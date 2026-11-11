import { describe, it, expect } from 'vitest';
import { NORMAL, simulate } from '../testHelpers.js';
import { DT } from '../units.js';

const settings = { mode: 'APRV', pHigh: 25, pLow: 5, tHigh: 4.0, tLow: 0.6, riseTime: 0 };

describe('APRV／BIPAP', () => {
  // 受け入れ条件 9
  it('No.9 Phigh 25、Plow 5、Thigh 4.0 s、Tlow 0.6 s → 圧が 2 レベルを時間どおりに切り替える', () => {
    const { samples, breaths } = simulate(NORMAL, settings, 'hamilton', 14);
    const cycle = Math.round(4.6 / DT);
    const high = Math.round(4.0 / DT);
    samples.forEach((s, i) => {
      expect(s.paw).toBe(i % cycle < high ? 25 : 5);
    });
    expect(breaths[0].ti).toBeCloseTo(4.0, 6);
    expect(breaths[0].te).toBeCloseTo(0.6, 6);
  });

  it('どちらの圧でも自発呼吸の流量が出て、数えられる', () => {
    const { breaths } = simulate(NORMAL, settings, 'hamilton', 30, { pmusMax: 6, rate: 20, tiEffort: 0.8 });
    expect(breaths.reduce((a, b) => a + b.spontCount, 0)).toBeGreaterThan(3);
  });

  it('pb980（BiLevel）：PH は PL + 5 以上に直される', () => {
    const { breaths } = simulate(NORMAL, { ...settings, pHigh: 7 }, 'pb980', 10);
    expect(breaths[0].pip).toBeCloseTo(10, 6);
    expect(breaths[0].settingAdjusted).toBe(true);
  });

  it('BIPAP は同じ計算を使う', () => {
    const a = simulate(NORMAL, settings, 'evita', 10);
    const b = simulate(NORMAL, { ...settings, mode: 'BIPAP' }, 'evita', 10);
    expect(b.samples).toEqual(a.samples);
  });
});
