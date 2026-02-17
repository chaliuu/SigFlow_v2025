/**
 * SvgOverlay
 * Renders the circuit schematic SVG in an overlay layer on top of the SFG.
 */

import { useState } from 'react';
import styles from './SvgOverlay.module.css';

interface SvgOverlayProps {
    svgContent: string | undefined;
    visible: boolean;
}

export default function SvgOverlay({ svgContent, visible }: SvgOverlayProps) {
    const [opacity] = useState(0.4);

    if (!svgContent || !visible) return null;

    return (
        <div
            className={styles.overlay}
            style={{ opacity }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
}
