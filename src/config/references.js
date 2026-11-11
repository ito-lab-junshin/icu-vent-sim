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
    status: 'verified',
    source: 'Puritan Bennett 980 カタログ（ct-va-980x(m4)2205、RMS_2019_0547-A-2）14 ページ「コントロール」「アラーム」の表（成人／小児）。2026-11-11 伊藤先生提供',
  },
  pb980SettingStepsInitials: {
    status: 'unverified',
    source: 'PB980 風の画面の設定の刻み・初期値、身長の範囲、立ち上がり時間（秒）の範囲、TL の上限 — カタログに記載がなく、画面を動かすための仮の値。取扱説明書で確認予定',
  },
  pb980AlarmNames: {
    status: 'verified',
    source: 'Puritan Bennett 980 カタログ 14 ページ「アラーム」の表の名称（無呼吸時間、回路内圧上限、呼気分時換気量下限、呼吸回数上限）。アラームが 3 段階であることは 4 ページ',
  },
  pb980Alarms: {
    status: 'unverified',
    source: 'PB980 風の画面のアラームの優先度の割り当てと色・消音の時間・リセットの動作 — カタログに記載がなく、仮の値。取扱説明書のアラームの章で確認予定',
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
