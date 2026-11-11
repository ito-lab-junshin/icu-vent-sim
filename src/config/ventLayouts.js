// 人工呼吸器レイアウト（スキン）定義。メーカーのロゴ・商標デザインは再現しない。
// 表示名は機種ごとに持つ。出典と確認状況は docs/REFERENCES.md と対応させる。
export const VENT_LAYOUTS = [
  { id: 'pb980', label: 'PB980 風' },
  { id: 'hamilton', label: 'Hamilton C6 風' }, // C6 取扱説明書で名称・画面を確認済み
  { id: 'evita', label: 'Evita V800 風' },     // V800/V600 取扱説明書で名称・画面を確認済み（2026-11-11 に V500 風から変更）
];

const SRC = {
  pb980: 'PB980 Quick Reference Guide（13-VE-0089(2)）',
  c6: 'HAMILTON-C6 取扱説明書 v1.2.x（10197573/00）表 7-2',
  v800: 'Evita V800/V600 取扱説明書 SW 1.n（9055601）3.6.2',
};
const v = (name, src) => ({ name, status: 'verified', src });

// 共通モード ID → 機種ごとの表示名（3 機種とも一次資料で確認済み）
export const MODE_NAMES = {
  'VC-AC': { pb980: v('A/C VC', SRC.pb980), hamilton: v('(S)CMV', SRC.c6), evita: v('VC-AC', SRC.v800) },
  'PC-AC': { pb980: v('A/C PC', SRC.pb980), hamilton: v('PCV+', SRC.c6), evita: v('PC-AC', SRC.v800) },
  PRVC: { pb980: v('A/C VC+', SRC.pb980), hamilton: v('APVcmv', SRC.c6), evita: v('VC-AC + AutoFlow', SRC.v800) },
  PSV: { pb980: v('SPONT PS', SRC.pb980), hamilton: v('SPONT', SRC.c6), evita: v('SPN-CPAP/PS', SRC.v800) },
  APRV: { pb980: v('BiLevel', SRC.pb980), hamilton: v('APRV', SRC.c6), evita: v('PC-APRV', SRC.v800) },
  BIPAP: { pb980: v('BiLevel', SRC.pb980), hamilton: v('DuoPAP', SRC.c6), evita: v('PC-BIPAP', SRC.v800) },
};

// 機種固有の動作ルール（一次資料で確認済み）
export const DEVICE_RULES = {
  pb980: {
    vcPlusMinPressureAbovePeep: 3, // VC+ の目標吸気圧は PEEP + 3 cmH2O を下回らない（VC+ QRG）
    bilevelMinPhAbovePl: 5,        // BiLevel では PH は PL より 5 cmH2O 以上高い（BiLevel QRG）
    bilevelPsReference: 'PL',      // BiLevel の PS は PL 基準（BiLevel QRG）
    status: 'verified',
  },
  hamilton: {
    // 出典：HAMILTON-C6 取扱説明書 v1.2.x。取扱説明書の圧の単位は hPa（コンフィグで変更可、14.3.2）。
    // シミュレータは cmH2O で表示し、1 hPa ≒ 1 cmH2O として扱う
    alarmUpperAbovePlimit: 10,         // 気道内圧アラーム上限は常にリミット圧 + 10。片方を変えると他方も連動（5.5.2）
    totalPressureCappedAtPlimit: true, // 総吸気圧がリミット圧を超える設定では供給圧がリミット圧に制限されアラーム（5.5.2）
    apvSafetyBound: 'Plimit',          // APVcmv の吸気圧はリミット圧（= アラーム上限 − 10）を超えない（7.3.1）
    apvSighBelowAlarmUpper: 3,         // 例外：深呼吸はアラーム上限より 3 低い圧まで（7.3.1）
    apvMinInspPressure: 5,             // APVcmv の最小吸気圧（ピーク圧 − PEEP）は 5（7.3 注記）
    apvNamingDefault: 'APVcmv',        // 名称はコンフィグで (S)CMV+ も選べる。既定は APVcmv（14.4.2）
    status: 'verified',
  },
  evita: {
    // 出典：Evita V800/V600 取扱説明書 SW 1.n（9055601）。圧の単位は mbar（hPa、cmH2O と同値として併記されている）
    // 吸気圧の上限（17.7）：Pmax/Paw high autoset が無効（工場出荷時）のとき、最大気道内圧は Paw high（アラーム上限）− 5 に制限
    // 有効にすると治療バーに Pmax コントロールが表示され、Pmax がアラーム上限と連動する
    maxPressureBelowPawHigh: 5,
    pmaxAutosetDefault: false,
    autoFlowModes: ['VC-CMV', 'VC-AC', 'VC-SIMV', 'VC-MMV'], // AutoFlow は従量式の各モードで使える（7.2 の表）
    // 設定範囲（成人、16.2 Set values）。シミュレータの設定上限・下限に使う
    adultRanges: {
      rate: [0.5, 98],         // /min
      ti: [0.11, 10],          // s
      timax: [0.1, 4],         // s（補助換気の最大吸気時間）
      vt: [100, 3000],         // mL
      inspFlow: [2, 120],      // L/min
      pinsp: [1, 95],          // cmH2O
      pmax: [2, 100],          // cmH2O
      peep: [0, 50],           // cmH2O
      psupp: [0, 95],          // cmH2O（ΔPsupp）
      slope: [0, 2],           // s（圧立ち上がり時間）
      fio2: [21, 100],         // Vol%
      trigger: [0.2, 15],      // L/min
      inspTerm: [5, 70],       // %（PS の吸気終了基準、ピーク吸気流量比）
      aprv: { thigh: [0.1, 30], tlow: [0.05, 30], phigh: [1, 95], plow: [0, 50], expTerm: [1, 80] },
    },
    status: 'verified',
  },
};
