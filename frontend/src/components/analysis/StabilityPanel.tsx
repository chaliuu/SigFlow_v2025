/* ------------------------------------------------------------------ */
/*  SigFlow – Stability Analysis Accordion Section                     */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';

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

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';
import { accordionSx, summarySx } from '../sidebar/sidebarStyles';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
);

export default function StabilityPanel() {
  const { circuitId } = useCircuit();

  const [stabIn, setStabIn] = useState('');
  const [stabOut, setStabOut] = useState('');
  const [stabDev, setStabDev] = useState('');
  const [stabMin, setStabMin] = useState('');
  const [stabMax, setStabMax] = useState('');
  const [stabStep, setStabStep] = useState('');
  const [stabErr, setStabErr] = useState<string | null>(null);
  const [stabPm, setStabPm] = useState<{
    device_value: number[];
    phase_margin: number[];
  } | null>(null);
  const [stabBw, setStabBw] = useState<{
    parameter_value: number[];
    bandwidth: number[];
  } | null>(null);

  const handleStability = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!circuitId) return;
      setStabErr(null);
      if (!stabIn || !stabOut || !stabDev || !stabMin || !stabMax || !stabStep) {
        setStabErr('Please fill in all fields.');
        return;
      }
      const p = {
        input_node: stabIn,
        output_node: stabOut,
        selected_device: stabDev,
        min_val: parseFloat(stabMin),
        max_val: parseFloat(stabMax),
        step_size: parseFloat(stabStep),
      };
      try {
        const exists = await api.checkDeviceExists(circuitId, stabDev);
        if (!exists) {
          setStabErr(`Device "${stabDev}" not found.`);
          return;
        }
        const [pm, bw] = await Promise.all([
          api.getPhaseMarginPlot(circuitId, p),
          api.getBandwidthPlot(circuitId, p),
        ]);
        setStabPm(pm);
        setStabBw(bw);
      } catch (err) {
        setStabErr(err instanceof Error ? err.message : 'Error');
      }
    },
    [circuitId, stabIn, stabOut, stabDev, stabMin, stabMax, stabStep],
  );

  const pmChartData = useMemo(() => {
    if (!stabPm) return null;
    return {
      labels: stabPm.device_value.map(String),
      datasets: [
        {
          label: 'Phase Margin (°)',
          data: stabPm.phase_margin,
          borderColor: '#26a69a',
          backgroundColor: '#26a69a',
          fill: false,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    };
  }, [stabPm]);

  const bwChartData = useMemo(() => {
    if (!stabBw) return null;
    return {
      labels: stabBw.parameter_value.map(String),
      datasets: [
        {
          label: 'Bandwidth (Hz)',
          data: stabBw.bandwidth,
          borderColor: '#7e57c2',
          backgroundColor: '#7e57c2',
          fill: false,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    };
  }, [stabBw]);

  const smallChartOpts = useCallback(
    (title: string, yLabel: string) => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: title, font: { size: 11 } },
        legend: { display: false },
      },
      scales: {
        x: { title: { display: true, text: stabDev, font: { size: 10 } } },
        y: { title: { display: true, text: yLabel, font: { size: 10 } } },
      },
    }),
    [stabDev],
  );

  return (
    <Accordion disableGutters sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <SecurityIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={600}>
            Stability Analysis
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0.5 }}>
        <form onSubmit={handleStability}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Input"
                value={stabIn}
                onChange={(e) => setStabIn(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Output"
                value={stabOut}
                onChange={(e) => setStabOut(e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
            <TextField
              label="Device parameter"
              value={stabDev}
              onChange={(e) => setStabDev(e.target.value)}
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Min"
                type="number"
                value={stabMin}
                onChange={(e) => setStabMin(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Max"
                type="number"
                value={stabMax}
                onChange={(e) => setStabMax(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Step"
                type="number"
                value={stabStep}
                onChange={(e) => setStabStep(e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
            <Button type="submit" variant="contained" size="small">
              Analyse
            </Button>
          </Stack>
        </form>

        {stabErr && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {stabErr}
          </Alert>
        )}

        {pmChartData && (
          <Box sx={{ mt: 2, height: 200 }}>
            <Line
              data={pmChartData}
              options={smallChartOpts(`${stabDev} vs Phase Margin`, 'Phase Margin (°)')}
            />
          </Box>
        )}
        {bwChartData && (
          <Box sx={{ mt: 2, height: 200 }}>
            <Line
              data={bwChartData}
              options={smallChartOpts(`${stabDev} vs Bandwidth`, 'Bandwidth (Hz)')}
            />
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
