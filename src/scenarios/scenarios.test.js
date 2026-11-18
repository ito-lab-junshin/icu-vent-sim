import { describe, it, expect } from 'vitest';
import { SCENARIOS, getScenario, DEFAULT_SCENARIO_ID, initialVentSettings } from './index.js';
import { initialPbSettings } from '../ui/vent/pb980/scenarioSettings.js';
import { toEngineSettings } from '../ui/vent/pb980/settingsMap.js';
import { createState, run } from '../engine/simulator.js';
import { requestExpHold } from '../engine/maneuvers.js';
import { jump } from '../engine/clock.js';
import { deriveVitals } from '../engine/gasDynamics.js';
import { relErr } from '../engine/testHelpers.js';

const vc = (over = {}) => ({ mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, fio2: 0.4, ...over });
const begin = (id, settings) => {
  const sc = getScenario(id);
  return { sc, state: createState(sc.patient, settings, 'pb980') };
};
const go = (sc, state, settings, seconds) => run(state, sc.patient, settings, 'pb980', sc.effort, seconds);

describe('シナリオ（Phase 4A）', () => {
  it('3 つのシナリオがあり、区画の割合の合計は 1', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['normal', 'ards', 'copd']);
    expect(getScenario(DEFAULT_SCENARIO_ID).id).toBe('normal');
    for (const s of SCENARIOS) {
      const { fNormal, fRecruitable, fNon } = s.patient.lung;
      expect(fNormal + fRecruitable + fNon, s.id).toBeCloseTo(1, 10);
    }
    expect(() => getScenario('xxx')).toThrow();
  });

  it('最初の人工呼吸器設定：VT は予測体重 × 予測体重あたりの mL。画面では設定の刻みに丸める', () => {
    expect(initialVentSettings(getScenario('normal'))).toMatchObject({ f: 14, peep: 5, o2: 40 });
    expect(initialVentSettings(getScenario('normal')).vt).toBeCloseTo(66.0 * 7, 6);   // 462 mL
    expect(initialVentSettings(getScenario('ards')).vt).toBeCloseTo(66.0 * 6, 6);     // 396 mL
    expect(initialVentSettings(getScenario('copd')).vt).toBeCloseTo(61.5 * 7, 6);     // 430.5 mL
    const shown = (id) => initialPbSettings(getScenario(id)).confirmed;
    expect(shown('normal')).toMatchObject({ vt: 460, f: 14, peep: 5, o2: 40, height: 170, sex: 'male' });
    expect(shown('ards')).toMatchObject({ vt: 395, f: 22, peep: 14, o2: 80 });
    expect(shown('copd')).toMatchObject({ vt: 430, f: 12, peep: 5, o2: 30, height: 165 });
    expect(toEngineSettings(shown('ards'))).toMatchObject({ mode: 'VC-AC', rr: 22, vt: 0.395, peep: 14, fio2: 0.8 });
  });

  it('重症 ARDS は「昇圧薬を使用中」：最初の設定（PEEP 14）での平均血圧が約 70 mmHg で、モニタのアラームの下限 65 mmHg を上回る', () => {
    const sc = getScenario('ards');
    expect(sc.conditions).toEqual(['昇圧薬を使用中']);
    expect(sc.patient.gas.mapBase).toBe(95);
    expect(getScenario('normal').patient.gas.mapBase).toBe(85);
    expect(getScenario('copd').patient.gas.mapBase).toBe(85);
    const st = toEngineSettings(initialPbSettings(sc).confirmed);
    const v = deriveVitals(run(createState(sc.patient, st, 'pb980'), sc.patient, st, 'pb980', sc.effort, 300).state.slow, sc.patient.gas);
    expect(v.map).toBeGreaterThan(69);
    expect(v.map).toBeLessThan(71);
    expect(v.co).toBeCloseTo(4.27, 1); // 心拍出量は変えていない
  }, 60000);

  // 受け入れ条件 12
  it('No.12 3 つのシナリオを最初の設定のまま 10 分動かしても、計算が壊れない', () => {
    for (const sc of SCENARIOS) {
      const r = go(sc, createState(sc.patient, vc(), 'pb980'), vc(), 600);
      const v = deriveVitals(r.state.slow, sc.patient.gas);
      for (const x of [v.spO2, v.paCO2, v.ph, v.co, v.map, r.state.slow.o, r.state.slow.cEff, r.state.v]) expect(Number.isFinite(x), sc.id).toBe(true);
      expect(r.breaths.length, sc.id).toBeGreaterThan(100);
      expect(v.spO2, sc.id).toBeGreaterThan(0.5);
    }
  }, 60000);

  // 受け入れ条件 7
  it('No.7 ARDS シナリオで PEEP を上げると、開いている割合が上がり、シャント率が下がり、SpO2 が上がる', () => {
    const { sc, state } = begin('ards', vc());
    const low = go(sc, state, vc(), 300).state;
    const high = go(sc, low, vc({ peep: 15 }), 300).state;
    expect(high.slow.o).toBeGreaterThan(low.slow.o + 0.2);
    expect(high.slow.shunt).toBeLessThan(low.slow.shunt);
    expect(high.slow.cEff).toBeGreaterThan(low.slow.cEff); // 含気している肺が増えるので、コンプライアンスも上がる
    expect(deriveVitals(high.slow, sc.patient.gas).spO2).toBeGreaterThan(deriveVitals(low.slow, sc.patient.gas).spO2);
  }, 60000);

  // 受け入れ条件 8
  it('No.8 そのあと PEEP を閉鎖圧より下げて時間を進めると、開いている割合が単調に下がり、SpO2 が下がる', () => {
    const { sc, state } = begin('ards', vc());
    let s = go(sc, state, vc({ peep: 15 }), 300).state;
    const start = s.slow.o;
    const spo2Start = deriveVitals(s.slow, sc.patient.gas).spO2;
    let previous = start;
    for (let i = 0; i < 12; i += 1) { // 30 分ずつ 6 時間
      s = jump(s, sc.patient, vc({ peep: 3 }), 'pb980', sc.effort, 1800).state;
      // 下げ止まったあと（吸気のたびに少し開く分とつり合ったあと）は、ごく小さく揺れるだけになる
      expect(s.slow.o).toBeLessThanOrEqual(previous + 1e-3);
      previous = s.slow.o;
    }
    expect(s.slow.o).toBeLessThan(start - 0.2);
    expect(deriveVitals(s.slow, sc.patient.gas).spO2).toBeLessThan(spo2Start);
  }, 60000);

  // 受け入れ条件 13
  it('No.13 COPD シナリオで呼吸回数を上げると、auto-PEEP が増える（呼気ホールドで測る）', () => {
    const autoPeep = (rr) => {
      const { sc, state } = begin('copd', vc({ rr }));
      const settled = run(state, sc.patient, vc({ rr }), 'pb980', null, 120).state; // 測るときは自発呼吸なし
      return run(requestExpHold(settled, 1), sc.patient, vc({ rr }), 'pb980', null, 15).breaths.find((b) => b.autoPeep != null).autoPeep;
    };
    const slow = autoPeep(12);
    const fast = autoPeep(24);
    expect(slow).toBeGreaterThan(0.5);
    expect(fast).toBeGreaterThan(slow + 2);
  }, 60000);

  // 受け入れ条件 14
  it('No.14 開いている割合が変化している途中の 30 分：時間経過ボタンと 5 ms 刻みが ±2 % で一致する', () => {
    const { sc, state } = begin('ards', vc());
    const opened = go(sc, state, vc({ peep: 15 }), 300).state;
    const lowPeep = vc({ peep: 3 });
    const full = go(sc, opened, lowPeep, 1800).state;
    const jumped = jump(opened, sc.patient, lowPeep, 'pb980', sc.effort, 1800).state;
    expect(opened.slow.o - full.slow.o).toBeGreaterThan(0.05); // 30 分で、はっきり閉じる条件
    expect(relErr(jumped.slow.o, full.slow.o)).toBeLessThan(0.02);
    expect(relErr(jumped.slow.paCO2, full.slow.paCO2)).toBeLessThan(0.02);
    expect(relErr(deriveVitals(jumped.slow, sc.patient.gas).saO2, deriveVitals(full.slow, sc.patient.gas).saO2)).toBeLessThan(0.02);
    expect(relErr(jumped.slow.cEff, full.slow.cEff)).toBeLessThan(0.02);
    expect(jumped.n).toBe(full.n);
  }, 120000);

  it('PEEP を上げた直後に時間経過ボタンを押しても、5 ms 刻みと ±2 % で一致する（開く途中）', () => {
    const { sc, state } = begin('ards', vc());
    const low = go(sc, state, vc(), 120).state;
    const high = vc({ peep: 15 });
    const full = go(sc, low, high, 1800).state;
    const jumped = jump(low, sc.patient, high, 'pb980', sc.effort, 1800).state;
    expect(relErr(jumped.slow.o, full.slow.o)).toBeLessThan(0.02);
    expect(relErr(jumped.slow.paCO2, full.slow.paCO2)).toBeLessThan(0.02);
  }, 120000);

  // 受け入れ条件 15
  it('No.15 同じ入力で 2 回計算すると、出力が完全に一致する', () => {
    const once = () => {
      const { sc, state } = begin('copd', vc({ rr: 16 }));
      const a = go(sc, state, vc({ rr: 16 }), 60);
      const b = jump(a.state, sc.patient, vc({ rr: 16, peep: 8 }), 'pb980', sc.effort, 3600);
      return { a, b, c: go(sc, b.state, vc({ rr: 16, peep: 8 }), 20) };
    };
    expect(once()).toEqual(once());
  }, 60000);

  it('コンプライアンスが変わっても、肺胞圧がつながる（呼気終末の圧が PEEP から離れない）', () => {
    const { sc, state } = begin('ards', vc({ peep: 15 }));
    const { breaths } = go(sc, state, vc({ peep: 15 }), 120);
    for (const b of breaths) expect(Math.abs(b.palvEndExp - 15)).toBeLessThan(0.5);
  }, 60000);
});
