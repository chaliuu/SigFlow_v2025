/* ------------------------------------------------------------------ */
/*  SigFlow – Circuit Parameters Accordion Section                     */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  Slider,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';

import { useCircuit } from '../../context/CircuitContext';
import { expo } from '../../utils/formatting';
import { accordionSx, summarySx } from '../sidebar/sidebarStyles';

export default function ParameterPanel() {
  const { data, patchCircuit } = useCircuit();

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

  return (
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
  );
}
