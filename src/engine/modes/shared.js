// 換気モードに共通の部品。
//
// 各モードは次の関数を持つオブジェクトとして書く（simulator.js から呼ばれる）。
//   id                          共通 ID
//   init(settings, limits)      モード固有の状態（PRVC の吸気圧など）
//   baselinePressure(settings)  呼気弁の圧（PEEP、APRV では Plow）
//   inspTrigger(ctx)            吸気を始めるなら 'time' か 'patient'、始めないなら null
//   prepareBreath(modeState, settings, limits, trigger)  吸気の開始時に呼ぶ。{ modeState, flags } を返す
//   inspControl(ctx)            吸気中の 1 ステップの制御。
//                               { type: 'flow', at(tau) }、{ type: 'pressure', at(tau) }、{ type: 'occluded' } のどれか
//                               （tau は吸気開始からの時間）
//   inspEnds(ctx)               吸気を終えるなら true
//   afterBreath(modeState, breath, settings, limits)  1 呼吸が終わったときに呼ぶ。新しい modeState を返す
import { toSteps, lpmToLps } from '../units.js';

// model: フロートリガ感度の既定値 2 L/min（設定がないときだけ使う。成人で一般的な初期値として置いた）
export const DEFAULT_TRIGGER_FLOW = lpmToLps(2);

// model: 呼気開始から 0.2 秒はトリガを受け付けない（吸気終了直後に残った Pmus による二段呼吸を防ぐ）
export const TRIGGER_REFRACTORY = 0.2;

// 患者トリガ（フロートリガ）：患者側へ向かう流量が設定値を超えたか。
// 1 ステップ前の流量で判定するので、トリガの遅れは 1 ステップ
export function patientTriggered(ctx) {
  const threshold = ctx.settings.triggerFlow ?? DEFAULT_TRIGGER_FLOW;
  return ctx.expSteps >= toSteps(TRIGGER_REFRACTORY) && ctx.flow > threshold;
}

// 補助／調節（A/C）の吸気の始まり：時間、または患者トリガ
export function timeOrPatientTrigger(ctx) {
  if (ctx.first) return 'time';
  if (ctx.cycleSteps >= toSteps(60 / ctx.settings.rr)) return 'time';
  return patientTriggered(ctx) ? 'patient' : null;
}

// 圧の立ち上がり：base から base + delta まで、riseTime 秒かけて上げる
// model: 立ち上がりは直線とした（実機の立ち上がり波形は機種で異なる）
export function rampedPressure(base, delta, riseTime, tau) {
  if (!(riseTime > 0) || tau >= riseTime) return base + delta;
  return base + delta * Math.max(0, tau / riseTime);
}

export const noFlags = { pressureLimited: false, minPressureApplied: false, settingAdjusted: false };
export const keepState = (modeState) => ({ modeState, flags: noFlags });
export const unchanged = (modeState) => modeState;
