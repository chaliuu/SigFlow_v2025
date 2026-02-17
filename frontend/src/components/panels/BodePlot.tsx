/**
 * BodePlot
 * Reusable Bode plot component using react-chartjs-2.
 */

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import type { BodeData } from '../../api/api';
import styles from './BodePlot.module.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface BodePlotProps {
    data: BodeData | null;
    title: string;
    overlayData?: BodeData | null;
    overlayLabel?: string;
}

export default function BodePlot({
    data,
    title,
    overlayData,
    overlayLabel = 'Overlay',
}: BodePlotProps) {
    const gainChartData = useMemo(() => {
        if (!data) return null;
        const datasets = [
            {
                label: 'Gain (dB)',
                data: data.gain,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                pointRadius: 0,
                tension: 0.3,
            },
        ];
        if (overlayData) {
            datasets.push({
                label: `${overlayLabel} Gain`,
                data: overlayData.gain,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                tension: 0.3,
            });
        }
        return {
            labels: data.frequency.map((f) => f.toFixed(1)),
            datasets,
        };
    }, [data, overlayData, overlayLabel]);

    const phaseChartData = useMemo(() => {
        if (!data) return null;
        const datasets = [
            {
                label: 'Phase (deg)',
                data: data.phase,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                pointRadius: 0,
                tension: 0.3,
            },
        ];
        if (overlayData) {
            datasets.push({
                label: `${overlayLabel} Phase`,
                data: overlayData.phase,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                tension: 0.3,
            });
        }
        return {
            labels: data.frequency.map((f) => f.toFixed(1)),
            datasets,
        };
    }, [data, overlayData, overlayLabel]);

    const chartOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#9aa0b4', font: { size: 11, family: 'Inter' } },
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Frequency (Hz)',
                        color: '#636b83',
                        font: { size: 11, family: 'Inter' },
                    },
                    ticks: { color: '#636b83', maxTicksLimit: 10, font: { size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
                y: {
                    ticks: { color: '#636b83', font: { size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
            },
        }),
        []
    );

    if (!data) {
        return (
            <div className={styles.panel}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.empty}>No Bode data available. Compute a transfer function or loop gain first.</p>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            <h3 className={styles.title}>{title}</h3>
            <div className={styles.plots}>
                <div className={styles.chart}>
                    {gainChartData && <Line data={gainChartData} options={chartOptions} />}
                </div>
                <div className={styles.chart}>
                    {phaseChartData && <Line data={phaseChartData} options={chartOptions} />}
                </div>
            </div>
        </div>
    );
}
