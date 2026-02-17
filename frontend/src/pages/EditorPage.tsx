/**
 * EditorPage
 * Main SFG editor — integrates all components.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useCircuit from '../hooks/useCircuit';
import useSfgActions from '../hooks/useSfgActions';
import CytoscapeRenderer, {
    type CytoscapeRendererRef,
} from '../components/sfg/CytoscapeRenderer';
import SvgOverlay from '../components/sfg/SvgOverlay';
import EdgeInfoTooltip from '../components/sfg/EdgeInfoTooltip';
import EdgeEditModal from '../components/sfg/EdgeEditModal';
import Toolbar from '../components/toolbar/Toolbar';
import ParameterPanel from '../components/panels/ParameterPanel';
import TransferFunctionDisplay from '../components/panels/TransferFunctionDisplay';
import LoopGainDisplay from '../components/panels/LoopGainDisplay';
import BodePlot from '../components/panels/BodePlot';
import StabilityAnalysis from '../components/panels/StabilityAnalysis';
import type { BodeData } from '../api/api';
import * as api from '../api/api';
import styles from './EditorPage.module.css';

export default function EditorPage() {
    const { circuitId: paramId } = useParams<{ circuitId: string }>();
    const navigate = useNavigate();
    const circuitId = paramId ?? sessionStorage.getItem('circuitId') ?? '';

    /* ─── Core state ─── */
    const {
        circuit,
        loading,
        error,
        stackLen,
        redoLen,
        loadCircuit,
        updateParameters,
        setCircuit,
    } = useCircuit(circuitId);

    const actions = useSfgActions(circuitId);

    /* ─── View state ─── */
    const [symbolic, setSymbolic] = useState(true);
    const [edgeLabelsVisible, setEdgeLabelsVisible] = useState(true);
    const [svgVisible, setSvgVisible] = useState(false);
    const [frequency, setFrequency] = useState(1000);
    const [freqMin, setFreqMin] = useState('1');
    const [freqMax, setFreqMax] = useState('10000');

    /* ─── Bode data ─── */
    const [tfBode, setTfBode] = useState<BodeData | null>(null);
    const [lgBode, setLgBode] = useState<BodeData | null>(null);
    const [bodeInputNode, setBodeInputNode] = useState('');
    const [bodeOutputNode, setBodeOutputNode] = useState('');
    const [bodeLoading, setBodeLoading] = useState(false);

    /* ─── Edge interaction ─── */
    const [hoverEdge, setHoverEdge] = useState<Record<string, unknown> | null>(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
    const [editEdge, setEditEdge] = useState<{
        source: string;
        target: string;
        symbolic: string;
        magnitude: number;
        phase: number;
        index: number;
    } | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedEdge, setSelectedEdge] = useState<Record<string, unknown> | null>(null);

    const cyRef = useRef<CytoscapeRendererRef>(null);

    /* ─── Derived data ─── */
    const nodeIds = useMemo(() => {
        const nodes = circuit?.sfg?.elements?.nodes;
        if (!nodes) return [];
        return nodes.map((n: { data: Record<string, unknown> }) =>
            String(n.data.name ?? n.data.label ?? n.data.id ?? '')
        );
    }, [circuit]);

    /* ─── Event handlers ─── */
    const handleNodeTap = useCallback(
        (nodeId: string) => {
            if (actions.simplifyMode) {
                actions.selectSimplifyNode(nodeId);
                // Visually mark on Cytoscape
                const cy = cyRef.current?.cy;
                if (cy) {
                    cy.getElementById(nodeId).addClass('simplify-selected');
                }
            }
        },
        [actions]
    );

    const handleEdgeTap = useCallback(
        async (edgeData: Record<string, unknown>) => {
            setSelectedEdge(edgeData);
        },
        []
    );

    const handleEdgeHover = useCallback(
        (edgeData: Record<string, unknown> | null, event?: MouseEvent) => {
            setHoverEdge(edgeData);
            if (event) {
                setHoverPos({ x: event.clientX, y: event.clientY });
            }
        },
        []
    );

    const handleSimplify = useCallback(async () => {
        const result = await actions.simplify();
        if (result) {
            setCircuit(result);
            // Clear visual selections
            cyRef.current?.cy?.elements().removeClass('simplify-selected');
        }
    }, [actions, setCircuit]);

    const handleSimplifyAll = useCallback(async () => {
        const result = await actions.simplifyAll();
        if (result) setCircuit(result);
    }, [actions, setCircuit]);

    const handleSimplifyAllTrivial = useCallback(async () => {
        const result = await actions.simplifyAllTrivial();
        if (result) setCircuit(result);
    }, [actions, setCircuit]);

    const handleUndo = useCallback(async () => {
        const result = await actions.undo();
        if (result) setCircuit(result);
    }, [actions, setCircuit]);

    const handleRedo = useCallback(async () => {
        const result = await actions.redo();
        if (result) setCircuit(result);
    }, [actions, setCircuit]);

    const handleRemoveHighlight = useCallback(() => {
        cyRef.current?.cy?.elements().removeClass('highlighted path-highlight');
    }, []);

    const handleRemoveBranch = useCallback(async () => {
        if (!selectedEdge) return;
        const result = await actions.removeBranch(
            String(selectedEdge.source),
            String(selectedEdge.target),
            Number(selectedEdge.index ?? 0)
        );
        if (result) {
            setCircuit(result);
            setSelectedEdge(null);
        }
    }, [selectedEdge, actions, setCircuit]);

    const handleEditBranch = useCallback(async () => {
        if (!selectedEdge) return;
        const info = await actions.getEdgeInfo(
            String(selectedEdge.source),
            String(selectedEdge.target),
            Number(selectedEdge.index ?? 0)
        );
        if (info) {
            setEditEdge({
                source: info.source,
                target: info.target,
                symbolic: info.symbolic,
                magnitude: info.magnitude,
                phase: info.phase,
                index: info.index,
            });
            setEditModalOpen(true);
        }
    }, [selectedEdge, actions]);

    const handleEdgeEditSubmit = useCallback(
        async (source: string, target: string, symbolicExpr: string, index: number) => {
            const result = await actions.updateEdge(source, target, symbolicExpr, index);
            if (result) setCircuit(result);
        },
        [actions, setCircuit]
    );

    const handleImport = useCallback(
        async (file: File) => {
            const result = await actions.importSfg(file);
            if (result) setCircuit(result);
        },
        [actions, setCircuit]
    );

    const handleRefresh = useCallback(() => {
        cyRef.current?.refresh();
        loadCircuit();
    }, [loadCircuit]);

    /* ─── Bode fetch ─── */
    const fetchTfBode = useCallback(async () => {
        if (!bodeInputNode || !bodeOutputNode) return;
        setBodeLoading(true);
        try {
            const data = await api.getTransferFunctionBode(circuitId, {
                input_node: bodeInputNode,
                output_node: bodeOutputNode,
                start_freq: Number(freqMin) || 1,
                end_freq: Number(freqMax) || 10000,
                points_per_decade: 50,
            });
            setTfBode(data);
        } catch {
            // silently fail, panels show empty state
        } finally {
            setBodeLoading(false);
        }
    }, [circuitId, bodeInputNode, bodeOutputNode, freqMin, freqMax]);

    const fetchLgBode = useCallback(async () => {
        setBodeLoading(true);
        try {
            const data = await api.getLoopGainBode(circuitId, {
                start_freq: Number(freqMin) || 1,
                end_freq: Number(freqMax) || 10000,
                points_per_decade: 50,
            });
            setLgBode(data);
        } catch {
            // silently fail
        } finally {
            setBodeLoading(false);
        }
    }, [circuitId, freqMin, freqMax]);

    /* ─── Render ─── */
    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <div className={styles.loadingSpinner} />
                <span className={styles.loadingText}>Loading circuit…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.errorScreen}>
                <h2>Error Loading Circuit</h2>
                <p>{error}</p>
                <button className="btn-primary" onClick={() => navigate('/')}>
                    Return to Landing
                </button>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Toolbar */}
            <Toolbar
                symbolic={symbolic}
                onSymbolicChange={setSymbolic}
                edgeLabelsVisible={edgeLabelsVisible}
                onEdgeLabelsChange={setEdgeLabelsVisible}
                svgVisible={svgVisible}
                onSvgVisibleChange={setSvgVisible}
                onRefresh={handleRefresh}
                onReturnToLanding={() => navigate('/')}
                simplifyMode={actions.simplifyMode}
                onSimplifyModeChange={actions.setSimplifyMode}
                onSimplify={handleSimplify}
                onSimplifyAll={handleSimplifyAll}
                onSimplifyAllTrivial={handleSimplifyAllTrivial}
                simplifyNode1={actions.simplifyNodes.node1}
                simplifyNode2={actions.simplifyNodes.node2}
                canUndo={stackLen > 0}
                canRedo={redoLen > 0}
                onUndo={handleUndo}
                onRedo={handleRedo}
                highlightMode={actions.highlightMode}
                onHighlightModeChange={actions.setHighlightMode}
                onRemoveHighlight={handleRemoveHighlight}
                onRemoveBranch={handleRemoveBranch}
                onEditBranch={handleEditBranch}
                onExport={actions.exportSfg}
                onImport={handleImport}
                frequency={frequency}
                onFrequencyChange={setFrequency}
                freqMin={freqMin}
                freqMax={freqMax}
                onFreqMinChange={setFreqMin}
                onFreqMaxChange={setFreqMax}
                onUpdateRange={() => {
                    fetchTfBode();
                    fetchLgBode();
                }}
            />

            {/* Main content area */}
            <div className={styles.mainGrid}>
                {/* Left — SFG Canvas */}
                <div className={styles.canvasSection}>
                    <div className={styles.canvasWrapper}>
                        <CytoscapeRenderer
                            ref={cyRef}
                            elements={circuit?.sfg ?? null}
                            symbolic={symbolic}
                            edgeLabelsVisible={edgeLabelsVisible}
                            onNodeTap={handleNodeTap}
                            onEdgeTap={handleEdgeTap}
                            onEdgeHover={handleEdgeHover}
                        />
                        <SvgOverlay svgContent={circuit?.svg} visible={svgVisible} />
                    </div>

                    {/* Bode Control Bar */}
                    <div className={styles.bodeBar}>
                        <select
                            value={bodeInputNode}
                            onChange={(e) => setBodeInputNode(e.target.value)}
                            className={styles.bodeSelect}
                        >
                            <option value="">Input</option>
                            {nodeIds.map((id) => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                        <span className={styles.bodeArrow}>→</span>
                        <select
                            value={bodeOutputNode}
                            onChange={(e) => setBodeOutputNode(e.target.value)}
                            className={styles.bodeSelect}
                        >
                            <option value="">Output</option>
                            {nodeIds.map((id) => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                        <button
                            className="btn-primary"
                            onClick={fetchTfBode}
                            disabled={bodeLoading || !bodeInputNode || !bodeOutputNode}
                        >
                            TF Bode
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={fetchLgBode}
                            disabled={bodeLoading}
                        >
                            LG Bode
                        </button>
                    </div>

                    {/* Bode Plots */}
                    <div className={styles.bodePlots}>
                        <BodePlot data={tfBode} title="Transfer Function Bode Plot" />
                        <BodePlot data={lgBode} title="Loop Gain Bode Plot" />
                    </div>
                </div>

                {/* Right — Panels */}
                <div className={styles.panelSection}>
                    <ParameterPanel
                        parameters={circuit?.parameters}
                        onUpdate={updateParameters}
                    />
                    <TransferFunctionDisplay
                        circuitId={circuitId}
                        nodeIds={nodeIds}
                    />
                    <LoopGainDisplay circuitId={circuitId} />
                    <StabilityAnalysis circuitId={circuitId} nodeIds={nodeIds} />
                </div>
            </div>

            {/* Floating elements */}
            <EdgeInfoTooltip data={hoverEdge} x={hoverPos.x} y={hoverPos.y} />
            <EdgeEditModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                edgeData={editEdge}
                onSubmit={handleEdgeEditSubmit}
            />

            {actions.actionError && (
                <div className={styles.toast}>
                    ⚠ {actions.actionError}
                </div>
            )}
        </div>
    );
}
