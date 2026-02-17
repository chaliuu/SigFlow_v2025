/**
 * SigFlow API Client
 * Centralized wrapper for all Flask backend endpoints.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

/* ---------- helpers ---------- */

async function request<T>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            ...(options.body && !(options.body instanceof FormData)
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...options.headers,
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') sp.append(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ---------- types ---------- */

export interface CircuitData {
    id: string;
    name: string;
    parameters: Record<string, number>;
    sfg: CytoscapeElements;
    svg?: string;
    stack_len?: number;
    redo_len?: number;
}

export interface CytoscapeElements {
    elements: {
        nodes: Array<{ data: Record<string, unknown> }>;
        edges: Array<{ data: Record<string, unknown> }>;
    };
    [key: string]: unknown;
}

export interface BodeData {
    frequency: number[];
    gain: number[];
    phase: number[];
}

export interface TransferFunctionResult {
    transfer_function: string;
}

export interface LoopGainResult {
    loop_gain: string;
}

export interface EdgeInfoResult {
    source: string;
    target: string;
    symbolic: string;
    magnitude: number;
    phase: number;
    index: number;
    [key: string]: unknown;
}

/* ---------- Circuit CRUD ---------- */

export async function createCircuit(body: {
    name: string;
    netlist: string | null;
    schematic?: string | null;
    op_point_log?: string | null;
}): Promise<CircuitData> {
    return request<CircuitData>(`${BASE_URL}/circuits`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function getCircuit(
    circuitId: string,
    fields?: string[]
): Promise<CircuitData> {
    const q = fields ? qs({ fields: fields.join(',') }) : '';
    return request<CircuitData>(`${BASE_URL}/circuits/${circuitId}${q}`);
}

export async function patchCircuit(
    circuitId: string,
    params: Record<string, number>
): Promise<CircuitData> {
    return request<CircuitData>(`${BASE_URL}/circuits/${circuitId}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
    });
}

/* ---------- Edge operations ---------- */

export async function updateEdge(
    circuitId: string,
    data: { source: string; target: string; symbolic: string; index?: number }
): Promise<CircuitData> {
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/update_edge_new`,
        { method: 'PATCH', body: JSON.stringify(data) }
    );
}

export async function getEdgeInfo(
    circuitId: string,
    params: { source: string; target: string; index?: number }
): Promise<EdgeInfoResult> {
    return request<EdgeInfoResult>(
        `${BASE_URL}/circuits/${circuitId}/get_edge_info${qs(params as Record<string, string | number>)}`
    );
}

export async function removeBranch(
    circuitId: string,
    data: { source: string; target: string; index?: number }
): Promise<CircuitData> {
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/remove_branch`,
        { method: 'PATCH', body: JSON.stringify(data) }
    );
}

/* ---------- Transfer Function ---------- */

export async function getTransferFunction(
    circuitId: string,
    params: { input_node: string; output_node: string; latex?: boolean }
): Promise<TransferFunctionResult> {
    return request<TransferFunctionResult>(
        `${BASE_URL}/circuits/${circuitId}/transfer_function${qs(params as Record<string, string | number | boolean>)}`
    );
}

export async function getTransferFunctionBode(
    circuitId: string,
    params: {
        input_node: string;
        output_node: string;
        start_freq: number;
        end_freq: number;
        points_per_decade: number;
        frequency_unit?: string;
        gain_unit?: string;
        phase_unit?: string;
    }
): Promise<BodeData> {
    return request<BodeData>(
        `${BASE_URL}/circuits/${circuitId}/transfer_function/bode${qs({
            input_node: params.input_node,
            output_node: params.output_node,
            start_freq_hz: params.start_freq,
            end_freq_hz: params.end_freq,
            points_per_decade: params.points_per_decade,
            frequency_unit: params.frequency_unit,
            gain_unit: params.gain_unit,
            phase_unit: params.phase_unit,
        })}`
    );
}

/* ---------- Loop Gain ---------- */

export async function getLoopGain(
    circuitId: string,
    params: { latex?: boolean }
): Promise<LoopGainResult> {
    return request<LoopGainResult>(
        `${BASE_URL}/circuits/${circuitId}/loop_gain${qs(params as Record<string, string | number | boolean>)}`
    );
}

export async function getLoopGainBode(
    circuitId: string,
    params: {
        start_freq: number;
        end_freq: number;
        points_per_decade: number;
        frequency_unit?: string;
        gain_unit?: string;
        phase_unit?: string;
    }
): Promise<BodeData> {
    return request<BodeData>(
        `${BASE_URL}/circuits/${circuitId}/loop_gain/bode${qs({
            start_freq_hz: params.start_freq,
            end_freq_hz: params.end_freq,
            points_per_decade: params.points_per_decade,
            frequency_unit: params.frequency_unit,
            gain_unit: params.gain_unit,
            phase_unit: params.phase_unit,
        })}`
    );
}

/* ---------- Simplification ---------- */

export async function simplifyCircuit(
    circuitId: string,
    data: { source: string; target: string }
): Promise<CircuitData> {
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/simplify`,
        { method: 'PATCH', body: JSON.stringify(data) }
    );
}

export async function simplifyEntireGraph(circuitId: string): Promise<CircuitData> {
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/simplification`,
        { method: 'PATCH' }
    );
}

export async function simplifyEntireGraphTrivial(circuitId: string): Promise<CircuitData> {
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/simplificationgraph`,
        { method: 'PATCH' }
    );
}

/* ---------- Undo / Redo ---------- */

export async function undoSfg(circuitId: string): Promise<CircuitData> {
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/undo`,
        { method: 'PATCH' }
    );
}

export async function redoSfg(circuitId: string): Promise<CircuitData> {
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/redo`,
        { method: 'PATCH' }
    );
}

/* ---------- Export / Import ---------- */

export async function exportSfg(circuitId: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/circuits/${circuitId}/export`);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.blob();
}

export async function importSfg(
    circuitId: string,
    file: File | Blob
): Promise<CircuitData> {
    const formData = new FormData();
    formData.append('file', file);
    return request<CircuitData>(
        `${BASE_URL}/circuits/${circuitId}/import`,
        { method: 'POST', body: formData }
    );
}

/* ---------- Stability / Device ---------- */

export async function getPhaseMarginPlot(
    circuitId: string,
    params: Record<string, string | number>
): Promise<{ device_value: number[]; phase_margin: number[] }> {
    return request(`${BASE_URL}/circuits/${circuitId}/pm/plot${qs(params)}`);
}

export async function getBandwidthPlot(
    circuitId: string,
    params: Record<string, string | number>
): Promise<{ parameter_value: number[]; bandwidth: number[] }> {
    return request(`${BASE_URL}/circuits/${circuitId}/bandwidth/plot${qs(params)}`);
}

export async function checkDevice(
    circuitId: string,
    deviceName: string
): Promise<{ exists: boolean }> {
    return request(`${BASE_URL}/circuits/${circuitId}/devices/check${qs({ device_name: deviceName })}`);
}
