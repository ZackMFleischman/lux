import { createTheme } from '@mui/material/styles';

export const studioTheme = createTheme({
  palette: {
    mode: 'dark', primary: { main: '#b4a4e9', contrastText: '#211b33' },
    background: { default: '#111217', paper: '#1b1c24' },
    text: { primary: '#e1e2ec', secondary: '#959bb0' }, divider: '#30323d',
    error: { main: '#e4a2b3' },
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", sans-serif', fontSize: 13,
    fontWeightRegular: 400, fontWeightMedium: 500, fontWeightBold: 500,
    button: { textTransform: 'none', fontWeight: 400 },
    h1: { fontWeight: 500 }, h2: { fontWeight: 500 }, h3: { fontWeight: 500 },
    h4: { fontWeight: 500 }, h5: { fontWeight: 500 }, h6: { fontWeight: 500 },
    subtitle1: { fontWeight: 500 }, subtitle2: { fontWeight: 500 },
  },
  shape: { borderRadius: 5 },
  components: {
    MuiButton: { defaultProps: { size: 'small', variant: 'text', disableElevation: true }, styleOverrides: { root: { whiteSpace: 'nowrap', minWidth: 0 } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { defaultProps: { size: 'small', variant: 'outlined' }, styleOverrides: { root: { fontSize: 9, letterSpacing: 1, borderRadius: 3, height: 23 } } },
    MuiSlider: { defaultProps: { size: 'small' } },
    MuiMenuItem: { styleOverrides: { root: { fontWeight: 400 } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '12px', fontWeight: 400, lineHeight: 1.45 } } },
  },
});
