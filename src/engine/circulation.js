// 循環の簡略モデル（純粋関数）。係数はすべて教育用モデルの仮定で、伊藤先生の確認待ち（docs/PHASE3.md 8 の C）。
//
// 入力：palvMean 肺胞圧の平均（cmH2O。平均気道内圧と auto-PEEP を反映する）、sao2（0〜1）、paco2（mmHg）
//       base = { coBase, hrBase, mapBase, cvpBase }

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
