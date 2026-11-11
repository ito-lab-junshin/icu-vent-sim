import { describe, it, expect } from 'vitest';
import { NORMAL, simulate } from '../testHelpers.js';

const settings = { mode: 'PSV', ps: 10, etsPct: 25, riseTime: 0, peep: 5, triggerFlow: 2 / 60 };
const effort = { pmusMax: 8, rate: 15, tiEffort: 0.8 };

describe('PSV／CPAP', () => {
  // 受け入れ条件 5
  it('No.5 PS 10、ETS 25 %、Pmus あり → 吸気の終わりの流量がピークの 25 %（1 ステップ以内）', () => {
    const { samples, breaths } = simulate(NORMAL, settings, 'pb980', 20, effort);
    expect(breaths.length).toBeGreaterThanOrEqual(3);
    // 各呼吸の吸気サンプルを取り出し、最後のサンプルで初めて 25 % 以下になったことを確かめる
    let insp = [];
    let checked = 0;
    for (const s of samples) {
      if (s.phase === 'insp') {
        insp.push(s);
      } else if (insp.length > 0) {
        const peak = Math.max(...insp.map((x) => x.flow));
        const last = insp.at(-1).flow;
        const before = insp.at(-2).flow;
        expect(last).toBeLessThanOrEqual(0.25 * peak);
        expect(before).toBeGreaterThan(0.25 * peak);
        insp = [];
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('患者トリガのみ：Pmus 0 では呼吸が始まらない', () => {
    const { breaths, samples } = simulate(NORMAL, settings, 'pb980', 10, null);
    expect(breaths.length).toBe(0);
    expect(samples.every((s) => s.phase === 'exp' && s.paw === 5)).toBe(true);
  });

  it('CPAP（PS 0）：気道内圧は PEEP のままで、自発呼吸の流量が出る', () => {
    const { breaths, samples } = simulate(NORMAL, { ...settings, mode: 'CPAP', ps: 0 }, 'pb980', 20, effort);
    expect(breaths.length).toBeGreaterThanOrEqual(3);
    expect(samples.every((s) => Math.abs(s.paw - 5) < 1e-9)).toBe(true);
    expect(breaths.every((b) => b.type === 'spontaneous' && b.vti > 0.1)).toBe(true);
  });
});
