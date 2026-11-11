import { useState } from 'react';

// 上部バナー：患者データ。1 ページ目 8 項目、左右の送りで追加の項目
export default function PatientDataBanner({ pages }) {
  const [page, setPage] = useState(0);
  const items = pages[page];
  const turn = (d) => setPage((p) => (p + d + pages.length) % pages.length);
  return (
    <div className="pb-banner" role="group" aria-label="患者データ">
      <button type="button" className="pb-page" onClick={() => turn(-1)} aria-label="前の項目">◀</button>
      <dl className="pb-data">
        {items.map((it) => (
          <div key={it.key} className="pb-datum">
            <dt>{it.label}</dt>
            <dd>
              <span className="pb-datum-value">{it.value}</span>
              <span className="pb-datum-unit">{it.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <button type="button" className="pb-page" onClick={() => turn(+1)} aria-label="次の項目">▶</button>
    </div>
  );
}
