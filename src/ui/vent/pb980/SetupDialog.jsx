import SettingTile from './SettingTile.jsx';
import Unverified from '../Unverified.jsx';

// 設定の流れ：性別と身長 → PBW → Mode → 換気の種類。ここでの変更も保留になり、「確定」で反映する。
export default function SetupDialog({ values, defs, pbw, onChoose, tileProps, onClose }) {
  const Choice = ({ id }) => (
    <div className="pb-choice" role="group" aria-label={defs[id].title}>
      {defs[id].options.map((o) => (o.unsupported ? (
        <button key={o.value} type="button" disabled title="エンジンにないモード">{o.label}（未対応）</button>
      ) : (
        <button key={o.value} type="button" aria-pressed={values[id] === o.value} onClick={() => onChoose(id, o.value)}>{o.label}</button>
      )))}
    </div>
  );
  return (
    <div className="pb-panel" role="dialog" aria-label="換気の設定">
      <div className="pb-panel-head">
        <h3>換気の設定</h3>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>
      <div className="pb-panel-grid">
        <div>
          <h4>1. 患者（性別と身長から PBW）</h4>
          <Choice id="sex" />
          <div className="pb-panel-row">
            <SettingTile id="height" {...tileProps('height')} />
            <p className="pb-pbw">PBW <strong>{pbw.toFixed(1)}</strong> kg</p>
          </div>
          <p className="pb-panel-note"><Unverified refKey="pb980SettingStepsInitials" what="身長の範囲・刻み・初期値" /></p>
        </div>
        <div>
          <h4>2. Mode</h4>
          <Choice id="mode" />
          {values.mode === 'AC' && (
            <>
              <h4>3. 強制換気の種類</h4>
              <Choice id="mandatoryType" />
            </>
          )}
          {values.mode === 'SPONT' && (
            <>
              <h4>3. 自発換気の種類</h4>
              <div className="pb-choice"><button type="button" aria-pressed>PS</button></div>
            </>
          )}
          {values.mode === 'BILEVEL' && <p className="pb-panel-note">TH と TL の設定で、APRV にも BIPAP にもなります。PH は PL + 5 cmH2O 以上に直されます。</p>}
        </div>
      </div>
      <p className="pb-panel-note">4. 下の主要設定を合わせてから「確定」を押すと、まとめて反映されます。モードは次の呼気中に切り替わります。</p>
    </div>
  );
}
