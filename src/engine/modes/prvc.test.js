import { describe, it, expect } from 'vitest';
import { NORMAL, simulate } from '../testHelpers.js';
import { DEVICE_RULES } from '../../config/ventLayouts.js';

const base = { mode: 'PRVC', rr: 12, targetVt: 0.5, ti: 1.0, riseTime: 0, peep: 5 };

describe('PRVC', () => {
  // 受け入れ条件 6
  it('No.6 目標 VT 0.5 L、C 0.05、R 10 → 数呼吸で目標 ±5 % に収まる', () => {
    const { breaths } = simulate(NORMAL, base, 'pb980', 40);
    const within = (b) => Math.abs(b.vti - 0.5) / 0.5 <= 0.05;
    const first = breaths.findIndex(within);
    expect(first).toBe(1); // 2 呼吸目（試験呼吸の次）で収まる
    expect(breaths.slice(first).every(within)).toBe(true);
    // 収束後の ΔP は理論値 VT ÷（C ×（1 − e^(−Ti/τ)））= 11.57 cmH2O
    expect(breaths.at(-1).targetDeltaP).toBeCloseTo(0.5 / (0.05 * (1 - Math.exp(-2))), 2);
  });

  // 受け入れ条件 7
  it('No.7 hamilton、リミット圧 12 → 吸気圧がリミット圧を超えず、目標 VT に届かず、pressureLimited', () => {
    const { breaths, samples } = simulate(NORMAL, { ...base, pLimit: 12 }, 'hamilton', 40);
    expect(Math.max(...samples.map((s) => s.paw))).toBeLessThanOrEqual(12 + 1e-9);
    for (const b of breaths.slice(2)) {
      expect(b.pip).toBeCloseTo(12, 6);
      expect(b.vti).toBeLessThan(0.5 * 0.95);
      expect(b.pressureLimited).toBe(true);
    }
  });

  // 受け入れ条件 8
  it('No.8 pb980、非常に柔らかい肺（C 0.2）→ 目標吸気圧が PEEP + 3 を下回らない', () => {
    const soft = { c: 0.2, rInsp: 5, rExp: 5 };
    const min = DEVICE_RULES.pb980.vcPlusMinPressureAbovePeep;
    const { breaths } = simulate(soft, { ...base, targetVt: 0.3 }, 'pb980', 60);
    expect(breaths.every((b) => b.targetDeltaP >= min - 1e-9)).toBe(true);
    const last = breaths.at(-1);
    expect(last.targetDeltaP).toBeCloseTo(min, 9);
    expect(last.pip).toBeCloseTo(base.peep + min, 6);
    expect(last.minPressureApplied).toBe(true);
    expect(last.vti).toBeGreaterThan(0.3); // 下限のため、目標より多く入る
  });

  it('1 呼吸あたりの調整は ±3 cmH2O まで', () => {
    const { breaths } = simulate({ c: 0.02, rInsp: 10, rExp: 10 }, base, 'pb980', 60);
    for (let i = 1; i < breaths.length; i += 1) {
      expect(Math.abs(breaths[i].targetDeltaP - breaths[i - 1].targetDeltaP)).toBeLessThanOrEqual(3 + 1e-9);
    }
  });

  it('pb980：目標吸気圧は PEAK アラーム上限 − 3 まで（硬い肺で目標 VT に届かない）', () => {
    const stiff = { c: 0.02, rInsp: 10, rExp: 10 };
    const { breaths, samples } = simulate(stiff, { ...base, pPeakAlarm: 25 }, 'pb980', 60);
    expect(Math.max(...samples.map((s) => s.paw))).toBeLessThanOrEqual(22 + 1e-9);
    const last = breaths.at(-1);
    expect(last.pip).toBeCloseTo(22, 6);
    expect(last.vti).toBeLessThan(0.5 * 0.95);
    expect(last.pressureLimited).toBe(true);
  });

  it('evita（AutoFlow）：最小吸気圧はトリガなしで PEEP + 3、患者トリガで PEEP + 0.1', () => {
    const soft = { c: 0.2, rInsp: 5, rExp: 5 };
    const s = { ...base, targetVt: 0.1, pawHighAlarm: 45, triggerFlow: 2 / 60 };
    const untriggered = simulate(soft, s, 'evita', 60).breaths.at(-1);
    expect(untriggered.trigger).toBe('time');
    expect(untriggered.targetDeltaP).toBeCloseTo(DEVICE_RULES.evita.autoFlowMinAbovePeepUntriggered, 9);
    // 強い自発努力では、努力だけで目標 VT を超えるので、吸気圧は患者トリガの下限まで下がる
    const triggered = simulate(soft, s, 'evita', 90, { pmusMax: 10, rate: 20, tiEffort: 0.8 }).breaths.filter((b) => b.trigger === 'patient');
    expect(triggered.length).toBeGreaterThan(5);
    expect(triggered.at(-1).targetDeltaP).toBeCloseTo(DEVICE_RULES.evita.autoFlowMinAbovePeepTriggered, 9);
  });

  it('hamilton：最小吸気圧は 5', () => {
    const soft = { c: 0.2, rInsp: 5, rExp: 5 };
    const { breaths } = simulate(soft, { ...base, targetVt: 0.3, pLimit: 40 }, 'hamilton', 60);
    expect(breaths.at(-1).targetDeltaP).toBeCloseTo(DEVICE_RULES.hamilton.apvMinInspPressure, 9);
  });
});
