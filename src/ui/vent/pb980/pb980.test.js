import { describe, it, expect } from 'vitest';
import { PB980_SETTINGS } from '../../../config/ventLayouts.js';
import { REFERENCES, UNVERIFIED_LABEL, needsUnverifiedLabel } from '../../../config/references.js';
import { createSettings, changeSetting, confirmSettings } from '../ventSettings.js';
import { toEngineSettings, commonModeId, modeDisplayName, settingKeysFor, alarmLimits, DEVICE_ID } from './settingsMap.js';
import { patientDataPages } from './patientData.js';
import { createState, run } from '../../../engine/simulator.js';
import { requestInspHold, requestExpHold } from '../../../engine/maneuvers.js';
import { summarizeBreaths } from '../../../engine/breathMetrics.js';
import { predictedBodyWeight } from '../../../engine/patient.js';

const defs = PB980_SETTINGS.items;
const initial = createSettings(defs).confirmed; // A/C VC、f 12、VT 500 mL、V̇max 60 L/min、TPL 0.5 s、矩形波、PEEP 5
const NORMAL = { c: 0.05, rInsp: 10, rExp: 10 };

describe('PB980 風：設定の換算（settingsMap）', () => {
  // 受け入れ条件 1
  it('No.1 A/C VC、f 12、VT 500 mL、V̇max 60 L/min、TPL 0.5 s、矩形波、PEEP 5', () => {
    const e = toEngineSettings(initial);
    expect(e).toMatchObject({ mode: 'VC-AC', rr: 12, vt: 0.5, flow: 1, flowPattern: 'square', peep: 5 });
    expect(e.ti).toBeCloseTo(1.0, 12);
  });

  // 受け入れ条件 2
  it('No.2 Ramp では ti = 2 × 0.5 ÷ 1 + 0.5 = 1.5', () => {
    expect(toEngineSettings({ ...initial, flowPattern: 'ramp' }).ti).toBeCloseTo(1.5, 12);
  });

  // 受け入れ条件 3
  it('No.3 1 の設定をエンジンに渡して 1 呼吸 → Ppeak 25、Pplat 15', () => {
    const e = toEngineSettings(initial);
    const { breaths } = run(createState(NORMAL, e, DEVICE_ID), NORMAL, e, DEVICE_ID, null, 11);
    expect(breaths[0].pip).toBeCloseTo(25, 6);
    expect(breaths[0].pplat).toBeCloseTo(15, 6);
  });

  // 受け入れ条件 4
  it('No.4 PBW：男性 170 cm は 66.0 kg、女性 160 cm は 52.4 kg', () => {
    expect(predictedBodyWeight(170, 'male')).toBeCloseTo(66.0, 1);
    expect(predictedBodyWeight(160, 'female')).toBeCloseTo(52.4, 1);
  });

  it('Mode と換気の種類 → 共通 ID と表示名', () => {
    const pick = (mode, mandatoryType = 'VC') => ({ ...initial, mode, mandatoryType });
    expect(commonModeId(pick('AC', 'VC'))).toBe('VC-AC');
    expect(commonModeId(pick('AC', 'PC'))).toBe('PC-AC');
    expect(commonModeId(pick('AC', 'VC+'))).toBe('PRVC');
    expect(commonModeId(pick('SPONT'))).toBe('PSV');
    expect(commonModeId(pick('BILEVEL'))).toBe('APRV');
    expect(modeDisplayName(pick('AC', 'VC+'))).toBe('A/C VC+');
    expect(modeDisplayName(pick('BILEVEL'))).toBe('BiLevel');
  });

  it('単位の換算と、モードごとの設定の対応', () => {
    const e = toEngineSettings({ ...initial, mode: 'AC', mandatoryType: 'PC', vsens: 3, pi: 18, ti: 1.2, pPeak: 35 });
    expect(e.mode).toBe('PC-AC');
    expect(e.triggerFlow).toBeCloseTo(0.05, 12);
    expect(e).toMatchObject({ deltaP: 18, ti: 1.2, pPeakAlarm: 35 });
    expect(toEngineSettings({ ...initial, mandatoryType: 'VC+' }).targetVt).toBe(0.5);
    expect(toEngineSettings({ ...initial, mode: 'BILEVEL' })).toMatchObject({ pHigh: 25, pLow: 5, tHigh: 4, tLow: 0.6 });
    expect(alarmLimits(initial)).toEqual({ pPeakAlarm: 40, mveLow: 3, rrHigh: 35, apneaTime: 20 });
  });

  it('下部に並べる設定は、すべて定義にある', () => {
    for (const mode of ['AC', 'SPONT', 'BILEVEL']) {
      for (const mandatoryType of ['VC', 'PC', 'VC+']) {
        for (const key of settingKeysFor({ mode, mandatoryType })) expect(defs[key], key).toBeTruthy();
      }
    }
  });

  it('確定するまで、エンジンに渡る設定は変わらない', () => {
    let s = createSettings(defs);
    s = changeSetting(s, 'vt', 400, defs);
    expect(toEngineSettings(s.confirmed).vt).toBe(0.5);
    expect(toEngineSettings(confirmSettings(s).confirmed).vt).toBe(0.4);
  });
});

describe('PB980 風：確認できていない値の表示', () => {
  it('設定範囲、アラーム、吸気の打ち切りは、確認できるまで「参考値（未確認）」の表示が必要', () => {
    expect(UNVERIFIED_LABEL).toBe('参考値（未確認）');
    expect(PB980_SETTINGS.status).toBe(REFERENCES.pb980SettingRanges.status);
    for (const key of ['pb980SettingRanges', 'pb980Alarms', 'pb980PeakAlarmTruncation']) expect(needsUnverifiedLabel(key), key).toBe(true);
    expect(needsUnverifiedLabel('pbwFormula')).toBe(false);
    expect(needsUnverifiedLabel('登録のない項目')).toBe(true);
  });
});

describe('PB980 風：上部バナー（patientData）', () => {
  const e = toEngineSettings(initial);
  const value = (pages, key) => pages.flat().find((x) => x.key === key).value;

  // 受け入れ条件 12
  it('No.12 エンジンの実測値と同じ（単位の換算と丸めだけ）', () => {
    const { breaths } = run(createState(NORMAL, e, DEVICE_ID), NORMAL, e, DEVICE_ID, null, 61);
    const summary = summarizeBreaths(breaths);
    const pages = patientDataPages(breaths, summary, 40);
    const b = breaths.at(-1);
    expect(pages[0].length).toBe(8);
    expect(pages[1].length).toBe(6);
    expect(value(pages, 'ppeak')).toBe(b.pip.toFixed(1));
    expect(value(pages, 'ppeak')).toBe('25.0');
    expect(value(pages, 'pmean')).toBe(b.pmean.toFixed(1));
    expect(value(pages, 'peep')).toBe('5.0');
    expect(value(pages, 'ie')).toBe('1:4.0');
    expect(value(pages, 'ftot')).toBe('12');
    expect(value(pages, 'vte')).toBe((b.vte * 1000).toFixed(0));
    expect(value(pages, 'vetot')).toBe(summary.mve.toFixed(1)); // 直近 1 分の分時換気量
    expect(value(pages, 'vetot')).toBe('6.0');
    expect(value(pages, 'o2')).toBe('40');
    expect(value(pages, 'pplat')).toBe('15.0');
    expect(value(pages, 'cstat')).toBe('50.0');
    expect(value(pages, 'rstat')).toBe('10.0');
  });

  it('測っていない値は「—」。ポーズで測った値は、次に測るまで残る', () => {
    const pc = toEngineSettings({ ...initial, mandatoryType: 'PC' });
    expect(value(patientDataPages([], summarizeBreaths([]), 40), 'ppeak')).toBe('—');
    const a = run(createState(NORMAL, pc, DEVICE_ID), NORMAL, pc, DEVICE_ID, null, 6);
    let pages = patientDataPages(a.breaths, summarizeBreaths(a.breaths), 40);
    expect(value(pages, 'pplat')).toBe('—');
    expect(value(pages, 'peeptot')).toBe('—');
    const held = run(requestExpHold(requestInspHold(a.state, 1), 1), NORMAL, pc, DEVICE_ID, null, 20);
    const all = [...a.breaths, ...held.breaths];
    pages = patientDataPages(all, summarizeBreaths(all), 40);
    expect(all.at(-1).pplat).toBeNull(); // 最後の呼吸はポーズなし
    expect(value(pages, 'pplat')).not.toBe('—');
    expect(value(pages, 'cstat')).toBe('50.0');
    expect(value(pages, 'peeptot')).toBe('5.0');
    expect(value(pages, 'peepi')).toBe('0.0');
  });
});
