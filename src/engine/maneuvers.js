// 吸気ホールド・呼気ホールド（PHASE1.md 3.5）。
// ここでは「次の機会にホールドする」という予約を状態に書くだけで、実際の動きは simulator.js が行う。
//   吸気ホールド：次の吸気の終わりで両弁を閉じ、流量 0 で保つ。終わりの Paw が Pplat
//   呼気ホールド：次の呼気の終わり（次の吸気が始まるはずの時点）で両弁を閉じ、流量 0 で保つ。
//                 終わりの Paw が total PEEP。auto-PEEP = total PEEP − 設定 PEEP
// 1 区画モデルでは保持中に圧は変わらない（Pmus が 0 のとき）が、保持時間は設定できる。
// 自発呼吸（Pmus）があると、保持中の Paw は Pmus の分だけ動くので、正しく測れない（実機と同じ）。
import { toSteps } from './units.js';

// model: 保持時間の既定値 1.0 秒（Phase 4 の多区画で圧が落ち着く時間を入れる余地として置いた）
export const DEFAULT_HOLD_TIME = 1.0;

export function requestInspHold(state, seconds = DEFAULT_HOLD_TIME) {
  return { ...state, pendingInspHold: toSteps(seconds) };
}

export function requestExpHold(state, seconds = DEFAULT_HOLD_TIME) {
  return { ...state, pendingExpHold: toSteps(seconds) };
}

// 用手換気：呼気中に呼ぶと、次のステップで、いまの設定の換気を 1 回送る。吸気中やホールド中は何もしない
export function requestManualBreath(state) {
  if (state.phase !== 'exp') return state;
  return { ...state, pendingManualBreath: true };
}

export const isHolding = (state) => state.phase === 'inspHold' || state.phase === 'expHold';
