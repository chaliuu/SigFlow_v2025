/* ------------------------------------------------------------------ */
/*  SigFlow – Consolidated Analysis Sidebar                            */
/*                                                                     */
/*  All analysis tools in collapsible accordion panels:                */
/*    1. Circuit Parameters                                            */
/*    2. Transfer Function  (symbolic + Bode)                          */
/*    3. Loop Gain          (symbolic + Bode)                          */
/*    4. Stability Analysis (PM + BW plots)                            */
/*    5. Circuit Schematic                                             */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Slider,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import FunctionsIcon from '@mui/icons-material/Functions';
import LoopIcon from '@mui/icons-material/Loop';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SecurityIcon from '@mui/icons-material/Security';
import SchemaIcon from '@mui/icons-material/Schema';
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

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';
import { expo, typesetMath } from '../../utils/formatting';
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

/* ================================================================== */
/*  Shared Accordion styling                                           */
/* ================================================================== */
const accordionSx = {
  '&:before': { display: 'none' },
  borderBottom: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
} as const;

const summarySx = {
  '&:hover': { bgcolor: 'action.hover' },
  minHeight: 44,
  '& .MuiAccordionSummary-content': { my: 0.75 },
} as const;

/* ================================================================== */
/*  Inline Bode Chart sub-component                                    */
/* ================================================================== */

interface BodeChartProps {
  label: string;
  extraFields?: { key: string; label: string }[];
  onFetch: (params: Record<string, string | number>) => Promise<BodeData>;
}

function BodeChart({ label, extraFields = [], onFetch }: BodeChartProps) {
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

/* ================================================================== */
/*  Main AnalysisSidebar Component                                     */
/* ================================================================== */

export default function AnalysisSidebar() {
  const { circuitId, data, patchCircuit } = useCircuit();

  /* ============= 1. Parameters ============= */
  const [paramInputs, setParamInputs] = useState<Record<string, string>>({});
  const [freq, setFreq] = useState(0);
  const params = data?.parameters ?? {};
  const paramKeys = Object.keys(params).filter((k) => k !== 'f');

  useEffect(() => {
    if (params.f !== undefined) setFreq(params.f);
  }, [params.f]);

  const handleParamChange = useCallback((key: string, value: string) => {
    setParamInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleParamSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const parsed: Record<string, number> = {};
      Object.entries(paramInputs).forEach(([k, v]) => {
        if (v !== '') parsed[k] = parseFloat(v);
      });
      if (Object.keys(parsed).length > 0) patchCircuit(parsed);
    },
    [paramInputs, patchCircuit],
  );

  const handleFreqChange = useCallback(
    (_: Event, value: number | number[]) => {
      const f = Array.isArray(value) ? value[0] : value;
      setFreq(f);
      patchCircuit({ f });
    },
    [patchCircuit],
  );

  /* ============= 2. Transfer Function ============= */
  const [tfIn, setTfIn] = useState('');
  const [tfOut, setTfOut] = useState('');
  const [tfNum, setTfNum] = useState(false);
  const [tfLatex, setTfLatex] = useState('');
  const [tfErr, setTfErr] = useState<string | null>(null);

  const fetchTF = useCallback(async () => {
    if (!circuitId || !tfIn || !tfOut) return;
    setTfErr(null);
    try {
      const res = await api.getTransferFunction(circuitId, tfIn, tfOut, tfNum);
      setTfLatex(res.transfer_function);
    } catch (err) {
      setTfErr(err instanceof Error ? err.message : 'Error');
    }
  }, [circuitId, tfIn, tfOut, tfNum]);

  useEffect(() => {
    if (tfLatex) requestAnimationFrame(() => typesetMath());
  }, [tfLatex]);

  const fetchTFBode = useCallback(
    async (p: Record<string, string | number>): Promise<BodeData> => {
      if (!circuitId) throw new Error('No circuit');
      return api.getTransferFunctionBode(circuitId, {
        input_node: String(p.input_node ?? tfIn),
        output_node: String(p.output_node ?? tfOut),
        start_freq_hz: Number(p.start_freq_hz),
        end_freq_hz: Number(p.end_freq_hz),
        points_per_decade: Number(p.points_per_decade),
      });
    },
    [circuitId, tfIn, tfOut],
  );

  /* ============= 3. Loop Gain ============= */
  const [lgNum, setLgNum] = useState(false);
  const [lgLatex, setLgLatex] = useState('');
  const [lgErr, setLgErr] = useState<string | null>(null);

  const fetchLG = useCallback(async () => {
    if (!circuitId) return;
    setLgErr(null);
    try {
      const res = await api.getLoopGain(circuitId, lgNum);
      setLgLatex(res.loop_gain);
    } catch (err) {
      setLgErr(err instanceof Error ? err.message : 'Error');
    }
  }, [circuitId, lgNum]);

  useEffect(() => {
    if (lgLatex) requestAnimationFrame(() => typesetMath());
  }, [lgLatex]);

  const fetchLGBode = useCallback(
    async (p: Record<string, string | number>): Promise<BodeData> => {
      if (!circuitId) throw new Error('No circuit');
      return api.getLoopGainBode(circuitId, {
        start_freq_hz: Number(p.start_freq_hz),
        end_freq_hz: Number(p.end_freq_hz),
        points_per_decade: Number(p.points_per_decade),
      });
    },
    [circuitId],
  );

  /* ============= 4. Stability ============= */
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

  /* ============= 5. Schematic ============= */
  const schematicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schematicRef.current || !data?.svg) return;
    schematicRef.current.innerHTML = data.svg;
    const svg = schematicRef.current.querySelector('svg');
    if (svg) {
      try {
        const bbox = svg.getBBox();
        svg.setAttribute(
          'viewBox',
          `${bbox.x - 10} ${bbox.y - 10} ${bbox.width + 20} ${bbox.height + 20}`,
        );
      } catch {
        /* ignore */
      }
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.maxHeight = '300px';
    }
  }, [data?.svg]);

  /* ============= Render ============= */
  if (!data) return null;

  return (
    <Box sx={{ overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={700} color="primary">
          Analysis Menu
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Expand a section to configure and view results
        </Typography>
      </Box>

      {/* ---------------------------------------------------------- */}
      {/*  1. Circuit Parameters                                      */}
      {/* ---------------------------------------------------------- */}
      <Accordion defaultExpanded disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TuneIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              Circuit Parameters
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0.5 }}>
          <form onSubmit={handleParamSubmit}>
            <Stack spacing={1.5}>
              {paramKeys.map((key) => (
                <TextField
                  key={key}
                  label={key}
                  placeholder={String(params[key]?.toExponential?.() ?? params[key])}
                  value={paramInputs[key] ?? ''}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  type="number"
                  inputProps={{ step: 'any' }}
                  size="small"
                  fullWidth
                />
              ))}
              {paramKeys.length > 0 && (
                <Button type="submit" variant="contained" size="small">
                  Apply
                </Button>
              )}
            </Stack>
          </form>

          {params.f !== undefined && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Frequency
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {expo(freq, 2)} Hz
              </Typography>
              <Box px={1}>
                <Slider
                  value={freq}
                  onChange={handleFreqChange}
                  min={0}
                  max={1e9}
                  step={1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v: number) => expo(v, 2)}
                  size="small"
                />
              </Box>
            </>
          )}
        </AccordionDetails>
      </Accordion>

      {/* ---------------------------------------------------------- */}
      {/*  2. Transfer Function + Bode                                */}
      {/* ---------------------------------------------------------- */}
      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FunctionsIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              Transfer Function
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0.5 }}>
          {/* Symbolic TF */}
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Input Node"
                value={tfIn}
                onChange={(e) => setTfIn(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Output Node"
                value={tfOut}
                onChange={(e) => setTfOut(e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Button variant="contained" size="small" onClick={fetchTF}>
                Compute
              </Button>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={tfNum}
                    onChange={() => {
                      setTfNum(!tfNum);
                      if (tfLatex) fetchTF();
                    }}
                  />
                }
                label={<Typography variant="caption">Numerical</Typography>}
              />
            </Stack>
          </Stack>

          {tfErr && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {tfErr}
            </Alert>
          )}

          {tfLatex && (
            <Box
              sx={{
                mt: 1.5,
                p: 1,
                bgcolor: '#f8f9fa',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: 13,
              }}
            >
              {`\\(${tfLatex}\\)`}
            </Box>
          )}

          {/* TF Bode plot */}
          <BodeChart label="Bode Plot" onFetch={fetchTFBode} />
        </AccordionDetails>
      </Accordion>

      {/* ---------------------------------------------------------- */}
      {/*  3. Loop Gain + Bode                                        */}
      {/* ---------------------------------------------------------- */}
      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LoopIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              Loop Gain
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0.5 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Button variant="contained" size="small" onClick={fetchLG}>
              Compute
            </Button>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={lgNum}
                  onChange={() => {
                    setLgNum(!lgNum);
                    if (lgLatex) fetchLG();
                  }}
                />
              }
              label={<Typography variant="caption">Numerical</Typography>}
            />
          </Stack>

          {lgErr && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {lgErr}
            </Alert>
          )}

          {lgLatex && (
            <Box
              sx={{
                mt: 1.5,
                p: 1,
                bgcolor: '#f8f9fa',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: 13,
              }}
            >
              {`\\(${lgLatex}\\)`}
            </Box>
          )}

          {/* LG Bode plot */}
          <BodeChart label="Bode Plot" onFetch={fetchLGBode} />
        </AccordionDetails>
      </Accordion>

      {/* ---------------------------------------------------------- */}
      {/*  4. Stability Analysis                                      */}
      {/* ---------------------------------------------------------- */}
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

      {/* ---------------------------------------------------------- */}
      {/*  5. Circuit Schematic                                       */}
      {/* ---------------------------------------------------------- */}
      {data?.svg && (
        <Accordion disableGutters sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SchemaIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={600}>
                Circuit Schematic
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              ref={schematicRef}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                overflow: 'auto',
                bgcolor: '#fff',
              }}
            />
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}
