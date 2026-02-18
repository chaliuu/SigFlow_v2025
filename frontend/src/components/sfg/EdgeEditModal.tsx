/* ------------------------------------------------------------------ */
/*  SigFlow – Edge Edit Modal                                          */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  Stack,
  Chip,
} from '@mui/material';

import { useCircuit } from '../../context/CircuitContext';
import * as api from '../../api/circuitApi';

interface EdgeEditModalProps {
  open: boolean;
  onClose: () => void;
  source: string;
  target: string;
}

export default function EdgeEditModal({ open, onClose, source, target }: EdgeEditModalProps) {
  const { circuitId, setData, setStackLen, setRedoLen } = useCircuit();
  const [symbolic, setSymbolic] = useState('');
  const [magnitude, setMagnitude] = useState<number | null>(null);
  const [phase, setPhase] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* Fetch edge info when modal opens */
  useEffect(() => {
    if (!open || !circuitId) return;
    setError(null);
    api
      .getEdgeInfo(circuitId, source, target)
      .then((info) => {
        setSymbolic(info.data.weight.symbolic);
        setMagnitude(info.data.weight.magnitude);
        setPhase(info.data.weight.phase);
      })
      .catch((err) => setError(err.message));
  }, [open, circuitId, source, target]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!circuitId) return;
      setError(null);
      setLoading(true);
      try {
        const d = await api.updateEdge(circuitId, source, target, symbolic);
        setData(d);
        setStackLen((s) => Math.min(s + 1, 5));
        setRedoLen(0);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setLoading(false);
      }
    },
    [circuitId, source, target, symbolic, setData, setStackLen, setRedoLen, onClose],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Edit Edge&nbsp;
          <Chip label={`${source} → ${target}`} size="small" color="primary" variant="outlined" />
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Symbolic Expression"
              value={symbolic}
              onChange={(e) => setSymbolic(e.target.value)}
              fullWidth
              autoFocus
            />

            <Stack direction="row" spacing={3}>
              <Typography variant="body2" color="text.secondary">
                <b>Magnitude:</b> {magnitude !== null ? magnitude.toExponential(2) : '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <b>Phase:</b> {phase !== null ? `${phase.toFixed(2)}°` : '—'}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Updating…' : 'Update'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
