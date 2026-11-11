import { describe, it, expect } from 'vitest';
import { NORMAL_GAS, GAS, relErr } from './testHelpers.js';
import { createState, run, step } from './simulator.js';
import { requestInspHold } from './maneuvers.js';
import { jump, measureVentilation, SPEEDS, JUMPS } from './clock.js';
import { deriveVitals } from './gasDynamics.js';
import { DT } from './units.js';

const settings = { mode: 'VC-AC', rr: 20, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, fio2: 0.3 };
const start = () => run(createState(NORMAL_GAS, settings, 'pb980'), NORMAL_GAS, settings, 'pb980', null, 20).state;

describe('clock（時間制御）', () => {
  it('設定を変えた直後でも、新しい設定の換気で進める（前の設定の呼吸を数えない）', () => {
    const slowRate = { ...settings, rr: 10 };
    const s0 = run(createState(NORMAL_GAS, slowRate, 'pb980'), NORMAL_GAS, slowRate, 'pb980', null, 20).state;
    const v = measureVentilation(s0, NORMAL_GAS, settings, 'pb980', null); // 呼吸回数 10 → 20
    expect(relErr(v.vaLpm, 7)).toBeLessThan(0.02);
  });

  it('倍速は実時間、×10、×60。時間経過ボタンは 30 分、1 時間、4 時間、12 時間', () => {
    expect(SPEEDS).toEqual([1, 10, 60]);
    expect(JUMPS.map((j) => j.seconds)).toEqual([1800, 3600, 14400, 43200]);
  });

  // 受け入れ条件 14
  it('No.14 ×60 で 10 分ぶん進めた状態は、実時間と同じ計算で進めた状態と完全に一致する', () => {
    const s0 = start();
    const realtime = run(s0, NORMAL_GAS, settings, 'pb980', null, 600).state;
    // ×60：1 フレーム（1/60 秒）に 60 倍の時間、つまり 200 ステップずつ進める
    let fast = s0;
    const total = Math.round(600 / DT);
    for (let done = 0; done < total; done += 200) {
      for (let i = 0; i < 200; i += 1) fast = step(fast, NORMAL_GAS, settings, 'pb980', null).state;
    }
    expect(fast).toEqual(realtime);
  });

  // 受け入れ条件 15
  it('No.15 時間経過ボタンで 30 分進めた状態は、5 ms 刻みで 30 分ぶん計算した状態と ±2 % で一致する', () => {
    const s0 = start(); // PaCO2 は 40 付近。この換気（VA 7 L/min）では 24.7 へ下がっていく途中
    const full = run(s0, NORMAL_GAS, settings, 'pb980', null, 1800).state;
    const jumped = jump(s0, NORMAL_GAS, settings, 'pb980', null, 1800);
    expect(Math.abs(s0.slow.paCO2 - full.slow.paCO2)).toBeGreaterThan(10); // 30 分で大きく変わる条件
    expect(relErr(jumped.state.slow.paCO2, full.slow.paCO2)).toBeLessThan(0.02);
    expect(relErr(jumped.state.slow.pAO2, full.slow.pAO2)).toBeLessThan(0.02);
    expect(relErr(deriveVitals(jumped.state.slow, GAS).saO2, deriveVitals(full.slow, GAS).saO2)).toBeLessThan(0.02);
    expect(jumped.state.n).toBe(full.n);
    expect(jumped.points.length).toBe(30); // 1 分ごとの記録
    expect(jumped.points.at(-1).t).toBeCloseTo(full.n * DT, 6);
  }, 30000);

  // 受け入れ条件 16
  it('No.16 時間経過ボタンで 12 時間：計算が 1 秒以内に終わる', () => {
    const s0 = start();
    const t0 = performance.now();
    const r = jump(s0, NORMAL_GAS, settings, 'pb980', null, 12 * 3600);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.points.length).toBe(720);
    expect(r.state.n - s0.n).toBe(Math.round((12 * 3600) / DT));
  });

  it('1 分あたりの換気：VA =（0.5 − 0.15）× 20 = 7 L/min', () => {
    const v = measureVentilation(start(), NORMAL_GAS, settings, 'pb980', null);
    expect(relErr(v.vaLpm, 7)).toBeLessThan(0.02);
    expect(relErr(v.mve, 10)).toBeLessThan(0.02);
    expect(v.rr).toBeCloseTo(20, 6);
    expect(v.ppeak).toBeCloseTo(25.2, 1); // 呼気が少し足りず（Te 2 秒 = 4τ）、わずかに高い
  });

  it('時間経過ボタンは、予約されたホールドを取り消す。呼吸の開始時刻は、進めた先の時刻に合わせる', () => {
    const s0 = requestInspHold(start(), 1);
    const { state } = jump(s0, NORMAL_GAS, settings, 'pb980', null, 1800);
    expect(state.pendingInspHold).toBe(0);
    expect(state.n).toBe(s0.n + Math.round(1800 / DT));
    const sinceInspStart = state.n * DT - state.breath.tStart;
    expect(sinceInspStart).toBeGreaterThanOrEqual(0);
    expect(sinceInspStart).toBeLessThanOrEqual(3); // 1 周期（3 秒）のうち
    expect(s0.pendingInspHold).toBeGreaterThan(0); // 元の状態は書き換えない
  });

  it('無呼吸（SPONT で Pmus 0）のまま時間を進めると、PaCO2 が上限まで上がる', () => {
    const psv = { mode: 'PSV', ps: 10, etsPct: 25, riseTime: 0, peep: 5, fio2: 0.21 };
    const s0 = run(createState(NORMAL_GAS, psv, 'pb980'), NORMAL_GAS, psv, 'pb980', null, 5).state;
    const r = jump(s0, NORMAL_GAS, psv, 'pb980', null, 1800);
    expect(r.ventilation.vaLpm).toBe(0);
    expect(r.ventilation.state).toBeUndefined();
    expect(r.state.slow.paCO2).toBe(150);
  });

  // 受け入れ条件 19
  it('No.19 同じ入力で 2 回計算すると、出力が完全に一致する（ガス交換と時間経過ボタンを含む）', () => {
    const once = () => {
      const a = run(createState(NORMAL_GAS, settings, 'pb980'), NORMAL_GAS, settings, 'pb980', { pmusMax: 5, rate: 25, tiEffort: 0.8 }, 60);
      const b = jump(a.state, NORMAL_GAS, settings, 'pb980', null, 3600);
      return { a, b, c: run(b.state, NORMAL_GAS, settings, 'pb980', null, 30) };
    };
    expect(once()).toEqual(once());
  });
});
