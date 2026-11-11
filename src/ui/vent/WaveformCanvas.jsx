import { useEffect, useRef } from 'react';
import { DT, lpsToLpm, lToMl } from '../../engine/units.js';

// 波形の描画（3 機種で共用）。時間軸をそろえた複数段を、スクロール表示する。
// traces = [{ key, label, color, get(sample), min, max }]

export const TRACE_PAW = { key: 'paw', color: '#f2c14e', get: (s) => s.paw, min: 0, max: 40 };
export const TRACE_FLOW = { key: 'flow', color: '#5fd38d', get: (s) => lpsToLpm(s.flow), min: -60, max: 60 };
// 機能的残気量からの増分（確認用ページ）
export const TRACE_VOLUME_FRC = { key: 'v', color: '#6cb6ff', get: (s) => lToMl(s.v), min: 0, max: 800 };
// 呼吸の始まりからの容量（人工呼吸器の画面）
export const TRACE_VOLUME_BREATH = { key: 'vBreath', color: '#6cb6ff', get: (s) => lToMl(s.vBreath), min: 0, max: 600 };

export function niceStep(range) {
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

// キャンバスの大きさを表示の大きさに合わせ、描画用の ctx と幅・高さを返す
export function prepareCanvas(canvas, background) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  ctx.font = '12px system-ui, sans-serif';
  return { ctx, w, h };
}

function draw(canvas, samples, tNow, traces, windowSec) {
  const { ctx, w, h } = prepareCanvas(canvas, '#12171b');
  if (w === 0 || h === 0) return;
  const left = 46;
  const right = 8;
  const plotW = w - left - right;
  const rowH = h / traces.length;
  const tMin = Math.max(0, tNow - windowSec);
  const x = (t) => left + ((t - tMin) / windowSec) * plotW;

  traces.forEach((tr, i) => {
    const top = i * rowH + 20;
    const bottom = (i + 1) * rowH - 14;
    let lo = tr.min;
    let hi = tr.max;
    for (const s of samples) {
      const y = tr.get(s);
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    const stp = niceStep(hi - lo);
    lo = Math.floor(lo / stp) * stp;
    hi = Math.ceil(hi / stp) * stp;
    const y = (val) => bottom - ((val - lo) / (hi - lo)) * (bottom - top);

    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = lo; g <= hi + 1e-9; g += stp) {
      ctx.strokeStyle = Math.abs(g) < 1e-9 ? '#5b666e' : '#273038';
      ctx.beginPath();
      ctx.moveTo(left, y(g));
      ctx.lineTo(w - right, y(g));
      ctx.stroke();
      ctx.fillStyle = '#9aa5ad';
      ctx.fillText(String(Math.round(g * 10) / 10), left - 6, y(g));
    }
    ctx.strokeStyle = '#273038';
    for (let t = Math.ceil(tMin); t <= tMin + windowSec; t += 1) {
      ctx.beginPath();
      ctx.moveTo(x(t), top);
      ctx.lineTo(x(t), bottom);
      ctx.stroke();
      if (i === traces.length - 1) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9aa5ad';
        ctx.fillText(`${t} s`, x(t), bottom + 8);
      }
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = tr.color;
    ctx.fillText(tr.label, left, i * rowH + 10);

    ctx.strokeStyle = tr.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    for (const s of samples) {
      if (s.t < tMin) continue;
      const px = x(s.t);
      const py = y(tr.get(s));
      if (started) ctx.lineTo(px, py);
      else {
        ctx.moveTo(px, py);
        started = true;
      }
    }
    ctx.stroke();
  });
}

export default function WaveformCanvas({ sim, traces, windowSec = 10, className, label }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) draw(ref.current, sim.current.samples, sim.current.state.n * DT, traces, windowSec);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim, traces, windowSec]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}
