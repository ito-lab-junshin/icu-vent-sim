import { describe, it, expect } from 'vitest';
import { NORMAL, simulate, relErr } from '../testHelpers.js';
import { createState, run } from '../simulator.js';
import { requestExpHold } from '../maneuvers.js';

describe('VC-AC', () => {
  // 受け入れ条件 1
  it('No.1 流量一定 1 L/s、VT 0.5 L、Ti 1.0 s、R 10、C 0.05、PEEP 5 → PIP 25、Pplat 15、Cstat 50、Raw 10', () => {
    const settings = { mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5 };
    const b = simulate(NORMAL, settings, 'pb980', 11).breaths[0];
    expect(relErr(b.pip, 25)).toBeLessThan(0.02);
    expect(relErr(b.pplat, 15)).toBeLessThan(0.02);
    expect(relErr(b.cstat * 1000, 50)).toBeLessThan(0.02);
    expect(relErr(b.raw, 10)).toBeLessThan(0.02);
    expect(b.vti).toBeCloseTo(0.5, 6);
    expect(b.ti).toBeCloseTo(1.0, 6);
    expect(b.drivingPressure).toBeCloseTo(10, 6);
  });

  // 受け入れ条件 4
  // 期待値の導き方：呼気は V(t) = V0 × e^(−t/τ) で減る。τ = Rexp × C = 20 × 0.06 = 1.2 s、Te = 1.0 s なので、
  // 1 回の呼気で容量は k = e^(−1/1.2) 倍になる。定常状態では、呼気終末の残り容量 Vee に VT を足して
  // k 倍すると、また Vee に戻る：(Vee + VT) × k = Vee → Vee = VT × k / (1 − k) = 0.384 L。
  // PEEP 0 なので auto-PEEP = Vee / C = 6.41 cmH2O。
  it('No.4 呼気不足による auto-PEEP（RR 30、Te 1.0 s、τ 1.2 s、20 呼吸後）', () => {
    const patient = { c: 0.06, rInsp: 10, rExp: 20 };
    const settings = { mode: 'VC-AC', rr: 30, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 0 };
    const k = Math.exp(-1 / 1.2);
    const veeTheory = (0.5 * k) / (1 - k);
    const autoPeepTheory = veeTheory / 0.06;
    expect(veeTheory).toBeCloseTo(0.384, 3);
    expect(autoPeepTheory).toBeCloseTo(6.41, 2);

    const after20 = simulate(patient, settings, 'pb980', 40); // 2 秒 × 20 呼吸
    expect(after20.breaths.length).toBe(19); // 20 呼吸目は、次の吸気が始まるときに確定する
    expect(relErr(after20.state.v, veeTheory)).toBeLessThan(0.05);
    expect(relErr(after20.state.v / patient.c, autoPeepTheory)).toBeLessThan(0.05);

    // 呼気ホールドで測った total PEEP − 設定 PEEP と一致する
    const held = run(requestExpHold(after20.state, 1.0), patient, settings, 'pb980', null, 4);
    const b = held.breaths[0];
    expect(b.holdTime).toBeCloseTo(1.0, 6);
    expect(relErr(b.autoPeep, autoPeepTheory)).toBeLessThan(0.05);
    expect(b.autoPeep).toBeCloseTo(after20.state.v / patient.c - settings.peep, 6);
  });

  it('漸減波でも設定 VT が入り、PIP は矩形波より低い', () => {
    const base = { mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, ti: 1.2, peep: 5 };
    const sq = simulate(NORMAL, { ...base, flowPattern: 'square' }, 'pb980', 6).breaths[0];
    const ramp = simulate(NORMAL, { ...base, flowPattern: 'ramp' }, 'pb980', 6).breaths[0];
    expect(ramp.vti).toBeCloseTo(0.5, 4);
    expect(ramp.pip).toBeLessThan(sq.pip);
    expect(ramp.raw).toBeNull(); // Raw は流量一定のときのみ
  });

  it('患者トリガで補助呼吸が始まる（設定 RR より多くなる）', () => {
    const settings = { mode: 'VC-AC', rr: 10, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, triggerFlow: 2 / 60 };
    const r = simulate(NORMAL, settings, 'pb980', 30, { pmusMax: 6, rate: 20, tiEffort: 0.8 });
    expect(r.breaths.some((b) => b.trigger === 'patient' && b.type === 'assisted')).toBe(true);
    expect(r.breaths.length).toBeGreaterThan(6);
  });

  it('hamilton：リミット圧で頭打ちになり、VT に届かず、pressureLimited が立つ', () => {
    const settings = { mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, pLimit: 14 };
    const r = simulate(NORMAL, settings, 'hamilton', 6);
    const b = r.breaths[0];
    expect(Math.max(...r.samples.filter((s) => s.phase === 'insp').map((s) => s.paw))).toBeLessThanOrEqual(14 + 1e-6);
    expect(b.pressureLimited).toBe(true);
    expect(b.vti).toBeLessThan(0.5);
  });
});
