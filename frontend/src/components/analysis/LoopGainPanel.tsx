/* ------------------------------------------------------------------ */
/*  SigFlow – Loop Gain Panel                                          */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  Alert,
  Box,
} from '@mui/material';
import LoopIcon from '@mui/icons-material/Loop';

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';
import { typesetMath } from '../../utils/formatting';

export default function LoopGainPanel() {
  const { circuitId } = useCircuit();
  const [numerical, setNumerical] = useState(false);
  const [latex, setLatex] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLG = useCallback(async () => {
    if (!circuitId) return;
    setError(null);
    try {
      const res = await api.getLoopGain(circuitId, numerical);
      setLatex(res.loop_gain);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [circuitId, numerical]);

  useEffect(() => {
    if (latex) requestAnimationFrame(() => typesetMath());
  }, [latex]);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <LoopIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            Loop Gain
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={2}>
          <Button variant="contained" size="small" onClick={fetchLG}>
            Compute
          </Button>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={numerical}
                onChange={() => {
                  setNumerical(!numerical);
                  if (latex) fetchLG();
                }}
              />
            }
            label="Numerical"
          />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {latex && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: '#f8f9fa',
              borderRadius: 1,
              overflow: 'auto',
              fontSize: 14,
            }}
          >
            {`\\(${latex}\\)`}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
