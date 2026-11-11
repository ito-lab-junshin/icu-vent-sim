import SettingTile from './SettingTile.jsx';

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
      <p className="pb-panel-note">
        気道内圧上限に達すると、その吸気を打ち切ります（参考値・未確認）。VC+ の目標吸気圧は、気道内圧上限 − 3 cmH2O までです。
        アラームの名称は一般的なもので、機種の表記ではありません。音は出ません。
      </p>
    </div>
  );
}
