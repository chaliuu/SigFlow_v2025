// @ts-nocheck
/* ------------------------------------------------------------------ */
/*  SigFlow – SFG Cytoscape Viewer  (unused – kept for reference)      */
/* ------------------------------------------------------------------ */
import React, { useRef, useEffect, useCallback } from 'react';
import cytoscape, { Core } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { CytoscapeOptions } from 'cytoscape';
import { Box } from '@mui/material';

import { useCircuit } from '../../context/CircuitContext';
import { getSfgStyles } from '../../utils/cytoscapeStyles';
import { expo } from '../../utils/formatting';
import {
  EDGE_BASE_CURVE_DISTANCE,
  EDGE_LABEL_OFFSET_BASE,
} from '../../utils/edgeCurves';
import type { CircuitData } from '../../types';

// Register dagre layout once
try {
  cytoscape.use(dagre as unknown as cytoscape.Ext);
} catch {
  /* already registered */
}

/* ---------- helper: convert server data → cytoscape elements ---------- */
function buildElements(data: CircuitData) {
  const sfg = data.sfg;
  if (!sfg?.elements) throw new Error('Invalid SFG data');

  const nodes = sfg.elements.nodes.map((n) => ({ data: { ...n.data } }));

  const symbolicLabels: string[] = [];

  const edges = sfg.elements.edges.map((e, i) => {
    const w = e.data.weight;
    symbolicLabels.push(w.symbolic);
    const mag = expo(w.magnitude, 2);
    const phase = w.phase.toFixed(2);
    return {
      data: {
        ...e.data,
        weight: `${mag}∠${phase}`,
        symbolicIndex: i,
        controlPointDistance: -EDGE_BASE_CURVE_DISTANCE,
        controlPointWeight: 0.5,
        labelOffset: EDGE_LABEL_OFFSET_BASE,
      },
    };
  });

  return { elements: { nodes, edges }, symbolicLabels };
}

interface SfgViewerProps {
  cyRef: React.MutableRefObject<Core | null>;
  onNodeTap?: (nodeId: string) => void;
  onEdgeTap?: (edgeId: string, source: string, target: string) => void;
}

export default function SfgViewer({ cyRef, onNodeTap, onEdgeTap }: SfgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, setEdgeSymbolicLabels, symbolicFlag } = useCircuit();

  /* Build or rebuild the Cytoscape graph when data changes */
  const initCy = useCallback(() => {
    if (!containerRef.current || !data) return;
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const { elements, symbolicLabels } = buildElements(data);
    setEdgeSymbolicLabels(symbolicLabels);

    const cy = cytoscape({
      container: containerRef.current,
      layout: {
        name: 'dagre',
        nodeSep: 200,
        edgeSep: 220,
        rankSep: 120,
        rankDir: 'LR',
        fit: true,
        minLen: () => 2,
      } as unknown as CytoscapeOptions['layout'],
      wheelSensitivity: 0.4,
      style: getSfgStyles(),
      elements,
    });

    /* Straighten edges for aligned nodes */
    cy.edges().forEach((edge) => {
      const src = edge.sourceEndpoint();
      const tgt = edge.targetEndpoint();
      if (
        (Math.abs(src.x - tgt.x) < 1 || Math.abs(src.y - tgt.y) < 1) &&
        edge.source().edgesWith(edge.target()).length === 1
      ) {
        edge.data('controlPointDistance', 0);
        edge.data('controlPointWeight', 0.5);
      }
    });

    /* Forward node / edge tap events */
    cy.on('tap', 'node', (evt) => {
      onNodeTap?.(evt.target.id());
    });

    cy.on('tap', 'edge', (evt) => {
      const e = evt.target;
      onEdgeTap?.(e.id(), e.data('source'), e.data('target'));
    });

    /* Edge hover tooltip */
    cy.on('mouseover', 'edge', (evt) => {
      const edge = evt.target;
      const info = document.getElementById('sfg-edge-tooltip');
      if (info) {
        info.innerHTML = `<b>Source:</b> ${edge.data('source')}
          <br/><b>Target:</b> ${edge.data('target')}
          <br/><b>Weight:</b> ${edge.data('weight')}`;
        info.style.display = 'block';
      }
    });
    cy.on('mouseout', 'edge', () => {
      const info = document.getElementById('sfg-edge-tooltip');
      if (info) {
        info.style.display = 'none';
        info.innerHTML = '';
      }
    });
    cy.on('mousemove', 'edge', (evt) => {
      const info = document.getElementById('sfg-edge-tooltip');
      if (info && evt.originalEvent) {
        info.style.left = `${(evt.originalEvent as MouseEvent).clientX + 15}px`;
        info.style.top = `${(evt.originalEvent as MouseEvent).clientY + 15}px`;
      }
    });

    /* Toggle label display */
    if (symbolicFlag) {
      cy.edges().style({ content: '' });
    }

    cyRef.current = cy;
  }, [data, cyRef, onNodeTap, onEdgeTap, setEdgeSymbolicLabels, symbolicFlag]);

  useEffect(() => {
    initCy();
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* Update edge labels when symbolic flag changes */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed()) return;
    if (symbolicFlag) {
      cy.edges().style({ content: '' });
    } else {
      cy.edges().style({ content: 'data(weight)' });
    }
  }, [symbolicFlag, cyRef]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 500,
          borderRadius: 2,
          bgcolor: '#fafbfc',
        }}
      />
      {/* Floating tooltip */}
      <Box
        id="sfg-edge-tooltip"
        sx={{
          display: 'none',
          position: 'fixed',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          px: 1.5,
          py: 1,
          fontSize: 12,
          pointerEvents: 'none',
          zIndex: 9999,
          maxWidth: 240,
          boxShadow: 2,
        }}
      />
    </Box>
  );
}
