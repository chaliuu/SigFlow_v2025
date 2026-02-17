/**
 * Toolbar
 * Top control bar for the SFG editor page.
 */

import { useCallback, useRef, type ChangeEvent } from 'react';
import Toggle from '../common/Toggle';
import styles from './Toolbar.module.css';

interface ToolbarProps {
    /* View controls */
    symbolic: boolean;
    onSymbolicChange: (v: boolean) => void;
    edgeLabelsVisible: boolean;
    onEdgeLabelsChange: (v: boolean) => void;
    svgVisible: boolean;
    onSvgVisibleChange: (v: boolean) => void;
    onRefresh: () => void;
    onReturnToLanding: () => void;

    /* Simplification */
    simplifyMode: boolean;
    onSimplifyModeChange: (v: boolean) => void;
    onSimplify: () => void;
    onSimplifyAll: () => void;
    onSimplifyAllTrivial: () => void;
    simplifyNode1: string | null;
    simplifyNode2: string | null;

    /* Undo/Redo */
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;

    /* Path highlight */
    highlightMode: boolean;
    onHighlightModeChange: (v: boolean) => void;
    onRemoveHighlight: () => void;

    /* Branch operations */
    onRemoveBranch: () => void;
    onEditBranch: () => void;

    /* Export/Import */
    onExport: () => void;
    onImport: (file: File) => void;

    /* Frequency */
    frequency: number;
    onFrequencyChange: (v: number) => void;
    freqMin: string;
    freqMax: string;
    onFreqMinChange: (v: string) => void;
    onFreqMaxChange: (v: string) => void;
    onUpdateRange: () => void;
}

export default function Toolbar(props: ToolbarProps) {
    const importRef = useRef<HTMLInputElement>(null);

    const handleImportChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) props.onImport(file);
        },
        [props]
    );

    return (
        <div className={styles.toolbar}>
            {/* ── View Controls ── */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>View</span>
                <div className={styles.controls}>
                    <Toggle
                        checked={props.symbolic}
                        onChange={props.onSymbolicChange}
                        label="Symbolic"
                    />
                    <Toggle
                        checked={props.edgeLabelsVisible}
                        onChange={props.onEdgeLabelsChange}
                        label="Edge Labels"
                    />
                    <Toggle
                        checked={props.svgVisible}
                        onChange={props.onSvgVisibleChange}
                        label="Schematic"
                    />
                    <button className="btn-secondary" onClick={props.onRefresh}>
                        ⟳ Refresh
                    </button>
                    <button className="btn-secondary" onClick={props.onReturnToLanding}>
                        ← Back
                    </button>
                </div>
            </div>

            {/* ── Simplification ── */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Simplification</span>
                <div className={styles.controls}>
                    <Toggle
                        checked={props.simplifyMode}
                        onChange={props.onSimplifyModeChange}
                        label="Select Mode"
                    />
                    {props.simplifyMode && (
                        <button
                            className="btn-primary"
                            onClick={props.onSimplify}
                            disabled={!props.simplifyNode1 || !props.simplifyNode2}
                        >
                            Simplify
                        </button>
                    )}
                    {props.simplifyNode1 && (
                        <span className={styles.badge}>
                            {props.simplifyNode1}
                            {props.simplifyNode2 && ` → ${props.simplifyNode2}`}
                        </span>
                    )}
                    <button className="btn-secondary" onClick={props.onSimplifyAll}>
                        Simplify All
                    </button>
                    <button className="btn-secondary" onClick={props.onSimplifyAllTrivial}>
                        Trivial
                    </button>
                    <div className={styles.divider} />
                    <button
                        className="btn-secondary"
                        onClick={props.onUndo}
                        disabled={!props.canUndo}
                    >
                        ↩ Undo
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={props.onRedo}
                        disabled={!props.canRedo}
                    >
                        ↪ Redo
                    </button>
                </div>
            </div>

            {/* ── Paths & Branches ── */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Paths & Branches</span>
                <div className={styles.controls}>
                    <Toggle
                        checked={props.highlightMode}
                        onChange={props.onHighlightModeChange}
                        label="Highlight"
                    />
                    <button className="btn-secondary" onClick={props.onRemoveHighlight}>
                        Clear
                    </button>
                    <div className={styles.divider} />
                    <button className="btn-secondary" onClick={props.onRemoveBranch}>
                        Remove Branch
                    </button>
                    <button className="btn-secondary" onClick={props.onEditBranch}>
                        Edit Branch
                    </button>
                </div>
            </div>

            {/* ── Frequency ── */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Frequency</span>
                <div className={styles.controls}>
                    <input
                        type="text"
                        placeholder="Min (Hz)"
                        value={props.freqMin}
                        onChange={(e) => props.onFreqMinChange(e.target.value)}
                        className={styles.freqInput}
                    />
                    <input
                        type="range"
                        min={1}
                        max={10000}
                        step="any"
                        value={props.frequency}
                        onChange={(e) => props.onFrequencyChange(Number(e.target.value))}
                        className={styles.slider}
                    />
                    <input
                        type="text"
                        placeholder="Max (Hz)"
                        value={props.freqMax}
                        onChange={(e) => props.onFreqMaxChange(e.target.value)}
                        className={styles.freqInput}
                    />
                    <span className={styles.freqValue}>{props.frequency} Hz</span>
                    <button className="btn-secondary" onClick={props.onUpdateRange}>
                        Update
                    </button>
                </div>
            </div>

            {/* ── Import / Export ── */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>SFG File</span>
                <div className={styles.controls}>
                    <button className="btn-secondary" onClick={props.onExport}>
                        💾 Save
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => importRef.current?.click()}
                    >
                        📂 Load
                    </button>
                    <input
                        ref={importRef}
                        type="file"
                        accept=".pkl"
                        onChange={handleImportChange}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>
        </div>
    );
}
