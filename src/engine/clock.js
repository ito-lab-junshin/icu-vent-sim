// 時間制御：倍速と、時間経過ボタンの計算。純粋関数。
import { DT } from './units.js';
import { step } from './simulator.js';
import { advanceSlowState, alveolarVolume, initialSlowState, deriveVitals } from './gasDynamics.js';
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

// model: 時間経過ボタンでは、いまの設定で呼吸メカニクスを計算して、1 分あたりの換気を求める。
//        最初の 60 秒は捨てる（設定を変えた直後の、前の設定の呼吸や、換気が落ち着くまでの呼吸を数えないため）。
//        そのあと 30 秒以上（3 呼吸以上、長くても 120 秒）を測る
export const PROBE_WARMUP_SEC = 60;
export const PROBE_MIN_SEC = 30;
export const PROBE_MAX_SEC = 120;
export const PROBE_MIN_BREATHS = 3;
// 時間経過ボタンで遅い状態を進める刻み（秒）。トレンドの記録の間隔でもある
export const JUMP_STEP_SEC = 60;

// いまの設定で少しの間だけ呼吸メカニクスを計算し、1 分あたりの換気を求める（ガス交換は進めない）。
// 返り値の state は、計算し終えたときの呼吸メカニクスの状態（その設定で落ち着いた状態）
export function measureVentilation(state, patient, settings, deviceId, effort) {
  const mechanics = { ...patient, gas: undefined };
  let s = { ...state, pendingInspHold: 0, pendingExpHold: 0, pendingManualBreath: false };
  for (let i = 0; i < Math.round(PROBE_WARMUP_SEC / DT); i += 1) s = step(s, mechanics, settings, deviceId, effort).state;
  const breaths = [];
  const maxSteps = Math.round(PROBE_MAX_SEC / DT);
  const minSteps = Math.round(PROBE_MIN_SEC / DT);
  for (let i = 0; i < maxSteps && !(breaths.length >= PROBE_MIN_BREATHS && i >= minSteps); i += 1) {
    const r = step(s, mechanics, settings, deviceId, effort);
    s = r.state;
    if (r.breath) breaths.push(r.breath);
  }
  if (breaths.length === 0) {
    // 呼吸が 1 回も終わらない（無呼吸）
    return { vaLpm: 0, mve: 0, rr: 0, ppeak: null, palvMean: MODES[s.modeId].baselinePressure(settings), breaths: 0, state: s };
  }
  const duration = breaths.reduce((a, b) => a + b.ttot, 0);
  const perMin = (x) => (x / duration) * 60;
  return {
    vaLpm: perMin(breaths.reduce((a, b) => a + alveolarVolume(b.vte, patient.gas), 0)),
    mve: perMin(breaths.reduce((a, b) => a + b.vte, 0)),
    rr: perMin(breaths.length),
    ppeak: breaths.at(-1).pip,
    palvMean: breaths.reduce((a, b) => a + b.palvMean * b.ttot, 0) / duration,
    breaths: breaths.length,
    state: s,
  };
}

// 時間経過ボタン：seconds 秒ぶん、遅い状態だけを進める。
// その間、設定と患者のパラメータは変わらないものとする。予約されたホールドと用手換気は取り消す。
// 呼吸メカニクスは、その設定で落ち着いた状態（換気を測り終えたときの状態）になる。
// 返り値：{ state, points, ventilation }。points は 1 分ごとの記録（トレンド用）
export function jump(state, patient, settings, deviceId, effort, seconds) {
  const gas = patient.gas;
  const { state: settled, ...ventilation } = measureVentilation(state, patient, settings, deviceId, effort);
  let slow = state.slow ?? initialSlowState(gas, settings, MODES[state.modeId].baselinePressure(settings), state.n);
  const t0 = state.n * DT;
  const points = [];
  let done = 0;
  while (done < seconds - 1e-9) {
    const dtSec = Math.min(JUMP_STEP_SEC, seconds - done);
    slow = advanceSlowState(slow, { dtSec, alvVolL: ventilation.vaLpm * (dtSec / 60), palvMean: ventilation.palvMean }, gas, settings.fio2);
    done += dtSec;
    points.push({ t: t0 + done, vitals: deriveVitals(slow, gas), ppeak: ventilation.ppeak, mve: ventilation.mve });
  }
  const steps = Math.round(seconds / DT);
  const n = state.n + steps;
  const shift = (n - settled.n) * DT; // 測り終えた状態の時刻を、進めた先の時刻に合わせる
  return {
    state: {
      ...settled,
      n,
      slow: { ...slow, lastN: n },
      // いまの呼吸の開始時刻もずらす（無呼吸の判定などが、飛ばした時間を数えないように）
      breath: settled.breath ? { ...settled.breath, tStart: settled.breath.tStart + shift } : null,
      pendingInspHold: 0,
      pendingExpHold: 0,
      pendingManualBreath: false,
    },
    points,
    ventilation,
  };
}
