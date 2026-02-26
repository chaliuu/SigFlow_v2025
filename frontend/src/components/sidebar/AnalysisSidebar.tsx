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
import React from 'react';
import { Box, Typography } from '@mui/material';

import { useCircuit } from '../../context/CircuitContext';
import ParameterPanel from '../analysis/ParameterPanel';
import TransferFunctionPanel from '../analysis/TransferFunctionPanel';
import LoopGainPanel from '../analysis/LoopGainPanel';
import StabilityPanel from '../analysis/StabilityPanel';
import SchematicPanel from '../analysis/SchematicPanel';

export default function AnalysisSidebar() {
  const { data } = useCircuit();

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

      <ParameterPanel />
      <LoopGainPanel />
      <StabilityPanel />
      <SchematicPanel />
    </Box>
  );
}
