import { createContext, useContext, useRef, useState } from 'react';
import { useVentSimulation } from './vent/useVentSimulation.js';
import { PATIENT_INITIAL, toEnginePatient } from './dev/PatientPanel.jsx';

// エンジンの状態を画面全体で共有する。人工呼吸器の画面とベッドサイドモニタが、同じ状態を見る。
const SimulationContext = createContext(null);

export function SimulationProvider({ initialSettings, deviceId, children }) {
  const [patient, setPatient] = useState(PATIENT_INITIAL); // 確認用の患者パラメータ（画面の値）
  const [settings, setSettings] = useState(initialSettings); // エンジンに渡している設定（確定済みのもの）
  const inputsRef = useRef(null);
  inputsRef.current = { ...toEnginePatient(patient), settings, deviceId };
  const api = useVentSimulation(inputsRef);

  // 人工呼吸器の画面から、確定した設定を受け取る。変わっていれば、トレンドに印を付ける
  const applySettings = (next) => {
    if (JSON.stringify(next) === JSON.stringify(settings)) return;
    setSettings(next);
    api.markEvent();
  };

  const value = { ...api, patient, setPatient, settings, applySettings, patientGas: inputsRef.current.patient.gas };
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation は SimulationProvider の中で使う');
  return ctx;
}
