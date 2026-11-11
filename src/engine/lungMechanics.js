// 1 区画の肺の運動方程式と、1 ステップの積分（4 次の Runge–Kutta）。
//
//   Paw(t) = V(t) / C + R × V'(t) − Pmus(t)
//
// V は機能的残気量（気道内圧 0 で釣り合う容量）からの増分。
// PEEP や auto-PEEP の分は V に含まれる（呼気終末の V = total PEEP × C）ので、
// 指示書の式にある PEEPi_base の項は別に持たない（常に 0 と同じ）。
//
// patient = { c: コンプライアンス, rInsp: 吸気抵抗, rExp: 呼気抵抗 }

// 肺胞圧（流量 0 のときの気道内圧と同じ）
export function alveolarPressure(v, patient, pmus) {
  return v / patient.c - pmus;
}

// 気道内圧が決まっているときの流量。患者へ向かう向きが正。
// 吸気の向きでは Rinsp、呼気の向きでは Rexp を使う（COPD の流量制限を表すため）
export function flowAtPressure(paw, v, patient, pmus) {
  const dp = paw - alveolarPressure(v, patient, pmus);
  return dp >= 0 ? dp / patient.rInsp : dp / patient.rExp;
}

// 流量が決まっているときの気道内圧
export function pawAtFlow(flow, v, patient, pmus) {
  const r = flow >= 0 ? patient.rInsp : patient.rExp;
  return alveolarPressure(v, patient, pmus) + r * flow;
}

// 圧規定（吸気の圧制御、受動的な呼気、APRV の 2 レベル）：Paw が決まっていて V' を求める。
// pawOfT、pmusOfT は絶対時刻 t の関数。新しい V を返す
export function stepPressureControlled(v, t, dt, pawOfT, pmusOfT, patient) {
  const f = (tt, vv) => flowAtPressure(pawOfT(tt), vv, patient, pmusOfT(tt));
  const k1 = f(t, v);
  const k2 = f(t + dt / 2, v + (dt / 2) * k1);
  const k3 = f(t + dt / 2, v + (dt / 2) * k2);
  const k4 = f(t + dt, v + dt * k3);
  return v + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

// 量規定：V' が決まっている。flowOfT は絶対時刻 t の関数。新しい V を返す
// （右辺が V によらないので、Runge–Kutta はシンプソン則と同じになる）
export function stepFlowControlled(v, t, dt, flowOfT) {
  const k1 = flowOfT(t);
  const k2 = flowOfT(t + dt / 2);
  const k4 = flowOfT(t + dt);
  return v + (dt / 6) * (k1 + 4 * k2 + k4);
}
