/* ------------------------------------------------------------------ */
/*  SigFlow – Landing Page                                             */
/* ------------------------------------------------------------------ */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Fade,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

import { createCircuit, importSfgFile } from '../../api/circuitApi';
import { decodeBufferText } from '../../utils/formatting';
import { useCircuit } from '../../context/CircuitContext';

/* ---------- file-drop helper ---------- */
interface FileSlot {
  label: string;
  accept: string;
  hint: string;
}

const FILE_SLOTS: FileSlot[] = [
  { label: 'Netlist File (.cir)', accept: '.cir,.net', hint: 'SPICE netlist' },
  { label: 'Schematic File (.asc)', accept: '.asc', hint: 'LTspice schematic' },
  { label: 'Operating Point Log (.log)', accept: '.log', hint: 'DC op-point log' },
  { label: 'Signal Flow Graph (.pkl)', accept: '.pkl', hint: 'SFG pickle' },
];

const tutorialSteps = [
  { title: 'Upload a Netlist', desc: 'Upload your .cir netlist file to define the circuit topology.' },
  { title: 'Add a Schematic', desc: 'Optionally upload an .asc LTspice schematic to render the circuit diagram.' },
  { title: 'Operating Point Log', desc: 'Optionally provide a .log file with DC operating-point data.' },
  { title: 'Analyze!', desc: 'Click Start Analysis to generate the Signal-Flow Graph and begin exploring.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { setCircuitId } = useCircuit();

  const [files, setFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [textFiles, setTextFiles] = useState<(string | null)[]>([null, null, null]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  /* read text file with encoding detection */
  const readTextFile = useCallback(
    (file: File, idx: number) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = decodeBufferText(reader.result as ArrayBuffer);
        setTextFiles((prev) => {
          const next = [...prev];
          next[idx] = text;
          return next;
        });
      };
      reader.readAsArrayBuffer(file);
    },
    [],
  );

  const handleFile = useCallback(
    (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setFiles((prev) => {
        const next = [...prev];
        next[idx] = file;
        return next;
      });
      if (file && idx < 3) readTextFile(file, idx);
    },
    [readTextFile],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const hasNetlist = Boolean(textFiles[0]);
      const sfgFile = files[3];

      if (!hasNetlist && !sfgFile) {
        setError('Please upload a netlist (.cir) or an SFG (.pkl) file.');
        return;
      }

      setSubmitting(true);
      try {
        let circuitId: string;

        if (!hasNetlist && sfgFile) {
          const generatedId = crypto.randomUUID?.() ?? String(Date.now());
          const imported = await importSfgFile(generatedId, sfgFile);
          circuitId = imported.id ?? generatedId;
        } else {
          const circuit = await createCircuit({
            name: 'untitled',
            netlist: textFiles[0],
            schematic: textFiles[1],
            op_point_log: textFiles[2],
          });
          circuitId = circuit.id;

          if (sfgFile) {
            await importSfgFile(circuitId, sfgFile);
          }
        }

        sessionStorage.setItem('circuitId', circuitId);
        setCircuitId(circuitId);
        navigate('/app');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setSubmitting(false);
      }
    },
    [textFiles, files, navigate, setCircuitId],
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e3f2fd 0%, #ede7f6 100%)',
        p: 2,
      }}
    >
      <Fade in timeout={600}>
        <Card sx={{ maxWidth: 560, width: '100%', p: 2 }}>
          <CardContent>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="h4" color="primary">
                SigFlow
              </Typography>
              <Tooltip title="Tutorial">
                <IconButton onClick={() => setTutorialOpen(true)}>
                  <InfoOutlinedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Analyze and visualize analog circuits using signal-flow graphs.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Upload form */}
            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {FILE_SLOTS.map((slot, idx) => (
                  <Box key={slot.label}>
                    <Typography variant="subtitle2" gutterBottom>
                      {slot.label}
                    </Typography>
                    <Button
                      component="label"
                      variant="outlined"
                      fullWidth
                      startIcon={files[idx] ? <InsertDriveFileIcon /> : <CloudUploadIcon />}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        color: files[idx] ? 'success.main' : 'text.secondary',
                        borderColor: files[idx] ? 'success.light' : undefined,
                      }}
                    >
                      {files[idx]?.name ?? slot.hint}
                      <input type="file" hidden accept={slot.accept} onChange={handleFile(idx)} />
                    </Button>
                  </Box>
                ))}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  startIcon={<RocketLaunchIcon />}
                  sx={{ mt: 1 }}
                >
                  {submitting ? 'Processing…' : 'Start Analysis'}
                </Button>
              </Stack>
            </form>

            {/* File status chips */}
            <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
              {files.map(
                (f, i) =>
                  f && (
                    <Chip
                      key={i}
                      label={f.name}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onDelete={() => {
                        setFiles((prev) => {
                          const next = [...prev];
                          next[i] = null;
                          return next;
                        });
                        if (i < 3) {
                          setTextFiles((prev) => {
                            const next = [...prev];
                            next[i] = null;
                            return next;
                          });
                        }
                      }}
                    />
                  ),
              )}
            </Stack>
          </CardContent>
        </Card>
      </Fade>

      {/* Tutorial Dialog */}
      <Dialog open={tutorialOpen} onClose={() => setTutorialOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Getting Started</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {tutorialSteps.map((step, idx) => (
              <Step key={step.title} completed={idx < activeStep}>
                <StepLabel>{step.title}</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    {step.desc}
                  </Typography>
                  <Box mt={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setActiveStep(idx + 1)}
                      sx={{ mr: 1 }}
                    >
                      {idx === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
                    </Button>
                    {idx > 0 && (
                      <Button size="small" onClick={() => setActiveStep(idx - 1)}>
                        Back
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTutorialOpen(false);
              setActiveStep(0);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
