/* ------------------------------------------------------------------ */
/*  SigFlow – Circuit context (shared state across SFG page)           */
/* ------------------------------------------------------------------ */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { CircuitData } from '../types';
import * as api from '../api/circuitApi';

interface CircuitContextValue {
  circuitId: string | null;
  setCircuitId: (id: string | null) => void;
  data: CircuitData | null;
  setData: React.Dispatch<React.SetStateAction<CircuitData | null>>;
  loading: boolean;
  error: string | null;
  loadCircuit: () => Promise<void>;
  patchCircuit: (params: Record<string, number>) => Promise<void>;
  symbolicFlag: boolean;
  toggleSymbolic: () => void;
  edgeSymbolicLabels: string[];
  setEdgeSymbolicLabels: React.Dispatch<React.SetStateAction<string[]>>;
  stackLen: number;
  setStackLen: React.Dispatch<React.SetStateAction<number>>;
  redoLen: number;
  setRedoLen: React.Dispatch<React.SetStateAction<number>>;
}

const CircuitContext = createContext<CircuitContextValue | undefined>(undefined);

export function CircuitProvider({ children }: { children: React.ReactNode }) {
  const [circuitId, setCircuitId] = useState<string | null>(
    sessionStorage.getItem('circuitId'),
  );
  /* Keep sessionStorage in sync so the legacy iframe can read the id */
  useEffect(() => {
    if (circuitId) {
      sessionStorage.setItem('circuitId', circuitId);
    } else {
      sessionStorage.removeItem('circuitId');
    }
  }, [circuitId]);

  const [data, setData] = useState<CircuitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbolicFlag, setSymbolicFlag] = useState(true);
  const [edgeSymbolicLabels, setEdgeSymbolicLabels] = useState<string[]>([]);
  const [stackLen, setStackLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);

  const loadCircuit = useCallback(async () => {
    if (!circuitId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.getCircuit(circuitId);
      setData(d);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [circuitId]);

  const patchCircuitFn = useCallback(
    async (params: Record<string, number>) => {
      if (!circuitId) return;
      try {
        const d = await api.patchCircuit(circuitId, params);
        setData(d);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [circuitId],
  );

  const toggleSymbolic = useCallback(() => {
    setSymbolicFlag((prev) => !prev);
  }, []);

  return (
    <CircuitContext.Provider
      value={{
        circuitId,
        setCircuitId,
        data,
        setData,
        loading,
        error,
        loadCircuit,
        patchCircuit: patchCircuitFn,
        symbolicFlag,
        toggleSymbolic,
        edgeSymbolicLabels,
        setEdgeSymbolicLabels,
        stackLen,
        setStackLen,
        redoLen,
        setRedoLen,
      }}
    >
      {children}
    </CircuitContext.Provider>
  );
}

export function useCircuit(): CircuitContextValue {
  const ctx = useContext(CircuitContext);
  if (!ctx) throw new Error('useCircuit must be used within CircuitProvider');
  return ctx;
}
