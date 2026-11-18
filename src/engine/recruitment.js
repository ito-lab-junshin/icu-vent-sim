// リクルートと虚脱（Phase 4A）。純粋関数。
// リクルート可能区画の「開いている割合 o（0〜1）」が、圧に応じて時間とともに変わる。
//   開く：吸気終末の肺胞圧が開放圧を超えると、o が上がる。速い（秒〜分）
//   閉じる：呼気終末の圧（total PEEP）が閉鎖圧を下回ると、o が下がる。遅い（数十分〜数時間）
// 開放圧は閉鎖圧より高いので、いちど開いた肺は、開いたときより低い PEEP でも開いたままでいられる（ヒステリシス）。
import { sigmoid } from './lungUnits.js';

// model: リクルートの値（docs/PHASE4.md 8 の E の案。根拠となる資料は確認していない仮の値。伊藤先生の確認待ち）
export const RECRUITMENT_DEFAULT = {
  pOpen: 25,      // 開放圧：o の「開く目標値」が 0.5 になる吸気終末の肺胞圧（cmH2O）
  wOpen: 4,       // 開く曲線の幅（cmH2O）
  tauOpen: 30,    // 開く時定数（秒）
  pClose: 8,      // 閉鎖圧：o の「保てる上限」が 0.5 になる呼気終末の圧（cmH2O）
  wClose: 3,      // 閉じる曲線の幅（cmH2O）
  tauClose: 3600, // 閉じる時定数（秒）
};

// 開く目標値：この吸気終末の肺胞圧なら、ここまで開く
export const openTarget = (pEndInsp, r) => sigmoid((pEndInsp - r.pOpen) / r.wOpen);
// 保てる上限：この呼気終末の圧なら、ここまでは開いたままでいられる
export const keepLimit = (pEndExp, r) => sigmoid((pEndExp - r.pClose) / r.wClose);

// o を dtSec 秒進める。
//   o が開く目標値より小さければ、目標値へ速く上がる。
//   o が保てる上限より大きければ、上限へゆっくり下がる。
//   その間（開く目標値 ≤ o ≤ 保てる上限）なら、変わらない。
export function advanceOpenFraction(o, { pEndInsp, pEndExp }, dtSec, r) {
  let next = o;
  const up = openTarget(pEndInsp, r);
  if (next < up) next = up + (next - up) * Math.exp(-dtSec / r.tauOpen);
  const keep = keepLimit(pEndExp, r);
  if (next > keep) next = keep + (next - keep) * Math.exp(-dtSec / r.tauClose);
  return Math.min(1, Math.max(0, next));
}
