// 上部バナーの患者データ（純粋関数）。
// エンジンの 1 呼吸ごとの実測値を、単位の換算と丸めだけで表示用にする。ここで計算し直さない。
import { lToMl, complianceToMl } from '../../../engine/units.js';
import { formatIE } from '../../../engine/breathMetrics.js';

const fmt = (x, digits) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(digits));
const lastWith = (breaths, key) => {
  for (let i = breaths.length - 1; i >= 0; i -= 1) if (breaths[i][key] != null) return breaths[i];
  return null;
};

// breaths：終わった呼吸の実測値（古い順）。summary：summarizeBreaths の結果。o2：設定値（%）
// 返り値：ページごとの項目の配列（1 ページ目 8 項目、2 ページ目 6 項目）
export function patientDataPages(breaths, summary, o2) {
  const b = breaths.at(-1) ?? null;
  const plat = lastWith(breaths, 'pplat');      // 吸気ポーズをした（またはプラトーのある）最後の呼吸
  const hold = lastWith(breaths, 'totalPeep');  // 呼気ポーズをした最後の呼吸
  const has = b != null;
  return [
    [
      { key: 'ppeak', label: 'Ppeak', unit: 'cmH2O', value: fmt(b?.pip, 1) },
      { key: 'pmean', label: 'Pmean', unit: 'cmH2O', value: fmt(b?.pmean, 1) },
      { key: 'peep', label: 'PEEP', unit: 'cmH2O', value: fmt(b?.peepSet, 1) },
      { key: 'ie', label: 'I:E', unit: '', value: formatIE(b?.ieRatio) },
      { key: 'ftot', label: 'ftot', unit: '/min', value: has ? fmt(summary.rrTotal, 0) : '—' },
      { key: 'vte', label: 'VTE', unit: 'mL', value: has ? fmt(lToMl(b.vte), 0) : '—' },
      { key: 'vetot', label: 'VE TOT', unit: 'L/min', value: has ? fmt(summary.mve, 1) : '—' },
      { key: 'o2', label: 'O2', unit: '%', value: fmt(o2, 0) }, // 設定値をそのまま表示（ガス交換は Phase 3）
    ],
    [
      { key: 'pplat', label: 'Pplat', unit: 'cmH2O', value: fmt(plat?.pplat, 1) },
      { key: 'cstat', label: 'Cstat', unit: 'mL/cmH2O', value: plat?.cstat != null ? fmt(complianceToMl(plat.cstat), 1) : '—' },
      { key: 'rstat', label: 'Rstat', unit: 'cmH2O/(L/s)', value: fmt(plat?.raw, 1) },
      { key: 'peeptot', label: 'total PEEP', unit: 'cmH2O', value: fmt(hold?.totalPeep, 1) },
      { key: 'peepi', label: 'auto-PEEP', unit: 'cmH2O', value: fmt(hold?.autoPeep, 1) },
      { key: 'vti', label: 'VTI', unit: 'mL', value: has ? fmt(lToMl(b.vti), 0) : '—' },
    ],
  ];
}
