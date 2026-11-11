import { useCallback, useEffect, useRef, useState } from 'react';
import { createState, step, MODES } from '../../engine/simulator.js';
import { requestInspHold, requestExpHold, requestManualBreath } from '../../engine/maneuvers.js';
import { summarizeBreaths } from '../../engine/breathMetrics.js';
import { deriveVitals } from '../../engine/gasDynamics.js';
import { jump } from '../../engine/clock.js';
import { DT } from '../../engine/units.js';

// エンジンを進める共通の部品（人工呼吸器の画面、ベッドサイドモニタ、確認用ページで共用する）。
//
// inputsRef.current = { patient, effort, settings, deviceId }（エンジンの内部単位）
// 返り値：
//   sim      ref。sim.current = { state, samples（直近 windowSec 秒）, breaths（終わった呼吸）, trend（1 分ごとの記録）, marks（設定を変えた時刻） }
//            波形の部品が直接読む
//   breaths  終わった呼吸の実測値（古い順、直近 60 個）
//   status   { t, phase, lastInspStart, terminated, vitals }。約 0.2 秒ごとと、相が変わったときに更新する。
//            terminated は、いまの呼吸の吸気がアラーム上限で打ち切られたか。vitals はガス交換と循環の値（gas がなければ null）
//   speed    倍速（1、10、60）。エンジンを 1 フレームに何ステップも進めるだけで、計算は同じ
//   jumpBy   時間経過ボタン。遅い状態だけを進める

const TREND_INTERVAL_STEPS = Math.round(60 / DT); // トレンドは 1 分ごとに記録する
const TREND_MAX_POINTS = 3000;

const baselineOf = (state, settings) => MODES[state.modeId].baselinePressure(settings);

function vitalsOf(state, inputs) {
  return inputs.patient.gas && state.slow ? deriveVitals(state.slow, inputs.patient.gas) : null;
}

function trendPoint(t, vitals, ppeak, mve) {
  return {
    t, ppeak, mve,
    spO2: vitals ? vitals.spO2 * 100 : null, etCO2: vitals?.etCO2 ?? null, hr: vitals?.hr ?? null, map: vitals?.map ?? null,
    paO2: vitals?.paO2 ?? null, paCO2: vitals?.paCO2 ?? null, ph: vitals?.ph ?? null,
  };
}

export function useVentSimulation(inputsRef, windowSec = 10) {
  const make = () => {
    const i = inputsRef.current;
    return { state: createState(i.patient, i.settings, i.deviceId), samples: [], breaths: [], trend: [], marks: [] };
  };
  const sim = useRef(null);
  if (sim.current === null) sim.current = make();
  const [breaths, setBreaths] = useState([]);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [trendVersion, setTrendVersion] = useState(0);
  const statusOf = () => {
    const s = sim.current.state;
    return {
      t: s.n * DT, phase: s.phase, lastInspStart: s.breath?.tStart ?? 0,
      terminated: Boolean(s.breath?.highPressureTerminated),
      vitals: vitalsOf(s, inputsRef.current),
      baseline: baselineOf(s, inputsRef.current.settings),
    };
  };
  const [status, setStatus] = useState(statusOf);

  const record = () => {
    const s = sim.current;
    const last = s.breaths.at(-1);
    s.trend.push(trendPoint(s.state.n * DT, vitalsOf(s.state, inputsRef.current), last?.pip ?? null, last ? summarizeBreaths(s.breaths).mve : null));
    if (s.trend.length > TREND_MAX_POINTS) s.trend.splice(0, s.trend.length - TREND_MAX_POINTS);
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    let lastStatusAt = performance.now();
    let lastPhase = null;
    const tick = (now) => {
      const elapsed = Math.min(0.1, (now - last) / 1000); // タブが裏に回っていた間は進めない
      last = now;
      const s = sim.current;
      if (running) {
        carry += elapsed * speed;
        const i = inputsRef.current;
        let changed = false;
        let recorded = false;
        while (carry >= DT) {
          carry -= DT;
          const r = step(s.state, i.patient, i.settings, i.deviceId, i.effort);
          s.state = r.state;
          s.samples.push(r.sample);
          if (r.breath) {
            s.breaths.push(r.breath);
            changed = true;
          }
          if (s.state.n % TREND_INTERVAL_STEPS === 0) {
            record();
            recorded = true;
          }
        }
        const keep = Math.round(windowSec / DT) + 1;
        if (s.samples.length > keep) s.samples.splice(0, s.samples.length - keep);
        if (s.breaths.length > 60) s.breaths.splice(0, s.breaths.length - 60);
        if (changed) setBreaths([...s.breaths]);
        if (recorded) setTrendVersion((v) => v + 1);
        if (s.state.phase !== lastPhase || now - lastStatusAt >= 200) {
          lastPhase = s.state.phase;
          lastStatusAt = now;
          setStatus(statusOf());
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, inputsRef, windowSec]);

  const inspHold = useCallback((seconds) => { sim.current.state = requestInspHold(sim.current.state, seconds); }, []);
  const expHold = useCallback((seconds) => { sim.current.state = requestExpHold(sim.current.state, seconds); }, []);
  const manualBreath = useCallback(() => { sim.current.state = requestManualBreath(sim.current.state); }, []);
  // 設定を変えた時刻に印を付ける（トレンドグラフに縦線で出る）
  const markEvent = useCallback(() => {
    sim.current.marks.push(sim.current.state.n * DT);
    setTrendVersion((v) => v + 1);
  }, []);

  // 時間経過ボタン：遅い状態だけを seconds 秒ぶん進める。波形と、終わった呼吸の記録は消す
  const jumpBy = (seconds) => {
    const i = inputsRef.current;
    if (!i.patient.gas) return;
    const s = sim.current;
    const r = jump(s.state, i.patient, i.settings, i.deviceId, i.effort, seconds);
    s.state = r.state;
    s.samples = [];
    s.breaths = [];
    for (const p of r.points) s.trend.push(trendPoint(p.t, p.vitals, p.ppeak, p.mve));
    if (s.trend.length > TREND_MAX_POINTS) s.trend.splice(0, s.trend.length - TREND_MAX_POINTS);
    setBreaths([]);
    setTrendVersion((v) => v + 1);
    setStatus(statusOf());
  };

  const reset = () => {
    sim.current = make();
    setBreaths([]);
    setTrendVersion((v) => v + 1);
    setStatus(statusOf());
  };

  return {
    sim, breaths, status, running, setRunning, speed, setSpeed, trendVersion,
    inspHold, expHold, manualBreath, markEvent, jumpBy, reset,
  };
}
