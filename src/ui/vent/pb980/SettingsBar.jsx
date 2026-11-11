import SettingTile from './SettingTile.jsx';
import Unverified from '../Unverified.jsx';

// 下部：左にモード表示と PBW、中央に主要設定、右にボタン
export default function SettingsBar({ modeName, modePending, pbw, keys, tileProps, panel, onPanel, layout, onLayout }) {
  return (
    <div className="pb-bar">
      <button type="button" className="pb-mode" data-pending={modePending || undefined} aria-pressed={panel === 'setup'} onClick={() => onPanel('setup')}>
        <span className="pb-mode-name">{modeName}</span>
        <span className="pb-mode-pbw">PBW {pbw.toFixed(1)} kg</span>
      </button>
      <div className="pb-tilegroup">
        <Unverified refKey="pb980SettingRanges" what="＊の設定の範囲・刻み・初期値" />
        <div className="pb-tiles" role="group" aria-label="主要設定">
          {keys.map((k) => <SettingTile key={k} id={k} {...tileProps(k)} />)}
        </div>
      </div>
      <div className="pb-icons">
        <button type="button" aria-pressed={panel === 'setup'} onClick={() => onPanel('setup')}>設定</button>
        <button type="button" aria-pressed={panel === 'alarm'} onClick={() => onPanel('alarm')}>アラーム</button>
        <button type="button" onClick={onLayout}>{layout === 'waves' ? 'ループ表示' : '波形 3 段'}</button>
      </div>
    </div>
  );
}
