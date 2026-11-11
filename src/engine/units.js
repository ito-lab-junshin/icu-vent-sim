// 内部単位：圧 cmH2O、容量 L、流量 L/s、時間 s、コンプライアンス L/cmH2O、抵抗 cmH2O/(L/s)
// 表示用の換算だけをここに置く。

// model: 時間刻み 0.005 秒。波形の滑らかさと計算量の折り合い（PHASE1.md 3.1）
export const DT = 0.005;

export const lpsToLpm = (lps) => lps * 60;
export const lpmToLps = (lpm) => lpm / 60;
export const lToMl = (l) => l * 1000;
export const mlToL = (ml) => ml / 1000;
// コンプライアンス：L/cmH2O ↔ mL/cmH2O
export const complianceToMl = (c) => c * 1000;
export const complianceFromMl = (c) => c / 1000;

// 秒 → ステップ数（1 ステップ未満にはしない）
export const toSteps = (seconds) => Math.max(1, Math.round(seconds / DT));
