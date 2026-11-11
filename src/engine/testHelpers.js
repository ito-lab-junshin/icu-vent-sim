// テスト用の共通部品
import { createState, run } from './simulator.js';

export const NORMAL = { c: 0.05, rInsp: 10, rExp: 10 }; // τ = 0.5 s

export function simulate(patient, settings, deviceId, seconds, effort = null) {
  return run(createState(patient, settings, deviceId), patient, settings, deviceId, effort, seconds);
}

// 相対誤差
export const relErr = (actual, expected) => Math.abs(actual - expected) / Math.abs(expected);
