import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { MountsProvider } from './context/MountsContext';

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const OidcCallbackPage = lazy(() =>
  import('./pages/OidcCallbackPage').then((module) => ({ default: module.OidcCallbackPage })),
);
const UnwrapPage = lazy(() =>
  import('./pages/UnwrapPage').then((module) => ({ default: module.UnwrapPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const SecretsPage = lazy(() =>
  import('./pages/SecretsPage').then((module) => ({ default: module.SecretsPage })),
);
const AuthBackendPage = lazy(() =>
  import('./pages/AuthBackendPage').then((module) => ({ default: module.AuthBackendPage })),
);
const TokensPage = lazy(() =>
  import('./pages/TokensPage').then((module) => ({ default: module.TokensPage })),
);
const PoliciesPage = lazy(() =>
  import('./pages/PoliciesPage').then((module) => ({ default: module.PoliciesPage })),
);
const HealthPage = lazy(() =>
  import('./pages/HealthPage').then((module) => ({ default: module.HealthPage })),
);
const MountsPage = lazy(() =>
  import('./pages/MountsPage').then((module) => ({ default: module.MountsPage })),
);
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((module) => ({ default: module.ToolsPage })));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

function PageFallback() {
  return (
    <Box sx={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  );
}

function ConnectionUnavailable({
  url,
  error,
  verifying,
  onRetry,
  onSignOut,
}: {
  url: string;
  error: string | null;
  verifying: boolean;
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 620, width: '100%' }} elevation={4}>
        <Typography variant="h5" gutterBottom>
          Cannot reach Vault
        </Typography>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'The saved session could not be verified against Vault.'}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Vault URL
        </Typography>
        <Typography variant="body2" className="monospace" sx={{ mb: 3, wordBreak: 'break-all' }}>
          {url || 'not configured'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Vault UI will not open the authenticated interface until it can verify the token. Check the server
          URL, certificate, and network, then retry.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={() => void onRetry()} disabled={verifying}>
            {verifying ? 'Retrying…' : 'Retry connection'}
          </Button>
          <Button onClick={() => void onSignOut()} disabled={verifying}>
            Sign out
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { initialized, connection, identity, connectionError, verifying, reconnect, logout } = useAuth();
  const location = useLocation();

  if (!initialized) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!connection.token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!identity) {
    return (
      <ConnectionUnavailable
        url={connection.url}
        error={connectionError}
        verifying={verifying}
        onRetry={reconnect}
        onSignOut={logout}
      />
    );
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unwrap" element={<UnwrapPage />} />
        <Route path="/oidc/callback" element={<OidcCallbackPage />} />

        <Route
          element={
            <RequireAuth>
              <MountsProvider>
                <AppLayout />
              </MountsProvider>
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="secrets/:mount/*" element={<SecretsPage />} />
          <Route path="auth/:type/:mount/*" element={<AuthBackendPage />} />
          <Route path="tokens" element={<TokensPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="system/health" element={<HealthPage />} />
          <Route path="system/mounts" element={<MountsPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
