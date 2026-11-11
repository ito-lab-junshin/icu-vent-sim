import { describe, it, expect } from 'vitest';
import {
  alveolarPO2, so2FromPo2, po2FromSo2, o2Content, o2ContentAtPo2, po2FromContent,
  alveolarVentilation, paco2Steady, etco2FromPaco2, phFromHco3, arterialOxygen,
} from './gasExchange.js';
import { relErr } from './testHelpers.js';

describe('gasExchange（定常状態の式）', () => {
  // 受け入れ条件 1：PAO2 = FiO2 ×（760 − 47）− PaCO2 ÷ 0.8 = 0.21 × 713 − 50 = 99.7
  it('No.1 肺胞気式：FiO2 0.21、PaCO2 40 → PAO2 99.7 mmHg', () => {
    expect(relErr(alveolarPO2(0.21, 40), 99.7)).toBeLessThan(0.02);
    expect(alveolarPO2(0.21, 40)).toBeCloseTo(0.21 * 713 - 50, 10);
  });

  // 受け入れ条件 2：Severinghaus の式 SO2 = 1 ÷（1 + 23400 ÷（PO2³ + 150 × PO2））
  //   PO2 100：23400 ÷ 1015000 = 0.02305 → 97.7 %。PO2 60：23400 ÷ 225000 = 0.104 → 90.6 %
  //   PO2 40：23400 ÷ 70000 = 0.3343 → 75.0 %。PO2 27：23400 ÷ 23733 = 0.986 → 50.4 %
  it('No.2 酸素解離曲線：PO2 100、60、40、27 → 97.7、90.6、75.0、50.4 %', () => {
    const expected = { 100: 97.7, 60: 90.6, 40: 75.0, 27: 50.4 };
    for (const [po2, so2] of Object.entries(expected)) expect(relErr(so2FromPo2(Number(po2)) * 100, so2)).toBeLessThan(0.02);
    expect(so2FromPo2(0)).toBe(0);
  });

  // 受け入れ条件 3
  it('No.3 酸素解離曲線を逆に解く：SO2 → PO2 → SO2 で元に戻る（5 点）', () => {
    for (const so2 of [0.5, 0.75, 0.9, 0.95, 0.98]) expect(so2FromPo2(po2FromSo2(so2))).toBeCloseTo(so2, 9);
    for (const po2 of [30, 60, 100, 300]) expect(po2FromContent(13, o2ContentAtPo2(13, po2))).toBeCloseTo(po2, 6);
  });

  // 受け入れ条件 4
  it('No.4 酸素含量：Hb 15、SO2 100 %、PO2 100 → 20.4 mL/dL', () => {
    expect(o2Content(15, 1, 100)).toBeCloseTo(1.34 * 15 + 0.003 * 100, 10);
    expect(relErr(o2Content(15, 1, 100), 20.4)).toBeLessThan(0.02);
  });

  // 受け入れ条件 5：VA =（0.5 − 0.15）× 12 = 4.2 L/min、PaCO2 = 0.863 × 200 ÷ 4.2 = 41.1
  it('No.5 換気：VTe 0.5 L、解剖学的死腔 0.15 L、呼吸回数 12、二酸化炭素産生量 200 → VA 4.2、PaCO2 41.1', () => {
    const va = alveolarVentilation({ vte: 0.5, rr: 12, vdAnat: 0.15, vdAlvFraction: 0 });
    expect(va).toBeCloseTo(4.2, 10);
    expect(relErr(paco2Steady(200, va), 41.1)).toBeLessThan(0.02);
  });

  // 受け入れ条件 6：VA = 0.35 × 0.8 × 12 = 3.36 L/min、PaCO2 = 0.863 × 200 ÷ 3.36 = 51.4、EtCO2 = 51.4 × 0.8 = 41.1
  it('No.6 肺胞死腔率 0.2 → VA 3.36、PaCO2 51.4、EtCO2 41.1', () => {
    const va = alveolarVentilation({ vte: 0.5, rr: 12, vdAnat: 0.15, vdAlvFraction: 0.2 });
    expect(va).toBeCloseTo(3.36, 10);
    const paco2 = paco2Steady(200, va);
    expect(relErr(paco2, 51.4)).toBeLessThan(0.02);
    expect(relErr(etco2FromPaco2(paco2, 0.2), 41.1)).toBeLessThan(0.02);
  });

  it('VT が死腔より小さいと、肺胞換気量は 0', () => {
    expect(alveolarVentilation({ vte: 0.1, rr: 30, vdAnat: 0.15, vdAlvFraction: 0 })).toBe(0);
  });

  // 受け入れ条件 7：pH = 6.1 + log10（24 ÷（0.03 × 40））= 6.1 + log10（20）= 7.40
  it('No.7 pH：HCO3 24、PaCO2 40 → 7.40', () => {
    expect(phFromHco3(24, 40)).toBeCloseTo(7.40, 2);
    expect(phFromHco3(24, 60)).toBeLessThan(7.3); // 換気が減ると下がる
  });

  // 受け入れ条件 8
  it('No.8 シャント率 0 → PaO2 = PAO2', () => {
    const r = arterialOxygen({ pAO2: 100, shunt: 0, hb: 13, vo2: 250, co: 5 });
    expect(r.pao2).toBeCloseTo(100, 5);
    expect(r.ca).toBeCloseTo(r.cc, 10);
  });

  // 受け入れ条件 9
  it('No.9 シャント率 0.3、FiO2 1.0 → シャントの式と Fick の関係に戻る', () => {
    const pAO2 = alveolarPO2(1.0, 40);
    const r = arterialOxygen({ pAO2, shunt: 0.3, hb: 13, vo2: 250, co: 5 });
    expect(relErr((r.cc - r.ca) / (r.cc - r.cv), 0.3)).toBeLessThan(0.02);
    expect(r.ca - r.cv).toBeCloseTo(250 / (5 * 10), 9); // Fick の関係：動静脈の酸素含量の差 5 mL/dL
    expect(o2ContentAtPo2(13, r.pao2)).toBeCloseTo(r.ca, 6);
  });

  // 受け入れ条件 10（指示書の書き方を直した。報告の「指示書から外れた点」を参照）
  // 指示書は「SaO2 の上がり方が、シャント率 0.05 のときより小さい」としていたが、シャント率 0.05 では
  // FiO2 0.5 ですでに SaO2 がほぼ 100 % で、上がる余地がない。シャントが酸素に反応しにくいことは PaO2 で確かめる
  it('No.10 シャント率 0.3 では、FiO2 を 0.5 から 1.0 に上げても PaO2 があまり上がらない', () => {
    const at = (shunt, fio2) => arterialOxygen({ pAO2: alveolarPO2(fio2, 40), shunt, hb: 13, vo2: 250, co: 5 });
    const riseLow = at(0.05, 1.0).pao2 - at(0.05, 0.5).pao2;
    const riseHigh = at(0.3, 1.0).pao2 - at(0.3, 0.5).pao2;
    expect(riseHigh).toBeLessThan(riseLow * 0.2);
    expect(at(0.3, 1.0).sao2).toBeLessThan(at(0.05, 0.3).sao2); // 酸素を 100 % にしても、シャントの少ない肺の低い FiO2 に届かない
    expect(at(0.3, 1.0).sao2).toBeGreaterThan(at(0.3, 0.5).sao2);
  });

  it('心拍出量が下がると、混合静脈血の酸素が下がり、シャントがあると動脈血も下がる', () => {
    const hi = arterialOxygen({ pAO2: 300, shunt: 0.3, hb: 13, vo2: 250, co: 5 });
    const lo = arterialOxygen({ pAO2: 300, shunt: 0.3, hb: 13, vo2: 250, co: 3 });
    expect(lo.svo2).toBeLessThan(hi.svo2);
    expect(lo.sao2).toBeLessThan(hi.sao2);
  });

  it('酸素の供給が足りない極端な設定でも、値が壊れない', () => {
    const r = arterialOxygen({ pAO2: 30, shunt: 0.8, hb: 5, vo2: 400, co: 2 });
    for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
    expect(r.cv).toBe(0);
  });
});
