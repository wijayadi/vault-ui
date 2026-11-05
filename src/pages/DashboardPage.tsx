import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import StorageIcon from '@mui/icons-material/Storage';
import LockIcon from '@mui/icons-material/Lock';
import BadgeIcon from '@mui/icons-material/Badge';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import HandymanIcon from '@mui/icons-material/Handyman';
import PolicyIcon from '@mui/icons-material/Policy';
import { useAuth } from '../context/AuthContext';
import { formatTtl, useTtlCountdown } from '../hooks/useTtl';
import { isKvMount } from '../api/kv';
import { useMounts } from '../context/MountsContext';

export function DashboardPage() {
  const { connection, identity, health, config } = useAuth();
  const { mounts, authMounts, loading } = useMounts();
  const remaining = useTtlCountdown(identity);

  const kvMounts = useMemo(() => mounts.filter(isKvMount), [mounts]);
  const firstKv = kvMounts[0];
  const policies = identity?.policies ?? identity?.token_policies ?? [];

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography color="text.secondary">
          Connected to {connection.url || 'no server'}
          {connection.namespace ? ` in namespace ${connection.namespace}` : ''}.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MonitorHeartIcon color="primary" />
              <Typography variant="h6">Cluster</Typography>
            </Box>
            {health ? (
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    color={health.sealed ? 'error' : health.standby ? 'warning' : 'success'}
                    label={health.sealed ? 'Sealed' : health.standby ? 'Standby' : 'Active'}
                  />
                  {health.ha_enabled ? <Chip size="small" variant="outlined" label="HA" /> : null}
                  {health.replication_dr_mode && health.replication_dr_mode !== 'disabled' ? (
                    <Chip size="small" variant="outlined" label={`DR: ${health.replication_dr_mode}`} />
                  ) : null}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Version {health.version} · {health.cluster_name || 'no cluster name'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Seal type: {health.seal_type || health.type || 'unknown'}
                </Typography>
                <Button component={RouterLink} to="/system/health" size="small">
                  Health details
                </Button>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Health information is unavailable. The token may not have access to <code>sys/health</code>.
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BadgeIcon color="primary" />
              <Typography variant="h6">Token</Typography>
            </Box>
            <Typography variant="body2" noWrap title={identity?.display_name || identity?.id}>
              {identity?.display_name || identity?.id || 'unknown'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              TTL: {formatTtl(remaining)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Accessor: {identity?.accessor || 'hidden'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {policies.slice(0, 5).map((policy) => (
                <Chip key={policy} size="small" label={policy} />
              ))}
              {policies.length > 5 ? <Chip size="small" label={`+${policies.length - 5}`} /> : null}
            </Box>
            <Button component={RouterLink} to="/tokens" size="small" sx={{ mt: 1 }}>
              Manage tokens
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <StorageIcon color="primary" />
              <Typography variant="h6">Secret engines</Typography>
            </Box>
            <Typography variant="h4">{loading ? '—' : kvMounts.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              KV-compatible engines available
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {kvMounts.slice(0, 6).map((mount) => (
                <Chip
                  key={mount.path}
                  size="small"
                  label={`${mount.path} (v${mount.options?.version ?? 1})`}
                  component={RouterLink}
                  to={`/secrets/${mount.path.replace(/\/+$/, '')}/`}
                  clickable
                />
              ))}
            </Box>
            {firstKv ? (
              <Button
                component={RouterLink}
                to={`/secrets/${firstKv.path.replace(/\/+$/, '')}/`}
                size="small"
                sx={{ mt: 1 }}
              >
                Browse secrets
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LockIcon color="primary" />
              <Typography variant="h6">Auth methods</Typography>
            </Box>
            <Typography variant="h4">{loading ? '—' : authMounts.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              Mounted authentication backends
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Server {config.version ? `v${config.version}` : ''} ·{' '}
              {connection.timeoutMs ? `${connection.timeoutMs / 1000}s timeout` : 'default timeout'}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button component={RouterLink} to="/tokens" startIcon={<BadgeIcon />} variant="outlined">
              Tokens
            </Button>
            <Button component={RouterLink} to="/policies" startIcon={<PolicyIcon />} variant="outlined">
              Policies
            </Button>
            <Button component={RouterLink} to="/system/mounts" startIcon={<StorageIcon />} variant="outlined">
              Mounts
            </Button>
            <Button component={RouterLink} to="/tools" startIcon={<HandymanIcon />} variant="outlined">
              Wrap / unwrap
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
