import { describe, it, expect } from 'vitest';
import { evaluateAlarms } from './alarms.js';

const limits = { pPeakAlarm: 40, mveLow: 3, rrHigh: 35, apneaTime: 20 };
const ok = { rrTotal: 12, mve: 6, duration: 60 };
const ids = (x) => evaluateAlarms(x).map((a) => a.id);

describe('alarms（受け入れ条件 11：条件を満たす間だけ一覧に入る）', () => {
  it('正常ではアラームなし', () => {
    expect(ids({ limits, lastBreath: {}, summary: ok, timeSinceInspStart: 2 })).toEqual([]);
  });
  it('気道内圧上限：吸気が打ち切られた呼吸', () => {
    expect(ids({ limits, lastBreath: { highPressureTerminated: true }, summary: ok, timeSinceInspStart: 2 })).toEqual(['highPressure']);
  });
  it('無呼吸：最後の吸気開始から設定時間を超えた', () => {
    expect(ids({ limits, lastBreath: null, summary: ok, timeSinceInspStart: 20.5 })).toEqual(['apnea']);
    expect(ids({ limits, lastBreath: null, summary: ok, timeSinceInspStart: 19.5 })).toEqual([]);
  });
  it('分時換気量下限、呼吸回数上限', () => {
    expect(ids({ limits, lastBreath: {}, summary: { rrTotal: 12, mve: 2.9, duration: 60 }, timeSinceInspStart: 1 })).toEqual(['lowMinuteVolume']);
    expect(ids({ limits, lastBreath: {}, summary: { rrTotal: 36, mve: 9, duration: 60 }, timeSinceInspStart: 1 })).toEqual(['highRate']);
  });
  it('集計した時間が短いうちは、分時換気量と呼吸回数を判定しない', () => {
    expect(ids({ limits, lastBreath: {}, summary: { rrTotal: 60, mve: 1, duration: 5 }, timeSinceInspStart: 1 })).toEqual([]);
  });
  it('設定のない項目は判定しない', () => {
    expect(ids({ limits: {}, lastBreath: {}, summary: { rrTotal: 60, mve: 1, duration: 60 }, timeSinceInspStart: 99 })).toEqual([]);
  });
  it('吸気圧が上限で制限（低優先）', () => {
    const a = evaluateAlarms({ limits, lastBreath: { pressureLimited: true }, summary: ok, timeSinceInspStart: 1 });
    expect(a[0]).toMatchObject({ id: 'pressureLimited', priority: 'low' });
  });
});
