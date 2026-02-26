/* ------------------------------------------------------------------ */
/*  SigFlow – Main SFG Application Page                                */
/*                                                                     */
/*  Layout: AppBar + toggleable left sidebar (analysis accordion       */
/*  panels) + SFG toolbar + legacy SFG iframe filling the rest.        */
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

const SIDEBAR_WIDTH = 380;

export default function SfgAppPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { circuitId, data, loadCircuit } = useCircuit();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* Ref to the legacy iframe – shared between SfgEmbed and SfgToolbar */
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  /* Redirect to landing if no circuit loaded */
  useEffect(() => {
    if (!circuitId) {
      navigate('/');
      return;
    }
    loadCircuit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitId]);

  /* Export callback */
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: 'background.default',
      }}
    >
      {/* ============ AppBar ============ */}
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
          {/* Sidebar toggle */}
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

          {/* Quick-action buttons */}
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Refresh circuit data">
              <IconButton size="small" onClick={() => loadCircuit()}>
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
                      loadCircuit();
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

      {/* ============ Body ============ */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar – persistent on desktop, overlay drawer on mobile */}
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

        {/* SFG viewer – toolbar + legacy iframe fills remaining space */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SfgToolbar iframeRef={iframeRef} />
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <SfgEmbed circuitId={circuitId} iframeRef={iframeRef} />
          </Box>
        <TransferFunctionPanel />
        </Box>
        </Box>
    </Box>
  );
}