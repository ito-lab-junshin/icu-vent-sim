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
  ardsnetPeepTable: {
    status: 'unverified',
    source: 'ARDS Network protocol — 原文で確認予定',
    values: null,
  },
};
