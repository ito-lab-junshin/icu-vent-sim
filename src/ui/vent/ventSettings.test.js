import { describe, it, expect } from 'vitest';
import { PB980_SETTINGS } from '../../config/ventLayouts.js';
import {
  createSettings, currentValues, hasPending, isPending, changeSetting, nudgeSetting, confirmSettings, cancelSettings, formatSetting,
} from './ventSettings.js';

const defs = PB980_SETTINGS.items;

describe('ventSettings（設定の保留と確定）', () => {
  // 受け入れ条件 5
  it('No.5 設定を変えても、確定するまで confirmed は変わらない。取り消しで元の値に戻る', () => {
    const s0 = createSettings(defs);
    const s1 = changeSetting(s0, 'vt', 400, defs);
    expect(s1.confirmed.vt).toBe(500);
    expect(currentValues(s1).vt).toBe(400);
    expect(isPending(s1, 'vt')).toBe(true);
    const s2 = cancelSettings(s1);
    expect(currentValues(s2).vt).toBe(500);
    expect(hasPending(s2)).toBe(false);
    expect(s0.pending).toEqual({}); // 元の状態を書き換えない
  });

  // 受け入れ条件 6
  it('No.6 2 つの設定を変えて 1 回確定すると、2 つとも同時に反映される', () => {
    let s = createSettings(defs);
    s = changeSetting(s, 'vt', 400, defs);
    s = changeSetting(s, 'f', 20, defs);
    expect(s.confirmed).toMatchObject({ vt: 500, f: 12 });
    s = confirmSettings(s);
    expect(s.confirmed).toMatchObject({ vt: 400, f: 20 });
    expect(hasPending(s)).toBe(false);
  });

  // 受け入れ条件 7
  it('No.7 範囲の外の値は、範囲の端で止まる', () => {
    const s = createSettings(defs);
    expect(currentValues(changeSetting(s, 'vt', 5000, defs)).vt).toBe(defs.vt.max);
    expect(currentValues(changeSetting(s, 'peep', -3, defs)).peep).toBe(defs.peep.min);
    let t = changeSetting(s, 'peep', defs.peep.max, defs);
    t = nudgeSetting(t, 'peep', +1, defs);
    expect(currentValues(t).peep).toBe(defs.peep.max);
  });

  it('ノブ：刻みごとに動き、小数の誤差が出ない', () => {
    let s = createSettings(defs);
    for (let i = 0; i < 3; i += 1) s = nudgeSetting(s, 'tpl', +1, defs);
    expect(currentValues(s).tpl).toBe(0.8);
    s = nudgeSetting(s, 'flowPattern', +1, defs);
    expect(currentValues(s).flowPattern).toBe('ramp');
  });

  it('確定済みの値に戻すと、保留から外れる', () => {
    let s = createSettings(defs);
    s = nudgeSetting(s, 'f', +1, defs);
    s = nudgeSetting(s, 'f', -1, defs);
    expect(hasPending(s)).toBe(false);
  });

  it('表示：刻みに合わせた桁数、選択肢は表示名', () => {
    expect(formatSetting(defs.tpl, 0.5)).toBe('0.5');
    expect(formatSetting(defs.vt, 500)).toBe('500');
    expect(formatSetting(defs.flowPattern, 'ramp')).toBe('Ramp');
  });

  it('初期値はすべて範囲の中にある', () => {
    for (const def of Object.values(defs)) {
      if (def.type === 'number') {
        expect(def.initial).toBeGreaterThanOrEqual(def.min);
        expect(def.initial).toBeLessThanOrEqual(def.max);
      }
    }
  });
});
