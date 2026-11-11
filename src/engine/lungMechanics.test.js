import { describe, it, expect } from 'vitest';
import { alveolarPressure, flowAtPressure, pawAtFlow, stepPressureControlled, stepFlowControlled } from './lungMechanics.js';
import { DT } from './units.js';

const P = { c: 0.05, rInsp: 10, rExp: 20 };
const noPmus = () => 0;

describe('lungMechanics', () => {
  it('運動方程式：Paw = V/C + R × V′ − Pmus', () => {
    expect(pawAtFlow(1, 0.5, P, 0)).toBeCloseTo(0.5 / 0.05 + 10 * 1, 10);
    expect(pawAtFlow(1, 0.5, P, 3)).toBeCloseTo(17, 10);
    expect(alveolarPressure(0.5, P, 0)).toBeCloseTo(10, 10);
  });
  it('吸気の向きは Rinsp、呼気の向きは Rexp を使う', () => {
    expect(flowAtPressure(20, 0.5, P, 0)).toBeCloseTo(1, 10);    // (20 − 10) / 10
    expect(flowAtPressure(0, 0.5, P, 0)).toBeCloseTo(-0.5, 10);  // (0 − 10) / 20
  });
  it('圧規定の 1 秒間の積分が解析解 C × ΔP ×（1 − e^(−t/τ)）に合う', () => {
    let v = 0;
    for (let i = 0; i < 200; i += 1) v = stepPressureControlled(v, i * DT, DT, () => 15, noPmus, P);
    expect(v).toBeCloseTo(0.05 * 15 * (1 - Math.exp(-1 / 0.5)), 8);
  });
  it('量規定の積分：流量一定 1 L/s を 0.5 秒で 0.5 L', () => {
    let v = 0;
    for (let i = 0; i < 100; i += 1) v = stepFlowControlled(v, i * DT, DT, () => 1);
    expect(v).toBeCloseTo(0.5, 10);
  });
});
