import { describe, it, expect } from 'vitest';
import { NORMAL } from './testHelpers.js';
import { createState, run } from './simulator.js';
import { requestInspHold, requestExpHold, isHolding } from './maneuvers.js';

describe('maneuvers', () => {
  const settings = { mode: 'PC-AC', rr: 10, deltaP: 15, ti: 1.0, riseTime: 0, peep: 5 };

  it('吸気ホールド：流量 0 で保ち、Pplat = 吸気終末の容量 ÷ C', () => {
    const s0 = requestInspHold(createState(NORMAL, settings, 'pb980'), 0.5);
    const { samples, breaths } = run(s0, NORMAL, settings, 'pb980', null, 14);
    const hold = samples.filter((s) => s.phase === 'inspHold');
    expect(hold.length).toBe(100);
    expect(hold.every((s) => s.flow === 0)).toBe(true);
    const vEnd = 5 * 0.05 + 0.05 * 15 * (1 - Math.exp(-2));
    expect(breaths[0].pplat).toBeCloseTo(vEnd / 0.05, 5);
    expect(breaths[0].cstat * 1000).toBeCloseTo(50, 3);
    expect(breaths[0].drivingPressure).toBeCloseTo(15 * (1 - Math.exp(-2)), 5);
    expect(breaths[1].pplat).toBeNull(); // 予約は 1 回だけ
  });

  it('呼気ホールド：呼気が十分なら total PEEP = 設定 PEEP（auto-PEEP 0）', () => {
    const first = run(createState(NORMAL, settings, 'pb980'), NORMAL, settings, 'pb980', null, 3);
    const { breaths, samples } = run(requestExpHold(first.state, 1.0), NORMAL, settings, 'pb980', null, 6);
    expect(samples.some((s) => s.phase === 'expHold')).toBe(true);
    expect(breaths[0].totalPeep).toBeCloseTo(5, 2);
    expect(breaths[0].autoPeep).toBeCloseTo(0, 2);
  });

  it('isHolding', () => {
    expect(isHolding({ phase: 'inspHold' })).toBe(true);
    expect(isHolding({ phase: 'exp' })).toBe(false);
  });
});
