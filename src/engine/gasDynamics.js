// 時間とともに変わる状態（遅い状態）：O2 と CO2 の貯蔵。純粋関数。
// 1 呼吸が終わるたびに、その呼吸の換気で進める（simulator.js）。時間経過ボタンでは 1 分刻みで進める（clock.js）。
//
// gas（患者のパラメータ）= {
//   shunt シャント率（0〜1）, vdAlvFraction 肺胞死腔率（0〜1）, vdAnat 解剖学的死腔（L）,
//   hb（g/dL）, vo2 酸素消費量（mL/min）, vco2 二酸化炭素産生量（mL/min）, hco3（mEq/L）,
//   coBase 心拍出量の基準値（L/min）, hrBase, mapBase, cvpBase
// }
// slow（遅い状態）= { pAO2 肺胞気の PO2, paCO2, palvMean 肺胞圧の平均, lastN 最後に進めたステップ番号 }
import {
  GAS_CONSTANTS, alveolarPO2, arterialOxygen, etco2FromPaco2, phFromHco3,
} from './gasExchange.js';
import { cardiacOutput, heartRate, bloodPressure } from './circulation.js';

// model: 体内の CO2 の貯蔵の大きさ 50 mL/mmHg。
//        換気が止まると PaCO2 は 1 分あたり 二酸化炭素産生量 ÷ 50 = 4 mmHg 上がる。
//        換気を変えたあとの時定数は 0.863 × 50 ÷ VA 分（VA 4.2 L/min で約 10 分）
export const CO2_STORE = 50;
// model: 肺の中のガスの量 2.5 L。FiO2 や換気を変えたあと、PAO2 は時定数 2.5 ÷ VA 分（VA 4.2 L/min で約 36 秒）で変わる
export const LUNG_GAS_VOLUME = 2.5;
// model: 計算が壊れないようにする上限と下限
export const PACO2_MAX = 150;
export const PAO2_MIN = 10;
// model: 最初の PaCO2 は 40 mmHg とする（その後、いまの換気に合った値へ近づく）
export const PACO2_INITIAL = 40;
// model: 呼吸が 10 秒以上終わらないとき（無呼吸）は、換気 0 として 10 秒ごとに遅い状態を進める
export const APNEA_ADVANCE = 10;

const fio2Of = (fio2) => fio2 ?? 0.21;

export function initialSlowState(gas, settings, baselinePressure, n = 0) {
  return {
    paCO2: PACO2_INITIAL,
    pAO2: Math.max(PAO2_MIN, alveolarPO2(fio2Of(settings.fio2), PACO2_INITIAL)),
    palvMean: baselinePressure,
    lastN: n,
  };
}

// 1 呼吸で肺胞に届いた量（L）：（VTe − 解剖学的死腔）×（1 − 肺胞死腔率）
export function alveolarVolume(vte, gas) {
  return Math.max(0, vte - gas.vdAnat) * (1 - gas.vdAlvFraction);
}

// 遅い状態を dtSec 秒進める。その間に肺胞に届いた量が alvVolL（L）。
// その間の肺胞換気量 VA = alvVolL ÷ 時間 を一定として、微分方程式を解析的に解く（刻みが大きくても正しい）。
//   CO2：d(PaCO2)/dt =（二酸化炭素産生量 − VA × PaCO2 ÷ 0.863）÷ 貯蔵の大きさ
//   O2 ：PAO2 は、肺胞気式の値へ時定数（肺の中のガスの量 ÷ VA）で近づく
export function advanceSlowState(slow, { dtSec, alvVolL, palvMean }, gas, fio2) {
  if (!(dtSec > 0)) return { ...slow, palvMean };
  const dtMin = dtSec / 60;
  const va = alvVolL / dtMin; // L/min
  let { paCO2, pAO2 } = slow;
  if (va > 1e-9) {
    const steady = (GAS_CONSTANTS.co2Factor * gas.vco2) / va;
    const tau = (GAS_CONSTANTS.co2Factor * CO2_STORE) / va;
    paCO2 = steady + (paCO2 - steady) * Math.exp(-dtMin / tau);
  } else {
    paCO2 += (gas.vco2 / CO2_STORE) * dtMin;
  }
  paCO2 = Math.min(PACO2_MAX, paCO2);

  if (va > 1e-9) {
    const target = Math.max(PAO2_MIN, alveolarPO2(fio2Of(fio2), paCO2));
    pAO2 = target + (pAO2 - target) * Math.exp(-dtMin / (LUNG_GAS_VOLUME / va));
  } else {
    // 換気が止まっている間は、酸素消費の分だけ肺胞気の酸素が減る
    const fall = (gas.vo2 / (LUNG_GAS_VOLUME * 1000)) * (GAS_CONSTANTS.pAtm - GAS_CONSTANTS.pH2O) * dtMin;
    pAO2 = Math.max(PAO2_MIN, pAO2 - fall);
  }
  return { ...slow, paCO2, pAO2, palvMean };
}

// その換気が続いたときに落ち着く値（定常状態）
export function steadySlowState(vaLpm, gas, fio2) {
  const paCO2 = Math.min(PACO2_MAX, (GAS_CONSTANTS.co2Factor * gas.vco2) / vaLpm);
  return { paCO2, pAO2: Math.max(PAO2_MIN, alveolarPO2(fio2Of(fio2), paCO2)) };
}

// 遅い状態から、モニタや血液ガスに出す値を求める
export function deriveVitals(slow, gas) {
  const co = cardiacOutput(slow.palvMean, gas);
  const ox = arterialOxygen({ pAO2: slow.pAO2, shunt: gas.shunt, hb: gas.hb, vo2: gas.vo2, co });
  const hr = heartRate(ox.sao2, slow.paCO2, gas);
  const bp = bloodPressure(co, hr, slow.palvMean, gas);
  return {
    pAO2: slow.pAO2,
    paO2: ox.pao2,
    saO2: ox.sao2,
    spO2: ox.sao2, // 測定の誤差や遅れは入れない
    caO2: ox.ca,
    cvO2: ox.cv,
    ccO2: ox.cc,
    svO2: ox.svo2,
    paCO2: slow.paCO2,
    etCO2: etco2FromPaco2(slow.paCO2, gas.vdAlvFraction),
    ph: phFromHco3(gas.hco3, slow.paCO2),
    hco3: gas.hco3,
    co,
    hr,
    ...bp,
  };
}
