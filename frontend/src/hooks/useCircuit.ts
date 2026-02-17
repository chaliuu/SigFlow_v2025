/**
 * useCircuit Hook
 * Manages circuit state: loading, data, parameter updates, SFG refresh.
 */

import { useState, useCallback, useEffect } from 'react';
import * as api from '../api/api';
import type { CircuitData } from '../api/api';

interface UseCircuitReturn {
    circuit: CircuitData | null;
    loading: boolean;
    error: string | null;
    stackLen: number;
    redoLen: number;
    loadCircuit: () => Promise<void>;
    updateParameters: (params: Record<string, number>) => Promise<void>;
    setCircuit: (data: CircuitData) => void;
    circuitId: string;
}

export default function useCircuit(circuitId: string): UseCircuitReturn {
    const [circuit, setCircuit] = useState<CircuitData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stackLen, setStackLen] = useState(0);
    const [redoLen, setRedoLen] = useState(0);

    const loadCircuit = useCallback(async () => {
        if (!circuitId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await api.getCircuit(circuitId);
            setCircuit(data);
            setStackLen(data.stack_len ?? 0);
            setRedoLen(data.redo_len ?? 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load circuit');
        } finally {
            setLoading(false);
        }
    }, [circuitId]);

    useEffect(() => {
        loadCircuit();
    }, [loadCircuit]);

    const updateParameters = useCallback(
        async (params: Record<string, number>) => {
            if (!circuitId) return;
            try {
                const data = await api.patchCircuit(circuitId, params);
                setCircuit(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update parameters');
            }
        },
        [circuitId]
    );

    const updateCircuit = useCallback((data: CircuitData) => {
        setCircuit(data);
        setStackLen(data.stack_len ?? 0);
        setRedoLen(data.redo_len ?? 0);
    }, []);

    return {
        circuit,
        loading,
        error,
        stackLen,
        redoLen,
        loadCircuit,
        updateParameters,
        setCircuit: updateCircuit,
        circuitId,
    };
}
