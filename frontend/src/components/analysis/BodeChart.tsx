/* ------------------------------------------------------------------ */
/*  SigFlow – Inline Bode Chart sub-component                         */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  Alert,
  Divider,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { expo } from '../../utils/formatting';
import type { BodeData } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
);

interface BodeChartProps {
  label: string;
  extraFields?: { key: string; label: string }[];
  onFetch: (params: Record<string, string | number>) => Promise<BodeData>;
}

export default function BodeChart({ label, extraFields = [], onFetch }: BodeChartProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BodeData[]>([]);
  const [overlayIdx, setOverlayIdx] = useState<number | null>(null);

  const handleField = useCallback((key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        const params: Record<string, string | number> = {};
        Object.entries(fields).forEach(([k, v]) => {
          params[k] = isNaN(Number(v)) ? v : parseFloat(v);
        });
        const data = await onFetch(params);
        setHistory((prev) => [...prev, data]);
        setOverlayIdx(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bode data');
      }
    },
    [fields, onFetch],
  );

  const latestData = history.length > 0 ? history[history.length - 1] : null;
  const overlay = overlayIdx !== null ? history[overlayIdx] : null;

  const chartData = useMemo(() => {
    if (!latestData) return null;
    const labels = latestData.frequency.map((f) => expo(f, 0));

    interface Dataset {
      label: string;
      data: { x: number; y: number }[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      yAxisID: string;
      borderDash?: number[];
      pointRadius: number;
      borderWidth: number;
    }

    const datasets: Dataset[] = [
      {
        label: 'Gain (dB)',
        data: latestData.frequency.map((f, i) => ({ x: f, y: latestData.gain[i] })),
        borderColor: '#ef5350',
        backgroundColor: '#ef5350',
        fill: false,
        yAxisID: 'y1',
        pointRadius: 1,
        borderWidth: 2,
      },
      {
        label: 'Phase (°)',
        data: latestData.frequency.map((f, i) => ({ x: f, y: latestData.phase[i] })),
        borderColor: '#42a5f5',
        backgroundColor: '#42a5f5',
        fill: false,
        yAxisID: 'y2',
        pointRadius: 1,
        borderWidth: 2,
      },
    ];

    if (overlay) {
      datasets.push(
        {
          label: 'Gain Overlay',
          data: overlay.frequency.map((f, i) => ({ x: f, y: overlay.gain[i] })),
          borderColor: 'rgba(239,83,80,0.4)',
          backgroundColor: 'rgba(239,83,80,0.4)',
          fill: false,
          yAxisID: 'y1',
          borderDash: [5, 5],
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Phase Overlay',
          data: overlay.frequency.map((f, i) => ({ x: f, y: overlay.phase[i] })),
          borderColor: 'rgba(66,165,245,0.4)',
          backgroundColor: 'rgba(66,165,245,0.4)',
          fill: false,
          yAxisID: 'y2',
          borderDash: [5, 5],
          pointRadius: 0,
          borderWidth: 1.5,
        },
      );
    }

    return { labels, datasets };
  }, [latestData, overlay]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: true, labels: { boxWidth: 8, font: { size: 9 } } },
      },
      scales: {
        y1: {
          type: 'linear' as const,
          position: 'left' as const,
          title: { display: true, text: 'dB', font: { size: 10 } },
        },
        y2: {
          type: 'linear' as const,
          position: 'right' as const,
          title: { display: true, text: '°', font: { size: 10 } },
          grid: { drawOnChartArea: false },
        },
      },
    }),
    [],
  );

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Stack spacing={1} mt={1}>
          {extraFields.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              value={fields[f.key] ?? ''}
              onChange={(e) => handleField(f.key, e.target.value)}
              size="small"
              fullWidth
            />
          ))}
          <Stack direction="row" spacing={1}>
            <TextField
              label="Start (Hz)"
              value={fields.start_freq_hz ?? ''}
              onChange={(e) => handleField('start_freq_hz', e.target.value)}
              type="number"
              size="small"
              fullWidth
            />
            <TextField
              label="End (Hz)"
              value={fields.end_freq_hz ?? ''}
              onChange={(e) => handleField('end_freq_hz', e.target.value)}
              type="number"
              size="small"
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Pts/dec"
              value={fields.points_per_decade ?? ''}
              onChange={(e) => handleField('points_per_decade', e.target.value)}
              type="number"
              size="small"
              sx={{ flex: 1 }}
            />
            <Button type="submit" variant="contained" size="small" startIcon={<ShowChartIcon />}>
              Plot
            </Button>
          </Stack>
        </Stack>
      </form>

      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

      {chartData && (
        <Box sx={{ mt: 1.5, height: 220 }}>
          <Line data={chartData} options={chartOptions} />
        </Box>
      )}

      {history.length > 1 && (
        <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Typography variant="caption" color="text.secondary">Overlay:</Typography>
          {history.map((_, idx) => (
            <Chip
              key={idx}
              label={`#${idx}`}
              size="small"
              variant={overlayIdx === idx ? 'filled' : 'outlined'}
              color="primary"
              onClick={() => setOverlayIdx(idx === overlayIdx ? null : idx)}
            />
          ))}
          <Tooltip title="Clear history">
            <IconButton size="small" onClick={() => { setHistory([]); setOverlayIdx(null); }}>
              <DeleteSweepIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Box>
  );
}
