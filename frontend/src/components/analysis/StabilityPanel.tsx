/* ------------------------------------------------------------------ */
/*  SigFlow – Stability Panel (Phase Margin + Bandwidth)               */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Box,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface StabilityData {
  pm: { device_value: number[]; phase_margin: number[] } | null;
  bw: { parameter_value: number[]; bandwidth: number[] } | null;
}

export default function StabilityPanel() {
  const { circuitId } = useCircuit();
  const [inputNode, setInputNode] = useState('');
  const [outputNode, setOutputNode] = useState('');
  const [device, setDevice] = useState('');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [stepSize, setStepSize] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stabData, setStabData] = useState<StabilityData>({ pm: null, bw: null });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!circuitId) return;
      setError(null);

      if (!inputNode || !outputNode || !device || !minVal || !maxVal || !stepSize) {
        setError('Please fill in all fields.');
        return;
      }

      const params = {
        input_node: inputNode,
        output_node: outputNode,
        selected_device: device,
        min_val: parseFloat(minVal),
        max_val: parseFloat(maxVal),
        step_size: parseFloat(stepSize),
      };

      try {
        const exists = await api.checkDeviceExists(circuitId, device);
        if (!exists) {
          setError(`Device "${device}" not found.`);
          return;
        }

        const [pm, bw] = await Promise.all([
          api.getPhaseMarginPlot(circuitId, params),
          api.getBandwidthPlot(circuitId, params),
        ]);
        setStabData({ pm, bw });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      }
    },
    [circuitId, inputNode, outputNode, device, minVal, maxVal, stepSize],
  );

  const pmChart = useMemo(() => {
    if (!stabData.pm) return null;
    return {
      labels: stabData.pm.device_value.map(String),
      datasets: [
        {
          label: 'Phase Margin (°)',
          data: stabData.pm.phase_margin,
          borderColor: '#26a69a',
          backgroundColor: '#26a69a',
          fill: false,
        },
      ],
    };
  }, [stabData.pm]);

  const bwChart = useMemo(() => {
    if (!stabData.bw) return null;
    return {
      labels: stabData.bw.parameter_value.map(String),
      datasets: [
        {
          label: 'Bandwidth (Hz)',
          data: stabData.bw.bandwidth,
          borderColor: '#7e57c2',
          backgroundColor: '#7e57c2',
          fill: false,
        },
      ],
    };
  }, [stabData.bw]);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <SecurityIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            Stability Analysis
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Input Node"
                value={inputNode}
                onChange={(e) => setInputNode(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Output Node"
                value={outputNode}
                onChange={(e) => setOutputNode(e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
            <TextField
              label="Device parameter"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Min"
                type="number"
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Max"
                type="number"
                value={maxVal}
                onChange={(e) => setMaxVal(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Step"
                type="number"
                value={stepSize}
                onChange={(e) => setStepSize(e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
            <Button type="submit" variant="contained" size="small">
              Analyse
            </Button>
          </Stack>
        </form>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {(pmChart || bwChart) && (
          <Stack spacing={2} mt={2}>
            {pmChart && (
              <Box sx={{ height: 280 }}>
                <Line
                  data={pmChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      title: { display: true, text: `${device} vs Phase Margin` },
                    },
                    scales: {
                      x: { title: { display: true, text: device } },
                      y: { title: { display: true, text: 'Phase Margin (°)' } },
                    },
                  }}
                />
              </Box>
            )}
            {bwChart && (
              <Box sx={{ height: 280 }}>
                <Line
                  data={bwChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      title: { display: true, text: `${device} vs Bandwidth` },
                    },
                    scales: {
                      x: { title: { display: true, text: device } },
                      y: { title: { display: true, text: 'Bandwidth (Hz)' } },
                    },
                  }}
                />
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
