// 血液ガスの結果（Phase 4A）。純粋関数。Phase 3 の計算結果（deriveVitals）を、検査結果の形にまとめる。

// BE（docs/PHASE4.md 8 の F の案）：BE = 0.93 ×（HCO3 − 24.4 + 14.8 ×（pH − 7.40））
// 教育用モデルの式（references.js の physiologyBaseExcess）。原典では未確認
export function baseExcess(hco3, ph) {
  return 0.93 * (hco3 - 24.4 + 14.8 * (ph - 7.4));
}

// model: Lac（docs/PHASE4.md 8 の G の案）。ふだんは 1.0 mmol/L で一定。
//        混合静脈血の酸素飽和度が 50 % を下回ったとき（酸素の供給が大きく不足したとき）だけ、下回った分 1 % あたり 0.2 mmol/L 上がる。
//        時間の遅れは入れていない
export const LACTATE_BASE = 1.0;
export const LACTATE_SVO2_THRESHOLD = 0.5;
export const LACTATE_PER_SVO2_PERCENT = 0.2;
export function lactate(svo2) {
  return LACTATE_BASE + Math.max(0, LACTATE_SVO2_THRESHOLD - svo2) * 100 * LACTATE_PER_SVO2_PERCENT;
}

// P/F 比 = PaO2 ÷ FiO2
export const pfRatio = (pao2, fio2) => pao2 / fio2;

// 血液ガスの結果。t は採血時刻（シミュレーション開始からの秒）
export function bloodGasResult(vitals, fio2, t) {
  return {
    t,
    fio2,
    ph: vitals.ph,
    paCO2: vitals.paCO2,
    paO2: vitals.paO2,
    hco3: vitals.hco3,
    be: baseExcess(vitals.hco3, vitals.ph),
    lac: lactate(vitals.svO2),
    saO2: vitals.saO2,
    pf: pfRatio(vitals.paO2, fio2),
  };
}

// 画面に出す形（丸めだけ）
export const BLOOD_GAS_ITEMS = [
  { key: 'ph', label: 'pH', unit: '', digits: 2 },
  { key: 'paCO2', label: 'PaCO2', unit: 'mmHg', digits: 0 },
  { key: 'paO2', label: 'PaO2', unit: 'mmHg', digits: 0 },
  { key: 'hco3', label: 'HCO3', unit: 'mEq/L', digits: 0 },
  { key: 'be', label: 'BE', unit: 'mEq/L', digits: 1 },
  { key: 'lac', label: 'Lac', unit: 'mmol/L', digits: 1 },
  { key: 'saO2', label: 'SaO2', unit: '%', digits: 0, scale: 100 },
  { key: 'pf', label: 'P/F 比', unit: '', digits: 0 },
];
export function formatBloodGas(result) {
  return BLOOD_GAS_ITEMS.map((it) => ({ ...it, value: (result[it.key] * (it.scale ?? 1)).toFixed(it.digits) }));
}
