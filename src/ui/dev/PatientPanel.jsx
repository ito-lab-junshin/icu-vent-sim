import { complianceFromMl, mlToL } from '../../engine/units.js';

// 患者の肺と自発呼吸を変える確認用パネル（確認用ページと人工呼吸器の画面で共用）。
// 初期値とスライダーの範囲は確認用に置いたもので、機種の既定値でもシナリオの値でもない。

export const PATIENT_INITIAL = {
  c: 50, rInsp: 10, rExp: 10, pmusMax: 0, effortRate: 15, tiEffort: 0.8,
  // ガス交換と循環（docs/PHASE3.md 8 の B の値。確認用で、シナリオの値ではない）
  shuntPct: 5, vdAlvPct: 0, vdAnat: 150, hb: 13, vo2: 250, vco2: 200, hco3: 24, coBase: 5,
};
// 心拍数・平均血圧・CVP の基準値（確認用）
const CIRCULATION_BASE = { hrBase: 75, mapBase: 85, cvpBase: 8 };

// 画面の値 → エンジンの内部単位
export function toEnginePatient(u) {
  return {
    patient: {
      c: complianceFromMl(u.c), rInsp: u.rInsp, rExp: u.rExp,
      gas: {
        shunt: u.shuntPct / 100, vdAlvFraction: u.vdAlvPct / 100, vdAnat: mlToL(u.vdAnat),
        hb: u.hb, vo2: u.vo2, vco2: u.vco2, hco3: u.hco3, coBase: u.coBase, ...CIRCULATION_BASE,
      },
    },
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
      <fieldset>
        <legend>ガス交換と循環</legend>
        <Slider label="シャント率" unit="%" value={u.shuntPct} min={0} max={60} step={1} onChange={set('shuntPct')} />
        <Slider label="肺胞死腔率" unit="%" value={u.vdAlvPct} min={0} max={60} step={1} onChange={set('vdAlvPct')} />
        <Slider label="解剖学的死腔" unit="mL" value={u.vdAnat} min={50} max={300} step={10} onChange={set('vdAnat')} />
        <Slider label="Hb" unit="g/dL" value={u.hb} min={5} max={18} step={0.5} onChange={set('hb')} />
        <Slider label="酸素消費量" unit="mL/min" value={u.vo2} min={150} max={500} step={10} onChange={set('vo2')} />
        <Slider label="二酸化炭素産生量" unit="mL/min" value={u.vco2} min={120} max={400} step={10} onChange={set('vco2')} />
        <Slider label="心拍出量の基準値" unit="L/min" value={u.coBase} min={2} max={10} step={0.5} onChange={set('coBase')} />
        <Slider label="HCO3" unit="mEq/L" value={u.hco3} min={10} max={40} step={1} onChange={set('hco3')} />
        <p className="ev-note">確認用の値（シナリオは Phase 4）。心拍数 75 /min、平均血圧 85 mmHg、CVP 8 mmHg を基準にしています。</p>
      </fieldset>
    </>
  );
}
