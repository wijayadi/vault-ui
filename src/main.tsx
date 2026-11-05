import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import './imports';
import { IS_ELECTRON } from './api/client';
import { SettingsProvider, useResolvedThemeMode } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { AppRoutes } from './App';
import { buildTheme } from './theme';

function Root() {
  const mode = useResolvedThemeMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);
  const Router = IS_ELECTRON ? HashRouter : BrowserRouter;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <Router>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <Root />
    </SettingsProvider>
  </StrictMode>,
);
