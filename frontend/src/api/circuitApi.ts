/* ------------------------------------------------------------------ */
/*  SigFlow – centralised API helper                                   */
/* ------------------------------------------------------------------ */
import type {
  CircuitData,
  TransferFunctionResponse,
  LoopGainResponse,
  BodeData,
  PhaseMarginData,
  BandwidthData,
  EdgeInfoResponse,
  DeviceCheckResponse,
} from '../types';

const BASE = window.location.origin;

/* -------- generic helpers -------- */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    mode: 'cors',
    credentials: 'same-origin',
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => u.append(k, String(v)));
  return u.toString();
}

/* ================================================================== */
/*  Circuits                                                           */
/* ================================================================== */

export async function createCircuit(payload: {
  name: string;
  netlist: string | null;
  schematic: string | null;
  op_point_log: string | null;
}): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function importSfgFile(
  circuitId: string,
  file: File,
): Promise<CircuitData> {
  const fd = new FormData();
  fd.append('file', file);
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/import`, {
    method: 'POST',
    body: fd,
  });
}

export async function getCircuit(
  circuitId: string,
  fields = 'id,name,parameters,sfg,svg',
): Promise<CircuitData> {
  return request<CircuitData>(
    `${BASE}/circuits/${circuitId}?fields=${encodeURIComponent(fields)}`,
  );
}

export async function patchCircuit(
  circuitId: string,
  params: Record<string, number>,
  fields = 'id,name,parameters,sfg,svg',
): Promise<CircuitData> {
  const url = `${BASE}/circuits/${circuitId}?fields=${encodeURIComponent(fields)}`;
  return request<CircuitData>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

/* ================================================================== */
/*  Simplification                                                     */
/* ================================================================== */

export async function simplifyNodes(
  circuitId: string,
  source: string,
  target: string,
): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/simplify`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target }),
  });
}

export async function simplifyEntireGraph(
  circuitId: string,
): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/simplification`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function simplifyGraphTrivial(
  circuitId: string,
): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/simplificationgraph`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

/* ================================================================== */
/*  Undo / Redo                                                        */
/* ================================================================== */

export async function undoSfg(circuitId: string): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/undo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function redoSfg(circuitId: string): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/redo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

/* ================================================================== */
/*  Branch operations                                                  */
/* ================================================================== */

export async function removeBranch(
  circuitId: string,
  source: string,
  target: string,
): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/remove_branch`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target }),
  });
}

export async function getEdgeInfo(
  circuitId: string,
  source: string,
  target: string,
): Promise<EdgeInfoResponse> {
  return request<EdgeInfoResponse>(
    `${BASE}/circuits/${circuitId}/get_edge_info?source=${source}&target=${target}`,
  );
}

export async function updateEdge(
  circuitId: string,
  source: string,
  target: string,
  symbolic: string,
): Promise<CircuitData> {
  return request<CircuitData>(`${BASE}/circuits/${circuitId}/update_edge_new`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target, symbolic }),
  });
}

/* ================================================================== */
/*  Transfer Function                                                  */
/* ================================================================== */

export async function getTransferFunction(
  circuitId: string,
  inputNode: string,
  outputNode: string,
  numerical = false,
): Promise<TransferFunctionResponse> {
  const q = qs({
    input_node: inputNode,
    output_node: outputNode,
    latex: true,
    factor: true,
    numerical,
  });
  return request<TransferFunctionResponse>(
    `${BASE}/circuits/${circuitId}/transfer_function?${q}`,
  );
}

export async function getTransferFunctionBode(
  circuitId: string,
  params: {
    input_node: string;
    output_node: string;
    start_freq_hz: number;
    end_freq_hz: number;
    points_per_decade: number;
  },
): Promise<BodeData> {
  const q = qs(params as unknown as Record<string, string | number | boolean>);
  return request<BodeData>(
    `${BASE}/circuits/${circuitId}/transfer_function/bode?${q}`,
  );
}

/* ================================================================== */
/*  Loop Gain                                                          */
/* ================================================================== */

export async function getLoopGain(
  circuitId: string,
  numerical = false,
): Promise<LoopGainResponse> {
  const q = qs({ latex: true, factor: true, numerical });
  return request<LoopGainResponse>(
    `${BASE}/circuits/${circuitId}/loop_gain?${q}`,
  );
}

export async function getLoopGainBode(
  circuitId: string,
  params: {
    start_freq_hz: number;
    end_freq_hz: number;
    points_per_decade: number;
  },
): Promise<BodeData> {
  const q = qs(params as unknown as Record<string, string | number | boolean>);
  return request<BodeData>(
    `${BASE}/circuits/${circuitId}/loop_gain/bode?${q}`,
  );
}

/* ================================================================== */
/*  Stability                                                          */
/* ================================================================== */

export async function checkDeviceExists(
  circuitId: string,
  deviceName: string,
): Promise<boolean> {
  const data = await request<DeviceCheckResponse>(
    `${BASE}/circuits/${circuitId}/devices/check?device_name=${encodeURIComponent(deviceName)}`,
  );
  return data.exists;
}

export async function getPhaseMarginPlot(
  circuitId: string,
  params: Record<string, string | number>,
): Promise<PhaseMarginData> {
  const q = qs(params as Record<string, string | number | boolean>);
  return request<PhaseMarginData>(
    `${BASE}/circuits/${circuitId}/pm/plot?${q}`,
  );
}

export async function getBandwidthPlot(
  circuitId: string,
  params: Record<string, string | number>,
): Promise<BandwidthData> {
  const q = qs(params as Record<string, string | number | boolean>);
  return request<BandwidthData>(
    `${BASE}/circuits/${circuitId}/bandwidth/plot?${q}`,
  );
}

/* ================================================================== */
/*  Export / Import                                                     */
/* ================================================================== */

export async function exportSfg(circuitId: string): Promise<Blob> {
  const res = await fetch(`${BASE}/circuits/${circuitId}/export`);
  return res.blob();
}
