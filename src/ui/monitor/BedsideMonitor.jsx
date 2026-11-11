import { useEffect, useMemo, useRef, useState } from 'react';
import { advanceBeatPhase, monitorValues } from '../../engine/monitorWaves.js';
import { deriveVitals } from '../../engine/gasDynamics.js';
import { summarizeBreaths } from '../../engine/breathMetrics.js';
import { MODES } from '../../engine/simulator.js';
import { DT } from '../../engine/units.js';
import { prepareCanvas } from '../vent/WaveformCanvas.jsx';

// ベッドサイドモニタ。人工呼吸器の画面と同じエンジンの状態を表示する。
// 特定の機種の画面には似せていない。波形の形は教育用の模式図。

const WINDOW = 10;
const ROWS = [
  { key: 'ecg', color: '#5fd38d', min: -0.4, max: 1.2 },
  { key: 'abp', color: '#ff7a7a', min: 40, max: 160 },
  { key: 'pleth', color: '#5bd0e6', min: -0.1, max: 1.2 },
  { key: 'co2', color: '#f2c14e', min: 0, max: 60 },
  { key: 'cvp', color: '#b9c4ff', min: 0, max: 20 },
];

// model: アラームの初期値。確認用に置いた値で、推奨値でも機種の既定値でもない（docs/PHASE3.md 8 の F）
const LIMITS_INITIAL = { spo2Low: 90, hrLow: 50, hrHigh: 120, mapLow: 65, etco2Low: 30, etco2High: 50 };
const LIMIT_FIELDS = [
  { key: 'spo2Low', label: 'SpO2 下限', unit: '%', min: 50, max: 100 },
  { key: 'hrLow', label: '心拍数 下限', unit: '/min', min: 20, max: 100 },
  { key: 'hrHigh', label: '心拍数 上限', unit: '/min', min: 60, max: 200 },
  { key: 'mapLow', label: '平均血圧 下限', unit: 'mmHg', min: 30, max: 100 },
  { key: 'etco2Low', label: 'EtCO2 下限', unit: 'mmHg', min: 0, max: 50 },
  { key: 'etco2High', label: 'EtCO2 上限', unit: 'mmHg', min: 30, max: 100 },
];

function draw(canvas, buf, tNow) {
  const { ctx, w, h } = prepareCanvas(canvas, '#000');
  if (w === 0 || h === 0) return;
  const tMin = Math.max(0, tNow - WINDOW);
  const x = (t) => ((t - tMin) / WINDOW) * w;
  const rowH = h / ROWS.length;
  const stride = Math.max(1, Math.floor(buf.length / (w * 2))); // 点が多いときは間引く
  ROWS.forEach((row, i) => {
    let lo = row.min;
    let hi = row.max;
    for (let k = 0; k < buf.length; k += stride) {
      const v = buf[k][row.key];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const top = i * rowH + 4;
    const bottom = (i + 1) * rowH - 4;
    const y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    ctx.strokeStyle = '#1c2227';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, (i + 1) * rowH);
    ctx.lineTo(w, (i + 1) * rowH);
    ctx.stroke();
    ctx.strokeStyle = row.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let started = false;
    for (let k = 0; k < buf.length; k += stride) {
      const p = buf[k];
      if (p.t < tMin) continue;
      if (started) ctx.lineTo(x(p.t), y(p[row.key]));
      else { ctx.moveTo(x(p.t), y(p[row.key])); started = true; }
    }
    ctx.stroke();
  });
}

export default function BedsideMonitor({ api }) {
  const { sim, status, breaths, settings, patientGas } = api;
  const canvasRef = useRef(null);
  const live = useRef({ lastT: -1, beatPhase: 0, buf: [] });
  const inputs = useRef(null);
  inputs.current = { settings, patientGas };
  const [limits, setLimits] = useState(LIMITS_INITIAL);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { state, samples } = sim.current;
      const L = live.current;
      const gas = inputs.current.patientGas;
      // 時間経過ボタンや「やり直す」で波形が消えたときは、モニタの波形も消す
      if (samples.length === 0 || samples[0].t > L.lastT + 1 || samples.at(-1).t < L.lastT) {
        L.buf = [];
        L.lastT = samples.length > 0 ? samples[0].t - DT : state.n * DT;
      }
      if (gas && state.slow && samples.length > 0) {
        const vitals = deriveVitals(state.slow, gas);
        const baseline = MODES[state.modeId].baselinePressure(inputs.current.settings);
        let k = samples.length - 1;
        while (k > 0 && samples[k - 1].t > L.lastT) k -= 1;
        for (; k < samples.length; k += 1) {
          const s = samples[k];
          if (s.t <= L.lastT) continue;
          L.beatPhase = advanceBeatPhase(L.beatPhase, vitals.hr, DT);
          L.buf.push(monitorValues(s, L.beatPhase, vitals, baseline));
          L.lastT = s.t;
        }
        const keep = Math.round(WINDOW / DT) + 1;
        if (L.buf.length > keep) L.buf.splice(0, L.buf.length - keep);
      }
      if (canvasRef.current) draw(canvasRef.current, L.buf, state.n * DT);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  const v = status.vitals;
  const rr = useMemo(() => summarizeBreaths(breaths).rrTotal, [breaths]);
  const out = (value, lo, hi) => value != null && ((lo != null && value < lo) || (hi != null && value > hi));
  const n = (x, d = 0) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
  const spo2 = v ? v.spO2 * 100 : null;
  const tiles = [
    { key: 'hr', label: '心拍数', unit: '/min', color: ROWS[0].color, value: n(v?.hr), alarm: out(v?.hr, limits.hrLow, limits.hrHigh) },
    { key: 'abp', label: '動脈圧', unit: 'mmHg', color: ROWS[1].color, value: v ? `${n(v.sys)}/${n(v.dia)}` : '—', sub: v ? `（${n(v.map)}）` : '', alarm: out(v?.map, limits.mapLow, null) },
    { key: 'spo2', label: 'SpO2', unit: '%', color: ROWS[2].color, value: n(spo2), alarm: out(spo2, limits.spo2Low, null) },
    { key: 'etco2', label: 'EtCO2', unit: 'mmHg', color: ROWS[3].color, value: n(v?.etCO2), sub: `呼吸回数 ${breaths.length > 0 ? n(rr) : '—'}`, alarm: out(v?.etCO2, limits.etco2Low, limits.etco2High) },
    { key: 'cvp', label: 'CVP', unit: 'mmHg', color: ROWS[4].color, value: n(v?.cvp), alarm: false },
  ];

  return (
    <div className="mon">
      <div className="mon-body">
        <canvas ref={canvasRef} className="mon-canvas" role="img" aria-label="ECG、動脈圧、SpO2 の脈波、カプノグラム、CVP の波形（10 秒分）" />
        <dl className="mon-values">
          {tiles.map((t) => (
            <div key={t.key} className="mon-value" data-alarm={t.alarm || undefined} style={{ color: t.color }}>
              <dt>{t.label}<span className="mon-unit">{t.unit}</span></dt>
              <dd>{t.value}{t.sub ? <span className="mon-sub">{t.sub}</span> : null}</dd>
            </div>
          ))}
        </dl>
      </div>
      <details className="mon-limits">
        <summary>モニタのアラームの設定（確認用の値）</summary>
        <div className="mon-limit-grid">
          {LIMIT_FIELDS.map((f) => (
            <label key={f.key}>
              <span>{f.label}（{f.unit}）</span>
              <input
                type="number" min={f.min} max={f.max} value={limits[f.key]}
                onChange={(e) => setLimits((l) => ({ ...l, [f.key]: Math.min(f.max, Math.max(f.min, Number(e.target.value))) }))}
              />
            </label>
          ))}
        </div>
        <p className="mon-note">初期値は確認用に置いた値で、推奨値でも機種の既定値でもありません。範囲を外れた数値は、色を反転して表示します。</p>
      </details>
    </div>
  );
}
