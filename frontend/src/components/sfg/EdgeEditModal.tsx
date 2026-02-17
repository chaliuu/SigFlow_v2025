/**
 * EdgeEditModal
 * Modal for editing edge symbolic expression, showing magnitude/phase.
 */

import { useState, useEffect, type FormEvent } from 'react';
import Modal from '../common/Modal';
import styles from './EdgeEditModal.module.css';

interface EdgeEditModalProps {
    open: boolean;
    onClose: () => void;
    edgeData: {
        source: string;
        target: string;
        symbolic: string;
        magnitude: number;
        phase: number;
        index: number;
    } | null;
    onSubmit: (source: string, target: string, symbolic: string, index: number) => Promise<void>;
}

export default function EdgeEditModal({
    open,
    onClose,
    edgeData,
    onSubmit,
}: EdgeEditModalProps) {
    const [symbolic, setSymbolic] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (edgeData) {
            setSymbolic(edgeData.symbolic);
            setError(null);
        }
    }, [edgeData]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!edgeData) return;

        setLoading(true);
        setError(null);
        try {
            await onSubmit(edgeData.source, edgeData.target, symbolic, edgeData.index);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update edge');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Edit Edge" width="480px">
            {edgeData && (
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.info}>
                        <span className={styles.infoLabel}>
                            {edgeData.source} → {edgeData.target}
                        </span>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Symbolic Expression</label>
                        <input
                            type="text"
                            value={symbolic}
                            onChange={(e) => setSymbolic(e.target.value)}
                            className={styles.input}
                            autoFocus
                        />
                    </div>

                    <div className={styles.readonlyFields}>
                        <div className={styles.readonlyField}>
                            <span className={styles.readonlyLabel}>Magnitude</span>
                            <span className={styles.readonlyValue}>
                                {edgeData.magnitude !== undefined
                                    ? Number(edgeData.magnitude).toExponential(4)
                                    : '—'}
                            </span>
                        </div>
                        <div className={styles.readonlyField}>
                            <span className={styles.readonlyLabel}>Phase</span>
                            <span className={styles.readonlyValue}>
                                {edgeData.phase !== undefined
                                    ? `${Number(edgeData.phase).toFixed(2)}°`
                                    : '—'}
                            </span>
                        </div>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.actions}>
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
