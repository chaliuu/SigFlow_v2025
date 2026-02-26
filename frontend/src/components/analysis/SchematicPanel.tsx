/* ------------------------------------------------------------------ */
/*  SigFlow – Circuit Schematic Accordion Section                      */
/* ------------------------------------------------------------------ */
import React, { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SchemaIcon from '@mui/icons-material/Schema';

import { useCircuit } from '../../context/CircuitContext';
import { accordionSx, summarySx } from '../sidebar/sidebarStyles';

export default function SchematicPanel() {
  const { data } = useCircuit();
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

  if (!data?.svg) return null;

  return (
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
  );
}
