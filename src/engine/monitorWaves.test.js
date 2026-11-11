import { describe, it, expect } from 'vitest';
import { NORMAL_GAS, GAS } from './testHelpers.js';
import { createState, run } from './simulator.js';
import { deriveVitals } from './gasDynamics.js';
import { ecgSeries, ecgShape, arterialShape, plethShape, capnogram, cvpWave, monitorValues, advanceBeatPhase } from './monitorWaves.js';

// R 波の数：0.5 を下から上に横切った回数
const countBeats = (series) => series.reduce((n, v, i) => n + (i > 0 && series[i - 1] < 0.5 && v >= 0.5 ? 1 : 0), 0);

describe('monitorWaves（モニタ波形の形）', () => {
  // 受け入れ条件 17
  it('No.17 心拍数 60、80、120 → 10 秒間の拍の数が 10、13〜14、20', () => {
    expect(countBeats(ecgSeries(60, 10, 0.005))).toBe(10);
    const n80 = countBeats(ecgSeries(80, 10, 0.005));
    expect(n80 === 13 || n80 === 14).toBe(true);
    expect(countBeats(ecgSeries(120, 10, 0.005))).toBe(20);
  });

  // 受け入れ条件 18
  it('No.18 カプノグラム：平らな部分の値が EtCO2 と一致し、吸気中は 0', () => {
    expect(capnogram('exp', 2.0, 38)).toBeCloseTo(38, 4);
    expect(capnogram('expHold', 2.0, 38)).toBeCloseTo(38, 4);
    expect(capnogram('insp', 0.2, 38)).toBe(0);
    expect(capnogram('inspHold', 0.5, 38)).toBe(0);
    expect(capnogram('exp', 0.05, 38)).toBeLessThan(38 * 0.5); // 立ち上がりの途中
  });

  it('エンジンのサンプルからモニタの値を作る：吸気中の CO2 は 0、呼気の終わりは EtCO2', () => {
    const settings = { mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, flowPattern: 'square', ti: 1.0, peep: 5, fio2: 0.4 };
    const { samples, state } = run(createState(NORMAL_GAS, settings, 'pb980'), NORMAL_GAS, settings, 'pb980', null, 10);
    const vitals = deriveVitals(state.slow, GAS);
    const endInsp = samples.filter((s) => s.phase === 'insp').at(-1);
    const endExp = samples.filter((s) => s.phase === 'exp').at(-1);
    expect(monitorValues(endInsp, 0.3, vitals, 5).co2).toBe(0);
    expect(monitorValues(endExp, 0.3, vitals, 5).co2).toBeCloseTo(vitals.etCO2, 3);
    const m = monitorValues(endExp, 0.3, vitals, 5);
    expect(m.abp).toBeGreaterThanOrEqual(vitals.dia - 1e-9);
    expect(m.abp).toBeLessThanOrEqual(vitals.sys * 1.11);
  });

  it('波形の形：ECG の頂点は R 波、動脈圧と脈波は 0〜1 の範囲に収まり、1 拍でつながる', () => {
    const grid = Array.from({ length: 1000 }, (_, i) => i / 1000);
    const ecg = grid.map(ecgShape);
    expect(grid[ecg.indexOf(Math.max(...ecg))]).toBeCloseTo(0.24, 2);
    for (const shape of [arterialShape, plethShape]) {
      const v = grid.map(shape);
      expect(Math.max(...v)).toBeGreaterThan(0.95);
      expect(Math.max(...v)).toBeLessThan(1.11);
      expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(shape(0.9999) - shape(0))).toBeLessThan(0.02); // 拍の継ぎ目で段差がない
    }
  });

  it('拍の位相は 0〜1 を回る。CVP は平均のまわりで動き、気道内圧が上がると上がる', () => {
    expect(advanceBeatPhase(0.9, 60, 0.2)).toBeCloseTo(0.1, 10);
    expect(cvpWave(0, 8, 0)).toBeCloseTo(8, 10);
    expect(cvpWave(0, 8, 20)).toBeCloseTo(11, 10);
  });
});
