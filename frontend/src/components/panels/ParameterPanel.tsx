/**
 * ParameterPanel
 * Displays circuit parameters and allows editing.
 */

import { useState, useCallback, type FormEvent } from 'react';
import styles from './ParameterPanel.module.css';

interface ParameterPanelProps {
    parameters: Record<string, number> | undefined;
    onUpdate: (params: Record<string, number>) => Promise<void>;
}

export default function ParameterPanel({ parameters, onUpdate }: ParameterPanelProps) {
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const handleChange = useCallback((key: string, value: string) => {
        setEditValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            if (!parameters) return;

            const updates: Record<string, number> = {};
            Object.entries(editValues).forEach(([key, val]) => {
                const num = Number(val);
                if (!isNaN(num) && num !== parameters[key]) {
                    updates[key] = num;
                }
            });

            if (Object.keys(updates).length === 0) return;

            setLoading(true);
            try {
                await onUpdate(updates);
                setEditValues({});
            } finally {
                setLoading(false);
            }
        },
        [editValues, parameters, onUpdate]
    );

    if (!parameters || Object.keys(parameters).length === 0) {
        return (
            <div className={styles.panel}>
                <h3 className={styles.title}>Circuit Parameters</h3>
                <p className={styles.empty}>No parameters available</p>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            <h3 className={styles.title}>Circuit Parameters</h3>
            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.paramList}>
                    {Object.entries(parameters).map(([key, value]) => (
                        <div key={key} className={styles.paramRow}>
                            <span className={styles.paramKey}>{key}</span>
                            <input
                                type="text"
                                defaultValue={value.toExponential(4)}
                                onChange={(e) => handleChange(key, e.target.value)}
                                className={styles.paramInput}
                            />
                        </div>
                    ))}
                </div>
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                    style={{ width: '100%', marginTop: 'var(--space-sm)' }}
                >
                    {loading ? 'Updating…' : 'Update Parameters'}
                </button>
            </form>
        </div>
    );
}
