// ベッドサイドモニタの波形の形（純粋関数）。数値（心拍数、血圧、EtCO2 など）から波形を作る。
// model: 波形の形はすべて教育用の模式図で、実際の生体信号を再現したものではない。不整脈は作らない。

const gauss = (x, center, width) => Math.exp(-(((x - center) / width) ** 2));
const wrap = (phase) => phase - Math.floor(phase);

// 拍の位相（0〜1）を dt 秒ぶん進める
export const advanceBeatPhase = (phase, hr, dt) => wrap(phase + (hr / 60) * dt);

// ECG（位相 0〜1 → 相対的な電位。R 波の頂点が 1）
export function ecgShape(phase) {
  const p = wrap(phase);
  return (
    0.12 * gauss(p, 0.10, 0.025) // P 波
    - 0.10 * gauss(p, 0.215, 0.008) // Q 波
    + 1.0 * gauss(p, 0.24, 0.012) // R 波
    - 0.22 * gauss(p, 0.265, 0.010) // S 波
    + 0.28 * gauss(p, 0.50, 0.055) // T 波
  );
}

// 動脈圧の形（位相 0〜1 → 0〜1。0 が拡張期、1 が収縮期）
export function arterialShape(phase) {
  const p = wrap(phase - 0.3); // 心電図の R 波より少し遅れて立ち上がる
  if (p < 0.12) return Math.sin((Math.PI / 2) * (p / 0.12));
  const x = (p - 0.12) / 0.88;
  const decay = (Math.exp(-x * 3) - Math.exp(-3)) / (1 - Math.exp(-3));
  return decay + 0.10 * gauss(p, 0.40, 0.035); // 重複切痕のあとの小さな山
}

// SpO2 の脈波（0〜1）。動脈圧よりなだらかで、さらに遅れる
export function plethShape(phase) {
  const p = wrap(phase - 0.42);
  if (p < 0.2) return Math.sin((Math.PI / 2) * (p / 0.2));
  const x = (p - 0.2) / 0.8;
  return (Math.exp(-x * 2.5) - Math.exp(-2.5)) / (1 - Math.exp(-2.5)) + 0.06 * gauss(p, 0.5, 0.06);
}

// カプノグラム。呼気で立ち上がって EtCO2 で平らになり、吸気で 0 に戻る
// model: 立ち上がりの時定数 0.12 秒、吸気では 0.1 秒で 0 に戻る
export function capnogram(phase, phaseTime, etco2) {
  const expiring = phase === 'exp' || phase === 'expHold';
  if (expiring) return etco2 * (1 - Math.exp(-phaseTime / 0.12));
  return etco2 * Math.max(0, 1 - phaseTime / 0.1);
}

// CVP。拍ごとの小さな波と、気道内圧に合わせたゆっくりした動き
// model: 拍ごとの振れ ±1.5 mmHg、気道内圧（呼気弁の圧との差）の 15 % が伝わる
export function cvpWave(beatPhase, cvpMean, pawAboveBaseline) {
  return cvpMean + 1.5 * Math.sin(2 * Math.PI * wrap(beatPhase)) + 0.15 * pawAboveBaseline;
}

// エンジンのサンプル 1 つ分から、モニタの 5 つの波形の値を作る
export function monitorValues(sample, beatPhase, vitals, baselinePressure) {
  return {
    t: sample.t,
    ecg: ecgShape(beatPhase),
    abp: vitals.dia + (vitals.sys - vitals.dia) * arterialShape(beatPhase),
    pleth: plethShape(beatPhase),
    co2: capnogram(sample.phase, sample.phaseTime, vitals.etCO2),
    cvp: cvpWave(beatPhase, vitals.cvp, sample.paw - baselinePressure),
  };
}

// 心拍数が一定のときの ECG を、dt 秒刻みで seconds 秒ぶん作る（テストと確認用）
export function ecgSeries(hr, seconds, dt) {
  const out = [];
  let phase = 0;
  for (let i = 0; i < Math.round(seconds / dt); i += 1) {
    phase = advanceBeatPhase(phase, hr, dt);
    out.push(ecgShape(phase));
  }
  return out;
}
