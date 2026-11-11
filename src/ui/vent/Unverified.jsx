import { UNVERIFIED_LABEL, needsUnverifiedLabel } from '../../config/references.js';

// 「参考値（未確認）」の表示。refKey は src/config/references.js の項目名。
// その項目が verified になったら、自動で表示が消える。what は、どの値が未確認かの短い説明
export default function Unverified({ refKey, what }) {
  if (!needsUnverifiedLabel(refKey)) return null;
  return (
    <span className="unverified">
      <strong>{UNVERIFIED_LABEL}</strong>{what ? `：${what}` : ''}
    </span>
  );
}
