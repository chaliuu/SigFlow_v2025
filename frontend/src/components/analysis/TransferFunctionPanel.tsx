/* ------------------------------------------------------------------ */
/*  SigFlow – Transfer Function Panel                                  */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  Alert,
  Box,
} from '@mui/material';
import FunctionsIcon from '@mui/icons-material/Functions';

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';
import { typesetMath } from '../../utils/formatting';

export default function TransferFunctionPanel() {
  const { circuitId } = useCircuit();
  const [inputNode, setInputNode] = useState('');
  const [outputNode, setOutputNode] = useState('');
  const [numerical, setNumerical] = useState(false);
  const [latex, setLatex] = useState('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchTF = useCallback(async () => {
    if (!circuitId || !inputNode || !outputNode) return;
    setError(null);
    try {
      const res = await api.getTransferFunction(circuitId, inputNode, outputNode, numerical);
      setLatex(res.transfer_function);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [circuitId, inputNode, outputNode, numerical]);

  /* Typeset MathJax whenever latex changes */
  useEffect(() => {
    if (latex) {
      requestAnimationFrame(() => typesetMath());
    }
  }, [latex]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      fetchTF();
    },
    [fetchTF],
  );

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <FunctionsIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            Transfer Function
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
            <Stack direction="row" alignItems="center" spacing={2}>
              <Button type="submit" variant="contained" size="small">
                Compute
              </Button>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={numerical}
                    onChange={() => {
                      setNumerical(!numerical);
                      if (latex) fetchTF();
                    }}
                  />
                }
                label="Numerical"
              />
            </Stack>
          </Stack>
        </form>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {latex && (
          <Box
            ref={containerRef}
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
