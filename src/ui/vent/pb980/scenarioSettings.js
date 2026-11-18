// シナリオの最初の状態の、PB980 風の設定（純粋関数）。
// 性別と身長はシナリオの患者に合わせ、VT・f・PEEP・O2 はシナリオの初期値にする。設定の範囲と刻みに合わせて丸められる。
import { PB980_SETTINGS } from '../../../config/ventLayouts.js';
import { initialVentSettings } from '../../../scenarios/index.js';
import { createSettings, changeSetting, confirmSettings } from '../ventSettings.js';

export function initialPbSettings(scenario) {
  const defs = PB980_SETTINGS.items;
  let s = createSettings(defs);
  for (const [key, value] of Object.entries(initialVentSettings(scenario))) s = changeSetting(s, key, value, defs);
  return confirmSettings(s);
}
