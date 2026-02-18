/* ------------------------------------------------------------------ */
/*  SigFlow – Parameter Panel                                          */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Slider,
  Box,
  Divider,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';

import { useCircuit } from '../../context/CircuitContext';
import { expo } from '../../utils/formatting';

export default function ParameterPanel() {
  const { data, patchCircuit } = useCircuit();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [freq, setFreq] = useState<number>(0);

  const params = data?.parameters ?? {};

  /* Derive initial frequency from parameters */
  React.useEffect(() => {
    if (params.f !== undefined) {
      setFreq(params.f);
    }
  }, [params.f]);

  const handleChange = useCallback((key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const parsed: Record<string, number> = {};
      Object.entries(inputs).forEach(([k, v]) => {
        if (v !== '') parsed[k] = parseFloat(v);
      });
      if (Object.keys(parsed).length > 0) {
        patchCircuit(parsed);
      }
    },
    [inputs, patchCircuit],
  );

  const handleFreqChange = useCallback(
    (_: Event, value: number | number[]) => {
      const f = Array.isArray(value) ? value[0] : value;
      setFreq(f);
      patchCircuit({ f });
    },
    [patchCircuit],
  );

  const paramKeys = Object.keys(params).filter((k) => k !== 'f');

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <TuneIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            Circuit Parameters
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5}>
            {paramKeys.map((key) => (
              <TextField
                key={key}
                label={key}
                placeholder={`${key}: ${params[key].toExponential()}`}
                value={inputs[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                type="number"
                inputProps={{ step: 'any' }}
                size="small"
                fullWidth
              />
            ))}
            <Button type="submit" variant="contained" size="small">
              Apply
            </Button>
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
                valueLabelFormat={(v) => expo(v, 2)}
                size="small"
              />
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
