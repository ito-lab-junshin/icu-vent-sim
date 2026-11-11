import { describe, it, expect } from 'vitest';
import { NORMAL, simulate, relErr } from '../testHelpers.js';
import { DT } from '../units.js';

const settings = { mode: 'PC-AC', rr: 10, deltaP: 15, ti: 1.0, riseTime: 0, peep: 5 }; // Te = 5 s = 10τ

describe('PC-AC', () => {
  // 受け入れ条件 2
  it('No.2 ΔP 15、Ti 1.0 s、τ 0.5 s → VTi = 0.05 × 15 ×（1 − e^−2）= 0.6485 L', () => {
    const b = simulate(NORMAL, settings, 'pb980', 7).breaths[0];
    const theory = 0.05 * 15 * (1 - Math.exp(-2));
    expect(theory).toBeCloseTo(0.6485, 4);
    expect(relErr(b.vti, theory)).toBeLessThan(0.02);
    expect(b.pip).toBeCloseTo(20, 6);
    expect(b.pplat).toBeNull(); // 吸気ポーズも吸気ホールドもない呼吸では Pplat を出さない
  });

  // 受け入れ条件 3（呼気終末の基準 PEEP × C からの増分で照合する）
  it('No.3 呼気の容量が V(t) = V0 × e^(−t/τ) に従う（3 点）', () => {
    const { samples } = simulate(NORMAL, settings, 'pb980', 7);
    const base = settings.peep * NORMAL.c;
    const endInsp = Math.round(1.0 / DT) - 1; // 吸気の最後のサンプル
    const v0 = samples[endInsp].v - base;
    for (const t of [0.25, 0.5, 1.5]) {
      const actual = samples[endInsp + Math.round(t / DT)].v - base;
      expect(relErr(actual, v0 * Math.exp(-t / 0.5))).toBeLessThan(0.02);
    }
  });

  it('立ち上がり時間を付けると VTi が減る', () => {
    const fast = simulate(NORMAL, settings, 'pb980', 7).breaths[0];
    const slow = simulate(NORMAL, { ...settings, riseTime: 0.4 }, 'pb980', 7).breaths[0];
    expect(slow.vti).toBeLessThan(fast.vti);
  });

  it('evita：最大気道内圧はアラーム上限 − 5 で頭打ち', () => {
    const r = simulate(NORMAL, { ...settings, pawHighAlarm: 20 }, 'evita', 7);
    expect(r.breaths[0].pip).toBeCloseTo(15, 6);
    expect(r.breaths[0].pressureLimited).toBe(true);
  });
});
