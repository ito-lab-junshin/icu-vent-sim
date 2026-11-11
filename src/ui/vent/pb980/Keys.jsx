// キー：吸気ポーズ、呼気ポーズ、用手換気、アラーム消音・リセット、ノブ、確定・取り消し
export default function Keys({ onInspPause, onExpPause, onManual, onSilence, onAlarmReset, silenced, knobLabel, onKnob, canConfirm, onConfirm, onCancel }) {
  return (
    <div className="pb-keys">
      <div className="pb-keygroup" role="group" aria-label="操作キー">
        <button type="button" onClick={onInspPause}>吸気ポーズ</button>
        <button type="button" onClick={onExpPause}>呼気ポーズ</button>
        <button type="button" onClick={onManual}>用手換気</button>
        <button type="button" aria-pressed={silenced} onClick={onSilence}>アラーム消音</button>
        <button type="button" onClick={onAlarmReset}>アラームリセット</button>
      </div>
      <div className="pb-keygroup pb-knob" role="group" aria-label="ノブ">
        <span className="pb-knob-label">{knobLabel ?? '設定を選ぶ'}</span>
        <button type="button" disabled={!knobLabel} onClick={() => onKnob(-1)} aria-label="値を下げる">−</button>
        <button type="button" disabled={!knobLabel} onClick={() => onKnob(+1)} aria-label="値を上げる">＋</button>
        <button type="button" className="pb-accept" disabled={!canConfirm} onClick={onConfirm}>確定</button>
        <button type="button" disabled={!canConfirm} onClick={onCancel}>取り消し</button>
      </div>
    </div>
  );
}
