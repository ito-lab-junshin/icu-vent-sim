// 病態シナリオ（Phase 4A）。
// どの値も、根拠となる資料を確認していない仮の値（docs/PHASE4.md 8 の D・E の案）。伊藤先生の確認待ち。
// 最初の人工呼吸器設定は、伊藤先生の指定がまだないので、PB980 風の画面の初期値をそのまま使っている。
//
// scenario = {
//   id, name, summary,
//   demographics { sex, height }             PBW の計算に使う
//   patient { rInsp, rExp, lung, gas }       エンジンの内部単位（lungUnits.js、gasDynamics.js）
//   effort                                   自発呼吸（null は深い鎮静）
//   initialSettings                          最初の人工呼吸器設定（PB980 風の画面の設定名と表示単位）。null は画面の初期値のまま
// }
import { RECRUITMENT_DEFAULT } from '../engine/recruitment.js';

// model: 解剖学的死腔 150 mL、心拍数・平均血圧・CVP の基準値（陽圧をかけていない状態の値）は 3 つのシナリオで共通
const COMMON_GAS = { vdAnat: 0.15, hrBase: 75, mapBase: 85, cvpBase: 8 };
// model: 区画によらないシャント率 3 %（3 つのシナリオで共通）
const SHUNT_BASE = 0.03;

const lung = (cFullMl, fNormal, fRecruitable, fNon, o0, vdAlvBase) => ({
  cFull: cFullMl / 1000, fNormal, fRecruitable, fNon, o0, vdAlvBase, shuntBase: SHUNT_BASE, recruitment: RECRUITMENT_DEFAULT,
});

export const SCENARIOS = [
  {
    id: 'normal',
    name: '正常肺（術後など）',
    summary: '肺は変化しにくい。モードごとの波形の違い、設定と実測値の関係、ホールドの意味を確かめる。',
    demographics: { sex: 'male', height: 170 },
    patient: {
      rInsp: 8, rExp: 8,
      lung: lung(60, 0.95, 0.05, 0, 1, 0.05),
      gas: { ...COMMON_GAS, hb: 13, vo2: 250, vco2: 200, hco3: 24, coBase: 5.0 },
    },
    effort: null,
    initialSettings: null,
  },
  {
    id: 'ards',
    name: '重症 ARDS',
    summary: '肺の一部が虚脱・浸潤している。PEEP で開く肺と開かない肺がある。VV ECMO は Phase 6 で作る。',
    demographics: { sex: 'male', height: 170 },
    patient: {
      rInsp: 12, rExp: 12,
      lung: lung(60, 0.35, 0.30, 0.35, 0.3, 0.25),
      gas: { ...COMMON_GAS, hb: 11, vo2: 300, vco2: 240, hco3: 22, coBase: 6.0 },
    },
    effort: null,
    initialSettings: null,
  },
  {
    id: 'copd',
    name: 'COPD 増悪',
    summary: '呼気の抵抗が高く、息を吐ききれない（auto-PEEP）。自発呼吸がある。',
    demographics: { sex: 'male', height: 165 },
    patient: {
      rInsp: 18, rExp: 30,
      lung: lung(80, 0.90, 0.05, 0.05, 1, 0.30),
      gas: { ...COMMON_GAS, hb: 14, vo2: 270, vco2: 220, hco3: 32, coBase: 5.0 },
    },
    // model: 自発呼吸の大きさ・回数・吸気努力の時間は仮の値（呼吸ドライブは 4B で作る）
    effort: { pmusMax: 5, rate: 18, tiEffort: 0.8 },
    initialSettings: null,
  },
];

export const DEFAULT_SCENARIO_ID = 'normal';
export function getScenario(id) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`未知のシナリオ: ${id}`);
  return s;
}
