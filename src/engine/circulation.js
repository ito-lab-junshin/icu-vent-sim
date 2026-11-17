// 循環の簡略モデル（純粋関数）。係数はすべて教育用モデルの仮定で、伊藤先生の確認待ち（docs/PHASE3.md 8 の C）。
//
// 入力：palvMean 肺胞圧の平均（cmH2O）、sao2（0〜1）、paco2（mmHg）
//       base = { coBase, hrBase, mapBase, cvpBase }
//
// model: 基準値（coBase、hrBase、mapBase、cvpBase）は「陽圧をかけていない状態の値」と定義する（2026-11-17 伊藤先生決定）。
//        陽圧換気では静脈還流が減るので、ふつうの設定（PEEP 5 cmH2O）でも、心拍出量と血圧は基準値より少し低く出る
//        （例：VT 500 mL、f 12、PEEP 5 で肺胞圧の平均は約 7.5 cmH2O、心拍出量は基準値 5.0 に対して 4.81 L/min、平均血圧 82 mmHg）。
//        これは意図した動きで、基準の圧は上げない。
//
// palvMean の求め方（breathMetrics.js）：1 呼吸（吸気の始まりから次の吸気の始まりまで。ホールド中も含む）について、
//   弾性による肺胞圧 V ÷ C を 5 ms ごとに足して平均した値。PEEP と auto-PEEP と一回換気量による上昇を含み、
//   気道抵抗による圧と Pmus は含まない。人工呼吸器の Pmean（気道内圧の平均）や設定 PEEP とは別の値。
// 注意：いまの式は、肺胞圧の平均が CO_REFERENCE_PRESSURE（5 cmH2O）以下では低下を 0 としている。
//   つまり 0〜5 cmH2O の間は基準値のままで、5 cmH2O を超えた分だけ下がる。
//   また、肺のコンプライアンスや病態によらず、同じ肺胞圧なら同じだけ下がる（胸腔内圧への伝わり方の違いは入れていない）。
//   どちらも伊藤先生の確認待ち（2026-11-17 時点。値は変えていない）。

// model: 肺胞圧の平均が 5 cmH2O を超えた分、1 cmH2O あたり心拍出量を 1.5 % 下げる（静脈還流の低下）。下限は基準値の 40 %
export const CO_REFERENCE_PRESSURE = 5;
export const CO_DROP_PER_CMH2O = 0.015;
export const CO_MIN_FRACTION = 0.4;
// model: SaO2 が 94 % を下回った分、1 % あたり心拍数を 1.5 /min 上げる。PaCO2 が 45 mmHg を超えた分、1 mmHg あたり 0.5 /min 上げる。上限 160 /min
export const HR_SAO2_THRESHOLD = 0.94;
export const HR_PER_SAO2_PERCENT = 1.5;
export const HR_PACO2_THRESHOLD = 45;
export const HR_PER_PACO2 = 0.5;
export const HR_MAX = 160;
// model: CVP は、肺胞圧の平均が 5 cmH2O を超えた分、1 cmH2O あたり 0.3 mmHg 上がる（胸腔内圧の伝わり）
export const CVP_PER_CMH2O = 0.3;
// model: 脈圧の基準値 40 mmHg。1 回拍出量に比例して変わる
export const PULSE_PRESSURE_BASE = 40;

export function cardiacOutput(palvMean, base) {
  const excess = Math.max(0, palvMean - CO_REFERENCE_PRESSURE);
  return base.coBase * Math.max(CO_MIN_FRACTION, 1 - CO_DROP_PER_CMH2O * excess);
}

export function heartRate(sao2, paco2, base) {
  const hypoxia = Math.max(0, HR_SAO2_THRESHOLD - sao2) * 100 * HR_PER_SAO2_PERCENT;
  const hypercapnia = Math.max(0, paco2 - HR_PACO2_THRESHOLD) * HR_PER_PACO2;
  return Math.min(HR_MAX, base.hrBase + hypoxia + hypercapnia);
}

// 血圧：血管抵抗は一定とし、（平均血圧 − CVP）が心拍出量に比例する
export function bloodPressure(co, hr, palvMean, base) {
  const cvp = base.cvpBase + CVP_PER_CMH2O * Math.max(0, palvMean - CO_REFERENCE_PRESSURE);
  const map = base.cvpBase + (base.mapBase - base.cvpBase) * (co / base.coBase);
  const strokeRatio = (co / hr) / (base.coBase / base.hrBase);
  const pp = PULSE_PRESSURE_BASE * strokeRatio;
  return { map, sys: map + (2 / 3) * pp, dia: map - (1 / 3) * pp, cvp };
}
