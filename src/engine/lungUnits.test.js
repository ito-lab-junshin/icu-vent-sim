import { describe, it, expect } from 'vitest';
import { aeratedFraction, effectiveCompliance, shuntFraction, deadSpaceFraction, overdistension, lungState, OVERDISTENSION } from './lungUnits.js';
import { openTarget, keepLimit, advanceOpenFraction, RECRUITMENT_DEFAULT as R } from './recruitment.js';

const lung = { cFull: 0.06, fNormal: 0.4, fRecruitable: 0.3, fNon: 0.3, o0: 0, shuntBase: 0, vdAlvBase: 0.1 };

describe('lungUnits（3 区画の肺）', () => {
  // 受け入れ条件 1
  it('No.1 正常区画 0.4、リクルート可能区画 0.3 → 含気している割合 0.4（o = 0）と 0.7（o = 1）。C はその比', () => {
    expect(aeratedFraction(lung, 0)).toBeCloseTo(0.4, 12);
    expect(aeratedFraction(lung, 1)).toBeCloseTo(0.7, 12);
    // 過膨張がない圧（5 cmH2O）で比べる
    expect(effectiveCompliance(lung, 0, 5) / effectiveCompliance(lung, 1, 5)).toBeCloseTo(0.4 / 0.7, 10);
    expect(effectiveCompliance(lung, 1, 5)).toBeCloseTo(0.06 * 0.7, 3);
  });

  // 受け入れ条件 2
  it('No.2 血流の配分の係数 1 → シャント率 0.6（o = 0）と 0.3（o = 1）', () => {
    expect(shuntFraction(lung, 0, 1)).toBeCloseTo(0.6, 12);
    expect(shuntFraction(lung, 1, 1)).toBeCloseTo(0.3, 12);
    expect(shuntFraction(lung, 0)).toBeCloseTo(0.6 * 0.7, 12); // 既定の係数 0.7
    expect(shuntFraction({ ...lung, shuntBase: 0.03 }, 1, 1)).toBeCloseTo(0.33, 12);
  });

  // 受け入れ条件 9
  it('No.9 過膨張：吸気終末の肺胞圧を上げていくと、C が単調に下がり、肺胞死腔率が単調に上がる', () => {
    let c = Infinity;
    let vd = -Infinity;
    for (let p = 5; p <= 60; p += 5) {
      const s = lungState(lung, 1, p);
      expect(s.cEff).toBeLessThan(c);
      expect(s.vdAlv).toBeGreaterThan(vd);
      c = s.cEff;
      vd = s.vdAlv;
    }
    expect(overdistension(OVERDISTENSION.pHalf)).toBeCloseTo(0.5, 12);
    expect(deadSpaceFraction(lung, 5)).toBeCloseTo(0.1, 2);
    expect(deadSpaceFraction(lung, 200)).toBeCloseTo(0.3, 6);
  });
});

describe('recruitment（リクルートと虚脱）', () => {
  // 受け入れ条件 3
  it('No.3 開く目標値：吸気終末の肺胞圧 = 開放圧で 0.5。高いと 1、低いと 0 に近づく', () => {
    expect(openTarget(R.pOpen, R)).toBeCloseTo(0.5, 12);
    expect(openTarget(R.pOpen + 40, R)).toBeGreaterThan(0.999);
    expect(openTarget(R.pOpen - 40, R)).toBeLessThan(0.001);
    expect(keepLimit(R.pClose, R)).toBeCloseTo(0.5, 12);
  });

  // 受け入れ条件 4：o(t) = 1 − e^(−t/τ)。t = τ で 1 − e^−1 = 0.632
  it('No.4 開く速さ：目標値 1 で、時定数の時間がたつと o が 0.632', () => {
    const o = advanceOpenFraction(0, { pEndInsp: 500, pEndExp: 500 }, R.tauOpen, R);
    expect(o).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  // 受け入れ条件 5：o(t) = e^(−t/τ)。t = τ で e^−1 = 0.368
  it('No.5 閉じる速さ：目標値 0 で、時定数の時間がたつと o が 0.368', () => {
    const o = advanceOpenFraction(1, { pEndInsp: -500, pEndExp: -500 }, R.tauClose, R);
    expect(o).toBeCloseTo(Math.exp(-1), 6);
    // 刻みを分けても同じ
    let stepped = 1;
    for (let i = 0; i < 60; i += 1) stepped = advanceOpenFraction(stepped, { pEndInsp: -500, pEndExp: -500 }, R.tauClose / 60, R);
    expect(stepped).toBeCloseTo(o, 9);
  });

  // 受け入れ条件 6
  it('No.6 ヒステリシス：開いたあと、閉鎖圧と開放圧の間の PEEP に下げても、最初からその PEEP だった場合より開いている', () => {
    const between = { pEndInsp: 20, pEndExp: 12 }; // 吸気終末 20（開放圧 25 より低い）、呼気終末 12（閉鎖圧 8 より高い）
    let opened = 0.2;
    for (let i = 0; i < 20; i += 1) opened = advanceOpenFraction(opened, { pEndInsp: 40, pEndExp: 18 }, 30, R); // 高い圧で 10 分
    expect(opened).toBeGreaterThan(0.95);
    let after = opened;
    let never = 0.2;
    for (let i = 0; i < 24 * 60; i += 1) { // 24 時間
      after = advanceOpenFraction(after, between, 60, R);
      never = advanceOpenFraction(never, between, 60, R);
    }
    expect(after).toBeGreaterThan(never + 0.4);
    expect(after).toBeCloseTo(keepLimit(12, R), 3);   // 保てる上限まで下がって止まる
    expect(never).toBeCloseTo(openTarget(20, R), 3);  // 開く目標値までしか開かない
  });

  it('開く目標値と保てる上限の間では、変わらない', () => {
    expect(advanceOpenFraction(0.5, { pEndInsp: 20, pEndExp: 12 }, 3600, R)).toBe(0.5);
  });
});
