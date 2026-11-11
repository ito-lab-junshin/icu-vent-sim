import { describe, it, expect } from 'vitest';
import { cardiacOutput, heartRate, bloodPressure } from './circulation.js';
import { GAS } from './testHelpers.js';

describe('circulation（簡略モデル）', () => {
  it('肺胞圧の平均が基準以下では、基準値のまま', () => {
    expect(cardiacOutput(5, GAS)).toBe(5);
    expect(heartRate(0.98, 40, GAS)).toBe(75);
    const bp = bloodPressure(5, 75, 5, GAS);
    expect(bp.map).toBeCloseTo(85, 10);
    expect(bp.cvp).toBe(8);
    expect(bp.sys - bp.dia).toBeCloseTo(40, 10);
    expect((bp.sys + 2 * bp.dia) / 3).toBeCloseTo(bp.map, 10); // 平均血圧 =（収縮期 + 2 × 拡張期）÷ 3
  });
  it('肺胞圧の平均が上がると、心拍出量と平均血圧が下がり、CVP が上がる', () => {
    const co = cardiacOutput(15, GAS);
    expect(co).toBeCloseTo(5 * (1 - 0.015 * 10), 10);
    const bp = bloodPressure(co, 75, 15, GAS);
    expect(bp.map).toBeLessThan(85);
    expect(bp.cvp).toBeGreaterThan(8);
  });
  it('心拍出量には下限がある', () => expect(cardiacOutput(200, GAS)).toBeCloseTo(2, 10));
  it('低酸素と高二酸化炭素で心拍数が上がる。上限がある', () => {
    expect(heartRate(0.84, 40, GAS)).toBeCloseTo(75 + 15, 6);
    expect(heartRate(0.98, 65, GAS)).toBeCloseTo(75 + 10, 6);
    expect(heartRate(0.2, 150, GAS)).toBe(160);
  });
});
