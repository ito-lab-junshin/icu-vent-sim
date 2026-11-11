// Phase 2 でエンジンに足した機能のテスト（docs/PHASE2.md の受け入れ条件 8、9、10、13）
import { describe, it, expect } from 'vitest';
import { NORMAL, simulate, relErr } from './testHelpers.js';
import { createState, run, step } from './simulator.js';
import { requestManualBreath } from './maneuvers.js';

const STIFF = { c: 0.02, rInsp: 10, rExp: 10 };

describe('PEAK アラーム上限での吸気の打ち切り（pb980）', () => {
  // 受け入れ条件 8：Paw = PEEP + 入った量 ÷ C + R × 流量 = 5 + V ÷ 0.02 + 10 × 1 が 30 になるのは V = 0.3 L
  it('No.8 VC-AC、流量 1 L/s、VT 0.6 L、C 0.02、PEAK アラーム上限 30 → 0.3 L で吸気が終わる', () => {
    const settings = { mode: 'VC-AC', rr: 12, vt: 0.6, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, pPeakAlarm: 30 };
    const { breaths, samples } = simulate(STIFF, settings, 'pb980', 11);
    const b = breaths[0];
    expect(relErr(b.vti, 0.3)).toBeLessThan(0.02);
    expect(b.highPressureTerminated).toBe(true);
    expect(b.ti).toBeLessThan(0.32);
    expect(Math.max(...samples.map((s) => s.paw))).toBeLessThanOrEqual(30 + 0.2); // 1 ステップ分の行き過ぎまで
  });

  // 受け入れ条件 9
  it('No.9 同じ肺で VC+（PRVC）→ 目標吸気圧は 27 を超えず、打ち切りは起きない', () => {
    const settings = { mode: 'PRVC', rr: 12, targetVt: 0.6, ti: 1.0, riseTime: 0, peep: 5, pPeakAlarm: 30 };
    const { breaths } = simulate(STIFF, settings, 'pb980', 60);
    expect(breaths.every((b) => b.pip <= 27 + 1e-9)).toBe(true);
    expect(breaths.every((b) => !b.highPressureTerminated)).toBe(true);
    expect(breaths.at(-1).pip).toBeCloseTo(27, 6);
    expect(breaths.at(-1).pressureLimited).toBe(true);
  });

  it('上限に届かない設定では打ち切らない。hamilton と evita にはこのルールがない', () => {
    const settings = { mode: 'VC-AC', rr: 12, vt: 0.6, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, pPeakAlarm: 30 };
    expect(simulate(NORMAL, settings, 'pb980', 11).breaths[0].highPressureTerminated).toBe(false);
    expect(simulate(STIFF, settings, 'hamilton', 11).breaths[0].highPressureTerminated).toBe(false);
    expect(simulate(STIFF, settings, 'evita', 11).breaths[0].highPressureTerminated).toBe(false);
  });
});

describe('用手換気', () => {
  const settings = { mode: 'VC-AC', rr: 6, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5 };

  // 受け入れ条件 10
  it('No.10 呼気中に予約すると、次のステップで強制換気が 1 回始まる', () => {
    const first = run(createState(NORMAL, settings, 'pb980'), NORMAL, settings, 'pb980', null, 4); // 周期 10 秒の 4 秒目（呼気中）
    expect(first.state.phase).toBe('exp');
    const r = step(requestManualBreath(first.state), NORMAL, settings, 'pb980', null);
    expect(r.state.phase).toBe('insp');
    expect(r.state.pendingManualBreath).toBe(false);
    const after = run(r.state, NORMAL, settings, 'pb980', null, 12);
    expect(after.breaths[0]).toMatchObject({ trigger: 'manual', type: 'mandatory' });
    expect(after.breaths[0].vti).toBeCloseTo(0.5, 6);
  });

  it('吸気中の予約では何も起きない', () => {
    const insp = run(createState(NORMAL, settings, 'pb980'), NORMAL, settings, 'pb980', null, 0.3).state;
    expect(insp.phase).toBe('insp');
    expect(requestManualBreath(insp)).toBe(insp);
  });

  it('SPONT（PSV）でも 1 回送れる', () => {
    const psv = { mode: 'PSV', ps: 10, etsPct: 25, riseTime: 0, peep: 5 };
    const idle = run(createState(NORMAL, psv, 'pb980'), NORMAL, psv, 'pb980', null, 2).state;
    const { breaths, state } = run(requestManualBreath(idle), NORMAL, psv, 'pb980', null, 5);
    expect(state.breathCount).toBe(1);
    expect(breaths.length).toBe(0); // 次の吸気が始まらないので、呼吸はまだ確定しない
  });
});

describe('決定性', () => {
  // 受け入れ条件 13
  it('No.13 追加した機能を含めて、同じ入力なら出力が完全に一致する', () => {
    const settings = { mode: 'VC-AC', rr: 12, vt: 0.6, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, pPeakAlarm: 30 };
    const once = () => {
      const a = run(createState(STIFF, settings, 'pb980'), STIFF, settings, 'pb980', null, 7);
      return run(requestManualBreath(a.state), STIFF, settings, 'pb980', null, 10);
    };
    expect(once()).toEqual(once());
  });

  it('容量波形の値 vBreath は、呼吸の始まりで 0 に戻る', () => {
    const settings = { mode: 'PC-AC', rr: 12, deltaP: 15, ti: 1.0, riseTime: 0, peep: 5 };
    const { samples } = simulate(NORMAL, settings, 'pb980', 6);
    expect(samples[0].vBreath).toBeGreaterThan(0);
    expect(samples[199].vBreath).toBeCloseTo(0.05 * 15 * (1 - Math.exp(-2)), 6);
    expect(samples[199].v - samples[199].vBreath).toBeCloseTo(0.25, 9);
  });
});
