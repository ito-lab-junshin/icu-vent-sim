import { useEffect, useRef } from 'react';
import { lpsToLpm, lToMl } from '../../engine/units.js';
import { niceStep, prepareCanvas } from './WaveformCanvas.jsx';

// ループの描画（3 機種で共用）。
//   P-V ループ：横軸 圧（cmH2O）、縦軸 容量（mL、呼吸の始まりから）
//   F-V ループ：横軸 容量（mL）、縦軸 流量（L/min）
// 直近に終わった 1 呼吸を薄く、いまの呼吸を濃く描く。

const LOOPS = [
  { key: 'pv', label: 'P-V ループ', xLabel: '圧（cmH2O）', yLabel: '容量（mL）', color: '#f2c14e',
    x: (s) => s.paw, y: (s) => lToMl(s.vBreath), xMin: 0, xMax: 40, yMin: 0, yMax: 600 },
  { key: 'fv', label: 'F-V ループ', xLabel: '容量（mL）', yLabel: '流量（L/min）', color: '#5fd38d',
    x: (s) => lToMl(s.vBreath), y: (s) => lpsToLpm(s.flow), xMin: 0, xMax: 600, yMin: -60, yMax: 60 },
];

function range(values, lo, hi) {
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const stp = niceStep(hi - lo);
  return { lo: Math.floor(lo / stp) * stp, hi: Math.ceil(hi / stp) * stp, stp };
}

function draw(canvas, sim) {
  const { ctx, w, h } = prepareCanvas(canvas, '#12171b');
  if (w === 0 || h === 0) return;
  const { samples, breaths, state } = sim;
  const prevStart = breaths.at(-1)?.tStart ?? Infinity;
  const curStart = state.breath?.tStart ?? Infinity;
  const previous = samples.filter((s) => s.t > prevStart && s.t <= curStart);
  const current = samples.filter((s) => s.t > curStart);
  const rowH = h / LOOPS.length;

  LOOPS.forEach((lp, i) => {
    const left = 46;
    const right = 10;
    const top = i * rowH + 20;
    const bottom = (i + 1) * rowH - 26;
    const all = [...previous, ...current];
    const xr = range(all.map(lp.x), lp.xMin, lp.xMax);
    const yr = range(all.map(lp.y), lp.yMin, lp.yMax);
    const x = (v) => left + ((v - xr.lo) / (xr.hi - xr.lo)) * (w - left - right);
    const y = (v) => bottom - ((v - yr.lo) / (yr.hi - yr.lo)) * (bottom - top);

    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let g = yr.lo; g <= yr.hi + 1e-9; g += yr.stp) {
      ctx.strokeStyle = Math.abs(g) < 1e-9 ? '#5b666e' : '#273038';
      ctx.beginPath();
      ctx.moveTo(left, y(g));
      ctx.lineTo(w - right, y(g));
      ctx.stroke();
      ctx.fillStyle = '#9aa5ad';
      ctx.fillText(String(Math.round(g)), left - 6, y(g));
    }
    ctx.textAlign = 'center';
    for (let g = xr.lo; g <= xr.hi + 1e-9; g += xr.stp) {
      ctx.strokeStyle = '#273038';
      ctx.beginPath();
      ctx.moveTo(x(g), top);
      ctx.lineTo(x(g), bottom);
      ctx.stroke();
      ctx.fillStyle = '#9aa5ad';
      ctx.fillText(String(Math.round(g)), x(g), bottom + 8);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = lp.color;
    ctx.fillText(`${lp.label}　縦：${lp.yLabel}`, left, i * rowH + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9aa5ad';
    ctx.fillText(`横：${lp.xLabel}`, w - right, bottom + 20);

    const stroke = (points, alpha, width) => {
      if (points.length < 2) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = lp.color;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach((s, k) => (k === 0 ? ctx.moveTo(x(lp.x(s)), y(lp.y(s))) : ctx.lineTo(x(lp.x(s)), y(lp.y(s)))));
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    stroke(previous, 0.4, 1.2);
    stroke(current, 1, 1.8);
  });
}

export default function LoopCanvas({ sim, className }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) draw(ref.current, sim.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);
  return <canvas ref={ref} className={className} role="img" aria-label="P-V ループと F-V ループ" />;
}
