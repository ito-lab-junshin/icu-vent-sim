// エンジンの入口。状態を受け取り、時間を 1 ステップ進めた新しい状態を返す（純粋関数）。
// React に依存しない。乱数は使わない（同じ入力なら同じ出力）。
//
//   patient  = { c, rInsp, rExp }                      肺（内部単位）
//   effort   = { pmusMax, rate, tiEffort } または null  自発呼吸
//   settings = { mode, ...モードごとの設定 }             各 modes/*.js の先頭に設定の一覧
//   deviceId = 'pb980' | 'hamilton' | 'evita'          圧の上限ルールを選ぶ
import { DT } from './units.js';
import { pmusAt } from './patientEffort.js';
import { alveolarPressure, flowAtPressure, pawAtFlow, stepPressureControlled, stepFlowControlled } from './lungMechanics.js';
import { resolveDeviceLimits } from './deviceRules.js';
import { newBreath, accumulate, finalizeBreath } from './breathMetrics.js';
import { vcAc } from './modes/vcAc.js';
import { pcAc } from './modes/pcAc.js';
import { prvc } from './modes/prvc.js';
import { psv } from './modes/psv.js';
import { aprv } from './modes/aprv.js';

export const MODES = { 'VC-AC': vcAc, 'PC-AC': pcAc, PRVC: prvc, PSV: psv, APRV: aprv };

// CPAP は PSV（PS = 0）、BIPAP は APRV と同じ計算を使う
const ALIASES = { CPAP: 'PSV', BIPAP: 'APRV' };
export function canonicalMode(mode) {
  const id = ALIASES[mode] ?? mode;
  if (!MODES[id]) throw new Error(`未知の換気モード: ${mode}`);
  return id;
}

const EPS = 1e-9;

// 最初の状態。肺は呼気弁の圧（PEEP、APRV では Plow）と釣り合っているところから始める
export function createState(patient, settings, deviceId) {
  const modeId = canonicalMode(settings.mode);
  const mode = MODES[modeId];
  const limits = resolveDeviceLimits(deviceId, settings);
  const base = mode.baselinePressure(settings);
  return {
    n: 0,                 // ステップ番号。時刻 t = n × DT
    v: base * patient.c,  // 機能的残気量からの容量の増分
    flow: 0,
    paw: base,
    phase: 'exp',         // 'insp' | 'inspHold' | 'exp' | 'expHold'
    phaseSteps: 0,        // いまの相に入ってからのステップ数
    cycleSteps: 0,        // 吸気開始からのステップ数（ホールド中は進めない）
    started: false,       // 最初の呼吸が始まったか
    modeId,
    modeState: mode.init(settings, limits),
    breath: null,         // いまの呼吸の集計
    breathCount: 0,
    pendingInspHold: 0,   // 予約された吸気ホールドのステップ数
    pendingExpHold: 0,
    holdStepsLeft: 0,
    queuedTrigger: null,
    pendingManualBreath: false, // 予約された用手換気
    forceExp: false,            // アラーム上限に達したので、次のステップで呼気に移る
    breathSettings: settings, // いまの呼吸が始まったときの設定（吸気の途中で設定が変わっても、その吸気は元の設定で終える）
  };
}

function beginInspiration(s, trigger, settings, limits) {
  const mode = MODES[s.modeId];
  let completed = null;
  let modeState = s.modeState;
  if (s.breath) {
    completed = finalizeBreath(s.breath, s.v);
    if (completed.mode === s.modeId) modeState = mode.afterBreath(modeState, completed, settings, limits);
  }
  const prepared = mode.prepareBreath(modeState, settings, limits, trigger);
  const type = trigger === 'manual' ? 'mandatory' : s.modeId === 'PSV' ? 'spontaneous' : trigger === 'patient' ? 'assisted' : 'mandatory';
  const breath = newBreath({
    index: s.breathCount,
    modeId: s.modeId,
    trigger,
    type,
    tStart: s.n * DT,
    vStart: s.v,
    peepSet: mode.baselinePressure(settings),
    flowPattern: settings.flowPattern,
    flags: prepared.flags,
    targetDeltaP: prepared.modeState.deltaP,
  });
  return {
    state: {
      ...s, phase: 'insp', phaseSteps: 0, cycleSteps: 0, started: true,
      modeState: prepared.modeState, breath, breathCount: s.breathCount + 1, queuedTrigger: null,
      breathSettings: settings, pendingManualBreath: false, forceExp: false,
    },
    completed,
  };
}

// 時間を 1 ステップ（DT 秒）進める。
// 返り値：{ state, sample, breath }。breath は、このステップで終わった呼吸の実測値（なければ null）
export function step(prev, patient, settings, deviceId, effort = null) {
  const limits = resolveDeviceLimits(deviceId, settings);
  let s = { ...prev };
  let completed = null;

  // モードの切り替えは呼気中に行う（吸気の途中では切り替えない）
  if (s.phase === 'exp') {
    const wanted = canonicalMode(settings.mode);
    if (wanted !== s.modeId) {
      s.modeId = wanted;
      s.modeState = MODES[wanted].init(settings, limits);
    }
  }
  const mode = MODES[s.modeId];

  // 1. 相の切り替え（1 ステップ前の値で判定する）
  if (s.phase === 'exp') {
    let trigger = mode.inspTrigger({
      first: !s.started, expSteps: s.phaseSteps, cycleSteps: s.cycleSteps, flow: s.flow, settings,
    });
    if (!trigger && s.pendingManualBreath) trigger = 'manual';
    if (trigger) {
      if (s.pendingExpHold > 0 && s.breath) {
        s = { ...s, phase: 'expHold', phaseSteps: 0, holdStepsLeft: s.pendingExpHold, pendingExpHold: 0, queuedTrigger: trigger };
      } else {
        ({ state: s, completed } = beginInspiration(s, trigger, settings, limits));
      }
    }
  } else if (s.phase === 'expHold') {
    if (s.holdStepsLeft <= 0) {
      s = { ...s, breath: { ...s.breath, totalPeep: s.paw } };
      ({ state: s, completed } = beginInspiration(s, s.queuedTrigger ?? 'time', settings, limits));
    }
  } else if (s.phase === 'insp') {
    const ends = mode.inspEnds({
      inspSteps: s.phaseSteps, tau: s.phaseSteps * DT, flow: s.flow,
      delivered: s.v - s.breath.vStart, breath: s.breath, settings: s.breathSettings, modeState: s.modeState,
    });
    if (s.forceExp) {
      s = { ...s, phase: 'exp', phaseSteps: 0, forceExp: false };
    } else if (ends) {
      if (s.pendingInspHold > 0) {
        s = { ...s, phase: 'inspHold', phaseSteps: 0, holdStepsLeft: s.pendingInspHold, pendingInspHold: 0 };
      } else {
        s = { ...s, phase: 'exp', phaseSteps: 0 };
      }
    }
  } else if (s.phase === 'inspHold') {
    if (s.holdStepsLeft <= 0) {
      s = { ...s, phase: 'exp', phaseSteps: 0, breath: { ...s.breath, pplatHold: s.paw } };
    }
  }

  // 2. いまの相で 1 ステップ積分する
  const t0 = s.n * DT;
  const t1 = (s.n + 1) * DT;
  const pmusOfT = (tt) => pmusAt(tt, effort);
  const pmus1 = pmusOfT(t1);
  const tau0 = s.phaseSteps * DT;
  const holding = s.phase === 'inspHold' || s.phase === 'expHold';

  let control;
  if (holding) {
    control = { type: 'occluded' };
  } else if (s.phase === 'insp') {
    control = mode.inspControl({
      tau: tau0, delivered: s.v - s.breath.vStart, breath: s.breath, settings: s.breathSettings, modeState: s.modeState, limits,
    });
  } else {
    const valve = mode.baselinePressure(settings); // 受動的な呼気：呼気弁の圧は設定 PEEP（APRV では Plow）
    control = { type: 'pressure', at: () => valve };
  }

  const cap = s.phase === 'insp' ? limits.pressureCap : null; // 機種の圧の上限は吸気中だけ当てはめる
  let v1 = s.v;
  let flow1 = 0;
  let paw1;
  let limited = false;
  let occluded = control.type === 'occluded';

  if (control.type === 'flow') {
    v1 = stepFlowControlled(s.v, t0, DT, (tt) => control.at(tau0 + (tt - t0)));
    flow1 = control.at(tau0 + DT);
    paw1 = pawAtFlow(flow1, v1, patient, pmus1);
    if (cap != null && paw1 > cap + EPS) {
      // 量規定でも、圧が上限に達したら上限の圧で頭打ちにする（流量が絞られ、VT に届かなくなる）
      limited = true;
      v1 = stepPressureControlled(s.v, t0, DT, () => cap, pmusOfT, patient);
      if (v1 < s.v) v1 = s.v; // 吸気中に吐かせることはしない
      flow1 = Math.max(0, flowAtPressure(cap, v1, patient, pmus1));
      paw1 = pawAtFlow(flow1, v1, patient, pmus1);
    }
  } else if (control.type === 'pressure') {
    let target = control.at;
    if (cap != null && control.at(tau0 + DT) > cap + EPS) {
      limited = true;
      target = (tau) => Math.min(control.at(tau), cap);
    }
    v1 = stepPressureControlled(s.v, t0, DT, (tt) => target(tau0 + (tt - t0)), pmusOfT, patient);
    paw1 = target(tau0 + DT);
    flow1 = flowAtPressure(paw1, v1, patient, pmus1);
  }
  if (occluded) {
    // 両弁を閉じている（吸気ポーズ、吸気ホールド、呼気ホールド）：流量 0、気道内圧 = 肺胞圧
    paw1 = alveolarPressure(v1, patient, pmus1);
  }

  // 機種のルール：吸気中に気道内圧がアラーム上限に達したら、その吸気を打ち切る（次のステップで呼気に移る）
  const terminated = s.phase === 'insp' && limits.inspTerminatePressure != null && paw1 >= limits.inspTerminatePressure - 1e-6;

  // 3. 集計
  let breath = s.breath;
  if (breath) {
    breath = accumulate(breath, { phase: s.phase, paw: paw1, flow: flow1, v: v1, occluded, limited, terminated });
    // model: 2 レベルの圧のモードでは、自発呼吸を呼吸筋圧 Pmus の立ち上がりで数える。
    //        実機は流量の変化で検出するが、圧の切り替えによる流量と重なると数え落とすため、単純化した
    if (mode.countsSpontaneousEfforts && !(pmusOfT(t0) > 0) && pmus1 > 0) {
      breath = { ...breath, spontCount: breath.spontCount + 1 };
    }
  }

  const next = {
    ...s,
    n: s.n + 1,
    v: v1,
    flow: flow1,
    paw: paw1,
    phaseSteps: s.phaseSteps + 1,
    cycleSteps: holding ? s.cycleSteps : s.cycleSteps + 1,
    holdStepsLeft: holding ? s.holdStepsLeft - 1 : s.holdStepsLeft,
    breath,
    forceExp: terminated,
  };
  // vBreath：いまの呼吸の始まりからの容量（人工呼吸器の容量波形はこの値）
  const sample = {
    t: t1, paw: paw1, flow: flow1, v: v1, vBreath: breath ? v1 - breath.vStart : 0, pmus: pmus1, phase: s.phase, limited,
  };
  return { state: next, sample, breath: completed };
}

// seconds 秒ぶん進める。返り値：{ state, samples, breaths }
export function run(state, patient, settings, deviceId, effort, seconds) {
  const samples = [];
  const breaths = [];
  let s = state;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    const r = step(s, patient, settings, deviceId, effort);
    s = r.state;
    samples.push(r.sample);
    if (r.breath) breaths.push(r.breath);
  }
  return { state: s, samples, breaths };
}
