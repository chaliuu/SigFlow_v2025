/**
 * SFG Helper Utilities
 * Pure functions extracted from sfg_script.js
 */

import type { CytoscapeElements } from '../api/api';

/* ---------- Cytoscape element parsing ---------- */

export interface ParsedElements {
    nodes: Array<{ data: { id: string; label: string } }>;
    edges: Array<{
        data: {
            id: string;
            source: string;
            target: string;
            label: string;
            weight: number;
            symbolic: string;
            magnitude: number;
            phase: number;
            index: number;
        };
    }>;
}

/**
 * Parse backend SFG JSON into Cytoscape elements array.
 * The backend returns nx.cytoscape_data(sfg) which nests nodes/edges
 * under an `elements` key, and edge weight data is a sub-object.
 */
export function parseGraphElements(
    sfgData: CytoscapeElements,
    useSymbolic = true
): ParsedElements {
    const raw = sfgData.elements ?? sfgData;
    const rawNodes = (raw as { nodes?: Array<{ data: Record<string, unknown> }> }).nodes ?? [];
    const rawEdges = (raw as { edges?: Array<{ data: Record<string, unknown> }> }).edges ?? [];

    const nodes = rawNodes.map((n) => ({
        data: {
            id: String(n.data.id ?? ''),
            label: String(n.data.name ?? n.data.label ?? n.data.id ?? ''),
        },
    }));

    const edges = rawEdges.map((e, idx) => {
        const d = e.data;
        // Weight may be an object { symbolic, magnitude, phase } or a primitive
        const w = (typeof d.weight === 'object' && d.weight !== null)
            ? d.weight as Record<string, unknown>
            : null;

        const symbolic = String(w?.symbolic ?? d.symbolic ?? d.weight ?? '');
        const magnitude = Number(w?.magnitude ?? d.magnitude ?? d.weight ?? 0);
        const phase = Number(w?.phase ?? d.phase ?? 0);
        const label = useSymbolic ? symbolic : expo(magnitude, 4);

        return {
            data: {
                id: String(d.id ?? `e${idx}-${d.source}-${d.target}`),
                source: String(d.source ?? ''),
                target: String(d.target ?? ''),
                label,
                weight: magnitude,
                symbolic,
                magnitude,
                phase,
                index: Number(d.index ?? idx),
            },
        };
    });

    return { nodes, edges };
}

/* ---------- Math / formatting ---------- */

/** Float to exponential notation */
export function expo(x: number, fractionDigits = 4): string {
    if (x === 0) return '0';
    return Number(x).toExponential(fractionDigits);
}

/** Sanitize text for LaTeX display */
export function sanitizeLatexText(text: string): string {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/_/g, '\\_')
        .replace(/\^/g, '\\^')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}');
}

/** Convert SymPy-style characters to LaTeX */
export function convertToLatex(sympyChars: string): string {
    if (!sympyChars) return '';
    let result = sympyChars;
    // Replace ** with ^
    result = result.replace(/\*\*/g, '^');
    // Replace * with \cdot
    result = result.replace(/\*/g, ' \\cdot ');
    return result;
}

/** Approximate the pixel width of a label string */
export function approximateLabelWidth(text: string, fontSize = 14): number {
    const charFactor = 0.62;
    return text.length * fontSize * charFactor;
}

/** Validate input for allowed parameter keys */
export function validateInput(
    userInput: string,
    validKeys: string[]
): boolean {
    const parts = userInput.split(/[+\-*/() ]+/).filter(Boolean);
    return parts.every(
        (part) => validKeys.includes(part) || !isNaN(Number(part))
    );
}
