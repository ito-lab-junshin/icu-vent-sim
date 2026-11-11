// APRV／BIPAP（2 つの圧レベル）
// 高圧 Phigh を Thigh 秒、低圧 Plow を Tlow 秒、時間で交互に保つ。
// どちらの圧でも弁は開いたままなので、自発呼吸（Pmus）による流量がそのまま出る。
// APRV と BIPAP は時間の設定が違うだけで、計算は同じ。
// この Phase では、自発呼吸への PS の上乗せは入れていない。
//
// 設定：pHigh、pLow、tHigh、tLow、riseTime
import { toSteps } from '../units.js';
import { rampedPressure, unchanged } from './shared.js';

// 機種ルール（PB980 の BiLevel：PH は PL + 5 以上）を当てはめた高圧
function effectiveHigh(settings, limits) {
  if (limits.bilevelMinDelta == null) return settings.pHigh;
  return Math.max(settings.pHigh, settings.pLow + limits.bilevelMinDelta);
}

export const aprv = {
  id: 'APRV',
  countsSpontaneousEfforts: true,
  init: (settings, limits) => ({ pHigh: effectiveHigh(settings, limits) }),
  baselinePressure: (settings) => settings.pLow,
  inspTrigger: (ctx) => (ctx.first || ctx.expSteps >= toSteps(ctx.settings.tLow) ? 'time' : null),
  prepareBreath(modeState, settings, limits) {
    const pHigh = effectiveHigh(settings, limits);
    return {
      modeState: { pHigh },
      flags: { pressureLimited: false, minPressureApplied: false, settingAdjusted: pHigh !== settings.pHigh },
    };
  },
  inspControl(ctx) {
    const { pLow, riseTime } = ctx.settings;
    const { pHigh } = ctx.modeState;
    return { type: 'pressure', at: (tau) => rampedPressure(pLow, pHigh - pLow, riseTime, tau) };
  },
  inspEnds: (ctx) => ctx.inspSteps >= toSteps(ctx.settings.tHigh),
  afterBreath: unchanged,
};
