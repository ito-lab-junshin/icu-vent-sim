import { createContext, useContext, useRef, useState } from 'react';
import { useVentSimulation } from './vent/useVentSimulation.js';
import { bloodGasResult } from '../engine/bloodGas.js';

// エンジンの状態を画面全体で共有する。人工呼吸器の画面とベッドサイドモニタが、同じ状態を見る。
// 患者はシナリオ（src/scenarios）で決まる。シナリオを選び直すと、App がこの部品を作り直して最初から始める。
const SimulationContext = createContext(null);

export function SimulationProvider({ scenario, initialSettings, deviceId, children }) {
  const [settings, setSettings] = useState(initialSettings); // エンジンに渡している設定（確定済みのもの）
  const [bloodGases, setBloodGases] = useState([]); // 血液ガスの結果（古い順）
  const inputsRef = useRef(null);
  inputsRef.current = { patient: scenario.patient, effort: scenario.effort, settings, deviceId };
  const api = useVentSimulation(inputsRef);

  // 人工呼吸器の画面から、確定した設定を受け取る。変わっていれば、トレンドに印を付ける
  const applySettings = (next) => {
    if (JSON.stringify(next) === JSON.stringify(settings)) return;
    setSettings(next);
    api.markEvent();
  };

  // 血液ガスをオーダーする。その時刻の値が結果になる（待ち時間なし。docs/PHASE4.md 8 の H）
  const orderBloodGas = () => {
    const { vitals, t } = api.status;
    if (!vitals) return;
    setBloodGases((list) => [...list, bloodGasResult(vitals, settings.fio2, t)].slice(-20));
  };

  const value = { ...api, scenario, settings, applySettings, patientGas: scenario.patient.gas, bloodGases, orderBloodGas };
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation は SimulationProvider の中で使う');
  return ctx;
}
