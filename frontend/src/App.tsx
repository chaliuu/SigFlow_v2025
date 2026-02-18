/* ------------------------------------------------------------------ */
/*  SigFlow – App shell (routes + providers)                           */
/* ------------------------------------------------------------------ */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';

import theme from './theme';
import { CircuitProvider } from './context/CircuitContext';
import LandingPage from './components/landing/LandingPage';
import SfgAppPage from './pages/SfgAppPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CircuitProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<SfgAppPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CircuitProvider>
    </ThemeProvider>
  );
}
