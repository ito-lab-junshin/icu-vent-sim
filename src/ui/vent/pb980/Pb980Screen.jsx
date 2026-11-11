import { useEffect, useMemo, useRef, useState } from 'react';
import { PB980_SETTINGS } from '../../../config/ventLayouts.js';
import { predictedBodyWeight } from '../../../engine/patient.js';
import { summarizeBreaths } from '../../../engine/breathMetrics.js';
import { evaluateAlarms } from '../../../engine/alarms.js';
import { DEFAULT_HOLD_TIME } from '../../../engine/maneuvers.js';
import { useSimulation } from '../../SimulationContext.jsx';
import {
  currentValues, hasPending, isPending, changeSetting, nudgeSetting, confirmSettings, cancelSettings,
} from '../ventSettings.js';
import WaveformCanvas, { TRACE_PAW, TRACE_FLOW, TRACE_VOLUME_BREATH } from '../WaveformCanvas.jsx';
import LoopCanvas from '../LoopCanvas.jsx';
import PatientPanel from '../../dev/PatientPanel.jsx';
import { toEngineSettings, alarmLimits, modeDisplayName, settingKeysFor } from './settingsMap.js';
import { patientDataPages } from './patientData.js';
import PatientDataBanner from './PatientDataBanner.jsx';
import SettingsBar from './SettingsBar.jsx';
import SetupDialog from './SetupDialog.jsx';
import AlarmDialog from './AlarmDialog.jsx';
import Keys from './Keys.jsx';
import Unverified from '../Unverified.jsx';

// PB980 風の人工呼吸器の画面。画面構成（配置、波形の並び、操作の流れ）だけを参考にしており、
// ロゴ・アイコンの絵柄・商標デザインは再現していない。

const defs = PB980_SETTINGS.items;
const TRACES = [
  { ...TRACE_PAW, label: 'Pcirc（cmH2O）' },
  { ...TRACE_FLOW, label: 'V̇（L/min）' },
  { ...TRACE_VOLUME_BREATH, label: 'VT（mL）' },
];
const TRACES_WITH_LOOP = TRACES.slice(0, 2);

// model: アラーム消音の時間 120 秒（機種の値は取扱説明書で未確認。音は出ないので、表示だけに使う）
const ALARM_SILENCE_SEC = 120;

// settings、setSettings：PB980 風の設定（保留と確定）。画面を切り替えても消えないように、App が持つ
export default function Pb980Screen({ settings, setSettings }) {
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState(null); // null | 'setup' | 'alarm'
  const [layout, setLayout] = useState('waves'); // 'waves' | 'loops'
  const [silencedUntil, setSilencedUntil] = useState(null);
  const [resolved, setResolved] = useState([]); // 鳴ったあと解除されたアラーム（リセットで消す）

  const values = currentValues(settings);
  const confirmed = settings.confirmed;

  // エンジンには確定済みの設定だけを渡す（O2 も渡す）
  const { sim, breaths, status, inspHold, expHold, manualBreath, patient, setPatient, applySettings } = useSimulation();
  const engineSettings = useMemo(() => toEngineSettings(confirmed), [confirmed]);
  useEffect(() => {
    applySettings(engineSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineSettings]);

  const summary = useMemo(() => summarizeBreaths(breaths), [breaths]);
  const pages = useMemo(() => patientDataPages(breaths, summary, confirmed.o2), [breaths, summary, confirmed.o2]);
  const alarms = evaluateAlarms({
    limits: alarmLimits(confirmed),
    // いまの呼吸が打ち切られたら、その呼吸が終わるのを待たずにアラームを出す
    lastBreath: status.terminated ? { ...(breaths.at(-1) ?? {}), highPressureTerminated: true } : breaths.at(-1) ?? null,
    summary,
    timeSinceInspStart: status.t - status.lastInspStart,
  });
  const alarmIds = alarms.map((a) => a.id).join(',');
  const previousAlarms = useRef([]);
  useEffect(() => {
    const now = alarms.map((a) => a.id);
    const gone = previousAlarms.current.filter((a) => !now.includes(a.id));
    if (gone.length > 0) setResolved((r) => [...r.filter((x) => !gone.some((g) => g.id === x.id) && !now.includes(x.id)), ...gone]);
    else setResolved((r) => (r.some((x) => now.includes(x.id)) ? r.filter((x) => !now.includes(x.id)) : r));
    previousAlarms.current = alarms;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmIds]);

  const silenced = silencedUntil != null && status.t < silencedUntil;
  const silenceLeft = silenced ? Math.ceil(silencedUntil - status.t) : 0;

  const select = (key) => setSelected(key);
  const nudge = (key, d) => setSettings((s) => nudgeSetting(s, key, d, defs));
  const choose = (key, v) => setSettings((s) => changeSetting(s, key, v, defs));
  const confirm = () => { setSettings(confirmSettings); setSelected(null); };
  const cancel = () => { setSettings(cancelSettings); setSelected(null); };
  const tileProps = (key) => ({
    def: defs[key], value: values[key], pending: isPending(settings, key), selected: selected === key,
    onSelect: select, onNudge: nudge, onConfirm: confirm, onCancel: cancel,
  });

  const pbw = predictedBodyWeight(values.height, values.sex);
  const modePending = isPending(settings, 'mode') || isPending(settings, 'mandatoryType');
  const togglePanel = (name) => setPanel((p) => (p === name ? null : name));
  const top = alarms[0];

  return (
    <div className="pb" data-alarm={top && !silenced ? top.priority : undefined}>
      <div className="pb-alarmbar" role="status" aria-live="polite">
        {alarms.length === 0 && <span className="pb-alarm-none">アラームなし</span>}
        {alarms.map((a) => (
          <span key={a.id} className="pb-alarm" data-priority={a.priority}>{a.label}{a.detail ? `：${a.detail}` : ''}</span>
        ))}
        {resolved.map((a) => <span key={a.id} className="pb-alarm pb-alarm-resolved">{a.label}（解除済み）</span>)}
        {silenced && <span className="pb-silence">消音中 残り {silenceLeft} s</span>}
        {status.phase === 'inspHold' && <span className="pb-hold">吸気ポーズ中</span>}
        {status.phase === 'expHold' && <span className="pb-hold">呼気ポーズ中</span>}
        <span className="pb-alarmbar-note">
          <Unverified refKey="pb980Alarms" what="アラームの優先度と色・消音の時間" />
          {alarms.some((a) => a.id === 'highPressure') && <Unverified refKey="pb980PeakAlarmTruncation" what="吸気の打ち切り" />}
        </span>
      </div>

      <PatientDataBanner pages={pages} />

      <div className="pb-center">
        {layout === 'waves' ? (
          <WaveformCanvas sim={sim} traces={TRACES} className="pb-canvas" label="Pcirc・V̇・VT の波形（10 秒分）" />
        ) : (
          <div className="pb-split">
            <WaveformCanvas sim={sim} traces={TRACES_WITH_LOOP} className="pb-canvas" label="Pcirc・V̇ の波形（10 秒分）" />
            <LoopCanvas sim={sim} className="pb-canvas" />
          </div>
        )}
        {panel === 'setup' && (
          <SetupDialog values={values} defs={defs} pbw={pbw} onChoose={choose} tileProps={tileProps} onClose={() => setPanel(null)} />
        )}
        {panel === 'alarm' && <AlarmDialog tileProps={tileProps} onClose={() => setPanel(null)} />}
      </div>

      <SettingsBar
        modeName={modeDisplayName(values)} modePending={modePending} pbw={pbw}
        keys={settingKeysFor(values)} tileProps={tileProps}
        panel={panel} onPanel={togglePanel}
        layout={layout} onLayout={() => setLayout((l) => (l === 'waves' ? 'loops' : 'waves'))}
      />

      <Keys
        onInspPause={() => inspHold(DEFAULT_HOLD_TIME)}
        onExpPause={() => expHold(DEFAULT_HOLD_TIME)}
        onManual={manualBreath}
        silenced={silenced}
        onSilence={() => setSilencedUntil(silenced ? null : status.t + ALARM_SILENCE_SEC)}
        onAlarmReset={() => { setResolved([]); setSilencedUntil(null); }}
        knobLabel={selected ? defs[selected].label : null}
        onKnob={(d) => selected && nudge(selected, d)}
        canConfirm={hasPending(settings)} onConfirm={confirm} onCancel={cancel}
      />

      <p className="pb-note">
        「参考値（未確認）」の値は{PB980_SETTINGS.note}。PB980 の取扱説明書で確認できた項目から置き換えます。
      </p>

      <details className="pb-patient">
        <summary>患者の肺・自発呼吸・ガス交換を変える（確認用。シナリオは Phase 4）</summary>
        <div className="pb-patient-grid ev">
          <PatientPanel value={patient} onChange={setPatient} />
        </div>
      </details>
    </div>
  );
}
