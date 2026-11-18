import { SCENARIOS } from '../../scenarios/index.js';

// シナリオの選択。選ぶと、その患者で最初から始まる（経過時間 0、トレンドは空）。
// 途中で選び直す・やり直すときは、確認してから行う。
export default function ScenarioPicker({ scenario, started, onStart }) {
  const start = (id) => {
    if (started && !window.confirm('いまの経過を消して、最初からやり直します。よろしいですか。')) return;
    onStart(id);
  };
  return (
    <span className="scenario">
      <label>
        シナリオ
        <select value={scenario.id} onChange={(e) => start(e.target.value)}>
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => start(scenario.id)}>最初からやり直す</button>
    </span>
  );
}
