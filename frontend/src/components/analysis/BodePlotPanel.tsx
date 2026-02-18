/* ------------------------------------------------------------------ */
/*  SigFlow – Bode Plot Panel (reusable for TF & Loop Gain)            */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Box,
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

import type { BodeData } from '../../types';
import { expo } from '../../utils/formatting';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend);

interface BodePlotPanelProps {
  title: string;
  /** Extra fields shown before frequency inputs (e.g., input/output node for TF) */
  extraFields?: { key: string; label: string }[];
  /** Called with the form values to fetch bode data */
  onFetch: (params: Record<string, string | number>) => Promise<BodeData>;
}

export default function BodePlotPanel({ title, extraFields = [], onFetch }: BodePlotPanelProps) {
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

  /* Build Chart.js datasets */
  const latestData = history.length > 0 ? history[history.length - 1] : null;
  const overlay = overlayIdx !== null ? history[overlayIdx] : null;

  const chartData = React.useMemo(() => {
    if (!latestData) return null;
    const labels = latestData.frequency.map((f) => expo(f, 0));
    const datasets: {
      label: string;
      data: { x: number; y: number }[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      yAxisID: string;
      borderDash?: number[];
    }[] = [
      {
        label: 'Gain (dB)',
        data: latestData.frequency.map((f, i) => ({ x: f, y: latestData.gain[i] })),
        borderColor: '#ef5350',
        backgroundColor: '#ef5350',
        fill: false,
        yAxisID: 'y1',
      },
      {
        label: 'Phase (deg)',
        data: latestData.frequency.map((f, i) => ({ x: f, y: latestData.phase[i] })),
        borderColor: '#42a5f5',
        backgroundColor: '#42a5f5',
        fill: false,
        yAxisID: 'y2',
      },
    ];

    if (overlay) {
      datasets.push(
        {
          label: 'Gain Overlay',
          data: overlay.frequency.map((f, i) => ({ x: f, y: overlay.gain[i] })),
          borderColor: 'rgba(239,83,80,0.45)',
          backgroundColor: 'rgba(239,83,80,0.45)',
          fill: false,
          yAxisID: 'y1',
          borderDash: [5, 5],
        },
        {
          label: 'Phase Overlay',
          data: overlay.frequency.map((f, i) => ({ x: f, y: overlay.phase[i] })),
          borderColor: 'rgba(66,165,245,0.45)',
          backgroundColor: 'rgba(66,165,245,0.45)',
          fill: false,
          yAxisID: 'y2',
          borderDash: [5, 5],
        },
      );
    }

    return { labels, datasets };
  }, [latestData, overlay]);

  const chartOptions = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        title: { display: true, text: title, font: { size: 14 } },
      },
      scales: {
        y1: {
          type: 'linear' as const,
          position: 'left' as const,
          title: { display: true, text: 'dB' },
        },
        y2: {
          type: 'linear' as const,
          position: 'right' as const,
          title: { display: true, text: 'deg' },
          min: -180,
          max: 180,
          grid: { drawOnChartArea: false },
        },
      },
    }),
    [title],
  );

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <ShowChartIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5}>
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
                label="Start Freq (Hz)"
                value={fields.start_freq_hz ?? ''}
                onChange={(e) => handleField('start_freq_hz', e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
              <TextField
                label="End Freq (Hz)"
                value={fields.end_freq_hz ?? ''}
                onChange={(e) => handleField('end_freq_hz', e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
              <TextField
                label="Points/Decade"
                value={fields.points_per_decade ?? ''}
                onChange={(e) => handleField('points_per_decade', e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Stack>
            <Button type="submit" variant="contained" size="small">
              Plot
            </Button>
          </Stack>
        </form>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {chartData && (
          <Box sx={{ mt: 2, height: 360 }}>
            <Line data={chartData} options={chartOptions} />
          </Box>
        )}

        {/* History overlay buttons */}
        {history.length > 1 && (
          <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Overlay:
            </Typography>
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
      </CardContent>
    </Card>
  );
}
