import { SPEEDS, JUMPS } from '../../engine/clock.js';

// 時間制御：実時間／×10／×60、一時停止、時間経過ボタン、経過時間。
// api は useVentSimulation の返り値（人工呼吸器の画面と確認用ページで共用する）

export function formatElapsed(seconds) {
  const s = Math.floor(seconds);
  const pad = (x) => String(x).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export default function TimeControl({ api }) {
  const { status, running, setRunning, speed, setSpeed, jumpBy } = api;
  return (
    <div className="timebar" role="group" aria-label="時間の進め方">
      <span className="timebar-elapsed">経過時間 <strong>{formatElapsed(status.t)}</strong></span>
      <div className="timebar-group" role="group" aria-label="速さ">
        <button type="button" onClick={() => setRunning((r) => !r)} aria-pressed={!running}>{running ? '一時停止' : '再開'}</button>
        {SPEEDS.map((x) => (
          <button key={x} type="button" aria-pressed={speed === x} onClick={() => setSpeed(x)}>{x === 1 ? '実時間' : `×${x}`}</button>
        ))}
      </div>
      <div className="timebar-group" role="group" aria-label="時間経過ボタン">
        {JUMPS.map((j) => (
          <button key={j.seconds} type="button" onClick={() => jumpBy(j.seconds)}>{j.label}進める</button>
        ))}
      </div>
      <span className="timebar-note">時間経過ボタンは、いまの設定のまま時間だけを進めます</span>
    </div>
  );
}
