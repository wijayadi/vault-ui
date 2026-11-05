import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useMounts } from '../context/MountsContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { disableMount, mountAuthBackend, mountSecretEngine, tuneMount } from '../api/system';
import { AUTH_BACKEND_TYPES, AUTH_BACKENDS } from '../config/authBackends';
import type { MountInfo } from '../api/types';

const SECRET_TYPES = [
  'kv',
  'generic',
  'pki',
  'transit',
  'database',
  'ssh',
  'aws',
  'gcp',
  'azure',
  'consul',
  'nomad',
  'rabbitmq',
];

export function MountsPage() {
  const { connection } = useAuth();
  const { notify, notifyError } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { mounts, authMounts, loading, error, refresh } = useMounts();
  const [tab, setTab] = useState<'secret' | 'auth'>('secret');

  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'secret' | 'auth'>('secret');
  const [createPath, setCreatePath] = useState('');
  const [createType, setCreateType] = useState('kv');
  const [createVersion, setCreateVersion] = useState('2');
  const [createDescription, setCreateDescription] = useState('');
  const [createDefaultTtl, setCreateDefaultTtl] = useState('');
  const [createMaxTtl, setCreateMaxTtl] = useState('');
  const [creating, setCreating] = useState(false);

  const [tune, setTune] = useState<{ mount: MountInfo; kind: 'secret' | 'auth' } | null>(null);
  const [tuneDescription, setTuneDescription] = useState('');
  const [tuneDefaultTtl, setTuneDefaultTtl] = useState('');
  const [tuneMaxTtl, setTuneMaxTtl] = useState('');
  const [tuning, setTuning] = useState(false);

  const [disable, setDisable] = useState<{ mount: MountInfo; kind: 'secret' | 'auth' } | null>(null);

  const rows = tab === 'secret' ? mounts : authMounts;
  const authTypeOptions = useMemo(
    () => [
      { value: 'token', label: 'token' },
      ...AUTH_BACKEND_TYPES.map((type) => ({ value: type, label: AUTH_BACKENDS[type].label })),
    ],
    [],
  );

  const openCreate = (kind: 'secret' | 'auth') => {
    setCreateKind(kind);
    setCreatePath('');
    setCreateType(kind === 'secret' ? 'kv' : 'userpass');
    setCreateVersion('2');
    setCreateDescription('');
    setCreateDefaultTtl('');
    setCreateMaxTtl('');
    setCreateOpen(true);
  };

  const createMount = async () => {
    const path = createPath.replace(/^\/+|\/+$/g, '');
    if (!path) {
      notifyError(new Error('Enter a mount path'));
      return;
    }

    const config: Record<string, unknown> = {};
    if (createDefaultTtl) config.default_lease_ttl = createDefaultTtl;
    if (createMaxTtl) config.max_lease_ttl = createMaxTtl;

    setCreating(true);
    try {
      if (createKind === 'secret') {
        await mountSecretEngine(connection, path, createType, {
          description: createDescription,
          version: createType === 'kv' ? createVersion : undefined,
          config: Object.keys(config).length ? config : undefined,
        });
        notify(`Secret engine ${path} mounted`);
        setCreateOpen(false);
        await refresh();
        navigate(`/secrets/${path}/`);
      } else {
        await mountAuthBackend(connection, path, createType, {
          description: createDescription,
          config: Object.keys(config).length ? config : undefined,
        });
        notify(`Auth backend ${path} mounted`);
        setCreateOpen(false);
        await refresh();
        if (AUTH_BACKENDS[createType]) navigate(`/auth/${createType}/${path}/`);
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setCreating(false);
    }
  };

  const openTune = (mount: MountInfo, kind: 'secret' | 'auth') => {
    setTune({ mount, kind });
    setTuneDescription(mount.description);
    const config = (mount.config ?? {}) as { default_lease_ttl?: number; max_lease_ttl?: number };
    setTuneDefaultTtl(config.default_lease_ttl ? String(config.default_lease_ttl) : '');
    setTuneMaxTtl(config.max_lease_ttl ? String(config.max_lease_ttl) : '');
  };

  const saveTune = async () => {
    if (!tune) return;
    setTuning(true);
    try {
      const data: Record<string, unknown> = { description: tuneDescription };
      if (tuneDefaultTtl) data.default_lease_ttl = Number(tuneDefaultTtl) || tuneDefaultTtl;
      if (tuneMaxTtl) data.max_lease_ttl = Number(tuneMaxTtl) || tuneMaxTtl;
      await tuneMount(connection, tune.mount.path, tune.kind, data);
      notify(`Mount ${tune.mount.path} tuned`);
      setTune(null);
      await refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setTuning(false);
    }
  };

  const removeMount = async () => {
    if (!disable) return;
    try {
      await disableMount(connection, disable.mount.path, disable.kind);
      notify(`Mount ${disable.mount.path} disabled`);
      setDisable(null);
      await refresh();
    } catch (err) {
      notifyError(err);
    }
  };

  const requestDisable = (mount: MountInfo, kind: 'secret' | 'auth') => {
    if (!settings.confirmDelete) {
      void (async () => {
        try {
          await disableMount(connection, mount.path, kind);
          notify(`Mount ${mount.path} disabled`);
          await refresh();
        } catch (err) {
          notifyError(err);
        }
      })();
      return;
    }
    setDisable({ mount, kind });
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <StorageIcon color="primary" />
        <Typography variant="h4">Mounts</Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={() => void refresh()} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate(tab)}>
          New {tab === 'secret' ? 'secret engine' : 'auth method'}
        </Button>
      </Box>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
        <Tab value="secret" label={`Secret engines (${mounts.length})`} />
        <Tab value="auth" label={`Auth methods (${authMounts.length})`} />
      </Tabs>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No mounts found or your token cannot list mounts.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Path</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Accessor</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((mount) => (
                  <TableRow key={mount.path} hover>
                    <TableCell>
                      {mount.path}
                      {mount.options?.version ? (
                        <Chip size="small" label={`v${mount.options.version}`} sx={{ ml: 1 }} />
                      ) : null}
                    </TableCell>
                    <TableCell>{mount.type}</TableCell>
                    <TableCell>{mount.description || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="caption" className="monospace">
                        {mount.accessor || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Tune">
                        <IconButton size="small" onClick={() => openTune(mount, tab)}>
                          <TuneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Disable">
                        <IconButton size="small" color="error" onClick={() => requestDisable(mount, tab)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mount {createKind === 'secret' ? 'secret engine' : 'auth method'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Mount path"
              value={createPath}
              onChange={(event) => setCreatePath(event.target.value)}
              helperText="Path without a trailing slash, for example team-kv or github-prod."
              fullWidth
              autoFocus
            />
            <TextField
              select
              label="Type"
              value={createType}
              onChange={(event) => setCreateType(event.target.value)}
              fullWidth
            >
              {(createKind === 'secret' ? SECRET_TYPES : authTypeOptions).map((option) => {
                if (typeof option === 'string') {
                  return (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  );
                }
                return (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                );
              })}
            </TextField>
            {createKind === 'secret' && createType === 'kv' ? (
              <TextField
                select
                label="KV version"
                value={createVersion}
                onChange={(event) => setCreateVersion(event.target.value)}
              >
                <MenuItem value="2">Version 2 (versioned)</MenuItem>
                <MenuItem value="1">Version 1</MenuItem>
              </TextField>
            ) : null}
            <TextField
              label="Description"
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Default lease TTL"
                value={createDefaultTtl}
                onChange={(event) => setCreateDefaultTtl(event.target.value)}
                placeholder="1h"
              />
              <TextField
                label="Max lease TTL"
                value={createMaxTtl}
                onChange={(event) => setCreateMaxTtl(event.target.value)}
                placeholder="24h"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void createMount()} disabled={creating}>
            Mount
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(tune)} onClose={() => setTune(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Tune {tune?.mount.path}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Description"
              value={tuneDescription}
              onChange={(event) => setTuneDescription(event.target.value)}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Default lease TTL (seconds)"
                value={tuneDefaultTtl}
                onChange={(event) => setTuneDefaultTtl(event.target.value)}
              />
              <TextField
                label="Max lease TTL (seconds)"
                value={tuneMaxTtl}
                onChange={(event) => setTuneMaxTtl(event.target.value)}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTune(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveTune()} disabled={tuning}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(disable)}
        title="Disable mount"
        description={`Disable ${disable?.mount.path}? ${
          disable?.kind === 'secret'
            ? 'All secrets stored in this engine become inaccessible (data may remain in the storage backend).'
            : 'Clients using this auth method will no longer be able to log in.'
        }`}
        confirmLabel="Disable"
        destructive
        onConfirm={removeMount}
        onClose={() => setDisable(null)}
      />
    </Box>
  );
}
