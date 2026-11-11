// 1 呼吸ごとの実測値（PHASE1.md 3.6）。
// 1 呼吸 = 吸気の始まりから、次の吸気の始まりまで。
import { DT } from './units.js';

export function newBreath({ index, modeId, trigger, type, tStart, vStart, peepSet, flowPattern, flags, targetDeltaP }) {
  return {
    index, modeId, trigger, type, tStart, vStart, peepSet, flowPattern,
    targetDeltaP: targetDeltaP ?? null,
    pressureLimited: flags.pressureLimited,
    minPressureApplied: flags.minPressureApplied,
    settingAdjusted: flags.settingAdjusted,
    steps: 0, sumPaw: 0,
    inspSteps: 0, pauseSteps: 0, expSteps: 0, holdSteps: 0,
    pip: -Infinity, flowAtPip: 0, peakFlow: 0, endInspFlow: 0,
    pausePaw: null, pplatHold: null, totalPeep: null,
    vEndInsp: vStart, spontCount: 0,
  };
}

// 1 ステップ分を足し込む。sample = { phase, paw, flow, v, occluded, limited }
export function accumulate(b, sample) {
  const n = { ...b };
  n.steps += 1;
  n.sumPaw += sample.paw;
  if (sample.limited) n.pressureLimited = true;
  if (sample.phase === 'insp') {
    n.inspSteps += 1;
    n.vEndInsp = sample.v;
    if (sample.paw > n.pip) {
      n.pip = sample.paw;
      n.flowAtPip = sample.flow;
    }
    if (sample.occluded) {
      n.pauseSteps += 1;
      n.pausePaw = sample.paw;
    } else {
      n.endInspFlow = sample.flow;
      if (sample.flow > n.peakFlow) n.peakFlow = sample.flow;
    }
  } else if (sample.phase === 'exp') {
    n.expSteps += 1;
  } else {
    n.holdSteps += 1; // 吸気ホールド・呼気ホールド
  }
  return n;
}

// 呼吸が終わったとき（次の吸気が始まるとき）に実測値をまとめる。vEnd は呼気終末の V
export function finalizeBreath(b, vEnd) {
  const ti = b.inspSteps * DT;
  const te = b.expSteps * DT;
  const hold = b.holdSteps * DT;
  const vti = b.vEndInsp - b.vStart;
  const vte = b.vEndInsp - vEnd;
  // Pplat：吸気ホールドがあればその値、なければ吸気ポーズの終わりの値
  const pplat = b.pplatHold ?? (b.pauseSteps > 0 ? b.pausePaw : null);
  const totalPeep = b.totalPeep;
  // total PEEP を測っていない呼吸では、設定 PEEP を基準にする
  const base = totalPeep ?? b.peepSet;
  const dp = pplat != null ? pplat - base : null;
  const rawOk = b.modeId === 'VC-AC' && b.flowPattern !== 'ramp' && pplat != null && !b.pressureLimited && b.flowAtPip > 0;
  return {
    index: b.index,
    mode: b.modeId,
    trigger: b.trigger, // 'time' | 'patient'
    type: b.type,       // 'mandatory'（強制）| 'assisted'（補助）| 'spontaneous'（自発）
    tStart: b.tStart,
    pip: b.pip,
    pplat,
    pmean: b.sumPaw / b.steps,
    peepSet: b.peepSet,
    totalPeep,
    autoPeep: totalPeep != null ? totalPeep - b.peepSet : null,
    vti,
    vte,
    ti,
    te,
    holdTime: hold,
    ttot: ti + te + hold,
    ieRatio: ti > 0 ? te / ti : null, // I:E = 1 : ieRatio
    rr: 60 / (ti + te),               // この呼吸の周期から求めた回数（ホールドの時間は除く）
    cstat: dp != null && dp > 0 ? vti / dp : null,          // L/cmH2O
    raw: rawOk ? (b.pip - pplat) / b.flowAtPip : null,       // cmH2O/(L/s)。流量一定の VC のときのみ
    drivingPressure: dp,
    peakFlow: b.peakFlow,
    endInspFlow: b.endInspFlow,
    targetDeltaP: b.targetDeltaP,
    pressureLimited: b.pressureLimited,
    minPressureApplied: b.minPressureApplied,
    settingAdjusted: b.settingAdjusted,
    spontCount: b.spontCount, // 2 レベルの圧のモードで、1 周期のあいだに数えた自発呼吸
  };
}

// 直近 windowSec 秒の呼吸から、呼吸回数（強制・自発）と分時換気量をまとめる
export function summarizeBreaths(breaths, windowSec = 60) {
  if (breaths.length === 0) return { rrTotal: 0, rrMandatory: 0, rrSpontaneous: 0, mve: 0, duration: 0 };
  const picked = [];
  let duration = 0;
  for (let i = breaths.length - 1; i >= 0 && duration < windowSec; i -= 1) {
    picked.push(breaths[i]);
    duration += breaths[i].ttot;
  }
  const perMin = (x) => (x / duration) * 60;
  const mandatory = picked.filter((b) => b.trigger === 'time').length;
  const spontaneous = picked.filter((b) => b.trigger === 'patient').length + picked.reduce((a, b) => a + b.spontCount, 0);
  return {
    rrTotal: perMin(mandatory + spontaneous),
    rrMandatory: perMin(mandatory),
    rrSpontaneous: perMin(spontaneous),
    mve: perMin(picked.reduce((a, b) => a + b.vte, 0)), // L/min
    duration,
  };
}
