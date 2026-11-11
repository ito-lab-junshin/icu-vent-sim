import { useCallback, useEffect, useRef, useState } from 'react';
import { createState, step } from '../../engine/simulator.js';
import { requestInspHold, requestExpHold, requestManualBreath } from '../../engine/maneuvers.js';
import { DT } from '../../engine/units.js';

// エンジンを実時間で進める共通の部品（3 機種の画面と確認用ページで共用する）。
//
// inputsRef.current = { patient, effort, settings, deviceId }（エンジンの内部単位）
// 返り値：
//   sim      ref。sim.current = { state, samples（直近 windowSec 秒）, breaths（終わった呼吸） }。波形の部品が直接読む
//   breaths  終わった呼吸の実測値（古い順、直近 60 個）
//   status   { t, phase, lastInspStart, terminated }。約 0.2 秒ごとと、相が変わったときに更新する。
//            terminated は、いまの呼吸の吸気がアラーム上限で打ち切られたか（呼吸が終わるのを待たずにアラームを出すため）
export function useVentSimulation(inputsRef, windowSec = 10) {
  const make = () => {
    const i = inputsRef.current;
    return { state: createState(i.patient, i.settings, i.deviceId), samples: [], breaths: [] };
  };
  const sim = useRef(null);
  if (sim.current === null) sim.current = make();
  const [breaths, setBreaths] = useState([]);
  const [running, setRunning] = useState(true);
  const [status, setStatus] = useState({ t: 0, phase: 'exp', lastInspStart: 0, terminated: false });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    let lastStatusAt = -1;
    let lastPhase = null;
    const tick = (now) => {
      const elapsed = Math.min(0.1, (now - last) / 1000); // タブが裏に回っていた間は進めない
      last = now;
      const s = sim.current;
      if (running) {
        carry += elapsed;
        const i = inputsRef.current;
        let changed = false;
        while (carry >= DT) {
          carry -= DT;
          const r = step(s.state, i.patient, i.settings, i.deviceId, i.effort);
          s.state = r.state;
          s.samples.push(r.sample);
          if (r.breath) {
            s.breaths.push(r.breath);
            changed = true;
          }
        }
        const keep = Math.round(windowSec / DT) + 1;
        if (s.samples.length > keep) s.samples.splice(0, s.samples.length - keep);
        if (s.breaths.length > 60) s.breaths.splice(0, s.breaths.length - 60);
        if (changed) setBreaths([...s.breaths]);
        const t = s.state.n * DT;
        if (s.state.phase !== lastPhase || t - lastStatusAt >= 0.2) {
          lastPhase = s.state.phase;
          lastStatusAt = t;
          setStatus({
            t, phase: s.state.phase, lastInspStart: s.state.breath?.tStart ?? 0,
            terminated: Boolean(s.state.breath?.highPressureTerminated),
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, inputsRef, windowSec]);

  const inspHold = useCallback((seconds) => { sim.current.state = requestInspHold(sim.current.state, seconds); }, []);
  const expHold = useCallback((seconds) => { sim.current.state = requestExpHold(sim.current.state, seconds); }, []);
  const manualBreath = useCallback(() => { sim.current.state = requestManualBreath(sim.current.state); }, []);
  const reset = () => {
    sim.current = make();
    setBreaths([]);
    setStatus({ t: 0, phase: 'exp', lastInspStart: 0, terminated: false });
  };

  return { sim, breaths, status, running, setRunning, inspHold, expHold, manualBreath, reset };
}
