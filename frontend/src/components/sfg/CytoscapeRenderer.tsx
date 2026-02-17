/**
 * CytoscapeRenderer
 * Core Cytoscape.js integration — renders the SFG graph.
 */

import {
    useRef,
    useEffect,
    useImperativeHandle,
    forwardRef,
    useCallback,
} from 'react';
import cytoscape, { type Core, type EventObject } from 'cytoscape';
import type { CytoscapeElements } from '../../api/api';
import { parseGraphElements } from '../../utils/sfgHelpers';
import styles from './CytoscapeRenderer.module.css';

/* ---------- Cytoscape stylesheet ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SFG_STYLES: any[] = [
    {
        selector: 'node',
        style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#3b82f6',
            color: '#fff',
            'font-size': '13px',
            'font-weight': 'bold' as const,
            'text-outline-width': 2,
            'text-outline-color': '#1e293b',
            width: 36,
            height: 36,
            'border-width': 2,
            'border-color': '#60a5fa',
        },
    },
    {
        selector: 'node:selected',
        style: {
            'background-color': '#10b981',
            'border-color': '#34d399',
            'border-width': 3,
        },
    },
    {
        selector: 'edge',
        style: {
            label: 'data(label)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#64748b',
            'line-color': '#64748b',
            width: 2,
            'font-size': '11px',
            color: '#94a3b8',
            'text-rotation': 'autorotate',
            'text-background-color': '#0f1117',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-border-color': '#334155',
            'text-border-width': 1,
            'text-border-opacity': 0.6,
        },
    },
    {
        selector: 'edge:selected',
        style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            width: 3,
            color: '#fbbf24',
        },
    },
    {
        selector: 'edge.highlighted',
        style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            width: 3,
        },
    },
    {
        selector: 'node.highlighted',
        style: {
            'background-color': '#ef4444',
            'border-color': '#f87171',
        },
    },
    {
        selector: 'edge.path-highlight',
        style: {
            'line-color': '#8b5cf6',
            'target-arrow-color': '#8b5cf6',
            width: 3,
        },
    },
    {
        selector: 'node.simplify-selected',
        style: {
            'background-color': '#f59e0b',
            'border-color': '#fbbf24',
            'border-width': 3,
        },
    },
];

/* ---------- Component ---------- */

export interface CytoscapeRendererRef {
    cy: Core | null;
    refresh: () => void;
}

interface CytoscapeRendererProps {
    elements: CytoscapeElements | null;
    symbolic?: boolean;
    edgeLabelsVisible?: boolean;
    onNodeTap?: (nodeId: string) => void;
    onEdgeTap?: (edgeData: Record<string, unknown>) => void;
    onEdgeHover?: (edgeData: Record<string, unknown> | null, event?: MouseEvent) => void;
}

const CytoscapeRenderer = forwardRef<CytoscapeRendererRef, CytoscapeRendererProps>(
    function CytoscapeRenderer(
        { elements, symbolic = true, edgeLabelsVisible = true, onNodeTap, onEdgeTap, onEdgeHover },
        ref
    ) {
        const containerRef = useRef<HTMLDivElement>(null);
        const cyRef = useRef<Core | null>(null);

        /* Expose cy instance */
        useImperativeHandle(ref, () => ({
            cy: cyRef.current,
            refresh: () => {
                if (cyRef.current) {
                    cyRef.current.resize();
                    cyRef.current.fit(undefined, 40);
                }
            },
        }));

        /* Build / rebuild graph */
        const buildGraph = useCallback(() => {
            if (!containerRef.current || !elements) return;

            const parsed = parseGraphElements(elements, symbolic);

            if (cyRef.current) {
                cyRef.current.destroy();
            }

            const cy = cytoscape({
                container: containerRef.current,
                elements: [...parsed.nodes, ...parsed.edges],
                style: SFG_STYLES,
                layout: {
                    name: 'breadthfirst',
                    padding: 30,
                } as cytoscape.LayoutOptions,
                minZoom: 0.2,
                maxZoom: 4,
                wheelSensitivity: 0.3,
            });

            // Apply edge curve differencing for parallel edges
            applyEdgeCurves(cy);

            // Event handlers
            cy.on('tap', 'node', (evt: EventObject) => {
                onNodeTap?.(evt.target.id());
            });

            cy.on('tap', 'edge', (evt: EventObject) => {
                onEdgeTap?.(evt.target.data());
            });

            cy.on('mouseover', 'edge', (evt: EventObject) => {
                onEdgeHover?.(evt.target.data(), evt.originalEvent as MouseEvent);
            });

            cy.on('mouseout', 'edge', () => {
                onEdgeHover?.(null);
            });

            cyRef.current = cy;

            // Expose globally for debugging
            (window as unknown as Record<string, unknown>).cy = cy;
        }, [elements, symbolic, onNodeTap, onEdgeTap, onEdgeHover]);

        useEffect(() => {
            buildGraph();
            return () => {
                cyRef.current?.destroy();
                cyRef.current = null;
            };
        }, [buildGraph]);

        /* Toggle edge labels */
        useEffect(() => {
            const cy = cyRef.current;
            if (!cy) return;
            cy.edges().forEach((edge) => {
                edge.style('label', edgeLabelsVisible ? edge.data('label') : '');
            });
        }, [edgeLabelsVisible]);

        return <div ref={containerRef} className={styles.container} />;
    }
);

export default CytoscapeRenderer;

/* ---------- Edge curve helper ---------- */

function applyEdgeCurves(cy: Core) {
    const edgePairs = new Map<string, cytoscape.EdgeCollection>();

    cy.edges().forEach((edge) => {
        const src = edge.source().id();
        const tgt = edge.target().id();
        const key = [src, tgt].sort().join('|');
        if (!edgePairs.has(key)) {
            edgePairs.set(key, cy.collection());
        }
        edgePairs.get(key)!.merge(edge);
    });

    edgePairs.forEach((edges) => {
        if (edges.length <= 1) return;
        const count = edges.length;
        edges.forEach((edge, i) => {
            const curveStyle = count > 1 ? 'unbundled-bezier' : 'bezier';
            const distance = (i - (count - 1) / 2) * 40;
            edge.style({
                'curve-style': curveStyle,
                'control-point-distances': [distance],
                'control-point-weights': [0.5],
            });
        });
    });
}
