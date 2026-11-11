import { describe, it, expect } from 'vitest';
import { VENT_LAYOUTS, MODE_NAMES, DEVICE_RULES } from './ventLayouts.js';

// 設定ファイルの構造を確かめるテスト（構造が崩れても気づけるようにする）
describe('ventLayouts', () => {
  const ids = VENT_LAYOUTS.map((l) => l.id);
  it('レイアウトは 3 機種', () => expect(ids).toEqual(['pb980', 'hamilton', 'evita']));
  it('すべてのモードに 3 機種の名称と出典がある', () => {
    for (const [mode, names] of Object.entries(MODE_NAMES)) {
      expect(Object.keys(names).sort(), mode).toEqual([...ids].sort());
      for (const id of ids) {
        expect(typeof names[id].name, `${mode}/${id}`).toBe('string');
        expect(names[id].src, `${mode}/${id}`).toBeTruthy();
      }
    }
  });
  it('機種ルールは 3 機種分', () => expect(Object.keys(DEVICE_RULES).sort()).toEqual([...ids].sort()));
  it('C6 の PC-AC は PCV+', () => expect(MODE_NAMES['PC-AC'].hamilton.name).toBe('PCV+'));
  it('Evita は V800 風', () => expect(VENT_LAYOUTS.find((l) => l.id === 'evita').label).toBe('Evita V800 風'));
  it('3 機種の圧の上限ルールが登録されている', () => {
    expect(DEVICE_RULES.hamilton.alarmUpperAbovePlimit).toBe(10);
    expect(DEVICE_RULES.evita.maxPressureBelowPawHigh).toBe(5);
    expect(DEVICE_RULES.pb980.vcPlusMinPressureAbovePeep).toBe(3);
  });
});
