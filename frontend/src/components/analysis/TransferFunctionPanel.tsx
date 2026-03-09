/* ------------------------------------------------------------------ */
/*  SigFlow – Transfer Function Accordion Section                      */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FunctionsIcon from '@mui/icons-material/Functions';

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';
import { typesetMath } from '../../utils/formatting';
import type { BodeData } from '../../types';
import BodeChart from './BodeChart';
import { accordionSx, summarySx } from '../sidebar/sidebarStyles';

export default function TransferFunctionPanel() {
  const { circuitId } = useCircuit();

  const [tfIn, setTfIn] = useState('');
  const [tfOut, setTfOut] = useState('');
  const [tfNum, setTfNum] = useState(false);
  const [tfLatex, setTfLatex] = useState('');
  const [tfErr, setTfErr] = useState<string | null>(null);

  const fetchTF = useCallback(
    async (numericalOverride?: boolean) => {
      if (!circuitId || !tfIn || !tfOut) return;
      setTfErr(null);
      const numerical = numericalOverride ?? tfNum;
      try {
        const res = await api.getTransferFunction(circuitId, tfIn, tfOut, numerical);
        setTfLatex(res.transfer_function);
      } catch (err) {
        setTfErr(err instanceof Error ? err.message : 'Error');
      }
    },
    [circuitId, tfIn, tfOut, tfNum],
  );

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

  return (
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
            <Button variant="contained" size="small" onClick={() => fetchTF()}>
              Compute
            </Button>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={tfNum}
                  onChange={() => {
                    const next = !tfNum;
                    setTfNum(next);
                    if (tfLatex) {fetchTF(next);}
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
  );
}
