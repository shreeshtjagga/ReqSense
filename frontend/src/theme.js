import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB',
      light: '#3B82F6',
      dark: '#1D4ED8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#475569',
      light: '#64748B',
      dark: '#334155',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0284C7',
    },
    success: {
      main: '#16A34A',
    },
    warning: {
      main: '#D97706',
    },
    error: {
      main: '#DC2626',
    },
    custom: {
      contradiction: '#EA580C',
      glassBg: 'rgba(255, 255, 255, 0.95)',
      gradientPrimary: '#2563EB',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontWeight: 800,
      fontSize: '2.25rem',
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontWeight: 800,
      fontSize: '1.875rem',
      lineHeight: 1.25,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.5rem',
      lineHeight: 1.3,
      letterSpacing: '-0.015em',
    },
    h4: {
      fontWeight: 700,
      fontSize: '1.25rem',
      lineHeight: 1.35,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 700,
      fontSize: '1.125rem',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.45,
    },
    body1: {
      fontSize: '0.95rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.55,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 18px',
          fontWeight: 600,
          boxShadow: 'none',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
          },
        },
        containedPrimary: {
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: '#1D4ED8',
          },
        },
        containedSecondary: {
          backgroundColor: '#475569',
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: '#334155',
          },
        },
        outlinedPrimary: {
          borderColor: '#CBD5E1',
          '&:hover': {
            borderColor: '#2563EB',
            backgroundColor: '#EFF6FF',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          backgroundImage: 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 14,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          color: '#0F172A',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        input::-ms-reveal,
        input::-ms-clear {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `,
    },
  },
});

export default theme;
