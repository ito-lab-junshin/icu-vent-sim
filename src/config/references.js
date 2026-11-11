// ガイドライン値・推奨値の出典管理。docs/REFERENCES.md と対応させる。
// status: 'verified' | 'unverified' | 'model'
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
