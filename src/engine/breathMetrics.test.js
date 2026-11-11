import { describe, it, expect } from 'vitest';
import { NORMAL, simulate } from './testHelpers.js';
import { summarizeBreaths } from './breathMetrics.js';

describe('breathMetrics', () => {
  const settings = { mode: 'VC-AC', rr: 15, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5 };
  const { breaths } = simulate(NORMAL, settings, 'pb980', 61);

  it('Ti、Te、I:E、Pmean', () => {
    const b = breaths[3];
    expect(b.ti).toBeCloseTo(1.0, 6);
    expect(b.te).toBeCloseTo(3.0, 6);
    expect(b.ieRatio).toBeCloseTo(3.0, 6);
    // Pmean の理論値：送気 0.5 秒（平均 20）＋ポーズ 0.5 秒（15）＋呼気 3 秒（5）を 4 秒で平均
    expect(b.pmean).toBeCloseTo((0.5 * 20 + 0.5 * 15 + 3 * 5) / 4, 1);
    expect(b.vte).toBeCloseTo(0.5, 2);
  });

  it('呼吸回数と分時換気量', () => {
    const s = summarizeBreaths(breaths);
    expect(s.rrTotal).toBeCloseTo(15, 6);
    expect(s.rrMandatory).toBeCloseTo(15, 6);
    expect(s.rrSpontaneous).toBe(0);
    expect(s.mve).toBeCloseTo(7.5, 1);
  });

  it('呼吸がないときは 0', () => expect(summarizeBreaths([]).rrTotal).toBe(0));
});
