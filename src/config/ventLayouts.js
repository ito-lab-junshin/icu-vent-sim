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
    vcPlusMaxBelowPeakAlarm: 3,    // VC+ の目標吸気圧は PEAK アラーム上限 − 3 cmH2O まで（取扱説明書・QRG。2026-11-11 伊藤先生確認）
    // PEAK アラーム上限に達したら、その吸気を打ち切って呼気に移る。
    // 2026-11-11 に伊藤先生の了承を得て Phase 2 で入れた動作。取扱説明書の原文では未確認（references.js の pb980PeakAlarmTruncation）
    peakAlarmTruncatesInspiration: true,
    maxCircuitPressure: 125,       // 最大回路内圧は 125 cmH2O 未満（同上。エンジンではまだ使っていない）
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
    // AutoFlow の最小吸気圧（AutoFlow の動作原理。2026-11-11 伊藤先生確認）
    autoFlowMinAbovePeepUntriggered: 3,  // トリガなしの強制換気：PEEP + 3
    autoFlowMinAbovePeepTriggered: 0.1,  // トリガありの強制換気・自発呼吸：PEEP + 0.1
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

// PB980 風の画面の設定項目（Phase 2）。
// 範囲（min、max）：Puritan Bennett 980 カタログ（ct-va-980x(m4)2205、RMS_2019_0547-A-2）14 ページの
//   「コントロール」「アラーム」の表（成人／小児）で確認済み（2026-11-11、伊藤先生提供）。
//   ただし unverifiedRange に挙げた項目は、カタログに範囲がない（または単位が違う）ので未確認。
// 刻み（step）と初期値（initial）：カタログに記載がなく、画面を動かすための仮の値。未確認。
// 画面では、未確認の値に「参考値（未確認）」と表示する（references.js の pb980SettingStepsInitials ほか）。
// 記号（f、VT、V̇max など）は DESIGN.md 5.1 と PB980 Quick Reference Guide の表記。
const num = (label, title, unit, min, max, step, initial) => ({ type: 'number', label, title, unit, min, max, step, initial });
const choice = (label, title, options, initial) => ({ type: 'choice', label, title, options, initial });
export const PB980_SETTINGS = {
  rangeStatus: 'verified',
  stepInitialStatus: 'unverified',
  // 範囲も未確認の項目
  unverifiedRange: {
    height: 'カタログに身長の範囲の記載がない',
    rise: 'カタログの設定は「立ち上がり時間 %（1〜100 %）」。秒との対応が分からないので、秒で仮に設定している',
    tl: 'カタログは「0.2 秒以上」で、上限の記載がない',
  },
  note: '仮の値で、機種の仕様ではない',
  items: {
    // 患者
    sex: choice('性別', '性別', [{ value: 'male', label: '男性' }, { value: 'female', label: '女性' }], 'male'),
    height: num('身長', '身長', 'cm', 130, 200, 1, 170),
    // 換気の種類（カタログ：モード A/C、SIMV、SPONT、BiLevel。強制呼吸タイプ VC、PC、VC+）
    mode: choice('Mode', 'Mode', [
      // 並びは PB980 と同じ（A/C、SIMV、SPONT、BiLevel）。SIMV はエンジンにないので選べない
      { value: 'AC', label: 'A/C' }, { value: 'SIMV', label: 'SIMV', unsupported: true },
      { value: 'SPONT', label: 'SPONT' }, { value: 'BILEVEL', label: 'BiLevel' },
    ], 'AC'),
    mandatoryType: choice('強制換気の種類', '強制換気の種類', [{ value: 'VC', label: 'VC' }, { value: 'PC', label: 'PC' }, { value: 'VC+', label: 'VC+' }], 'VC'),
    // 主要設定（範囲はカタログの値）
    f: num('f', '呼吸回数', '/min', 1, 100, 1, 12),                    // 1.0〜100 回/min
    vt: num('VT', '一回換気量', 'mL', 25, 2500, 5, 500),               // 25〜2500 mL
    vmax: num('V̇max', 'ピークフロー', 'L/min', 3, 150, 1, 60),        // 成人 3〜150 L/min
    tpl: num('TPL', 'プラトー時間', 's', 0, 2, 0.1, 0.5),              // 0.0〜2.0 秒
    flowPattern: choice('流量波形', 'フローパターン', [{ value: 'square', label: '矩形波' }, { value: 'ramp', label: 'Ramp' }], 'square'), // 漸減波、矩形波
    pi: num('PI', 'PC 吸気圧（PEEP 上）', 'cmH2O', 5, 90, 1, 15),      // 5〜90 cmH2O
    ti: num('TI', '吸気時間', 's', 0.2, 8, 0.1, 1),                    // 0.2〜8.0 秒
    psupp: num('PSUPP', 'プレッシャーサポート', 'cmH2O', 0, 70, 1, 10), // 0〜70 cmH2O
    esens: num('ESENS', '呼気感度', '%', 1, 80, 1, 25),                // 1〜80 %
    vsens: num('V̇sens', 'フロートリガ感度', 'L/min', 0.2, 20, 0.1, 2), // 成人／小児 0.2〜20 L/min
    peep: num('PEEP', 'PEEP', 'cmH2O', 0, 45, 1, 5),                   // 0〜45 cmH2O
    ph: num('PH', 'BiLevel 高圧相', 'cmH2O', 5, 90, 1, 25),            // 5〜90 cmH2O
    pl: num('PL', 'BiLevel 低圧相', 'cmH2O', 0, 45, 1, 5),             // 0〜45 cmH2O
    th: num('TH', 'BiLevel 高圧相時間', 's', 0.2, 30, 0.1, 4),         // 0.2〜30 秒
    tl: num('TL', 'BiLevel 低圧相時間', 's', 0.2, 30, 0.1, 0.6),       // 0.2 秒以上（上限は未確認）
    rise: num('立ち上がり', '圧の立ち上がり時間', 's', 0, 0.5, 0.05, 0), // 未確認（カタログは % 表記）
    o2: num('O2', '酸素濃度', '%', 21, 100, 1, 40),                    // 21〜100 %
    // アラームの設定（名称と範囲はカタログの値）
    pPeak: num('回路内圧上限', '回路内圧上限（PEAK アラーム上限）', 'cmH2O', 7, 100, 1, 40),   // 7〜100 cmH2O
    mveLow: num('呼気分時換気量下限', '呼気分時換気量下限', 'L/min', 0.05, 60, 0.05, 3),       // 0.05〜60 L/min
    rrHigh: num('呼吸回数上限', '呼吸回数上限', '/min', 10, 110, 1, 35),                       // 10〜110 回/min または OFF
    apnea: num('無呼吸時間', '無呼吸時間', 's', 10, 60, 1, 20),                                // 10〜60 秒
  },
};
