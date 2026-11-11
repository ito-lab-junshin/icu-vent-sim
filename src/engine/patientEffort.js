// 自発呼吸：呼吸筋圧 Pmus の波形。
// 1 呼吸を「吸気努力の山（半正弦波）＋休止」で表す。正の値が吸気努力。
//
// effort = { pmusMax: 振幅 cmH2O, rate: 自発呼吸回数 /min, tiEffort: 吸気努力の時間 s }
// 振幅 0（または effort なし）は深い鎮静・筋弛緩の状態。

// model: 吸気努力の時間の既定値 0.8 秒（安静時の成人の吸気時間に近い値として置いた）
export const DEFAULT_EFFORT_TIME = 0.8;

export function pmusAt(t, effort) {
  if (!effort || !(effort.pmusMax > 0) || !(effort.rate > 0)) return 0;
  const period = 60 / effort.rate;
  const ti = Math.min(effort.tiEffort ?? DEFAULT_EFFORT_TIME, period);
  const phase = t - Math.floor(t / period) * period;
  if (phase >= ti) return 0;
  return effort.pmusMax * Math.sin((Math.PI * phase) / ti);
}
