import { describe, it, expect } from 'vitest';
import { NORMAL, NORMAL_GAS, GAS, simulate, relErr } from './testHelpers.js';
import { createState, run } from './simulator.js';
import { jump } from './clock.js';
import { alveolarPO2, paco2Steady } from './gasExchange.js';
import { advanceSlowState, deriveVitals, steadySlowState, alveolarVolume, CO2_STORE, LUNG_GAS_VOLUME } from './gasDynamics.js';

const vc = (over = {}) => ({ mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, fio2: 0.4, ...over });
const steadyState = (settings) => {
  const s0 = run(createState(NORMAL_GAS, settings, 'pb980'), NORMAL_GAS, settings, 'pb980', null, 30).state;
  return jump(s0, NORMAL_GAS, settings, 'pb980', null, 4 * 3600).state; // 十分に待つ
};

describe('gasDynamics（遅い状態）', () => {
  it('gas がなければ、ガス交換は計算しない（Phase 1 と同じ）', () => {
    expect(simulate(NORMAL, vc(), 'pb980', 10).state.slow).toBeNull();
  });

  it('1 呼吸ごとに遅い状態が進み、換気に合った PaCO2 に近づく', () => {
    const { state } = simulate(NORMAL_GAS, vc(), 'pb980', 60);
    expect(state.slow.paCO2).toBeGreaterThan(40); // 40 から、定常値 41.1 へ
    expect(state.slow.paCO2).toBeLessThan(41.2);
    expect(state.slow.palvMean).toBeGreaterThan(5);
  });

  // 受け入れ条件 11
  it('No.11 呼吸回数を 12 から 24 に変えると、PaCO2 が単調に下がり、新しい定常値に落ち着く', () => {
    let s = steadyState(vc());
    expect(relErr(s.slow.paCO2, 41.1)).toBeLessThan(0.02);
    const start = s.slow.paCO2;
    const fast = vc({ rr: 24 });
    // 新しい定常値：VTe ×  24 回で VA = 0.35 × 24 = 8.4 L/min → 0.863 × 200 ÷ 8.4 = 20.5 mmHg
    const target = paco2Steady(200, 8.4);
    let previous = start;
    let t95 = null;
    for (let minute = 1; minute <= 60; minute += 1) {
      s = jump(s, NORMAL_GAS, fast, 'pb980', null, 60).state;
      expect(s.slow.paCO2).toBeLessThan(previous);
      previous = s.slow.paCO2;
      if (t95 === null && (start - s.slow.paCO2) / (start - target) >= 0.95) t95 = minute;
    }
    expect(relErr(s.slow.paCO2, target)).toBeLessThan(0.02);
    // 時定数は 0.863 × 貯蔵の大きさ ÷ VA = 5.1 分。95 % まで近づくのは 3 倍の約 15 分
    expect(t95).toBeGreaterThanOrEqual(15);
    expect(t95).toBeLessThanOrEqual(17);
    expect((0.863 * CO2_STORE) / 8.4).toBeCloseTo(5.14, 2);
  });

  // 受け入れ条件 12
  it('No.12 FiO2 を 0.4 から 1.0 に変えると、PAO2 が単調に上がり、新しい定常値に落ち着く', () => {
    const s0 = steadyState(vc());
    expect(relErr(s0.slow.pAO2, alveolarPO2(0.4, s0.slow.paCO2))).toBeLessThan(0.02);
    const high = vc({ fio2: 1.0 });
    const start = s0.slow.pAO2;
    const target = alveolarPO2(1.0, s0.slow.paCO2);
    let s = s0;
    let previous = start;
    let t95 = null;
    for (let i = 1; i <= 60; i += 1) { // 5 秒ごとに 5 分間
      s = run(s, NORMAL_GAS, high, 'pb980', null, 5).state;
      expect(s.slow.pAO2).toBeGreaterThanOrEqual(previous);
      previous = s.slow.pAO2;
      if (t95 === null && (s.slow.pAO2 - start) / (target - start) >= 0.95) t95 = i * 5;
    }
    expect(relErr(s.slow.pAO2, target)).toBeLessThan(0.02);
    // 時定数は 肺の中のガスの量 ÷ VA = 2.5 ÷ 4.2 分 = 36 秒。95 % まで近づくのは約 107 秒（1 呼吸 5 秒ごとに進む）
    expect(t95).toBeGreaterThanOrEqual(100);
    expect(t95).toBeLessThanOrEqual(115);
    expect((LUNG_GAS_VOLUME / 4.2) * 60).toBeCloseTo(35.7, 1);
    expect(deriveVitals(s.slow, GAS).saO2).toBeGreaterThan(deriveVitals(s0.slow, GAS).saO2);
  });

  // 受け入れ条件 13
  it('No.13 PEEP を 5 から 15 に上げると、心拍出量と平均血圧が下がる', () => {
    const low = deriveVitals(steadyState(vc()).slow, GAS);
    const high = deriveVitals(steadyState(vc({ peep: 15 })).slow, GAS);
    expect(high.co).toBeLessThan(low.co);
    expect(high.map).toBeLessThan(low.map);
    expect(high.cvp).toBeGreaterThan(low.cvp);
    // 肺胞圧の平均が 10 cmH2O 上がるので、心拍出量は 5.0 L/min の 15 % ぶん下がる
    expect(low.co - high.co).toBeCloseTo(5 * 0.015 * 10, 2);
  });

  it('無呼吸：呼吸が終わらなくても遅い状態が進み、PaCO2 が 1 分あたり 4 mmHg 上がり、SpO2 が下がる', () => {
    const psv = { mode: 'PSV', ps: 10, etsPct: 25, riseTime: 0, peep: 5, fio2: 0.21 };
    const { state } = simulate(NORMAL_GAS, psv, 'pb980', 120.1, null);
    expect(state.breathCount).toBe(0);
    expect(state.slow.paCO2).toBeCloseTo(40 + (GAS.vco2 / CO2_STORE) * 2, 1);
    expect(deriveVitals(state.slow, GAS).spO2).toBeLessThan(0.6);
  });

  it('VT が死腔より小さいと PaCO2 が上がり続けるが、上限で止まる', () => {
    let slow = { paCO2: 40, pAO2: 100, palvMean: 5, lastN: 0 };
    for (let i = 0; i < 600; i += 1) slow = advanceSlowState(slow, { dtSec: 60, alvVolL: alveolarVolume(0.1, GAS), palvMean: 5 }, GAS, 0.21);
    expect(slow.paCO2).toBe(150);
    expect(Number.isFinite(deriveVitals(slow, GAS).ph)).toBe(true);
  });

  it('解析的に解いているので、刻みを変えても同じ値になる', () => {
    const start = { paCO2: 60, pAO2: 80, palvMean: 8, lastN: 0 };
    const once = advanceSlowState(start, { dtSec: 600, alvVolL: 42, palvMean: 8 }, GAS, 0.5);
    let many = start;
    for (let i = 0; i < 600; i += 1) many = advanceSlowState(many, { dtSec: 1, alvVolL: 0.07, palvMean: 8 }, GAS, 0.5);
    expect(many.paCO2).toBeCloseTo(once.paCO2, 6);
    expect(relErr(many.pAO2, once.pAO2)).toBeLessThan(0.02); // PAO2 は PaCO2 に引かれるので、刻みでわずかに違う
    expect(steadySlowState(4.2, GAS, 0.5).paCO2).toBeCloseTo(41.095, 2);
  });

  it('deriveVitals：初期値で、ふつうの値になる', () => {
    const v = deriveVitals({ paCO2: 40, pAO2: alveolarPO2(0.21, 40), palvMean: 5, lastN: 0 }, GAS);
    expect(v.spO2).toBeGreaterThan(0.95);
    expect(v.ph).toBeCloseTo(7.40, 2);
    expect(v.etCO2).toBe(40);
    expect(v.hr).toBe(75);
    expect(v.paO2).toBeLessThan(v.pAO2); // シャント 5 % のぶん、動脈血は肺胞気より低い
  });
});
