import { createTheme } from '@mui/material/styles';

export function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#7aa7ff' : '#1a4b8c' },
      secondary: { main: mode === 'dark' ? '#ffb74d' : '#b45309' },
      error: { main: '#d32f2f' },
      background: {
        default: mode === 'dark' ? '#0f1216' : '#f4f6f9',
        paper: mode === 'dark' ? '#171b21' : '#ffffff',
      },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: "'Source Sans Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiToolbar: { styleOverrides: { root: { gap: 8 } } },
      MuiTableCell: { styleOverrides: { head: { fontWeight: 600, whiteSpace: 'nowrap' } } },
    },
  });
}
