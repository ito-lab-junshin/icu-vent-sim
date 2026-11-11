// アラームの判定（純粋関数）。設定された上限・下限と実測値から、鳴っているアラームの一覧を返す。
// 名称は PB980 カタログ（14 ページ「アラーム」の表）の表記。優先度の割り当ては仮のもので、取扱説明書で未確認。
//
// limits = { pPeakAlarm, mveLow（L/min）, rrHigh（/min）, apneaTime（s） }  ない項目は判定しない
// lastBreath = 直近に終わった呼吸の実測値（breathMetrics.js）または null
// summary = summarizeBreaths の結果
// timeSinceInspStart = 最後の吸気開始からの時間（s）

// model: 分時換気量と呼吸回数のアラームは、集計した時間が 15 秒に達してから判定する（開始直後の誤判定を防ぐ）
export const ALARM_MIN_WINDOW = 15;

export const ALARMS = {
  highPressure: { label: '回路内圧上限', priority: 'high' },
  apnea: { label: '無呼吸', priority: 'high' },
  lowMinuteVolume: { label: '呼気分時換気量下限', priority: 'medium' },
  highRate: { label: '呼吸回数上限', priority: 'medium' },
  pressureLimited: { label: '吸気圧が上限で制限', priority: 'low' },
};

export function evaluateAlarms({ limits, lastBreath, summary, timeSinceInspStart }) {
  const active = [];
  const add = (id, detail) => active.push({ id, ...ALARMS[id], detail });
  if (lastBreath?.highPressureTerminated) add('highPressure', '吸気を打ち切りました');
  if (limits.apneaTime != null && timeSinceInspStart > limits.apneaTime) add('apnea', null);
  if (summary && summary.duration >= ALARM_MIN_WINDOW) {
    if (limits.mveLow != null && summary.mve < limits.mveLow) add('lowMinuteVolume', null);
    if (limits.rrHigh != null && summary.rrTotal > limits.rrHigh) add('highRate', null);
  }
  if (lastBreath?.pressureLimited) add('pressureLimited', '目標の換気量に届いていない可能性があります');
  return active;
}
