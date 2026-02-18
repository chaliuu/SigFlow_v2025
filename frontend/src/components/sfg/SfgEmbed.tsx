/* ------------------------------------------------------------------ */
/*  SigFlow – Embedded legacy SFG viewer (iframe)                      */
/*                                                                     */
/*  Loads the stripped sfg_only.html + sfg_script.js inside an iframe  */
/*  so the Cytoscape rendering code runs unchanged.                    */
/*  Communication:                                                     */
/*    • sessionStorage for circuitId (same-origin)                     */
/*    • postMessage for toolbar commands (parent ↔ iframe)             */
/* ------------------------------------------------------------------ */
import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { Box } from '@mui/material';

interface SfgEmbedProps {
  /** Circuit ID – must already be stored in sessionStorage. */
  circuitId: string;
  /** Ref to the underlying iframe element (used by SfgToolbar). */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const SfgEmbed = forwardRef<HTMLIFrameElement, SfgEmbedProps>(
  function SfgEmbed({ circuitId, iframeRef }, ref) {
    /* Ensure sessionStorage has the circuitId before the iframe reads it */
    useEffect(() => {
      sessionStorage.setItem('circuitId', circuitId);
    }, [circuitId]);

    /* Expose the iframe element on both the forwarded ref and the passed ref */
    useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);

    return (
      <Box sx={{ width: '100%', height: '100%' }}>
        <iframe
          ref={iframeRef as React.RefObject<HTMLIFrameElement>}
          src="/legacy/sfg_only.html"
          title="SigFlow – Signal-Flow Graph"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      </Box>
    );
  },
);

export default SfgEmbed;
