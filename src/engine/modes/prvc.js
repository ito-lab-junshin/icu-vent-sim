// PRVC（量目標の自動圧調整。PB980 の VC+、Hamilton の APVcmv、Evita の AutoFlow に当たる）
// 吸気の始まり・吸気中・吸気の終わりは PC-AC と同じ。
// 吸気圧 ΔP（PEEP からの上乗せ）を呼吸ごとに調整して、目標 VT に近づける。
// 機種ごとの圧の上限・下限は limits（deviceRules.js が DEVICE_RULES から求めた値）で受け取る。
//
// 設定：rr、targetVt、ti、riseTime、peep、triggerFlow
import { toSteps } from '../units.js';
import { timeOrPatientTrigger, rampedPressure } from './shared.js';

// model: 最初の 1 呼吸（試験呼吸）は、ΔP 10 cmH2O の圧規定の呼吸とする。
//        実機の試験呼吸の方法は機種で異なり、取扱説明書で確認できた範囲では数値を決められない（伊藤先生の確認待ち）
export const PRVC_INITIAL_DELTA_P = 10;

// model: ΔP の調整は 1 呼吸あたり最大 ±3 cmH2O。取扱説明書に数値がない（伊藤先生の確認待ち）
export const PRVC_MAX_STEP = 3;

// model: 調整は比例式。次の ΔP = 今の ΔP ×（目標 VT ÷ 測定 VT）。ただし上の調整幅を超えない
function nextDeltaP(deltaP, targetVt, measuredVt) {
  if (!(measuredVt > 1e-6)) return deltaP + PRVC_MAX_STEP;
  const wanted = deltaP * (targetVt / measuredVt);
  const change = Math.max(-PRVC_MAX_STEP, Math.min(PRVC_MAX_STEP, wanted - deltaP));
  return deltaP + change;
}

// 機種ルールの範囲に収める。上限と下限がぶつかるときは上限を優先する（圧を上げない側）
function bound(deltaP, settings, limits) {
  let d = deltaP;
  let pressureLimited = false;
  let minPressureApplied = false;
  if (limits.prvcMinAbovePeep != null && d < limits.prvcMinAbovePeep) {
    d = limits.prvcMinAbovePeep;
    minPressureApplied = true;
  }
  if (limits.prvcMaxPressure != null && settings.peep + d > limits.prvcMaxPressure) {
    d = Math.max(0, limits.prvcMaxPressure - settings.peep);
    pressureLimited = true;
    minPressureApplied = false;
  }
  return { deltaP: d, pressureLimited, minPressureApplied };
}

export const prvc = {
  id: 'PRVC',
  init: () => ({ deltaP: PRVC_INITIAL_DELTA_P, breaths: 0 }),
  baselinePressure: (settings) => settings.peep,
  inspTrigger: timeOrPatientTrigger,
  // 吸気の開始時に、設定や機種が変わっていても範囲に収まるように直す
  prepareBreath(modeState, settings, limits) {
    const b = bound(modeState.deltaP, settings, limits);
    return {
      modeState: { ...modeState, deltaP: b.deltaP },
      flags: { pressureLimited: b.pressureLimited, minPressureApplied: b.minPressureApplied, settingAdjusted: false },
    };
  },
  inspControl(ctx) {
    const { peep, riseTime } = ctx.settings;
    const { deltaP } = ctx.modeState;
    return { type: 'pressure', at: (tau) => rampedPressure(peep, deltaP, riseTime, tau) };
  },
  inspEnds: (ctx) => ctx.inspSteps >= toSteps(ctx.settings.ti),
  // 測定した VTi と目標 VT から、次の呼吸の ΔP を決める
  afterBreath(modeState, breath, settings) {
    return {
      deltaP: nextDeltaP(modeState.deltaP, settings.targetVt, breath.vti),
      breaths: modeState.breaths + 1,
    };
  },
};
