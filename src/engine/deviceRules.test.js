import { describe, it, expect } from 'vitest';
import { resolveDeviceLimits } from './deviceRules.js';
import { DEVICE_RULES } from '../config/ventLayouts.js';

describe('deviceRules（数値は DEVICE_RULES から読む）', () => {
  it('pb980：VC+ の下限と BiLevel の PH − PL', () => {
    const l = resolveDeviceLimits('pb980', { peep: 5 });
    expect(l.prvcMinAbovePeep).toBe(DEVICE_RULES.pb980.vcPlusMinPressureAbovePeep);
    expect(l.bilevelMinDelta).toBe(DEVICE_RULES.pb980.bilevelMinPhAbovePl);
    expect(l.pressureCap).toBeNull();
  });
  it('hamilton：供給圧はリミット圧まで、アラーム上限 = リミット圧 + 10、最小吸気圧 5', () => {
    const l = resolveDeviceLimits('hamilton', { peep: 5, pLimit: 30 });
    expect(l.pressureCap).toBe(30);
    expect(l.alarmUpper).toBe(40);
    expect(l.prvcMaxPressure).toBe(30);
    expect(l.prvcMinAbovePeep).toBe(5);
  });
  it('evita：最大気道内圧はアラーム上限 − 5', () => {
    const l = resolveDeviceLimits('evita', { peep: 5, pawHighAlarm: 40 });
    expect(l.pressureCap).toBe(35);
    expect(l.alarmUpper).toBe(40);
  });
  it('未知の機種 ID はエラー', () => expect(() => resolveDeviceLimits('xxx', {})).toThrow());
});
