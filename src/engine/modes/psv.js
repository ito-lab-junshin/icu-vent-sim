// PSV／CPAP（自発呼吸の補助）
// 吸気の始まり：患者トリガのみ
// 吸気中：Paw = PEEP + PS。立ち上がり時間を設定できる。CPAP は PS = 0
// 吸気の終わり：吸気流量がピークの ETS（%）まで下がったとき
//
// 設定：ps、etsPct、riseTime、peep、triggerFlow、tiMax
import { patientTriggered, rampedPressure, keepState, unchanged } from './shared.js';

// model: 吸気時間の上限 3 秒（リークや長い努力で吸気が終わらないときの打ち切り。設定 tiMax があればそちらを使う）
export const PSV_DEFAULT_TI_MAX = 3;

export const psv = {
  id: 'PSV',
  init: () => ({}),
  baselinePressure: (settings) => settings.peep,
  inspTrigger: (ctx) => (patientTriggered(ctx) ? 'patient' : null),
  prepareBreath: keepState,
  inspControl(ctx) {
    const { peep, ps, riseTime } = ctx.settings;
    return { type: 'pressure', at: (tau) => rampedPressure(peep, ps, riseTime, tau) };
  },
  inspEnds(ctx) {
    if (ctx.inspSteps < 1) return false;
    if (ctx.tau >= (ctx.settings.tiMax ?? PSV_DEFAULT_TI_MAX)) return true;
    return ctx.flow <= (ctx.settings.etsPct / 100) * ctx.breath.peakFlow;
  },
  afterBreath: unchanged,
};
