/* ------------------------------------------------------------------ */
/*  SigFlow – SFG Toolbar                                              */
/*                                                                     */
/*  Modern MUI toolbar that sits above the legacy SFG iframe.          */
/*  All actions are forwarded via postMessage to sfg_only.html.        */
/* ------------------------------------------------------------------ */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  ToggleButton,
  Tooltip,
  Divider,
  Typography,
  Chip,
} from '@mui/material';

/* MUI Icons */
import AbcIcon from '@mui/icons-material/Abc';
import NumbersIcon from '@mui/icons-material/Numbers';
import CompressIcon from '@mui/icons-material/Compress';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AutoFixNormalIcon from '@mui/icons-material/AutoFixNormal';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HighlightIcon from '@mui/icons-material/Highlight';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LayersIcon from '@mui/icons-material/Layers';
import LabelIcon from '@mui/icons-material/Label';
import LabelOffIcon from '@mui/icons-material/LabelOff';

/* ---- Types ---- */

/** State reported back from the iframe via postMessage */
export interface SfgState {
  simplifyMode: boolean;
  highlightMode: boolean;
  symbolicFlag: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

interface SfgToolbarProps {
  /** Ref to the legacy iframe so we can postMessage to it */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

/* ---- Helper ---- */

function sendCommand(iframe: HTMLIFrameElement | null, action: string) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage({ type: 'sfg-command', action }, '*');
}

/* ---- Component ---- */

export default function SfgToolbar({ iframeRef }: SfgToolbarProps) {
  const [state, setState] = useState<SfgState>({
    simplifyMode: false,
    highlightMode: false,
    symbolicFlag: true,
    canUndo: false,
    canRedo: false,
  });

  /* Listen for state reports from the iframe */
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'sfg-state') {
        setState(e.data.state as SfgState);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const cmd = useCallback(
    (action: string) => () => sendCommand(iframeRef.current, action),
    [iframeRef],
  );

  /* Shorthand for icon-button pattern */
  const Btn = ({
    title,
    action,
    icon,
    disabled,
  }: {
    title: string;
    action: string;
    icon: React.ReactNode;
    disabled?: boolean;
  }) => (
    <Tooltip title={title}>
      <span>
        <IconButton size="small" onClick={cmd(action)} disabled={disabled}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.5,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexWrap: 'wrap',
        minHeight: 42,
      }}
    >
      {/* ─── Symbolic / Numeric toggle ─── */}
      <Tooltip title={state.symbolicFlag ? 'Switch to Numeric view' : 'Switch to Symbolic view'}>
        <ToggleButton
          size="small"
          value="symbolic"
          selected={state.symbolicFlag}
          onChange={cmd('sfg_toggle')}
          sx={{ border: 'none', textTransform: 'none', px: 1, gap: 0.5 }}
        >
          {state.symbolicFlag ? <AbcIcon fontSize="small" /> : <NumbersIcon fontSize="small" />}
          <Typography variant="caption">
            {state.symbolicFlag ? 'Symbolic' : 'Numeric'}
          </Typography>
        </ToggleButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* ─── Simplification ─── */}
      <Tooltip title={state.simplifyMode ? 'Exit Simplification Mode' : 'Enter Simplification Mode'}>
        <ToggleButton
          size="small"
          value="simplify-mode"
          selected={state.simplifyMode}
          onChange={cmd('simplify_mode_toggle')}
          color={state.simplifyMode ? 'primary' : 'standard'}
          sx={{ border: 'none', textTransform: 'none', px: 1, gap: 0.5 }}
        >
          <CompressIcon fontSize="small" />
          <Typography variant="caption">Simplify</Typography>
        </ToggleButton>
      </Tooltip>

      {state.simplifyMode && (
        <Btn title="Simplify selected" action="simplify" icon={<CompressIcon fontSize="small" />} />
      )}

      <Tooltip title="Simplify Entire Graph">
        <span>
          <IconButton size="small" onClick={cmd('simplify_entire_graph')}>
            <AutoFixHighIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Simplify Entire Graph (Trivial)">
        <span>
          <IconButton size="small" onClick={cmd('simplify_entire_graph_trivial')}>
            <AutoFixNormalIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Btn title="Undo" action="sfg_undo" icon={<UndoIcon fontSize="small" />} disabled={!state.canUndo} />
      <Btn title="Redo" action="sfg_redo" icon={<RedoIcon fontSize="small" />} disabled={!state.canRedo} />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* ─── Highlight & branch manipulation ─── */}
      <Tooltip title={state.highlightMode ? 'Exit Highlight Mode' : 'Highlight Path'}>
        <ToggleButton
          size="small"
          value="highlight-mode"
          selected={state.highlightMode}
          onChange={cmd('path_highlight_toggle')}
          color={state.highlightMode ? 'secondary' : 'standard'}
          sx={{ border: 'none', textTransform: 'none', px: 1, gap: 0.5 }}
        >
          <HighlightIcon fontSize="small" />
          <Typography variant="caption">Highlight</Typography>
        </ToggleButton>
      </Tooltip>

      <Btn title="Remove Highlight" action="removeHighlight" icon={<HighlightOffIcon fontSize="small" />} />
      <Btn title="Remove Branch" action="removeBranch" icon={<DeleteIcon fontSize="small" />} />
      <Btn title="Edit Branch" action="editBranch" icon={<EditIcon fontSize="small" />} />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* ─── Display toggles ─── */}
      <Btn title="Toggle Schematic Overlay" action="toggleSVG" icon={<LayersIcon fontSize="small" />} />
      <Tooltip title="Toggle Edge Labels">
        <IconButton size="small" onClick={cmd('toggleEdgeLabels')}>
          {state.symbolicFlag ? <LabelIcon fontSize="small" /> : <LabelOffIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Legend chips */}
      <Chip label="Dominant" size="small" sx={{ bgcolor: '#ff6384', color: '#fff', fontWeight: 600, fontSize: 11 }} />
      <Chip label="Weak" size="small" sx={{ bgcolor: '#36a2eb', color: '#fff', fontWeight: 600, fontSize: 11 }} />
      <Chip label="Shared" size="small" sx={{ bgcolor: '#ffce56', color: '#000', fontWeight: 600, fontSize: 11 }} />
      <Chip label="Cycle" size="small" sx={{ bgcolor: '#4bc0c0', color: '#fff', fontWeight: 600, fontSize: 11 }} />
    </Box>
  );
}
