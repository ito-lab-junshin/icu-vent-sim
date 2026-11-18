import { useState } from 'react';
import BloodGasResult from './BloodGasResult.jsx';

// オーダーと処置。Phase 4A は血液ガスだけ。X 線・CT・処置は 4B、VV ECMO は Phase 6 で作る
export default function OrdersPanel({ api }) {
  const { bloodGases, orderBloodGas } = api;
  const [open, setOpen] = useState(false);
  return (
    <div className="orders">
      <div className="orders-row">
        <span className="orders-title">オーダー</span>
        <button type="button" onClick={() => { orderBloodGas(); setOpen(true); }}>血液ガスを採る</button>
        <button type="button" disabled={bloodGases.length === 0} onClick={() => setOpen((o) => !o)}>結果を見る（{bloodGases.length}）</button>
      </div>
      <p className="orders-note">胸部 X 線・CT・処置は Phase 4B、VV ECMO は Phase 6 で作成</p>
      {open && bloodGases.length > 0 && <BloodGasResult results={bloodGases} onClose={() => setOpen(false)} />}
    </div>
  );
}
