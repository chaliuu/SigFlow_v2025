/* ------------------------------------------------------------------ */
/*  SigFlow – shared TypeScript type definitions                       */
/* ------------------------------------------------------------------ */

/** MathJax global (loaded via CDN script tag) */
declare global {
  interface Window {
    MathJax?: {
      typeset: () => void;
    };
  }
}

/* ---------- Edge weight (as returned by server) ---------- */
export interface EdgeWeight {
  symbolic: string;
  magnitude: number;
  phase: number;
}

/* ---------- Raw SFG element types from server ---------- */
export interface SfgNodeData {
  id: string;
  name: string;
  Vin?: boolean;
}

export interface SfgNode {
  data: SfgNodeData;
  position?: { x: number; y: number };
}

export interface SfgEdgeData {
  id: string;
  source: string;
  target: string;
  weight: EdgeWeight;
}

export interface SfgEdge {
  data: SfgEdgeData;
}

export interface SfgElements {
  nodes: SfgNode[];
  edges: SfgEdge[];
}

export interface Sfg {
  elements: SfgElements;
}

/* ---------- Circuit (top-level server response) ---------- */
export interface CircuitData {
  id: string;
  name: string;
  parameters: Record<string, number>;
  sfg: Sfg;
  svg?: string | null;
}

/* ---------- Transfer-function / Loop-gain ---------- */
export interface TransferFunctionResponse {
  transfer_function: string;
}

export interface LoopGainResponse {
  loop_gain: string;
}

/* ---------- Bode plot data ---------- */
export interface BodeData {
  frequency: number[];
  gain: number[];
  phase: number[];
}

/* ---------- Stability parameters ---------- */
export interface PhaseMarginData {
  device_value: number[];
  phase_margin: number[];
}

export interface BandwidthData {
  parameter_value: number[];
  bandwidth: number[];
}

/* ---------- Processed edge for Cytoscape ---------- */
export interface ProcessedEdgeData {
  id: string;
  source: string;
  target: string;
  weight: string;
  symbolicIndex: number;
  controlPointDistance: number;
  controlPointWeight: number;
  labelOffset: number;
}

/* ---------- Edge-info response ---------- */
export interface EdgeInfoResponse {
  data: SfgEdge['data'] & { weight: EdgeWeight };
}

/* ---------- Device-check response ---------- */
export interface DeviceCheckResponse {
  exists: boolean;
}
