// VC-AC（量規定・補助／調節）
// 吸気の始まり：時間、または患者トリガ
// 吸気中：流量一定（矩形波）。漸減波も選べる
// 吸気の終わり：設定 VT を送り終えたら流量 0 にし、設定 Ti まで吸気ポーズ
//
// 設定：rr、vt、flow（最大流量 L/s）、flowPattern（'square' | 'ramp'）、ti、peep、triggerFlow
import { DT, toSteps } from '../units.js';
import { timeOrPatientTrigger, keepState, unchanged } from './shared.js';

const EPS = 1e-9;

// model: 漸減波は、最大流量から 0 まで直線で下げる。送気時間は 2 × VT ÷ 最大流量
//        （実機の終末流量は機種で異なる。Phase 2 で取扱説明書に合わせて見直す）
const rampTime = (settings) => (2 * settings.vt) / settings.flow;

// 設定 VT を送り終えたか
function delivered(ctx) {
  if (ctx.settings.vt - ctx.delivered <= EPS) return true;
  return ctx.settings.flowPattern === 'ramp' && ctx.tau >= rampTime(ctx.settings) - EPS;
}

export const vcAc = {
  id: 'VC-AC',
  init: () => ({}),
  baselinePressure: (settings) => settings.peep,
  inspTrigger: timeOrPatientTrigger,
  prepareBreath: keepState,
  inspControl(ctx) {
    if (delivered(ctx)) return { type: 'occluded' }; // 吸気ポーズ
    const { vt, flow, flowPattern } = ctx.settings;
    if (flowPattern === 'ramp') {
      const tf = rampTime(ctx.settings);
      return { type: 'flow', at: (tau) => Math.max(0, flow * (1 - tau / tf)) };
    }
    // 矩形波。最後の 1 ステップは残りの量だけ送り、VT を超えないようにする
    const f = Math.min(flow, (vt - ctx.delivered) / DT);
    return { type: 'flow', at: () => f };
  },
  // 設定 Ti を過ぎ、かつ VT を送り終えたら終わる。
  // Ti のうちに送り終えない設定（VT ÷ 流量 > Ti）では、送り終えるまで吸気を延ばす（量を優先）。
  // 圧の上限で流量が絞られた呼吸は、VT に届かなくても Ti で終わる
  inspEnds(ctx) {
    if (ctx.inspSteps < toSteps(ctx.settings.ti)) return false;
    return delivered(ctx) || ctx.breath.pressureLimited;
  },
  afterBreath: unchanged,
};
