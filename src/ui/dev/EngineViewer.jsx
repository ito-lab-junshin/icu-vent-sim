import { useMemo, useRef, useState } from 'react';
import { VENT_LAYOUTS, MODE_NAMES } from '../../config/ventLayouts.js';
import { UNVERIFIED_LABEL } from '../../config/references.js';
import Unverified from '../vent/Unverified.jsx';
import { DEFAULT_HOLD_TIME } from '../../engine/maneuvers.js';
import { summarizeBreaths, formatIE } from '../../engine/breathMetrics.js';
import { resolveDeviceLimits } from '../../engine/deviceRules.js';
import { lpmToLps, mlToL, lToMl, complianceToMl } from '../../engine/units.js';
import { useVentSimulation } from '../vent/useVentSimulation.js';
import WaveformCanvas, { TRACE_PAW, TRACE_FLOW, TRACE_VOLUME_FRC } from '../vent/WaveformCanvas.jsx';
import PatientPanel, { Slider, PATIENT_INITIAL, toEnginePatient } from './PatientPanel.jsx';

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
  ...PATIENT_INITIAL,
  // 設定
  mode: 'VC-AC', device: 'pb980',
  rr: 12, ti: 1.0, peep: 5, triggerFlow: 2,
  vt: 500, flow: 60, flowPattern: 'square',
  deltaP: 15, riseTime: 0,
  targetVt: 500,
  ps: 10, etsPct: 25,
  pHigh: 25, pLow: 5, tHigh: 4.0, tLow: 0.6,
  pPeakAlarm: 40, pLimit: 40, pawHighAlarm: 45,
  holdTime: DEFAULT_HOLD_TIME,
};

// 画面の値 → エンジンの内部単位
function toEngine(u) {
  return {
    ...toEnginePatient(u),
    settings: {
      mode: u.mode, rr: u.rr, ti: u.ti, peep: u.peep, triggerFlow: lpmToLps(u.triggerFlow),
      vt: mlToL(u.vt), flow: lpmToLps(u.flow), flowPattern: u.flowPattern,
      deltaP: u.deltaP, riseTime: u.riseTime,
      targetVt: mlToL(u.targetVt),
      ps: u.ps, etsPct: u.etsPct,
      pHigh: u.pHigh, pLow: u.pLow, tHigh: u.tHigh, tLow: u.tLow,
      pPeakAlarm: u.pPeakAlarm, pLimit: u.pLimit, pawHighAlarm: u.pawHighAlarm,
    },
  };
}

const fmt = (x, digits = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(digits));

const TRACES = [
  { ...TRACE_PAW, label: '圧 Paw（cmH2O）' },
  { ...TRACE_FLOW, label: '流量（L/min）' },
  { ...TRACE_VOLUME_FRC, label: '容量（mL、機能的残気量からの増分）' },
];

const TRIGGER_LABEL = { time: '時間', patient: '患者' };
const TYPE_LABEL = { mandatory: '強制', assisted: '補助', spontaneous: '自発' };

export default function EngineViewer() {
  const [u, setU] = useState(INITIAL);
  const inputsRef = useRef(null);
  inputsRef.current = { ...toEngine(u), deviceId: u.device };
  const { sim, breaths, status, running, setRunning, inspHold, expHold, reset } = useVentSimulation(inputsRef, WINDOW);
  const phase = status.phase;
  const set = (key) => (value) => setU((prev) => ({ ...prev, [key]: value }));

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
          <PatientPanel value={u} onChange={(next) => setU((prev) => ({ ...prev, ...next }))} />

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
            <p className="ev-note"><span className="unverified"><strong>{UNVERIFIED_LABEL}</strong>：このページのスライダーの範囲と初期値（アラーム上限・リミット圧を含む）。確認用に置いた値で、機種の既定値ではない</span></p>
            {u.device === 'pb980' && (
              <>
                <Slider label="PEAK アラーム上限" unit="cmH2O" value={u.pPeakAlarm} min={10} max={100} step={1} onChange={set('pPeakAlarm')} />
                <p className="ev-note">PB980 風：VC+（PRVC）の目標吸気圧は PEEP + {limits.prvcMinAbovePeep} cmH2O 以上、{limits.prvcMaxPressure} cmH2O 以下（PEAK アラーム上限 − 3）。BiLevel の PH は PL + {limits.bilevelMinDelta} cmH2O 以上。</p>
                <p className="ev-note"><Unverified refKey="pb980PeakAlarmTruncation" what="吸気中に PEAK アラーム上限に達すると、その吸気を打ち切る動作" /></p>
              </>
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
                <p className="ev-note">Evita V800 風：最大気道内圧は {limits.pressureCap} cmH2O（アラーム上限 − 5）。AutoFlow（PRVC）の最小吸気圧は、トリガなしで PEEP + {limits.prvcMinAbovePeep} cmH2O、患者トリガで PEEP + {limits.prvcMinAbovePeepTriggered} cmH2O。</p>
              </>
            )}
          </fieldset>
        </div>

        <div className="ev-main">
          <div className="ev-toolbar">
            <button type="button" onClick={() => inspHold(u.holdTime)}>吸気ホールド</button>
            <button type="button" onClick={() => expHold(u.holdTime)}>呼気ホールド</button>
            <Slider label="保持時間" unit="s" value={u.holdTime} min={0.5} max={3} step={0.5} onChange={set('holdTime')} />
            <button type="button" onClick={() => setRunning((r) => !r)}>{running ? '一時停止' : '再開'}</button>
            <button type="button" onClick={reset}>最初からやり直す</button>
          </div>
          <p className="ev-status" aria-live="polite">
            {phase === 'inspHold' && <span className="ev-flag">吸気ホールド中</span>}
            {phase === 'expHold' && <span className="ev-flag">呼気ホールド中</span>}
            {lastBreath?.highPressureTerminated && <span className="ev-flag ev-warn">気道内圧がアラーム上限に達し、吸気を打ち切りました（{UNVERIFIED_LABEL}）</span>}
            {lastBreath?.pressureLimited && <span className="ev-flag ev-warn">気道内圧が上限で制限されています（pressureLimited）</span>}
            {lastBreath?.minPressureApplied && <span className="ev-flag">吸気圧が機種の下限になっています</span>}
            {lastBreath?.settingAdjusted && <span className="ev-flag">PH を PL + 5 cmH2O に直しています</span>}
          </p>
          <WaveformCanvas sim={sim} traces={TRACES} windowSec={WINDOW} className="ev-canvas" label="圧・流量・容量の波形（10 秒分）" />

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
                    <td>{formatIE(b.ieRatio)}</td>
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
