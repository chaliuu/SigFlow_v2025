/* ------------------------------------------------------------------ */
/*  SigFlow – Loop Gain Accordion Section                              */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LoopIcon from '@mui/icons-material/Loop';

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';
import { typesetMath } from '../../utils/formatting';
import type { BodeData } from '../../types';
import BodeChart from './BodeChart';
import { accordionSx, summarySx } from '../sidebar/sidebarStyles';

export default function LoopGainPanel() {
  const { circuitId } = useCircuit();

  const [lgNum, setLgNum] = useState(false);
  const [lgLatex, setLgLatex] = useState('');
  const [lgErr, setLgErr] = useState<string | null>(null);

  const fetchLG = useCallback(
    async (numericalOverride?: boolean) => {
      if (!circuitId) return;
      setLgErr(null);
      const numerical = numericalOverride ?? lgNum;
      try {
        const res = await api.getLoopGain(circuitId, numerical);
        setLgLatex(res.loop_gain);
      } catch (err) {
        setLgErr(err instanceof Error ? err.message : 'Error');
      }
    },
    [circuitId, lgNum],
  );

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

  return (
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
          <Button variant="contained" size="small" onClick={() => fetchLG()}>
            Compute
          </Button>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={lgNum}
                onChange={() => {
                  const next = !lgNum;
                  setLgNum(next);
                  if (lgLatex) {fetchLG(next);}
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
  );
}
