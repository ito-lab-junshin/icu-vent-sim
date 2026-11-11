import SettingTile from './SettingTile.jsx';
import Unverified from '../Unverified.jsx';

const KEYS = ['pPeak', 'mveLow', 'rrHigh', 'apnea'];

// アラームの設定。ここでの変更も保留になり、「確定」で反映する
export default function AlarmDialog({ tileProps, onClose }) {
  return (
    <div className="pb-panel" role="dialog" aria-label="アラームの設定">
      <div className="pb-panel-head">
        <h3>アラームの設定</h3>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>
      <div className="pb-tiles">
        {KEYS.map((k) => <SettingTile key={k} id={k} {...tileProps(k)} />)}
      </div>
      <p className="pb-panel-note"><Unverified refKey="pb980SettingRanges" what="＊の設定の範囲・刻み・初期値" /></p>
      <p className="pb-panel-note"><Unverified refKey="pb980Alarms" what="アラームの名称・優先度の色・消音の時間・リセットの動作（一般的な名称で、機種の表記ではない）" /></p>
      <p className="pb-panel-note"><Unverified refKey="pb980PeakAlarmTruncation" what="気道内圧上限に達すると、その吸気を打ち切る動作" /></p>
      <p className="pb-panel-note">VC+ の目標吸気圧は、気道内圧上限 − 3 cmH2O までです（確認済み）。音は出ません。</p>
    </div>
  );
}
