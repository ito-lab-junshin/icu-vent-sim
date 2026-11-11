// ガイドライン値・推奨値の出典管理。docs/REFERENCES.md と対応させる。
// status: 'verified' | 'unverified' | 'model'

// 原文で確認できていない値に、画面で付ける表示（CLAUDE.md の 2）
export const UNVERIFIED_LABEL = '参考値（未確認）';
// 画面に上の表示が必要か。項目がない、または verified でなければ必要
export const needsUnverifiedLabel = (key) => REFERENCES[key]?.status !== 'verified';

export const REFERENCES = {
  pbwFormula: {
    status: 'verified',
    source: 'ARDS Network low tidal volume protocol',
  },
  ecmoLungRest: {
    status: 'unverified',
    source: 'ELSO Interim Guidelines for Adult Respiratory Failure (2021) — 原文の表で確認予定',
    values: null, // 原文確認後に記入する
  },
  // 機種仕様（数値は src/config/ventLayouts.js の DEVICE_RULES に持つ）
  pb980VcPlusPressureLimit: {
    status: 'verified',
    source: 'Puritan Bennett 980 取扱説明書・クイックガイド — VC+ の目標吸気圧は PEAK アラーム上限 − 3 cmH2O まで（2026-11-11 伊藤先生確認。ページ番号は未記録）',
  },
  pb980SettingRanges: {
    status: 'unverified',
    source: 'PB980 風の画面の設定範囲・刻み・初期値（ventLayouts.js の PB980_SETTINGS）— 画面を動かすための仮の値。PB980 取扱説明書の設定範囲の表で確認予定',
  },
  pb980Alarms: {
    status: 'unverified',
    source: 'PB980 風の画面のアラームの名称・優先度の色・消音の時間・リセットの動作 — 一般的な名称と仮の値。PB980 取扱説明書のアラームの章で確認予定',
  },
  pb980PeakAlarmTruncation: {
    status: 'unverified',
    source: 'PB980：PEAK アラーム上限に達したときの吸気の打ち切り — 2026-11-11 伊藤先生の了承で実装。取扱説明書の原文で確認予定',
  },
  evitaAutoFlowMinPressure: {
    status: 'verified',
    source: 'Evita V800/V600 取扱説明書・Evita V300 取扱説明書 — AutoFlow の最小吸気圧（2026-11-11 伊藤先生確認。節番号は未記録）',
  },
  ardsnetPeepTable: {
    status: 'unverified',
    source: 'ARDS Network protocol — 原文で確認予定',
    values: null,
  },
};
