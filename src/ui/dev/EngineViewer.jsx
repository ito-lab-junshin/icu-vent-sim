import { useEffect, useMemo, useRef, useState } from 'react';
import { VENT_LAYOUTS, MODE_NAMES } from '../../config/ventLayouts.js';
import { createState, step } from '../../engine/simulator.js';
import { requestInspHold, requestExpHold, DEFAULT_HOLD_TIME } from '../../engine/maneuvers.js';
import { summarizeBreaths } from '../../engine/breathMetrics.js';
import { resolveDeviceLimits } from '../../engine/deviceRules.js';
import { DT, lpmToLps, lpsToLpm, mlToL, lToMl, complianceFromMl, complianceToMl } from '../../engine/units.js';

// 開発確認用ページ。計算エンジン（src/engine）の結果を、機種の見た目なしで確かめる。
// ここの初期値とスライダーの範囲は確認用に置いたもので、機種の既定値やガイドライン値ではない。

const WINDOW = 10; // 波形の表示幅（秒）
const MODES = [
  { id: 'VC-AC', label: 'VC-AC' },
  { id: 'PC-AC', label: 'PC-AC' },
  { id: 'PRVC', label: 'PRVC' },
  { id: 'PSV', label: 'PSV／CPAP' },
  { id: 'APRV', label: 'APRV／BIPAP' },
];

// 画面の値（表示単位）
const INITIAL = {
  // 患者
  c: 50, rInsp: 10, rExp: 10, pmusMax: 0, effortRate: 15, tiEffort: 0.8,
  // 設定
  mode: 'VC-AC', device: 'pb980',
  rr: 12, ti: 1.0, peep: 5, triggerFlow: 2,
  vt: 500, flow: 60, flowPattern: 'square',
  deltaP: 15, riseTime: 0,
  targetVt: 500,
  ps: 10, etsPct: 25,
  pHigh: 25, pLow: 5, tHigh: 4.0, tLow: 0.6,
  pLimit: 40, pawHighAlarm: 45,
  holdTime: DEFAULT_HOLD_TIME,
};

// 画面の値 → エンジンの内部単位
function toEngine(u) {
  return {
    patient: { c: complianceFromMl(u.c), rInsp: u.rInsp, rExp: u.rExp },
    effort: u.pmusMax > 0 ? { pmusMax: u.pmusMax, rate: u.effortRate, tiEffort: u.tiEffort } : null,
    settings: {
      mode: u.mode, rr: u.rr, ti: u.ti, peep: u.peep, triggerFlow: lpmToLps(u.triggerFlow),
      vt: mlToL(u.vt), flow: lpmToLps(u.flow), flowPattern: u.flowPattern,
      deltaP: u.deltaP, riseTime: u.riseTime,
      targetVt: mlToL(u.targetVt),
      ps: u.ps, etsPct: u.etsPct,
      pHigh: u.pHigh, pLow: u.pLow, tHigh: u.tHigh, tLow: u.tLow,
      pLimit: u.pLimit, pawHighAlarm: u.pawHighAlarm,
    },
  };
}

function Slider({ label, unit, value, min, max, step: st, onChange }) {
  return (
    <label className="ev-slider">
      <span className="ev-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={st} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="ev-slider-value">{value}{unit ? ` ${unit}` : ''}</span>
    </label>
  );
}

const fmt = (x, digits = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(digits));

const TRACES = [
  { key: 'paw', label: '圧 Paw（cmH2O）', color: '#f2c14e', get: (s) => s.paw, min: 0, max: 40 },
  { key: 'flow', label: '流量（L/min）', color: '#5fd38d', get: (s) => lpsToLpm(s.flow), min: -60, max: 60 },
  { key: 'v', label: '容量（mL、機能的残気量からの増分）', color: '#6cb6ff', get: (s) => lToMl(s.v), min: 0, max: 800 },
];

function niceStep(range) {
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

function draw(canvas, samples, tNow) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#12171b';
  ctx.fillRect(0, 0, w, h);
  const left = 52;
  const right = 10;
  const plotW = w - left - right;
  const rowH = h / TRACES.length;
  const tMin = Math.max(0, tNow - WINDOW);
  const x = (t) => left + ((t - tMin) / WINDOW) * plotW;
  ctx.font = '12px system-ui, sans-serif';

  TRACES.forEach((tr, i) => {
    const top = i * rowH + 22;
    const bottom = (i + 1) * rowH - 16;
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

    // 目盛り
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
    // 時間の目盛り（1 秒ごと）
    ctx.strokeStyle = '#273038';
    for (let t = Math.ceil(tMin); t <= tMin + WINDOW; t += 1) {
      ctx.beginPath();
      ctx.moveTo(x(t), top);
      ctx.lineTo(x(t), bottom);
      ctx.stroke();
      if (i === TRACES.length - 1) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9aa5ad';
        ctx.fillText(`${t} s`, x(t), bottom + 9);
      }
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = tr.color;
    ctx.fillText(tr.label, left, i * rowH + 11);

    // 波形
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

const TRIGGER_LABEL = { time: '時間', patient: '患者' };
const TYPE_LABEL = { mandatory: '強制', assisted: '補助', spontaneous: '自発' };

export default function EngineViewer() {
  const [u, setU] = useState(INITIAL);
  const [breaths, setBreaths] = useState([]);
  const [running, setRunning] = useState(true);
  const [phase, setPhase] = useState('exp');
  const canvasRef = useRef(null);
  const uRef = useRef(u);
  uRef.current = u;
  const sim = useRef(null);
  if (sim.current === null) {
    const e = toEngine(INITIAL);
    sim.current = { state: createState(e.patient, e.settings, INITIAL.device), samples: [], breaths: [] };
  }
  const set = (key) => (value) => setU((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    const e = toEngine(uRef.current);
    sim.current = { state: createState(e.patient, e.settings, uRef.current.device), samples: [], breaths: [] };
    setBreaths([]);
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now) => {
      const elapsed = Math.min(0.1, (now - last) / 1000); // タブが裏に回っていた間は進めない
      last = now;
      const s = sim.current;
      if (running) {
        carry += elapsed;
        const e = toEngine(uRef.current);
        let changed = false;
        while (carry >= DT) {
          carry -= DT;
          const r = step(s.state, e.patient, e.settings, uRef.current.device, e.effort);
          s.state = r.state;
          s.samples.push(r.sample);
          if (r.breath) {
            s.breaths.push(r.breath);
            changed = true;
          }
        }
        const keep = Math.round(WINDOW / DT) + 1;
        if (s.samples.length > keep) s.samples.splice(0, s.samples.length - keep);
        if (s.breaths.length > 60) s.breaths.splice(0, s.breaths.length - 60);
        if (changed) setBreaths([...s.breaths]);
        setPhase(s.state.phase);
      }
      if (canvasRef.current) draw(canvasRef.current, s.samples, s.state.n * DT);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const limits = useMemo(() => resolveDeviceLimits(u.device, toEngine(u).settings), [u]);
  const summary = useMemo(() => summarizeBreaths(breaths), [breaths]);
  const lastBreath = breaths.at(-1);
  const recent = breaths.slice(-8).reverse();
  const deviceName = (id) => MODE_NAMES[id]?.[u.device]?.name;
  const ac = u.mode === 'VC-AC' || u.mode === 'PC-AC' || u.mode === 'PRVC';

  return (
    <div className="ev">
      <p className="ev-banner" role="note">開発確認用。機種の画面は Phase 2 以降</p>

      <div className="ev-layout">
        <div className="ev-controls">
          <fieldset>
            <legend>患者の肺</legend>
            <Slider label="コンプライアンス C" unit="mL/cmH2O" value={u.c} min={10} max={200} step={1} onChange={set('c')} />
            <Slider label="吸気抵抗 Rinsp" unit="cmH2O/(L/s)" value={u.rInsp} min={2} max={40} step={1} onChange={set('rInsp')} />
            <Slider label="呼気抵抗 Rexp" unit="cmH2O/(L/s)" value={u.rExp} min={2} max={40} step={1} onChange={set('rExp')} />
            <p className="ev-note">時定数 τ = Rexp × C = {fmt((u.rExp * u.c) / 1000, 2)} s</p>
          </fieldset>

          <fieldset>
            <legend>自発呼吸（呼吸筋圧 Pmus）</legend>
            <Slider label="振幅 Pmus" unit="cmH2O" value={u.pmusMax} min={0} max={20} step={1} onChange={set('pmusMax')} />
            <Slider label="自発呼吸回数" unit="/min" value={u.effortRate} min={5} max={40} step={1} onChange={set('effortRate')} />
            <Slider label="吸気努力の時間" unit="s" value={u.tiEffort} min={0.4} max={1.5} step={0.1} onChange={set('tiEffort')} />
            <p className="ev-note">振幅 0 は深い鎮静・筋弛緩の状態</p>
          </fieldset>

          <fieldset>
            <legend>モードと機種</legend>
            <div className="ev-buttons" role="group" aria-label="換気モード">
              {MODES.map((m) => (
                <button key={m.id} type="button" aria-pressed={u.mode === m.id} onClick={() => set('mode')(m.id)}>{m.label}</button>
              ))}
            </div>
            <div className="ev-buttons" role="group" aria-label="機種">
              {VENT_LAYOUTS.map((l) => (
                <button key={l.id} type="button" aria-pressed={u.device === l.id} onClick={() => set('device')(l.id)}>{l.label}</button>
              ))}
            </div>
            <p className="ev-note">
              この機種での名称：{deviceName(u.mode)}
              {u.mode === 'APRV' && deviceName('BIPAP') !== deviceName('APRV') ? `（BIPAP は ${deviceName('BIPAP')}）` : ''}
            </p>
          </fieldset>

          <fieldset>
            <legend>設定値</legend>
            {ac && <Slider label="呼吸回数 RR" unit="/min" value={u.rr} min={4} max={40} step={1} onChange={set('rr')} />}
            {ac && <Slider label="吸気時間 Ti" unit="s" value={u.ti} min={0.4} max={3} step={0.1} onChange={set('ti')} />}
            {u.mode !== 'APRV' && <Slider label="PEEP" unit="cmH2O" value={u.peep} min={0} max={24} step={1} onChange={set('peep')} />}
            {u.mode === 'VC-AC' && (
              <>
                <Slider label="一回換気量 VT" unit="mL" value={u.vt} min={200} max={1000} step={10} onChange={set('vt')} />
                <Slider label="最大流量" unit="L/min" value={u.flow} min={20} max={120} step={5} onChange={set('flow')} />
                <div className="ev-buttons" role="group" aria-label="流量波形">
                  <button type="button" aria-pressed={u.flowPattern === 'square'} onClick={() => set('flowPattern')('square')}>矩形波</button>
                  <button type="button" aria-pressed={u.flowPattern === 'ramp'} onClick={() => set('flowPattern')('ramp')}>漸減波</button>
                </div>
              </>
            )}
            {u.mode === 'PC-AC' && <Slider label="吸気圧 ΔP（PEEP 上）" unit="cmH2O" value={u.deltaP} min={3} max={40} step={1} onChange={set('deltaP')} />}
            {u.mode === 'PRVC' && <Slider label="目標 VT" unit="mL" value={u.targetVt} min={200} max={1000} step={10} onChange={set('targetVt')} />}
            {u.mode === 'PSV' && (
              <>
                <Slider label="PS（0 で CPAP）" unit="cmH2O" value={u.ps} min={0} max={30} step={1} onChange={set('ps')} />
                <Slider label="ETS" unit="%" value={u.etsPct} min={5} max={70} step={5} onChange={set('etsPct')} />
              </>
            )}
            {u.mode === 'APRV' && (
              <>
                <Slider label="Phigh" unit="cmH2O" value={u.pHigh} min={5} max={40} step={1} onChange={set('pHigh')} />
                <Slider label="Plow" unit="cmH2O" value={u.pLow} min={0} max={20} step={1} onChange={set('pLow')} />
                <Slider label="Thigh" unit="s" value={u.tHigh} min={0.5} max={8} step={0.1} onChange={set('tHigh')} />
                <Slider label="Tlow" unit="s" value={u.tLow} min={0.2} max={4} step={0.1} onChange={set('tLow')} />
              </>
            )}
            {u.mode !== 'VC-AC' && <Slider label="立ち上がり時間" unit="s" value={u.riseTime} min={0} max={0.5} step={0.05} onChange={set('riseTime')} />}
            {u.mode !== 'APRV' && <Slider label="フロートリガ" unit="L/min" value={u.triggerFlow} min={0.5} max={10} step={0.5} onChange={set('triggerFlow')} />}
          </fieldset>

          <fieldset>
            <legend>機種ごとの圧の上限ルール</legend>
            {u.device === 'pb980' && (
              <p className="ev-note">PB980 風：VC+（PRVC）の目標吸気圧は PEEP + {limits.prvcMinAbovePeep} cmH2O を下回らない。BiLevel の PH は PL + {limits.bilevelMinDelta} cmH2O 以上。</p>
            )}
            {u.device === 'hamilton' && (
              <>
                <Slider label="リミット圧" unit="cmH2O" value={u.pLimit} min={10} max={60} step={1} onChange={set('pLimit')} />
                <p className="ev-note">Hamilton C6 風：供給圧の上限 {limits.pressureCap} cmH2O、アラーム上限 {limits.alarmUpper} cmH2O（リミット圧 + 10）。APVcmv（PRVC）の最小吸気圧は PEEP + {limits.prvcMinAbovePeep} cmH2O。</p>
              </>
            )}
            {u.device === 'evita' && (
              <>
                <Slider label="アラーム上限 Paw high" unit="cmH2O" value={u.pawHighAlarm} min={15} max={65} step={1} onChange={set('pawHighAlarm')} />
                <p className="ev-note">Evita V800 風：最大気道内圧は {limits.pressureCap} cmH2O（アラーム上限 − 5）。</p>
              </>
            )}
          </fieldset>
        </div>

        <div className="ev-main">
          <div className="ev-toolbar">
            <button type="button" onClick={() => { sim.current.state = requestInspHold(sim.current.state, u.holdTime); }}>吸気ホールド</button>
            <button type="button" onClick={() => { sim.current.state = requestExpHold(sim.current.state, u.holdTime); }}>呼気ホールド</button>
            <Slider label="保持時間" unit="s" value={u.holdTime} min={0.5} max={3} step={0.5} onChange={set('holdTime')} />
            <button type="button" onClick={() => setRunning((r) => !r)}>{running ? '一時停止' : '再開'}</button>
            <button type="button" onClick={reset}>最初からやり直す</button>
          </div>
          <p className="ev-status" aria-live="polite">
            {phase === 'inspHold' && <span className="ev-flag">吸気ホールド中</span>}
            {phase === 'expHold' && <span className="ev-flag">呼気ホールド中</span>}
            {lastBreath?.pressureLimited && <span className="ev-flag ev-warn">気道内圧が上限で制限されています（pressureLimited）</span>}
            {lastBreath?.minPressureApplied && <span className="ev-flag">吸気圧が機種の下限になっています</span>}
            {lastBreath?.settingAdjusted && <span className="ev-flag">PH を PL + 5 cmH2O に直しています</span>}
          </p>
          <canvas ref={canvasRef} className="ev-canvas" aria-label="圧・流量・容量の波形（10 秒分）" />

          <h2>直近 1 分のまとめ</h2>
          <p className="ev-summary">
            呼吸回数 {fmt(summary.rrTotal, 1)} /min（強制 {fmt(summary.rrMandatory, 1)}、自発 {fmt(summary.rrSpontaneous, 1)}）　分時換気量 MVe {fmt(summary.mve, 2)} L/min
          </p>

          <h2>1 呼吸ごとの実測値（新しい順）</h2>
          <div className="ev-table-wrap">
            <table className="ev-table">
              <thead>
                <tr>
                  <th>No.</th><th>種類</th><th>開始</th>
                  <th>PIP</th><th>Pplat</th><th>Pmean</th><th>設定 PEEP</th><th>total PEEP</th><th>auto-PEEP</th>
                  <th>VTi</th><th>VTe</th><th>Ti</th><th>Te</th><th>I:E</th>
                  <th>Cstat</th><th>Raw</th><th>ΔP</th>
                </tr>
                <tr className="ev-units">
                  <th></th><th></th><th></th>
                  <th>cmH2O</th><th>cmH2O</th><th>cmH2O</th><th>cmH2O</th><th>cmH2O</th><th>cmH2O</th>
                  <th>mL</th><th>mL</th><th>s</th><th>s</th><th></th>
                  <th>mL/cmH2O</th><th>cmH2O/(L/s)</th><th>cmH2O</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={17}>まだ呼吸が終わっていません{u.mode === 'PSV' && u.pmusMax === 0 ? '（PSV／CPAP は患者トリガのみ。Pmus を上げてください）' : ''}</td></tr>
                )}
                {recent.map((b) => (
                  <tr key={b.index} className={b.pressureLimited ? 'ev-limited' : undefined}>
                    <td>{b.index + 1}</td>
                    <td>{TYPE_LABEL[b.type]}</td>
                    <td>{TRIGGER_LABEL[b.trigger]}</td>
                    <td>{fmt(b.pip)}</td><td>{fmt(b.pplat)}</td><td>{fmt(b.pmean)}</td><td>{fmt(b.peepSet)}</td>
                    <td>{fmt(b.totalPeep)}</td><td>{fmt(b.autoPeep)}</td>
                    <td>{fmt(lToMl(b.vti), 0)}</td><td>{fmt(lToMl(b.vte), 0)}</td>
                    <td>{fmt(b.ti, 2)}</td><td>{fmt(b.te, 2)}</td>
                    <td>{b.ieRatio == null ? '—' : `1:${fmt(b.ieRatio, 1)}`}</td>
                    <td>{fmt(b.cstat == null ? null : complianceToMl(b.cstat))}</td><td>{fmt(b.raw)}</td><td>{fmt(b.drivingPressure)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ev-note">
            Pplat は吸気ポーズまたは吸気ホールドがある呼吸のみ。total PEEP と auto-PEEP は呼気ホールドをした呼吸のみ。
            Raw は流量一定の VC のときのみ。「—」は測定していない値。
          </p>
        </div>
      </div>
    </div>
  );
}
