import { describe, it, expect } from 'vitest';
import { pmusAt } from './patientEffort.js';

describe('patientEffort', () => {
  const effort = { pmusMax: 8, rate: 15, tiEffort: 0.8 }; // 周期 4 秒
  it('振幅 0 や effort なしは 0（深い鎮静・筋弛緩）', () => {
    expect(pmusAt(0.4, null)).toBe(0);
    expect(pmusAt(0.4, { pmusMax: 0, rate: 15 })).toBe(0);
  });
  it('半正弦波：努力時間の中央で最大', () => {
    expect(pmusAt(0, effort)).toBeCloseTo(0, 10);
    expect(pmusAt(0.4, effort)).toBeCloseTo(8, 10);
    expect(pmusAt(0.2, effort)).toBeCloseTo(8 * Math.sin(Math.PI / 4), 10);
  });
  it('努力のあとは休止し、周期ごとにくり返す', () => {
    expect(pmusAt(1.5, effort)).toBe(0);
    expect(pmusAt(4.4, effort)).toBeCloseTo(8, 10);
  });
});
