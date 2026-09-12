import { createTheme } from '@mui/material/styles';

export const studioTheme = createTheme({
  palette: {
    mode: 'dark', primary: { main: '#b4a4e9', contrastText: '#211b33' },
    background: { default: '#111217', paper: '#1b1c24' },
    text: { primary: '#e1e2ec', secondary: '#959bb0' }, divider: '#30323d',
    error: { main: '#e4a2b3' },
  },
  typography: { fontFamily: 'Inter, "Segoe UI", sans-serif', fontSize: 13, button: { textTransform: 'none', fontWeight: 500 } },
  shape: { borderRadius: 5 },
  components: {
    MuiButton: { defaultProps: { size: 'small', variant: 'outlined', disableElevation: true }, styleOverrides: { root: { whiteSpace: 'nowrap', minWidth: 0 } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { defaultProps: { size: 'small', variant: 'outlined' }, styleOverrides: { root: { fontSize: 9, letterSpacing: 1, borderRadius: 3, height: 23 } } },
    MuiSlider: { defaultProps: { size: 'small' } },
  },
});
