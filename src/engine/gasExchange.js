// ガス交換：酸素化・換気・酸塩基（定常状態の式）。純粋関数。
// 式と定数は docs/PHASE3.md の 8 の A の表のもの。教育用モデルの式（status: 'model'）として
// src/config/references.js に登録してある。原典では未確認（伊藤先生の確認待ち）。
//
// 単位：ガス分圧 mmHg、酸素含量 mL/dL、心拍出量 L/min、酸素消費量・二酸化炭素産生量 mL/min、Hb g/dL、容量 L

// model: 以下の定数は呼吸生理学の教科書の標準的な値（references.js の physiology* を参照）
export const GAS_CONSTANTS = {
  pAtm: 760,          // 大気圧 mmHg
  pH2O: 47,           // 水蒸気圧 mmHg（37 ℃）
  rq: 0.8,            // 呼吸商
  o2Capacity: 1.34,   // Hb 1 g に結合する酸素 mL
  o2Solubility: 0.003, // 血漿に溶ける酸素 mL/dL/mmHg
  co2Factor: 0.863,   // 肺胞換気式の係数
  pK: 6.1,            // Henderson–Hasselbalch の式
  co2Solubility: 0.03, // mEq/L/mmHg
};
const K = GAS_CONSTANTS;

// 肺胞気式：PAO2 = FiO2 ×（大気圧 − 水蒸気圧）− PaCO2 ÷ 呼吸商
export function alveolarPO2(fio2, paco2) {
  return fio2 * (K.pAtm - K.pH2O) - paco2 / K.rq;
}

// 酸素解離曲線（Severinghaus の式）。返り値は 0〜1
export function so2FromPo2(po2) {
  if (!(po2 > 0)) return 0;
  return 1 / (1 + 23400 / (po2 ** 3 + 150 * po2));
}

// 単調に増える関数 f について、f(x) = target となる x を二分法で求める
function solveIncreasing(f, target, lo, hi) {
  if (target <= f(lo)) return lo;
  if (target >= f(hi)) return hi;
  let a = lo;
  let b = hi;
  for (let i = 0; i < 60; i += 1) {
    const m = (a + b) / 2;
    if (f(m) < target) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

// 酸素解離曲線を逆に解く：酸素飽和度（0〜1）→ PO2
export function po2FromSo2(so2) {
  return solveIncreasing(so2FromPo2, so2, 0, K.pAtm);
}

// 酸素含量：C = 1.34 × Hb × SO2 + 0.003 × PO2
export function o2Content(hb, so2, po2) {
  return K.o2Capacity * hb * so2 + K.o2Solubility * po2;
}
export const o2ContentAtPo2 = (hb, po2) => o2Content(hb, so2FromPo2(po2), po2);
// 酸素含量 → PO2
export const po2FromContent = (hb, content) => solveIncreasing((p) => o2ContentAtPo2(hb, p), content, 0, K.pAtm);

// 肺胞換気量（L/min）：VA =（VTe − 解剖学的死腔 − 肺胞死腔）× 呼吸回数。肺胞死腔 =（VTe − 解剖学的死腔）× 肺胞死腔率
export function alveolarVentilation({ vte, rr, vdAnat, vdAlvFraction }) {
  return Math.max(0, vte - vdAnat) * (1 - vdAlvFraction) * rr;
}

// 肺胞換気式：PaCO2 = 0.863 × 二酸化炭素産生量 ÷ VA（定常状態）
export const paco2Steady = (vco2, va) => (K.co2Factor * vco2) / va;

// EtCO2 = PaCO2 ×（1 − 肺胞死腔率）
export const etco2FromPaco2 = (paco2, vdAlvFraction) => paco2 * (1 - vdAlvFraction);

// Henderson–Hasselbalch の式：pH = 6.1 + log10（HCO3 ÷（0.03 × PaCO2））
export const phFromHco3 = (hco3, paco2) => K.pK + Math.log10(hco3 / (K.co2Solubility * paco2));

// 動脈血の酸素化。肺毛細血管終末の PO2 は PAO2 と等しいとする（拡散障害は入れない）。
//   Fick の関係   CvO2 = CaO2 − 酸素消費量 ÷（心拍出量 × 10）
//   シャントの式  CaO2 =（1 − シャント率）× Cc'O2 + シャント率 × CvO2
// 2 つの式を連立すると CaO2 = Cc'O2 − シャント率 ÷（1 − シャント率）× 酸素消費量 ÷（心拍出量 × 10）
export function arterialOxygen({ pAO2, shunt, hb, vo2, co }) {
  const s = Math.min(Math.max(shunt, 0), 0.95);
  const cc = o2ContentAtPo2(hb, pAO2);
  const avDiff = vo2 / (co * 10); // 動脈血と混合静脈血の酸素含量の差 mL/dL
  let ca = cc - (s / (1 - s)) * avDiff;
  let cv = ca - avDiff;
  if (cv < 0) {
    // 酸素の供給が消費に足りない設定。混合静脈血の酸素含量を 0 で止める（このとき Fick の関係は成り立たない）
    cv = 0;
    ca = (1 - s) * cc;
  }
  const pao2 = po2FromContent(hb, ca);
  const pvo2 = po2FromContent(hb, cv);
  return { cc, ca, cv, pao2, sao2: so2FromPo2(pao2), pvo2, svo2: so2FromPo2(pvo2) };
}
