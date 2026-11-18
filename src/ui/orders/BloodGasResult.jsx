import { formatBloodGas } from '../../engine/bloodGas.js';
import { formatElapsed } from '../time/TimeControl.jsx';

// 血液ガスの結果。新しい順に 4 回分を横に並べ、前回との違いが分かるようにする
export default function BloodGasResult({ results, onClose }) {
  const shown = results.slice(-4).reverse();
  const columns = shown.map((r) => ({ r, items: formatBloodGas(r) }));
  const rows = columns[0]?.items ?? [];
  return (
    <div className="bga" role="dialog" aria-label="血液ガスの結果">
      <div className="bga-head">
        <h3>動脈血液ガス</h3>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>採血時刻</th>
            {columns.map((c, i) => <th key={c.r.t}>{formatElapsed(c.r.t)}{i === 0 ? '（最新）' : ''}</th>)}
          </tr>
          <tr className="bga-sub">
            <th>O2</th>
            {columns.map((c) => <td key={c.r.t}>{Math.round(c.r.fio2 * 100)} %</td>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((it, k) => (
            <tr key={it.key}>
              <th>{it.label}{it.unit ? <span className="bga-unit">{it.unit}</span> : null}</th>
              {columns.map((c, i) => <td key={c.r.t} data-latest={i === 0 || undefined}>{c.items[k].value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bga-note">採血した時刻の値です。結果が出るまでの待ち時間は入れていません。BE と Lac は教育用モデルの式です。</p>
    </div>
  );
}
