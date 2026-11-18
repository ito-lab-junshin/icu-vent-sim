// 時間制御：倍速と、時間経過ボタンの計算。純粋関数。
import { DT } from './units.js';
import { step } from './simulator.js';
import { advanceSlowState, advanceLungState, effectivePatient, alveolarVolume, initialSlowState, deriveVitals } from './gasDynamics.js';
import { MODES } from './simulator.js';

// 倍速。エンジンを 1 フレームに何ステップも進めるだけで、計算は実時間と同じ
export const SPEEDS = [1, 10, 60];
// 時間経過ボタン（秒）
export const JUMPS = [
  { seconds: 30 * 60, label: '30 分' },
  { seconds: 60 * 60, label: '1 時間' },
  { seconds: 4 * 3600, label: '4 時間' },
  { seconds: 12 * 3600, label: '12 時間' },
];

// model: 時間経過ボタンの進め方。
//   1. はじめの部分は、ふつうの計算（5 ms 刻み）でそのまま進める。最初の 60 秒は換気が落ち着くのを待ち
//      （設定を変えた直後の、前の設定の呼吸を数えないため。速い変化であるリクルートもこの間に進む）、
//      そのあと 30 秒以上（3 呼吸以上、長くても 120 秒）で 1 分あたりの換気を測る。この時間も、進める時間に含める。
//   2. 残りは、遅い状態だけを 60 秒刻みで進める。
//   3. 3 区画の肺では、途中でコンプライアンスや死腔が変わる。2 % 以上変わったとき、または 10 分たったときに、
//      呼吸メカニクスを短く（15 秒待って、15 秒以上・2 呼吸以上）測り直す
export const PROBE_WARMUP_SEC = 60;
export const PROBE_MIN_SEC = 30;
export const PROBE_MAX_SEC = 120;
export const PROBE_MIN_BREATHS = 3;
export const REPROBE_WARMUP_SEC = 15;
export const REPROBE_MIN_SEC = 15;
export const REPROBE_MIN_BREATHS = 2;
export const REPROBE_MAX_SEC = 60;
export const REPROBE_CHANGE = 0.02;
export const REPROBE_INTERVAL_SEC = 600;
// 時間経過ボタンで遅い状態を進める刻み（秒）。トレンドの記録の間隔でもある
export const JUMP_STEP_SEC = 60;

const clearRequests = (state) => ({ ...state, pendingInspHold: 0, pendingExpHold: 0, pendingManualBreath: false });
const baselineOf = (state, settings) => MODES[state.modeId].baselinePressure(settings);

// 終わった呼吸の記録から、1 分あたりの換気をまとめる
function summarizeVentilation(breaths, state, settings) {
  if (breaths.length === 0) {
    // 呼吸が 1 回も終わらない（無呼吸）
    const p = baselineOf(state, settings);
    return { vtes: [], vaLpm: 0, mve: 0, rr: 0, ppeak: null, palvMean: p, pEndInsp: p, pEndExp: p, breaths: 0 };
  }
  const duration = breaths.reduce((a, b) => a + b.ttot, 0);
  const perMin = (x) => (x / duration) * 60;
  const mean = (key) => breaths.reduce((a, b) => a + b[key] * b.ttot, 0) / duration;
  return {
    vtes: breaths.map((b) => b.vte),
    mve: perMin(breaths.reduce((a, b) => a + b.vte, 0)),
    rr: perMin(breaths.length),
    ppeak: breaths.at(-1).pip,
    palvMean: mean('palvMean'),
    pEndInsp: mean('palvEndInsp'),
    pEndExp: mean('palvEndExp'),
    breaths: breaths.length,
  };
}
// 肺胞換気量（L/min）。死腔はいまの値（gas）で計算する
const alveolarVentilationOf = (v, gas) => (v.vtes.length === 0 ? 0 : v.vtes.reduce((a, vte) => a + alveolarVolume(vte, gas), 0) / v.vtes.length * v.rr);

// 呼吸メカニクスだけを少しの間だけ計算し、1 分あたりの換気を求める（遅い状態は進めない。時間も進めない）。
// 3 区画の肺では、いまの肺の状態（コンプライアンス）で固定して計算する。
// 返り値の state は、計算し終えたときの呼吸メカニクスの状態
export function measureVentilation(state, patient, settings, deviceId, effort, timing = {}) {
  const warmup = timing.warmupSec ?? PROBE_WARMUP_SEC;
  const minSec = timing.minSec ?? PROBE_MIN_SEC;
  const maxSec = timing.maxSec ?? PROBE_MAX_SEC;
  const minBreaths = timing.minBreaths ?? PROBE_MIN_BREATHS;
  const now = effectivePatient(patient, state.slow);
  const mechanics = { ...now, gas: undefined, lung: undefined };
  let s = clearRequests(state);
  for (let i = 0; i < Math.round(warmup / DT); i += 1) s = step(s, mechanics, settings, deviceId, effort).state;
  const breaths = [];
  const maxSteps = Math.round(maxSec / DT);
  const minSteps = Math.round(minSec / DT);
  for (let i = 0; i < maxSteps && !(breaths.length >= minBreaths && i >= minSteps); i += 1) {
    const r = step(s, mechanics, settings, deviceId, effort);
    s = r.state;
    if (r.breath) breaths.push(r.breath);
  }
  const v = summarizeVentilation(breaths, s, settings);
  return { ...v, vaLpm: alveolarVentilationOf(v, now.gas), state: s };
}

// 時間経過ボタン：seconds 秒ぶん進める。
// その間、設定と患者のパラメータは変わらないものとする。予約されたホールドと用手換気は取り消す。
// 返り値：{ state, points, ventilation }。points は 1 分ごとの記録（トレンド用）
export function jump(state, patient, settings, deviceId, effort, seconds) {
  const lung = patient.lung ?? null;
  const t0 = state.n * DT;
  const totalSteps = Math.round(seconds / DT);
  const recordEvery = Math.round(JUMP_STEP_SEC / DT);
  const points = [];
  let s = clearRequests(state);
  let done = 0; // 進めたステップ数
  const record = (v) => points.push({
    t: t0 + done * DT, vitals: s.slow ? deriveVitals(s.slow, patient.gas) : null, ppeak: v?.ppeak ?? null, mve: v?.mve ?? null,
  });

  // 1. はじめの部分：ふつうの計算で進める（落ち着くのを待ち、そのあと換気を測る）
  const warmupSteps = Math.round(PROBE_WARMUP_SEC / DT);
  const minSteps = Math.round(PROBE_MIN_SEC / DT);
  const maxSteps = Math.round(PROBE_MAX_SEC / DT);
  const breaths = [];
  let last = null;
  while (done < totalSteps) {
    const measured = done - warmupSteps;
    if (measured >= maxSteps || (measured >= minSteps && breaths.length >= PROBE_MIN_BREATHS)) break;
    const r = step(s, patient, settings, deviceId, effort);
    s = r.state;
    done += 1;
    if (r.breath) {
      last = r.breath;
      if (done > warmupSteps) breaths.push(r.breath);
    }
    if (done % recordEvery === 0) record(last ? { ppeak: last.pip, mve: (last.vte / last.ttot) * 60 } : null);
  }
  let v = summarizeVentilation(breaths, s, settings);
  let ventilation = { ...v, vaLpm: alveolarVentilationOf(v, effectivePatient(patient, s.slow).gas) };

  // 2. 残り：遅い状態だけを大きな刻みで進める
  if (done < totalSteps) {
    let slow = s.slow ?? initialSlowState(patient.gas, settings, baselineOf(s, settings), s.n, lung);
    let mech = s; // 呼吸メカニクスの状態（測り直すたびに、その時点の肺の状態で落ち着いたものにする）
    let probedC = slow.cEff;
    let probedVd = slow.vdAlv;
    let sinceProbe = 0;
    while (done < totalSteps) {
      const stepN = Math.min(recordEvery - (done % recordEvery), totalSteps - done);
      const dtSec = stepN * DT;
      const gasNow = effectivePatient(patient, slow).gas;
      const va = alveolarVentilationOf(v, gasNow);
      slow = advanceSlowState(slow, { dtSec, alvVolL: va * (dtSec / 60), palvMean: v.palvMean }, gasNow, settings.fio2);
      if (lung) slow = advanceLungState(slow, { pEndInsp: v.pEndInsp, pEndExp: v.pEndExp, dtSec }, lung);
      done += stepN;
      sinceProbe += dtSec;
      s = { ...s, slow };
      if (done % recordEvery === 0) record(v);
      // 3. 肺の状態が変わったら、呼吸メカニクスを測り直す
      const changed = lung && (Math.abs(slow.cEff - probedC) / probedC > REPROBE_CHANGE || Math.abs(slow.vdAlv - probedVd) > REPROBE_CHANGE);
      if (lung && done < totalSteps && (changed || sinceProbe >= REPROBE_INTERVAL_SEC)) {
        // コンプライアンスが変わったぶん、肺胞圧がつながるように容量を合わせ直してから測る
        const k = slow.cEff / probedC;
        const scaled = { ...mech, slow, v: mech.v * k, breath: mech.breath ? { ...mech.breath, vStart: mech.breath.vStart * k, vEndInsp: mech.breath.vEndInsp * k } : null };
        const m = measureVentilation(scaled, patient, settings, deviceId, effort, {
          warmupSec: REPROBE_WARMUP_SEC, minSec: REPROBE_MIN_SEC, maxSec: REPROBE_MAX_SEC, minBreaths: REPROBE_MIN_BREATHS,
        });
        mech = m.state;
        v = m;
        probedC = slow.cEff;
        probedVd = slow.vdAlv;
        sinceProbe = 0;
      }
    }
    if (lung && slow.cEff !== probedC) {
      const k = slow.cEff / probedC;
      mech = { ...mech, v: mech.v * k, breath: mech.breath ? { ...mech.breath, vStart: mech.breath.vStart * k, vEndInsp: mech.breath.vEndInsp * k } : null };
    }
    ventilation = { ...v, vaLpm: alveolarVentilationOf(v, effectivePatient(patient, slow).gas) };
    delete ventilation.state;
    // 呼吸メカニクスの状態の時刻を、進めた先の時刻に合わせる
    const n = state.n + totalSteps;
    const shift = (n - mech.n) * DT;
    s = {
      ...mech,
      n,
      slow: { ...slow, lastN: n },
      breath: mech.breath ? { ...mech.breath, tStart: mech.breath.tStart + shift } : null,
    };
  }
  return { state: clearRequests(s), points, ventilation };
}
