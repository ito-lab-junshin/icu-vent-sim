import { complianceFromMl } from '../../engine/units.js';

// 患者の肺と自発呼吸を変える確認用パネル（確認用ページと人工呼吸器の画面で共用）。
// 初期値とスライダーの範囲は確認用に置いたもので、機種の既定値でもシナリオの値でもない。

export const PATIENT_INITIAL = { c: 50, rInsp: 10, rExp: 10, pmusMax: 0, effortRate: 15, tiEffort: 0.8 };

// 画面の値 → エンジンの内部単位
export function toEnginePatient(u) {
  return {
    patient: { c: complianceFromMl(u.c), rInsp: u.rInsp, rExp: u.rExp },
    effort: u.pmusMax > 0 ? { pmusMax: u.pmusMax, rate: u.effortRate, tiEffort: u.tiEffort } : null,
  };
}

export function Slider({ label, unit, value, min, max, step: st, onChange }) {
  return (
    <label className="ev-slider">
      <span className="ev-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={st} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="ev-slider-value">{value}{unit ? ` ${unit}` : ''}</span>
    </label>
  );
}

export default function PatientPanel({ value: u, onChange }) {
  const set = (key) => (v) => onChange({ ...u, [key]: v });
  return (
    <>
      <fieldset>
        <legend>患者の肺</legend>
        <Slider label="コンプライアンス C" unit="mL/cmH2O" value={u.c} min={10} max={200} step={1} onChange={set('c')} />
        <Slider label="吸気抵抗 Rinsp" unit="cmH2O/(L/s)" value={u.rInsp} min={2} max={40} step={1} onChange={set('rInsp')} />
        <Slider label="呼気抵抗 Rexp" unit="cmH2O/(L/s)" value={u.rExp} min={2} max={40} step={1} onChange={set('rExp')} />
        <p className="ev-note">時定数 τ = Rexp × C = {((u.rExp * u.c) / 1000).toFixed(2)} s</p>
      </fieldset>
      <fieldset>
        <legend>自発呼吸（呼吸筋圧 Pmus）</legend>
        <Slider label="振幅 Pmus" unit="cmH2O" value={u.pmusMax} min={0} max={20} step={1} onChange={set('pmusMax')} />
        <Slider label="自発呼吸回数" unit="/min" value={u.effortRate} min={5} max={40} step={1} onChange={set('effortRate')} />
        <Slider label="吸気努力の時間" unit="s" value={u.tiEffort} min={0.4} max={1.5} step={0.1} onChange={set('tiEffort')} />
        <p className="ev-note">振幅 0 は深い鎮静・筋弛緩の状態</p>
      </fieldset>
    </>
  );
}
