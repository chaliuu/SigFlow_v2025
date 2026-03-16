/* ------------------------------------------------------------------ */
/*  SigFlow – Main SFG Application Page                                */
/* ------------------------------------------------------------------ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  AppBar,
  Toolbar,
  Tooltip,
  Divider,
  Chip,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import RefreshIcon from '@mui/icons-material/Refresh';
import InsightsIcon from '@mui/icons-material/Insights';

import { useCircuit } from '../context/CircuitContext';
import * as api from '../api/circuitApi';
import SfgEmbed from '../components/sfg/SfgEmbed';
import SfgToolbar from '../components/sfg/SfgToolbar';
import AnalysisSidebar from '../components/sidebar/AnalysisSidebar';
import TransferFunctionPanel from '../components/analysis/TransferFunctionPanel';
import LoopGainPanel from '@/components/analysis/LoopGainPanel';

const SIDEBAR_WIDTH = 380;
const BOTTOM_PANEL_HEIGHT = 320;
const ACCORDION_HEADER_HEIGHT = 48;
const COLLAPSED_BOTTOM_HEIGHT = ACCORDION_HEADER_HEIGHT * 2;

export default function SfgAppPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { circuitId, data, loadCircuit, resetCircuit } = useCircuit();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [tfExpanded, setTfExpanded] = useState(false);
  const [lgExpanded, setLgExpanded] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!circuitId) {
      navigate('/');
      return;
    }
    loadCircuit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitId]);

  const handleExport = useCallback(async () => {
    if (!circuitId) return;
    try {
      const blob = await api.exportSfg(circuitId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${circuitId}-export.pkl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  }, [circuitId]);

  if (!circuitId) return null;

  const anyPanelOpen = tfExpanded || lgExpanded;
  const bottomHeight = anyPanelOpen ? BOTTOM_PANEL_HEIGHT : COLLAPSED_BOTTOM_HEIGHT;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar variant="dense">
          <Tooltip title={sidebarOpen ? 'Close analysis panel' : 'Open analysis panel'}>
            <IconButton edge="start" onClick={() => setSidebarOpen((o) => !o)} sx={{ mr: 1 }}>
              {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>

          <InsightsIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
            SigFlow
          </Typography>
          <Chip
            label={data?.name ?? 'Loading…'}
            size="small"
            variant="outlined"
            sx={{ ml: 2, fontWeight: 500 }}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Reset circuit">
              <IconButton size="small" onClick={async () => {
                await resetCircuit();
                if(iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage(
                    { type: 'sfg-command', action: 'refresh' },
                    '*'
                  );
                }
              }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export SFG (.pkl)">
              <IconButton size="small" onClick={handleExport}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Import SFG">
              <IconButton size="small" component="label">
                <UploadFileIcon fontSize="small" />
                <input
                  type="file"
                  hidden
                  accept=".pkl,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && circuitId) {
                      await api.importSfgFile(circuitId, file);
                      await loadCircuit();
                      if (iframeRef.current?.contentWindow) {
                        iframeRef.current.contentWindow.postMessage({ type: 'sfg-command', action: 'refresh' }, '*');
                      }
                      e.target.value = '';
                    }
                  }}
                />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Return to Landing Page">
              <IconButton size="small" onClick={() => navigate('/')}>
                <HomeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {isMd ? (
          <Box
            sx={{
              width: sidebarOpen ? SIDEBAR_WIDTH : 0,
              flexShrink: 0,
              borderRight: sidebarOpen ? '1px solid' : 'none',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden',
              transition: 'width 0.25s ease',
            }}
          >
            {sidebarOpen && <AnalysisSidebar />}
          </Box>
        ) : (
          <Drawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
            <Box sx={{ width: SIDEBAR_WIDTH }}>
              <AnalysisSidebar />
            </Box>
          </Drawer>
        )}

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <SfgToolbar iframeRef={iframeRef} />

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <SfgEmbed circuitId={circuitId} iframeRef={iframeRef} />
          </Box>

          <Box
            sx={{
              height: bottomHeight,
              maxHeight: BOTTOM_PANEL_HEIGHT,
              minHeight: COLLAPSED_BOTTOM_HEIGHT,
              overflow: 'hidden',
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              transition: 'height 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                '& .MuiAccordion-root': {
                  m: 0,
                  borderRadius: 0,
                },
                '& .MuiAccordionSummary-root': {
                  minHeight: `${ACCORDION_HEADER_HEIGHT}px`,
                },
                '& .MuiAccordionSummary-content': {
                  my: 0.75,
                },
                '& .MuiAccordionDetails-root': {
                  overflow: 'auto',
                },
              }}
            >
              <TransferFunctionPanel
                expanded={tfExpanded}
                onChange={(_, expanded) => setTfExpanded(expanded)}
              />
              <LoopGainPanel
                expanded={lgExpanded}
                onChange={(_, expanded) => setLgExpanded(expanded)}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}