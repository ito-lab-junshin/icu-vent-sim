import { useEffect, useMemo, useState } from 'react';
import { VENT_LAYOUTS } from './config/ventLayouts.js';
import EngineViewer from './ui/dev/EngineViewer.jsx';
import Pb980Screen from './ui/vent/pb980/Pb980Screen.jsx';
import { toEngineSettings, DEVICE_ID } from './ui/vent/pb980/settingsMap.js';
import { initialPbSettings } from './ui/vent/pb980/scenarioSettings.js';
import Unverified from './ui/vent/Unverified.jsx';
import { SimulationProvider, useSimulation } from './ui/SimulationContext.jsx';
import BedsideMonitor from './ui/monitor/BedsideMonitor.jsx';
import TimeControl from './ui/time/TimeControl.jsx';
import TrendChart from './ui/time/TrendChart.jsx';
import ScenarioPicker from './ui/scenario/ScenarioPicker.jsx';
import OrdersPanel from './ui/orders/OrdersPanel.jsx';
import { getScenario, DEFAULT_SCENARIO_ID } from './scenarios/index.js';

// Phase 4A：上にシナリオと時間制御、左にベッドサイドモニタ・トレンド・オーダー、右に人工呼吸器（PB980 風）。
// Hamilton 風と Evita 風は Phase 5。計算エンジンの確認用ページは URL の #engine。

const FOOT = '教育用シミュレータです。実在する機器のメーカーとは関係がなく、臨床判断に用いないでください。';

function Simulator({ layout, pbSettings, setPbSettings, onStartScenario }) {
  const api = useSimulation();
  return (
    <>
      <TimeControl api={api}>
        <ScenarioPicker scenario={api.scenario} started={api.status.t > 0} onStart={onStartScenario} />
      </TimeControl>
      <p className="scenario-summary">{api.scenario.name}：{api.scenario.summary}
        {(api.scenario.conditions ?? []).map((c) => <strong key={c} className="scenario-condition">{c}</strong>)}<span className="scenario-note">（患者の値は仮の値）</span>{' '}
        <Unverified refKey="scenarioInitialSettings" what="最初の人工呼吸器設定（シナリオの初期値。ガイドラインの推奨値ではない）" /></p>
      <main className="grid">
        <section className="panel monitor" aria-label="ベッドサイドモニタ">
          <BedsideMonitor api={api} />
          <TrendChart api={api} />
          <OrdersPanel api={api} />
        </section>
        <section className={`panel vent vent-${layout}`} aria-label="人工呼吸器">
          {layout === 'pb980' ? (
            <Pb980Screen settings={pbSettings} setSettings={setPbSettings} />
          ) : (
            <>
              <h2>人工呼吸器</h2>
              <p>{VENT_LAYOUTS.find((l) => l.id === layout).label} の画面は Phase 5 で作成</p>
            </>
          )}
        </section>
      </main>
    </>
  );
}

export default function App() {
  const [layout, setLayout] = useState('pb980');
  // シナリオ。run は、選び直す・やり直すたびに増やす番号（エンジンの状態を作り直すため）
  const [session, setSession] = useState({ scenarioId: DEFAULT_SCENARIO_ID, run: 0 });
  const scenario = getScenario(session.scenarioId);
  // PB980 風の設定（保留と確定）。画面を切り替えても消えないように、ここで持つ
  const [pbSettings, setPbSettings] = useState(() => initialPbSettings(scenario));
  const initialSettings = useMemo(() => toEngineSettings(initialPbSettings(scenario).confirmed), [scenario]);
  const startScenario = (id) => {
    setPbSettings(initialPbSettings(getScenario(id)));
    setSession((x) => ({ scenarioId: id, run: x.run + 1 }));
  };
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (hash === '#engine') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>ICU Vent Sim</h1>
          <p className="sub">計算エンジンの確認ページ</p>
          <a className="dev-link" href="#">シミュレータの画面に戻る</a>
        </header>
        <EngineViewer />
        <footer className="foot">{FOOT}</footer>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>ICU Vent Sim</h1>
        <p className="sub">人工呼吸器管理シミュレータ（開発中 Phase 4A）</p>
        <a className="dev-link" href="#engine">計算エンジンの確認ページ</a>
        <nav className="layout-switch" aria-label="人工呼吸器レイアウトの切り替え">
          {VENT_LAYOUTS.map((l) => (
            <button key={l.id} aria-pressed={layout === l.id} onClick={() => setLayout(l.id)}>
              {l.label}
            </button>
          ))}
        </nav>
      </header>
      <SimulationProvider key={`${session.scenarioId}-${session.run}`} scenario={scenario} initialSettings={initialSettings} deviceId={DEVICE_ID}>
        <Simulator layout={layout} pbSettings={pbSettings} setPbSettings={setPbSettings} onStartScenario={startScenario} />
      </SimulationProvider>
      <footer className="foot">{FOOT}</footer>
    </div>
  );
}
