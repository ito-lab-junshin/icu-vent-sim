// PC-AC（圧規定・補助／調節）
// 吸気の始まり：時間、または患者トリガ
// 吸気中：Paw = PEEP + ΔP。立ち上がり時間を設定できる
// 吸気の終わり：設定 Ti
//
// 設定：rr、deltaP（PEEP からの上乗せ）、ti、riseTime、peep、triggerFlow
import { toSteps } from '../units.js';
import { timeOrPatientTrigger, rampedPressure, keepState, unchanged } from './shared.js';

export const pcAc = {
  id: 'PC-AC',
  init: () => ({}),
  baselinePressure: (settings) => settings.peep,
  inspTrigger: timeOrPatientTrigger,
  prepareBreath: keepState,
  inspControl(ctx) {
    const { peep, deltaP, riseTime } = ctx.settings;
    return { type: 'pressure', at: (tau) => rampedPressure(peep, deltaP, riseTime, tau) };
  },
  inspEnds: (ctx) => ctx.inspSteps >= toSteps(ctx.settings.ti),
  afterBreath: unchanged,
};
