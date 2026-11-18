import { describe, it, expect } from 'vitest';
import { baseExcess, lactate, pfRatio, bloodGasResult, formatBloodGas } from './bloodGas.js';
import { deriveVitals } from './gasDynamics.js';
import { alveolarPO2 } from './gasExchange.js';
import { GAS } from './testHelpers.js';

describe('bloodGas（血液ガスの結果）', () => {
  // 受け入れ条件 10
  it('No.10 P/F 比：PaO2 80、FiO2 0.4 → 200', () => expect(pfRatio(80, 0.4)).toBeCloseTo(200, 10));

  // 受け入れ条件 11
  it('No.11 結果はエンジンの値と同じ（丸めだけ）で、採血時刻が付く', () => {
    const vitals = deriveVitals({ paCO2: 40, pAO2: alveolarPO2(0.4, 40), palvMean: 7.5, lastN: 0 }, GAS);
    const r = bloodGasResult(vitals, 0.4, 754);
    expect(r).toMatchObject({ t: 754, fio2: 0.4, ph: vitals.ph, paCO2: vitals.paCO2, paO2: vitals.paO2, hco3: vitals.hco3, saO2: vitals.saO2 });
    expect(r.pf).toBeCloseTo(vitals.paO2 / 0.4, 10);
    const shown = Object.fromEntries(formatBloodGas(r).map((x) => [x.key, x.value]));
    expect(shown.ph).toBe(vitals.ph.toFixed(2));
    expect(shown.paCO2).toBe('40');
    expect(shown.saO2).toBe((vitals.saO2 * 100).toFixed(0));
    expect(shown.hco3).toBe('24');
  });

  it('BE：pH 7.40、HCO3 24.4 で 0。HCO3 が高いと正、低いと負', () => {
    expect(baseExcess(24.4, 7.4)).toBeCloseTo(0, 10);
    expect(baseExcess(24, 7.4)).toBeCloseTo(-0.372, 3);
    expect(baseExcess(32, 7.4)).toBeGreaterThan(5);
    expect(baseExcess(15, 7.2)).toBeLessThan(-10);
  });

  it('Lac：ふだんは 1.0。混合静脈血の酸素飽和度が 50 % を下回ると上がる', () => {
    expect(lactate(0.72)).toBe(1.0);
    expect(lactate(0.5)).toBe(1.0);
    expect(lactate(0.4)).toBeCloseTo(3.0, 10);
  });
});
