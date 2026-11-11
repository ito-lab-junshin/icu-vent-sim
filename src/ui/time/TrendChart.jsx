import { useEffect, useRef, useState } from 'react';
import { niceStep, prepareCanvas } from '../vent/WaveformCanvas.jsx';

// トレンドグラフ。1 分ごとの記録（sim.current.trend）を、項目ごとに 1 段ずつ描く。
// 設定を変えた時刻（sim.current.marks）に縦の点線を入れる。
// items = [{ key, label, color, min, max, digits }]

export const TREND_ITEMS = [
  { key: 'spO2', label: 'SpO2（%）', color: '#5bd0e6', min: 85, max: 100, digits: 0 },
  { key: 'etCO2', label: 'EtCO2（mmHg）', color: '#f2c14e', min: 20, max: 60, digits: 0 },
  { key: 'hr', label: '心拍数（/min）', color: '#5fd38d', min: 50, max: 120, digits: 0 },
  { key: 'map', label: '平均血圧（mmHg）', color: '#ff7a7a', min: 50, max: 110, digits: 0 },
  { key: 'ppeak', label: 'Ppeak（cmH2O）', color: '#d9a8ff', min: 0, max: 40, digits: 0 },
  { key: 'mve', label: 'VE TOT（L/min）', color: '#6cb6ff', min: 0, max: 12, digits: 1 },
];
export const TREND_ITEMS_BLOOD_GAS = [
  { key: 'paO2', label: 'PaO2（mmHg）', color: '#5bd0e6', min: 40, max: 200, digits: 0 },
  { key: 'paCO2', label: 'PaCO2（mmHg）', color: '#f2c14e', min: 20, max: 60, digits: 0 },
  { key: 'ph', label: 'pH', color: '#e8ecee', min: 7.2, max: 7.6, digits: 2 },
];

const RANGES = [
  { id: '30m', label: '30 分', seconds: 1800 },
  { id: '4h', label: '4 時間', seconds: 14400 },
  { id: 'all', label: '全体', seconds: null },
];

const timeLabel = (t) => {
  const m = Math.round(t / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m} 分`;
};

function draw(canvas, trend, marks, items, rangeSec, tNow) {
  const { ctx, w, h } = prepareCanvas(canvas, '#12171b');
  if (w === 0 || h === 0) return;
  ctx.font = '11px system-ui, sans-serif';
  const left = 34;
  const right = 6;
  const tMax = Math.max(tNow, 60);
  const tMin = rangeSec == null ? 0 : Math.max(0, tMax - rangeSec);
  const span = Math.max(60, tMax - tMin);
  const x = (t) => left + ((t - tMin) / span) * (w - left - right);
  const rowH = (h - 14) / items.length;
  const points = trend.filter((p) => p.t >= tMin);

  items.forEach((it, i) => {
    const top = i * rowH + 14;
    const bottom = (i + 1) * rowH - 3;
    let lo = it.min;
    let hi = it.max;
    for (const p of points) {
      const v = p[it.key];
      if (v == null) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const stp = niceStep(hi - lo);
    lo = Math.floor(lo / stp) * stp;
    hi = Math.ceil(hi / stp) * stp;
    const y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    ctx.strokeStyle = '#273038';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#9aa5ad';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const g of [lo, hi]) {
      ctx.beginPath();
      ctx.moveTo(left, y(g));
      ctx.lineTo(w - right, y(g));
      ctx.stroke();
      ctx.fillText(String(Math.round(g * 100) / 100), left - 4, y(g));
    }
    // 設定を変えた時刻
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#8a949b';
    for (const m of marks) {
      if (m < tMin) continue;
      ctx.beginPath();
      ctx.moveTo(x(m), top);
      ctx.lineTo(x(m), bottom);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const last = points.at(-1)?.[it.key];
    ctx.textAlign = 'left';
    ctx.fillStyle = it.color;
    ctx.fillText(`${it.label}${last == null ? '' : `　${last.toFixed(it.digits)}`}`, left + 2, top - 7);
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (const p of points) {
      const v = p[it.key];
      if (v == null) { started = false; continue; }
      if (started) ctx.lineTo(x(p.t), y(v));
      else { ctx.moveTo(x(p.t), y(v)); started = true; }
    }
    ctx.stroke();
    if (points.length === 1 && last != null) ctx.fillRect(x(points[0].t) - 1, y(last) - 1, 3, 3);
  });
  ctx.fillStyle = '#9aa5ad';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(timeLabel(tMin), left, h - 2);
  ctx.textAlign = 'right';
  ctx.fillText(timeLabel(tMax), w - right, h - 2);
}

export default function TrendChart({ api, items = TREND_ITEMS, className }) {
  const ref = useRef(null);
  const [range, setRange] = useState('30m');
  const { sim, trendVersion, status } = api;
  const minute = Math.floor(status.t / 60);
  useEffect(() => {
    if (!ref.current) return;
    const r = RANGES.find((x) => x.id === range);
    draw(ref.current, sim.current.trend, sim.current.marks, items, r.seconds, status.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendVersion, range, minute, items, sim]);
  return (
    <div className="trend">
      <div className="trend-head">
        <span>トレンド（点線：設定変更）</span>
        <span className="trend-range" role="group" aria-label="表示する時間の幅">
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </span>
      </div>
      <canvas ref={ref} className={className ?? 'trend-canvas'} role="img" aria-label="トレンドグラフ" />
    </div>
  );
}
