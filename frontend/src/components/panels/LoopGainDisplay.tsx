/**
 * LoopGainDisplay
 * Shows loop gain expression with LaTeX rendering.
 */

import { useState, useCallback } from 'react';
import { MathJax } from 'better-react-mathjax';
import Toggle from '../common/Toggle';
import * as api from '../../api/api';
import styles from './TransferFunctionDisplay.module.css'; // reuse styles

interface LoopGainDisplayProps {
    circuitId: string;
}

export default function LoopGainDisplay({ circuitId }: LoopGainDisplayProps) {
    const [lgExpr, setLgExpr] = useState<string | null>(null);
    const [isSymbolic, setIsSymbolic] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLoopGain = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.getLoopGain(circuitId, { latex: isSymbolic });
            setLgExpr(result.loop_gain);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get loop gain');
        } finally {
            setLoading(false);
        }
    }, [circuitId, isSymbolic]);

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h3 className={styles.title}>Loop Gain</h3>
                <Toggle
                    checked={isSymbolic}
                    onChange={(v) => {
                        setIsSymbolic(v);
                    }}
                    label={isSymbolic ? 'Symbolic' : 'Numeric'}
                />
            </div>

            <button
                className="btn-primary"
                onClick={fetchLoopGain}
                disabled={loading}
                style={{ width: '100%' }}
            >
                {loading ? 'Computing…' : 'Compute Loop Gain'}
            </button>

            {error && <div className={styles.error}>{error}</div>}

            {lgExpr && (
                <div className={styles.result}>
                    {isSymbolic ? (
                        <MathJax>{`\\(${lgExpr}\\)`}</MathJax>
                    ) : (
                        <code className={styles.numericResult}>{lgExpr}</code>
                    )}
                </div>
            )}
        </div>
    );
}
