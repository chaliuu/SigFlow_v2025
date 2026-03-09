// @ts-nocheck
/* ------------------------------------------------------------------ */
/*  SigFlow – Cytoscape style definitions  (unused – kept for ref)     */
/* ------------------------------------------------------------------ */

import { EDGE_CURVE_SPACING } from './edgeCurves';

/** Shared SFG style array for Cytoscape instances. */
export function getSfgStyles(): cytoscape.StylesheetStyle[] {
  return [
    {
      selector: 'node[name]',
      style: {
        content: 'data(name)',
        'font-size': '20px',
        'text-outline-width': 6,
        'text-outline-color': '#f5f5f5',
        width: '65px',
        height: '65px',
        'background-color': '#5aa5ff',
        'border-width': 3,
        'border-color': '#4a90e2',
        'text-valign': 'center',
        'text-halign': 'center',
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'node[Vin]',
      style: { 'background-color': 'red' } as cytoscape.Css.Node,
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'unbundled-bezier',
        'control-point-distance': 'data(controlPointDistance)' as unknown as number,
        'control-point-weight': 'data(controlPointWeight)' as unknown as number,
        'control-point-step-size': EDGE_CURVE_SPACING,
        width: 5,
        'line-color': '#4a90e2',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.2,
        'target-arrow-color': '#4a90e2',
        'source-arrow-color': '#4a90e2',
        content: 'data(weight)',
        'font-size': '24px',
        'edge-text-rotation': 'autorotate',
        'text-margin-y': 'data(labelOffset)' as unknown as number,
        'text-outline-width': 8,
        'text-outline-color': '#f5f5f5',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: ':selected',
      style: { 'background-color': '#0069d9' } as cytoscape.Css.Node,
    },
    {
      selector: '.highlighted',
      style: {
        'background-color': '#ef5350',
        'line-color': '#ef5350',
        'target-arrow-color': '#ef5350',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.1s',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: '.cycle',
      style: {
        'background-color': '#42a5f5',
        'line-color': '#42a5f5',
        'target-arrow-color': '#42a5f5',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: '.weak_path',
      style: {
        'background-color': '#ffca28',
        'line-color': '#ffca28',
        'target-arrow-color': '#ffca28',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: '.common_edge',
      style: {
        'background-color': '#ab47bc',
        'line-color': '#ab47bc',
        'target-arrow-color': '#ab47bc',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: '.pink',
      style: {
        'background-color': '#ec407a',
        'line-color': '#ec407a',
        'target-arrow-color': '#ec407a',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: '.green',
      style: {
        'background-color': '#66bb6a',
        'line-color': '#66bb6a',
        'target-arrow-color': '#66bb6a',
      } as unknown as cytoscape.Css.Edge,
    },
  ] as unknown as cytoscape.StylesheetStyle[];
}
