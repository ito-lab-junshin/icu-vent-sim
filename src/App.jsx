import { useEffect, useMemo, useState } from 'react';
import { VENT_LAYOUTS, PB980_SETTINGS } from './config/ventLayouts.js';
import EngineViewer from './ui/dev/EngineViewer.jsx';
import Pb980Screen from './ui/vent/pb980/Pb980Screen.jsx';
import { toEngineSettings, DEVICE_ID } from './ui/vent/pb980/settingsMap.js';
import { createSettings } from './ui/vent/ventSettings.js';
import { SimulationProvider, useSimulation } from './ui/SimulationContext.jsx';
import BedsideMonitor from './ui/monitor/BedsideMonitor.jsx';
import TimeControl from './ui/time/TimeControl.jsx';
import TrendChart from './ui/time/TrendChart.jsx';

// Phase 3：上に時間制御、左にベッドサイドモニタとトレンド、右に人工呼吸器（PB980 風）。
// Hamilton 風と Evita 風は Phase 5。オーダー・処置は Phase 4。計算エンジンの確認用ページは URL の #engine。

const FOOT = '教育用シミュレータです。実在する機器のメーカーとは関係がなく、臨床判断に用いないでください。';

function Simulator({ layout, pbSettings, setPbSettings }) {
  const api = useSimulation();
  return (
    <>
      <TimeControl api={api} />
      <main className="grid">
        <section className="panel monitor" aria-label="ベッドサイドモニタ">
          <BedsideMonitor api={api} />
          <TrendChart api={api} />
          <p className="orders-note">オーダー・処置（血液ガス、胸部 X 線、CT、VV ECMO）は Phase 4 以降で作成</p>
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
  // PB980 風の設定（保留と確定）。画面を切り替えても消えないように、ここで持つ
  const [pbSettings, setPbSettings] = useState(() => createSettings(PB980_SETTINGS.items));
  const initialSettings = useMemo(() => toEngineSettings(createSettings(PB980_SETTINGS.items).confirmed), []);
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
        <p className="sub">人工呼吸器管理シミュレータ（開発中 Phase 3）</p>
        <a className="dev-link" href="#engine">計算エンジンの確認ページ</a>
        <nav className="layout-switch" aria-label="人工呼吸器レイアウトの切り替え">
          {VENT_LAYOUTS.map((l) => (
            <button key={l.id} aria-pressed={layout === l.id} onClick={() => setLayout(l.id)}>
              {l.label}
            </button>
          ))}
        </nav>
      </header>
      <SimulationProvider initialSettings={initialSettings} deviceId={DEVICE_ID}>
        <Simulator layout={layout} pbSettings={pbSettings} setPbSettings={setPbSettings} />
      </SimulationProvider>
      <footer className="foot">{FOOT}</footer>
    </div>
  );
}
