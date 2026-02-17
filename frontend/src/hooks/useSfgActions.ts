/**
 * useSfgActions Hook
 * Simplification, undo/redo, edge operations, path highlighting.
 */

import { useState, useCallback } from 'react';
import * as api from '../api/api';
import type { CircuitData, EdgeInfoResult } from '../api/api';

interface UseSfgActionsReturn {
    /* Simplification */
    simplifyMode: boolean;
    setSimplifyMode: (v: boolean) => void;
    simplifyNodes: { node1: string | null; node2: string | null };
    selectSimplifyNode: (nodeId: string) => void;
    clearSimplifySelection: () => void;
    simplify: () => Promise<CircuitData | null>;
    simplifyAll: () => Promise<CircuitData | null>;
    simplifyAllTrivial: () => Promise<CircuitData | null>;

    /* Undo / Redo */
    undo: () => Promise<CircuitData | null>;
    redo: () => Promise<CircuitData | null>;

    /* Path highlighting */
    highlightMode: boolean;
    setHighlightMode: (v: boolean) => void;

    /* Edge operations */
    getEdgeInfo: (source: string, target: string, index?: number) => Promise<EdgeInfoResult | null>;
    updateEdge: (source: string, target: string, symbolic: string, index?: number) => Promise<CircuitData | null>;
    removeBranch: (source: string, target: string, index?: number) => Promise<CircuitData | null>;

    /* Export / Import */
    exportSfg: () => Promise<void>;
    importSfg: (file: File) => Promise<CircuitData | null>;

    /* State */
    actionLoading: boolean;
    actionError: string | null;
}

export default function useSfgActions(circuitId: string): UseSfgActionsReturn {
    const [simplifyMode, setSimplifyMode] = useState(false);
    const [highlightMode, setHighlightMode] = useState(false);
    const [simplifyNode1, setSimplifyNode1] = useState<string | null>(null);
    const [simplifyNode2, setSimplifyNode2] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const wrap = useCallback(
        async <T>(fn: () => Promise<T>): Promise<T | null> => {
            setActionLoading(true);
            setActionError(null);
            try {
                return await fn();
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Action failed';
                setActionError(msg);
                return null;
            } finally {
                setActionLoading(false);
            }
        },
        []
    );

    const selectSimplifyNode = useCallback(
        (nodeId: string) => {
            if (!simplifyNode1) {
                setSimplifyNode1(nodeId);
            } else if (!simplifyNode2) {
                setSimplifyNode2(nodeId);
            }
        },
        [simplifyNode1, simplifyNode2]
    );

    const clearSimplifySelection = useCallback(() => {
        setSimplifyNode1(null);
        setSimplifyNode2(null);
    }, []);

    const simplify = useCallback(async () => {
        if (!simplifyNode1 || !simplifyNode2) return null;
        const result = await wrap(() =>
            api.simplifyCircuit(circuitId, { source: simplifyNode1, target: simplifyNode2 })
        );
        clearSimplifySelection();
        return result;
    }, [circuitId, simplifyNode1, simplifyNode2, wrap, clearSimplifySelection]);

    const simplifyAll = useCallback(
        () => wrap(() => api.simplifyEntireGraph(circuitId)),
        [circuitId, wrap]
    );

    const simplifyAllTrivial = useCallback(
        () => wrap(() => api.simplifyEntireGraphTrivial(circuitId)),
        [circuitId, wrap]
    );

    const undo = useCallback(
        () => wrap(() => api.undoSfg(circuitId)),
        [circuitId, wrap]
    );

    const redo = useCallback(
        () => wrap(() => api.redoSfg(circuitId)),
        [circuitId, wrap]
    );

    const getEdgeInfoFn = useCallback(
        (source: string, target: string, index?: number) =>
            wrap(() => api.getEdgeInfo(circuitId, { source, target, index: index ?? 0 })),
        [circuitId, wrap]
    );

    const updateEdgeFn = useCallback(
        (source: string, target: string, symbolic: string, index?: number) =>
            wrap(() => api.updateEdge(circuitId, { source, target, symbolic, index })),
        [circuitId, wrap]
    );

    const removeBranchFn = useCallback(
        (source: string, target: string, index?: number) =>
            wrap(() => api.removeBranch(circuitId, { source, target, index })),
        [circuitId, wrap]
    );

    const exportSfgFn = useCallback(async () => {
        const blob = await api.exportSfg(circuitId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sfg_${circuitId}.pkl`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }, [circuitId]);

    const importSfgFn = useCallback(
        (file: File) => wrap(() => api.importSfg(circuitId, file)),
        [circuitId, wrap]
    );

    return {
        simplifyMode,
        setSimplifyMode,
        simplifyNodes: { node1: simplifyNode1, node2: simplifyNode2 },
        selectSimplifyNode,
        clearSimplifySelection,
        simplify,
        simplifyAll,
        simplifyAllTrivial,
        undo,
        redo,
        highlightMode,
        setHighlightMode,
        getEdgeInfo: getEdgeInfoFn,
        updateEdge: updateEdgeFn,
        removeBranch: removeBranchFn,
        exportSfg: exportSfgFn,
        importSfg: importSfgFn,
        actionLoading,
        actionError,
    };
}
