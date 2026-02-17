/**
 * StabilityAnalysis
 * Phase margin & bandwidth parametric sweep forms + plots.
 */

import { useState, useCallback, type FormEvent } from 'react';
import { Line } from 'react-chartjs-2';
import * as api from '../../api/api';
import styles from './StabilityAnalysis.module.css';

interface StabilityAnalysisProps {
    circuitId: string;
    nodeIds: string[];
}

export default function StabilityAnalysis({
    circuitId,
    nodeIds,
}: StabilityAnalysisProps) {
    const [inputNode, setInputNode] = useState('');
    const [outputNode, setOutputNode] = useState('');
    const [device, setDevice] = useState('');
    const [minVal, setMinVal] = useState('');
    const [maxVal, setMaxVal] = useState('');
    const [stepSize, setStepSize] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [pmData, setPmData] = useState<{ x: number[]; y: number[] } | null>(null);
    const [bwData, setBwData] = useState<{ x: number[]; y: number[] } | null>(null);

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            if (!inputNode || !outputNode || !device || !minVal || !maxVal || !stepSize) {
                setError('Please fill all fields.');
                return;
            }

            // Validate device
            const deviceCheck = await api.checkDevice(circuitId, device);
            if (!deviceCheck.exists) {
                setError(`Device "${device}" not found.`);
                return;
            }

            const params: Record<string, string | number> = {
                input_node: inputNode,
                output_node: outputNode,
                selected_device: device,
                min_val: Number(minVal),
                max_val: Number(maxVal),
                step_size: Number(stepSize),
            };

            setLoading(true);
            setError(null);
            try {
                const [pm, bw] = await Promise.all([
                    api.getPhaseMarginPlot(circuitId, params),
                    api.getBandwidthPlot(circuitId, params),
                ]);
                setPmData({ x: pm.device_value, y: pm.phase_margin });
                setBwData({ x: bw.parameter_value, y: bw.bandwidth });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch stability data');
            } finally {
                setLoading(false);
            }
        },
        [circuitId, inputNode, outputNode, device, minVal, maxVal, stepSize]
    );

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#9aa0b4', font: { size: 11, family: 'Inter' } },
            },
        },
        scales: {
            x: {
                ticks: { color: '#636b83', font: { size: 10 } },
                grid: { color: 'rgba(255,255,255,0.04)' },
            },
            y: {
                ticks: { color: '#636b83', font: { size: 10 } },
                grid: { color: 'rgba(255,255,255,0.04)' },
            },
        },
    };

    return (
        <div className={styles.panel}>
            <h3 className={styles.title}>Stability Analysis</h3>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGrid}>
                    <select
                        value={inputNode}
                        onChange={(e) => setInputNode(e.target.value)}
                        className={styles.input}
                    >
                        <option value="">Input Node</option>
                        {nodeIds.map((id) => (
                            <option key={id} value={id}>{id}</option>
                        ))}
                    </select>

                    <select
                        value={outputNode}
                        onChange={(e) => setOutputNode(e.target.value)}
                        className={styles.input}
                    >
                        <option value="">Output Node</option>
                        {nodeIds.map((id) => (
                            <option key={id} value={id}>{id}</option>
                        ))}
                    </select>

                    <input
                        type="text"
                        placeholder="Device name"
                        value={device}
                        onChange={(e) => setDevice(e.target.value)}
                        className={styles.input}
                    />

                    <input
                        type="number"
                        placeholder="Min value"
                        value={minVal}
                        onChange={(e) => setMinVal(e.target.value)}
                        className={styles.input}
                    />

                    <input
                        type="number"
                        placeholder="Max value"
                        value={maxVal}
                        onChange={(e) => setMaxVal(e.target.value)}
                        className={styles.input}
                    />

                    <input
                        type="number"
                        placeholder="Step size"
                        value={stepSize}
                        onChange={(e) => setStepSize(e.target.value)}
                        className={styles.input}
                    />
                </div>

                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Computing…' : 'Run Stability Analysis'}
                </button>
            </form>

            {error && <div className={styles.error}>{error}</div>}

            {(pmData || bwData) && (
                <div className={styles.plots}>
                    {pmData && (
                        <div className={styles.chart}>
                            <Line
                                data={{
                                    labels: pmData.x.map(String),
                                    datasets: [
                                        {
                                            label: 'Phase Margin (°)',
                                            data: pmData.y,
                                            borderColor: '#10b981',
                                            borderWidth: 2,
                                            fill: false,
                                            pointRadius: 2,
                                            tension: 0.3,
                                        },
                                    ],
                                }}
                                options={{
                                    ...chartOptions,
                                    plugins: {
                                        ...chartOptions.plugins,
                                        title: {
                                            display: true,
                                            text: `${device} vs Phase Margin`,
                                            color: '#e8eaed',
                                            font: { size: 13, family: 'Inter' },
                                        },
                                    },
                                }}
                            />
                        </div>
                    )}
                    {bwData && (
                        <div className={styles.chart}>
                            <Line
                                data={{
                                    labels: bwData.x.map(String),
                                    datasets: [
                                        {
                                            label: 'Bandwidth (Hz)',
                                            data: bwData.y,
                                            borderColor: '#8b5cf6',
                                            borderWidth: 2,
                                            fill: false,
                                            pointRadius: 2,
                                            tension: 0.3,
                                        },
                                    ],
                                }}
                                options={{
                                    ...chartOptions,
                                    plugins: {
                                        ...chartOptions.plugins,
                                        title: {
                                            display: true,
                                            text: `${device} vs Bandwidth`,
                                            color: '#e8eaed',
                                            font: { size: 13, family: 'Inter' },
                                        },
                                    },
                                }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
