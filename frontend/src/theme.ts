/* ------------------------------------------------------------------ */
/*  SigFlow – Material UI theme                                        */
/* ------------------------------------------------------------------ */
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1565c0',
      light: '#5e92f3',
      dark: '#003c8f',
    },
    secondary: {
      main: '#7c4dff',
      light: '#b47cff',
      dark: '#3f1dcb',
    },
    background: {
      default: '#f0f2f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
  },
});

export default theme;
