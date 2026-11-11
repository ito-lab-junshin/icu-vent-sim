import { useState } from 'react';
import { VENT_LAYOUTS } from './config/ventLayouts.js';

// Phase 0：画面の骨組みのみ。生理モデルは Phase 1 以降で接続する。
export default function App() {
  const [layout, setLayout] = useState('pb980');
  return (
    <div className="shell">
      <header className="topbar">
        <h1>ICU Vent Sim</h1>
        <p className="sub">人工呼吸器管理シミュレータ（開発中 Phase 0）</p>
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
          <h2>人工呼吸器</h2>
          <p>{VENT_LAYOUTS.find((l) => l.id === layout).label} の画面を表示予定</p>
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
