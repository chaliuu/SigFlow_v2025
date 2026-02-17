/**
 * TransferFunctionDisplay
 * Shows the transfer function with LaTeX rendering and numeric/symbolic toggle.
 */

import { useState, useCallback, type FormEvent } from 'react';
import { MathJax } from 'better-react-mathjax';
import Toggle from '../common/Toggle';
import * as api from '../../api/api';
import styles from './TransferFunctionDisplay.module.css';

interface TransferFunctionDisplayProps {
    circuitId: string;
    nodeIds: string[];
}

export default function TransferFunctionDisplay({
    circuitId,
    nodeIds,
}: TransferFunctionDisplayProps) {
    const [inputNode, setInputNode] = useState('');
    const [outputNode, setOutputNode] = useState('');
    const [tfExpr, setTfExpr] = useState<string | null>(null);
    const [isSymbolic, setIsSymbolic] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTF = useCallback(
        async (e?: FormEvent) => {
            e?.preventDefault();
            if (!inputNode || !outputNode) return;

            setLoading(true);
            setError(null);
            try {
                const result = await api.getTransferFunction(circuitId, {
                    input_node: inputNode,
                    output_node: outputNode,
                    latex: isSymbolic,
                });
                setTfExpr(result.transfer_function);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to get transfer function');
            } finally {
                setLoading(false);
            }
        },
        [circuitId, inputNode, outputNode, isSymbolic]
    );

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h3 className={styles.title}>Transfer Function</h3>
                <Toggle
                    checked={isSymbolic}
                    onChange={(v) => {
                        setIsSymbolic(v);
                        if (inputNode && outputNode) fetchTF();
                    }}
                    label={isSymbolic ? 'Symbolic' : 'Numeric'}
                />
            </div>

            <form onSubmit={fetchTF} className={styles.form}>
                <select
                    value={inputNode}
                    onChange={(e) => setInputNode(e.target.value)}
                    className={styles.select}
                >
                    <option value="">Input Node</option>
                    {nodeIds.map((id) => (
                        <option key={id} value={id}>
                            {id}
                        </option>
                    ))}
                </select>
                <span className={styles.arrow}>→</span>
                <select
                    value={outputNode}
                    onChange={(e) => setOutputNode(e.target.value)}
                    className={styles.select}
                >
                    <option value="">Output Node</option>
                    {nodeIds.map((id) => (
                        <option key={id} value={id}>
                            {id}
                        </option>
                    ))}
                </select>
                <button type="submit" className="btn-primary" disabled={loading || !inputNode || !outputNode}>
                    {loading ? '…' : 'Compute'}
                </button>
            </form>

            {error && <div className={styles.error}>{error}</div>}

            {tfExpr && (
                <div className={styles.result}>
                    {isSymbolic ? (
                        <MathJax>{`\\(${tfExpr}\\)`}</MathJax>
                    ) : (
                        <code className={styles.numericResult}>{tfExpr}</code>
                    )}
                </div>
            )}
        </div>
    );
}
