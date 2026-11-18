// 3 区画の肺（Phase 4A）。純粋関数。
// 肺を 3 つの区画の割合で表す（合計 1）。
//   正常区画            含気がある肺。換気も血流もある
//   リクルート可能区画  虚脱しているが開く肺。開いている割合 o（0〜1）を持つ。開いている分だけ換気される。血流はある
//   非リクルート区画    浸潤・硬化した肺。換気されないが血流はある（シャント）
//
// lung = {
//   cFull          肺全体が含気したときのコンプライアンス（L/cmH2O）
//   fNormal, fRecruitable, fNon   3 区画の割合（合計 1）
//   o0             最初に開いている割合
//   shuntBase      区画によらないシャント率（解剖学的シャントなど）
//   vdAlvBase      過膨張がないときの肺胞死腔率
//   recruitment    リクルートの値（recruitment.js）
// }
// 呼吸メカニクスは Phase 1 の 1 区画の式のまま使い、ここで求めたコンプライアンスを 1 呼吸ごとに渡す（docs/PHASE4.md 8 の B）。

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// model: 虚脱した肺・浸潤した肺への血流は、含気している肺の 0.7 倍とする（低酸素性肺血管収縮で血流が減る効果を 1 つの係数で表した）
export const PERFUSION_WEIGHT_COLLAPSED = 0.7;

// model: 過膨張。吸気終末の肺胞圧が高いほど、なだらかに進む（シグモイド。ガイドラインの上限値を境目にしたものではない）。
//        半分まで進む圧 35 cmH2O、曲線の幅 6 cmH2O。いちばん進んだとき、コンプライアンスが 50 % 下がり、肺胞死腔率が 0.2 上がる
export const OVERDISTENSION = { pHalf: 35, width: 6, complianceLoss: 0.5, deadSpaceGain: 0.2 };

// model: シャント率と肺胞死腔率の上限（計算が壊れないようにする）
export const SHUNT_MAX = 0.95;
export const DEAD_SPACE_MAX = 0.9;

// 含気している割合 = 正常区画 + リクルート可能区画 × o
export function aeratedFraction(lung, o) {
  return lung.fNormal + lung.fRecruitable * o;
}

// 過膨張の進み具合（0〜1）
export function overdistension(pEndInsp) {
  return sigmoid((pEndInsp - OVERDISTENSION.pHalf) / OVERDISTENSION.width);
}

// コンプライアンス = 肺全体が含気したときの C × 含気している割合 × 過膨張による低下
export function effectiveCompliance(lung, o, pEndInsp) {
  return lung.cFull * aeratedFraction(lung, o) * (1 - OVERDISTENSION.complianceLoss * overdistension(pEndInsp));
}

// シャント率 = 区画によらない分 +（非リクルート区画 + リクルート可能区画 ×（1 − o））× 血流の配分の係数
export function shuntFraction(lung, o, weight = PERFUSION_WEIGHT_COLLAPSED) {
  return Math.min(SHUNT_MAX, (lung.shuntBase ?? 0) + (lung.fNon + lung.fRecruitable * (1 - o)) * weight);
}

// 肺胞死腔率 = 過膨張がないときの値 + 過膨張による上昇
export function deadSpaceFraction(lung, pEndInsp) {
  return Math.min(DEAD_SPACE_MAX, (lung.vdAlvBase ?? 0) + OVERDISTENSION.deadSpaceGain * overdistension(pEndInsp));
}

// 開いている割合と吸気終末の肺胞圧から、呼吸メカニクスとガス交換に渡す値をまとめる
export function lungState(lung, o, pEndInsp) {
  return {
    cEff: effectiveCompliance(lung, o, pEndInsp),
    shunt: shuntFraction(lung, o),
    vdAlv: deadSpaceFraction(lung, pEndInsp),
  };
}
