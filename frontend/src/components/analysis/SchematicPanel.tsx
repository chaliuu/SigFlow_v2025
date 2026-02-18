/* ------------------------------------------------------------------ */
/*  SigFlow – Schematic Panel                                          */
/* ------------------------------------------------------------------ */
import React, { useRef, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Stack } from '@mui/material';
import SchemaIcon from '@mui/icons-material/Schema';

import { useCircuit } from '../../context/CircuitContext';

export default function SchematicPanel() {
  const { data } = useCircuit();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data?.svg) return;
    containerRef.current.innerHTML = data.svg;

    const svg = containerRef.current.querySelector('svg');
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
      svg.style.maxHeight = '400px';
    }
  }, [data?.svg]);

  if (!data?.svg) return null;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <SchemaIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            Circuit Schematic
          </Typography>
        </Stack>
        <Box
          ref={containerRef}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1,
            overflow: 'auto',
            bgcolor: '#fff',
          }}
        />
      </CardContent>
    </Card>
  );
}
