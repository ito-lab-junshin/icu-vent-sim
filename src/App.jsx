import { useEffect, useState } from 'react';
import { VENT_LAYOUTS } from './config/ventLayouts.js';
import EngineViewer from './ui/dev/EngineViewer.jsx';
import Pb980Screen from './ui/vent/pb980/Pb980Screen.jsx';

// Phase 2：人工呼吸器の区画に PB980 風の画面を表示する（Hamilton 風と Evita 風は Phase 5）。
// ベッドサイドモニタとオーダーは Phase 3 以降。計算エンジンの確認用ページは URL の #engine。
export default function App() {
  const [layout, setLayout] = useState('pb980');
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
          <p className="sub">計算エンジンの確認ページ（Phase 1）</p>
          <a className="dev-link" href="#">シミュレータの画面に戻る</a>
        </header>
        <EngineViewer />
        <footer className="foot">
          教育用シミュレータです。実在する機器のメーカーとは関係がなく、臨床判断に用いないでください。
        </footer>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>ICU Vent Sim</h1>
        <p className="sub">人工呼吸器管理シミュレータ（開発中 Phase 2）</p>
        <a className="dev-link" href="#engine">計算エンジンの確認ページ</a>
        <nav className="layout-switch" aria-label="人工呼吸器レイアウトの切り替え">
          {VENT_LAYOUTS.map((l) => (
            <button key={l.id} aria-pressed={layout === l.id} onClick={() => setLayout(l.id)}>
              {l.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="grid">
        <section className="panel monitor" aria-label="ベッドサイドモニタ">
          <h2>ベッドサイドモニタ</h2>
          <p>ECG・動脈圧・SpO2・EtCO2・CVP を表示予定</p>
        </section>
        <section className={`panel vent vent-${layout}`} aria-label="人工呼吸器">
          {layout === 'pb980' ? (
            <Pb980Screen />
          ) : (
            <>
              <h2>人工呼吸器</h2>
              <p>{VENT_LAYOUTS.find((l) => l.id === layout).label} の画面は Phase 5 で作成</p>
            </>
          )}
        </section>
        <section className="panel orders" aria-label="オーダーと処置">
          <h2>オーダー・処置</h2>
          <p>血液ガス、胸部 X 線、CT、VV ECMO 導入</p>
        </section>
      </main>
      <footer className="foot">
        教育用シミュレータです。実在する機器のメーカーとは関係がなく、臨床判断に用いないでください。
      </footer>
    </div>
  );
}
