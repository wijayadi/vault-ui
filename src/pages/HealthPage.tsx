import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import IconButton from '@mui/material/IconButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { JsonEditor } from '../components/common/JsonEditor';
import { useResolvedThemeMode } from '../context/SettingsContext';
import { getLeader, seal, sealStatus, unseal } from '../api/system';
import { errorMessage } from '../context/ToastContext';

export function HealthPage() {
  const { connection, health, refreshHealth, logout } = useAuth();
  const { notify, notifyError } = useToast();
  const mode = useResolvedThemeMode();
  const [loading, setLoading] = useState(false);
  const [unsealKey, setUnsealKey] = useState('');
  const [unsealing, setUnsealing] = useState(false);
  const [sealOpen, setSealOpen] = useState(false);
  const [leader, setLeader] = useState<Record<string, unknown> | null>(null);
  const [leaderError, setLeaderError] = useState('');
  const [sealInfo, setSealInfo] = useState<Awaited<ReturnType<typeof sealStatus>> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await refreshHealth();
    try {
      setSealInfo(await sealStatus(connection));
    } catch {
      setSealInfo(null);
    }
    try {
      setLeader(await getLeader(connection));
      setLeaderError('');
    } catch (error) {
      setLeader(null);
      setLeaderError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [connection, refreshHealth]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitUnseal = async () => {
    if (!unsealKey) {
      notifyError(new Error('Enter an unseal key share'));
      return;
    }
    setUnsealing(true);
    try {
      await unseal({ ...connection, token: '' }, unsealKey);
      setUnsealKey('');
      notify('Unseal key accepted');
      await load();
    } catch (error) {
      notifyError(error);
    } finally {
      setUnsealing(false);
    }
  };

  const doSeal = async () => {
    try {
      await seal(connection);
      notify('Vault sealed');
      await load();
      setSealOpen(false);
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MonitorHeartIcon color="primary" />
        <Typography variant="h4">Health & seal</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={() => void load()} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {!health ? (
        <Alert severity="warning">
          Health information is unavailable. The token may lack access to <code>sys/health</code>, or Vault is
          unreachable.
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' },
              gap: 2,
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Status
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={health.sealed ? 'Sealed' : health.standby ? 'Standby' : 'Active'}
                    color={health.sealed ? 'error' : health.standby ? 'warning' : 'success'}
                  />
                  {health.initialized ? (
                    <Chip label="Initialized" variant="outlined" />
                  ) : (
                    <Chip label="Not initialized" color="error" />
                  )}
                  {health.ha_enabled ? <Chip label="HA enabled" variant="outlined" /> : null}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Version: {health.version}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cluster: {health.cluster_name || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Seal type: {sealInfo?.seal_type || health.seal_type || health.type || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Storage: {health.storage_type || '—'}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Node
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active time: {health.active_time || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                  Leader: {health.leader_address || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Self: {health.is_self ? 'yes' : 'no / unknown'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Performance standby: {health.performance_standby ? 'yes' : 'no'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Replication: DR {health.replication_dr_mode ?? 'disabled'}, performance{' '}
                  {health.replication_performance_mode ?? 'disabled'}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Seal operations
                </Typography>
                {health.sealed ? (
                  <Box sx={{ display: 'grid', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Vault is sealed. Submit unseal key shares until the threshold is reached.
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={sealInfo?.n ? ((sealInfo.progress ?? 0) / sealInfo.n) * 100 : 0}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {sealInfo?.progress ?? health.progress ?? 0} of {sealInfo?.n ?? health.n ?? '?'} key
                      shares provided
                    </Typography>
                    <TextField
                      label="Unseal key share"
                      type="password"
                      value={unsealKey}
                      onChange={(event) => setUnsealKey(event.target.value)}
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      startIcon={<LockOpenIcon />}
                      onClick={() => void submitUnseal()}
                      disabled={unsealing}
                    >
                      Submit key
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'grid', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Vault is unsealed. Sealing immediately stops all API operations until it is unsealed
                      again.
                    </Typography>
                    <Button
                      color="error"
                      variant="outlined"
                      startIcon={<LockIcon />}
                      onClick={() => setSealOpen(true)}
                    >
                      Seal Vault
                    </Button>
                    <Button size="small" onClick={() => void logout()}>
                      Sign out instead
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Leader
              </Typography>
              {leaderError ? (
                <Typography variant="body2" color="text.secondary">
                  {leaderError}
                </Typography>
              ) : leader ? (
                <JsonEditor value={leader} readOnly height={220} dark={mode === 'dark'} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No leader information available.
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Raw health response
              </Typography>
              <JsonEditor value={health} readOnly height={320} dark={mode === 'dark'} />
            </CardContent>
          </Card>
        </>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={18} /> Refreshing…
        </Box>
      ) : null}

      <Divider />

      <ConfirmDialog
        open={sealOpen}
        title="Seal Vault"
        description="Seal this Vault cluster? All requests will fail until enough unseal key shares are provided."
        confirmLabel="Seal"
        destructive
        onConfirm={doSeal}
        onClose={() => setSealOpen(false)}
      />
    </Box>
  );
}
