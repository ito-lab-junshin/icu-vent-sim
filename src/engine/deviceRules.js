// 機種ごとの圧の上限ルール（PHASE1.md 3.4）。
// 数値は src/config/ventLayouts.js の DEVICE_RULES から読み、ここには直接書かない。
import { DEVICE_RULES } from '../config/ventLayouts.js';

// 返り値（該当しない項目は null）
//   pressureCap       供給圧の上限。吸気中の気道内圧はこれを超えない
//   alarmUpper        気道内圧アラームの上限（Phase 2 のアラーム表示用）
//   prvcMinAbovePeep  PRVC の吸気圧（PEEP からの上乗せ）の下限
//   prvcMinAbovePeepTriggered  患者トリガの呼吸での下限（機種が区別する場合のみ。null なら上と同じ）
//   prvcMaxPressure   PRVC の吸気圧（絶対値）の上限
//   bilevelMinDelta   2 レベルの圧で、高圧が低圧より最低これだけ高い
//   inspTerminatePressure  吸気中に気道内圧がこの値に達したら、その吸気を打ち切る
//
// 使う設定値：pb980 は settings.pPeakAlarm（PEAK アラーム上限）、hamilton は settings.pLimit（リミット圧）、
//             evita は settings.pawHighAlarm（アラーム上限 Paw high）
export function resolveDeviceLimits(deviceId, settings) {
  const rules = DEVICE_RULES[deviceId];
  if (!rules) throw new Error(`未知の機種 ID: ${deviceId}`);
  const out = {
    deviceId,
    pressureCap: null,
    alarmUpper: null,
    prvcMinAbovePeep: null,
    prvcMinAbovePeepTriggered: null,
    prvcMaxPressure: null,
    bilevelMinDelta: null,
    inspTerminatePressure: null,
  };
  if (deviceId === 'pb980') {
    out.prvcMinAbovePeep = rules.vcPlusMinPressureAbovePeep;
    out.bilevelMinDelta = rules.bilevelMinPhAbovePl;
    if (settings.pPeakAlarm != null) {
      out.alarmUpper = settings.pPeakAlarm;
      out.prvcMaxPressure = settings.pPeakAlarm - rules.vcPlusMaxBelowPeakAlarm;
      if (rules.peakAlarmTruncatesInspiration) out.inspTerminatePressure = settings.pPeakAlarm;
    }
  } else if (deviceId === 'hamilton') {
    out.prvcMinAbovePeep = rules.apvMinInspPressure;
    if (settings.pLimit != null) {
      if (rules.totalPressureCappedAtPlimit) out.pressureCap = settings.pLimit;
      out.alarmUpper = settings.pLimit + rules.alarmUpperAbovePlimit;
      if (rules.apvSafetyBound === 'Plimit') out.prvcMaxPressure = settings.pLimit;
    }
  } else if (deviceId === 'evita') {
    out.prvcMinAbovePeep = rules.autoFlowMinAbovePeepUntriggered;
    out.prvcMinAbovePeepTriggered = rules.autoFlowMinAbovePeepTriggered;
    if (settings.pawHighAlarm != null) {
      out.alarmUpper = settings.pawHighAlarm;
      if (!rules.pmaxAutosetDefault) {
        out.pressureCap = settings.pawHighAlarm - rules.maxPressureBelowPawHigh;
        out.prvcMaxPressure = out.pressureCap;
      }
    }
  }
  return out;
}
