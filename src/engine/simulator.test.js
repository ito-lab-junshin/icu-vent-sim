import { describe, it, expect } from 'vitest';
import { NORMAL, simulate } from './testHelpers.js';
import { createState, step, canonicalMode } from './simulator.js';

const effort = { pmusMax: 6, rate: 18, tiEffort: 0.8 };
const cases = [
  { mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5 },
  { mode: 'PC-AC', rr: 12, deltaP: 15, ti: 1.0, riseTime: 0.1, peep: 5 },
  { mode: 'PRVC', rr: 12, targetVt: 0.5, ti: 1.0, riseTime: 0, peep: 5, pLimit: 30 },
  { mode: 'PSV', ps: 10, etsPct: 25, riseTime: 0.1, peep: 5 },
  { mode: 'APRV', pHigh: 25, pLow: 5, tHigh: 4.0, tLow: 0.6, riseTime: 0 },
];

describe('simulator', () => {
  // 受け入れ条件 10
  it('No.10 同じ入力で 2 回計算すると、出力が完全に一致する（5 モード）', () => {
    for (const settings of cases) {
      const a = simulate(NORMAL, settings, 'hamilton', 30, effort);
      const b = simulate(NORMAL, settings, 'hamilton', 30, effort);
      expect(b.samples, settings.mode).toEqual(a.samples);
      expect(b.breaths, settings.mode).toEqual(a.breaths);
      expect(b.state, settings.mode).toEqual(a.state);
    }
  });

  it('step は受け取った状態を書き換えない（純粋関数）', () => {
    const settings = cases[0];
    const s0 = createState(NORMAL, settings, 'pb980');
    const frozen = Object.freeze({ ...s0 });
    const r = step(frozen, NORMAL, settings, 'pb980', null);
    expect(frozen).toEqual(s0);
    expect(r.state.n).toBe(1);
  });

  it('モードの切り替えは呼気中に行われる', () => {
    let s = createState(NORMAL, cases[0], 'pb980');
    for (let i = 0; i < 50; i += 1) s = step(s, NORMAL, cases[0], 'pb980', null).state; // 吸気の途中
    s = step(s, NORMAL, cases[1], 'pb980', null).state;
    expect(s.modeId).toBe('VC-AC');
    for (let i = 0; i < 400; i += 1) s = step(s, NORMAL, cases[1], 'pb980', null).state;
    expect(s.modeId).toBe('PC-AC');
  });

  it('モード ID：CPAP は PSV、BIPAP は APRV。未知の ID はエラー', () => {
    expect(canonicalMode('CPAP')).toBe('PSV');
    expect(canonicalMode('BIPAP')).toBe('APRV');
    expect(() => canonicalMode('XYZ')).toThrow();
  });
});
