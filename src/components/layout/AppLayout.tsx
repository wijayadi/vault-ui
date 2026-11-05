import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTtlCountdown } from '../../hooks/useTtl';
import { DRAWER_WIDTH, Sidebar } from './Sidebar';
import { useMounts } from '../../context/MountsContext';
import { TopBar } from './TopBar';

export function AppLayout() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expiryDismissed, setExpiryDismissed] = useState(false);
  const { identity, renew, refreshHealth, logout } = useAuth();
  const { notifyError } = useToast();
  const { mounts, authMounts, loading, error, refresh } = useMounts();
  const remaining = useTtlCountdown(identity);

  useEffect(() => {
    const interval = window.setInterval(() => void refreshHealth(), 60_000);
    return () => window.clearInterval(interval);
  }, [refreshHealth]);

  useEffect(() => {
    if (remaining !== null && remaining > 120) setExpiryDismissed(false);
  }, [remaining]);

  const showExpiryDialog = remaining !== null && remaining <= 120 && !expiryDismissed;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        open={drawerOpen}
        mobile={mobile}
        onClose={() => setDrawerOpen(false)}
        mounts={mounts}
        authMounts={authMounts}
        loading={loading}
        error={error}
        onRefresh={() => void refresh()}
      />
      <TopBar onMenuClick={() => setDrawerOpen(true)} drawerWidth={DRAWER_WIDTH} mobile={mobile} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, md: 3 },
          pt: { xs: 10, md: 11 },
          ml: mobile ? 0 : 0,
        }}
      >
        <Outlet />
      </Box>

      <Dialog open={showExpiryDialog} onClose={() => setExpiryDismissed(true)} maxWidth="sm" fullWidth>
        <DialogTitle>Your session is about to expire</DialogTitle>
        <DialogContent>
          <Typography>
            The current token expires in {Math.max(0, remaining ?? 0)} seconds. Renew the lease to stay signed
            in.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setExpiryDismissed(true);
              void logout();
            }}
          >
            Sign out
          </Button>
          <Button onClick={() => setExpiryDismissed(true)}>Dismiss</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                await renew();
                setExpiryDismissed(false);
              } catch (error) {
                notifyError(error);
              }
            }}
          >
            Renew
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
