// テスト用の共通部品
import { createState, run } from './simulator.js';

export const NORMAL = { c: 0.05, rInsp: 10, rExp: 10 }; // τ = 0.5 s

export function simulate(patient, settings, deviceId, seconds, effort = null) {
  return run(createState(patient, settings, deviceId), patient, settings, deviceId, effort, seconds);
}

// 相対誤差
export const relErr = (actual, expected) => Math.abs(actual - expected) / Math.abs(expected);

// ガス交換と循環の確認用のパラメータ（docs/PHASE3.md 8 の B の値）
export const GAS = {
  shunt: 0.05, vdAlvFraction: 0, vdAnat: 0.15, hb: 13, vo2: 250, vco2: 200, hco3: 24,
  coBase: 5, hrBase: 75, mapBase: 85, cvpBase: 8,
};
export const NORMAL_GAS = { ...NORMAL, gas: GAS };
