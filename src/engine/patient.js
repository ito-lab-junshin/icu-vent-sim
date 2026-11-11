// 予測体重（PBW）: ARDS Network の式
// 男性 50 + 0.91 ×（身長 cm − 152.4）、女性 45.5 + 0.91 ×（身長 cm − 152.4）
export function predictedBodyWeight(heightCm, sex) {
  const base = sex === 'female' ? 45.5 : 50;
  return Math.round((base + 0.91 * (heightCm - 152.4)) * 10) / 10;
}
