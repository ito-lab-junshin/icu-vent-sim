import { formatSetting } from '../ventSettings.js';
import { UNVERIFIED_LABEL, needsUnverifiedLabel } from '../../../config/references.js';

// 設定 1 つ分のボタン。押すと選択され、ノブ（上下の矢印キー、画面のノブ）で値を変えられる。
// 保留の値は色を変えて示す。Enter で確定、Esc で取り消し。
export default function SettingTile({ id, def, value, pending, selected, onSelect, onNudge, onConfirm, onCancel }) {
  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onSelect(id); onNudge(id, +1); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onSelect(id); onNudge(id, -1); }
    else if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
  // 設定範囲・刻み・初期値が未確認のあいだは、名前に「＊」を付け、説明にも書く（まとまりごとに「参考値（未確認）」の表示がある）
  const unverified = needsUnverifiedLabel('pb980SettingRanges');
  const mark = unverified ? `（${UNVERIFIED_LABEL}）` : '';
  return (
    <button
      type="button"
      className="pb-tile"
      data-pending={pending || undefined}
      data-selected={selected || undefined}
      aria-pressed={selected}
      title={`${def.title}${unverified && def.type === 'number' ? `　範囲 ${def.min}〜${def.max}${def.unit ? ` ${def.unit}` : ''}` : ''}${mark}`}
      aria-label={`${def.title} ${formatSetting(def, value)}${def.unit ? ` ${def.unit}` : ''}${pending ? '（保留）' : ''}${mark}`}
      onClick={() => onSelect(id)}
      onKeyDown={onKeyDown}
    >
      <span className="pb-tile-label">{def.label}{unverified ? '＊' : ''}</span>
      <span className="pb-tile-value">{formatSetting(def, value)}</span>
      <span className="pb-tile-unit">{def.unit || ' '}</span>
    </button>
  );
}
