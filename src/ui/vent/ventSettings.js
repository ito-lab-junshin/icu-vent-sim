// 設定の保留・確定・取り消し（純粋関数。3 機種で共用する）。
//   state = { confirmed: { キー: 値 }, pending: { キー: 値 } }
//   confirmed … エンジンに渡している値
//   pending   … 画面で変えたが、まだ確定していない値
// defs は設定項目の定義（src/config/ventLayouts.js の PB980_SETTINGS.items など）

export function createSettings(defs) {
  const confirmed = {};
  for (const [key, def] of Object.entries(defs)) confirmed[key] = def.initial;
  return { confirmed, pending: {} };
}

// 画面に表示する値（保留があれば保留の値）
export const currentValues = (state) => ({ ...state.confirmed, ...state.pending });
export const hasPending = (state) => Object.keys(state.pending).length > 0;
export const isPending = (state, key) => key in state.pending;

// 範囲の端で止め、刻みに丸める
export function clampToDef(def, value) {
  // 未対応（unsupported）の選択肢は選べない
  if (def.type === 'choice') return def.options.some((o) => o.value === value && !o.unsupported) ? value : def.initial;
  const stepped = Math.round((value - def.min) / def.step) * def.step + def.min;
  const digits = Math.max(0, -Math.floor(Math.log10(def.step) + 1e-9));
  return Number(Math.min(def.max, Math.max(def.min, stepped)).toFixed(digits));
}

// 値を変える（保留にする）。確定済みの値と同じに戻したら、保留から外す
export function changeSetting(state, key, value, defs) {
  const v = clampToDef(defs[key], value);
  const pending = { ...state.pending };
  if (v === state.confirmed[key]) delete pending[key];
  else pending[key] = v;
  return { ...state, pending };
}

// ノブを 1 目盛り回す（direction は +1 か −1）。選択肢の設定では、次の選択肢に移る
export function nudgeSetting(state, key, direction, defs) {
  const def = defs[key];
  const now = currentValues(state)[key];
  if (def.type === 'choice') {
    const usable = def.options.filter((o) => !o.unsupported);
    const i = usable.findIndex((o) => o.value === now);
    const next = usable[(i + direction + usable.length) % usable.length].value;
    return changeSetting(state, key, next, defs);
  }
  return changeSetting(state, key, now + direction * def.step, defs);
}

// 確定：保留の値をまとめて反映する
export const confirmSettings = (state) => ({ confirmed: currentValues(state), pending: {} });
// 取り消し：保留を捨てる
export const cancelSettings = (state) => ({ ...state, pending: {} });

export function formatSetting(def, value) {
  if (def.type === 'choice') return def.options.find((o) => o.value === value)?.label ?? String(value);
  const digits = Math.max(0, -Math.floor(Math.log10(def.step) + 1e-9));
  return value.toFixed(digits);
}
