/* ------------------------------------------------------------------ */
/*  SigFlow – SVG Schematic Overlay                                    */
/* ------------------------------------------------------------------ */
import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useCircuit } from '../../context/CircuitContext';

interface SvgOverlayProps {
  visible: boolean;
}

export default function SvgOverlay({ visible }: SvgOverlayProps) {
  const { data } = useCircuit();
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layerRef.current || !data?.svg) return;
    layerRef.current.innerHTML = data.svg;

    const svgEl = layerRef.current.querySelector('svg');
    if (svgEl) {
      try {
        const bb = svgEl.getBBox();
        svgEl.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.width} ${bb.height}`);
      } catch {
        /* ignore */
      }
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
    }
  }, [data?.svg]);

  return (
    <Box
      ref={layerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        opacity: visible ? 0.35 : 0,
        pointerEvents: 'none',
        zIndex: 1,
        transition: 'opacity 0.3s',
      }}
    />
  );
}
