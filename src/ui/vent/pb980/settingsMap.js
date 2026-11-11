// PB980 風の設定値 → エンジンの settings（純粋関数）。docs/PHASE2.md 3.4 の対応表。
import { MODE_NAMES } from '../../../config/ventLayouts.js';
import { lpmToLps, mlToL } from '../../../engine/units.js';

export const DEVICE_ID = 'pb980';

// PB980 風の選択（Mode と換気の種類）→ 共通 ID
export function commonModeId(pb) {
  if (pb.mode === 'SPONT') return 'PSV';
  if (pb.mode === 'BILEVEL') return 'APRV';
  return { VC: 'VC-AC', PC: 'PC-AC', 'VC+': 'PRVC' }[pb.mandatoryType];
}

// 画面に出すモード名（MODE_NAMES から取る）
export const modeDisplayName = (pb) => MODE_NAMES[commonModeId(pb)][DEVICE_ID].name;

// いまのモードで下部に並べる主要設定
export function settingKeysFor(pb) {
  const id = commonModeId(pb);
  if (id === 'VC-AC') return ['f', 'vt', 'vmax', 'tpl', 'flowPattern', 'vsens', 'o2', 'peep'];
  if (id === 'PC-AC') return ['f', 'pi', 'ti', 'rise', 'vsens', 'o2', 'peep'];
  if (id === 'PRVC') return ['f', 'vt', 'ti', 'rise', 'vsens', 'o2', 'peep'];
  if (id === 'PSV') return ['psupp', 'esens', 'rise', 'vsens', 'o2', 'peep'];
  return ['ph', 'pl', 'th', 'tl', 'rise', 'o2'];
}

export function toEngineSettings(pb) {
  const vt = mlToL(pb.vt);
  const flow = lpmToLps(pb.vmax);
  // VC の吸気時間：送気の時間＋プラトー時間。Ramp の送気の時間はエンジンの漸減波のモデル（2 × VT ÷ 最大流量）に合わせる
  const deliveryTime = pb.flowPattern === 'ramp' ? (2 * vt) / flow : vt / flow;
  const vc = commonModeId(pb) === 'VC-AC';
  return {
    mode: commonModeId(pb),
    rr: pb.f,
    vt,
    flow,
    flowPattern: pb.flowPattern,
    ti: vc ? deliveryTime + pb.tpl : pb.ti,
    deltaP: pb.pi,
    targetVt: vt,
    riseTime: pb.rise,
    ps: pb.psupp,
    etsPct: pb.esens,
    triggerFlow: lpmToLps(pb.vsens),
    peep: pb.peep,
    pHigh: pb.ph,
    pLow: pb.pl,
    tHigh: pb.th,
    tLow: pb.tl,
    pPeakAlarm: pb.pPeak,
    fio2: pb.o2 / 100,
  };
}

export const alarmLimits = (pb) => ({ pPeakAlarm: pb.pPeak, mveLow: pb.mveLow, rrHigh: pb.rrHigh, apneaTime: pb.apnea });
