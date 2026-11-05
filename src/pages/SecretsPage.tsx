import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings, useResolvedThemeMode } from '../context/SettingsContext';
import { useMounts } from '../context/MountsContext';
import { JsonEditor } from '../components/common/JsonEditor';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CopyButton, copyText } from '../components/common/CopyButton';
import {
  deleteSecret,
  destroySecret,
  isDirectoryPath,
  joinLogicalPath,
  kvDataPath,
  kvVersion,
  listSecrets,
  readSecret,
  readSecretMetadata,
  undeleteSecret,
  updateSecretMetadata,
  writeSecret,
} from '../api/kv';
import { wrapExisting } from '../api/wrapping';
import { errorMessage } from '../context/ToastContext';
import type { MountInfo, SecretReadResult } from '../api/types';

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function trimMount(path: string): string {
  return path.replace(/\/+$/, '');
}

export function SecretsPage() {
  const { mount: mountName = '', '*': splat = '' } = useParams();
  const { connection } = useAuth();
  const { notify, notifyError } = useToast();
  const { settings } = useSettings();
  const mode = useResolvedThemeMode();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mounts, loading: mountsLoading, error: mountsError } = useMounts();

  const mount = useMemo<MountInfo | undefined>(() => {
    return mounts.find((entry) => trimMount(entry.path) === mountName);
  }, [mounts, mountName]);

  const logicalPath = splat ?? '';
  const directory = isDirectoryPath(logicalPath);
  const versionParam = Number(searchParams.get('version')) || undefined;
  const basePath = `/secrets/${mountName}/`;

  const [entries, setEntries] = useState<string[]>([]);
  const [secret, setSecret] = useState<SecretReadResult | null>(null);
  const [metadata, setMetadata] = useState<SecretReadResult['metadata']>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [refreshToken, setRefreshToken] = useState(0);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newData, setNewData] = useState<Record<string, unknown>>({});
  const [newTextValue, setNewTextValue] = useState('');
  const [newValid, setNewValid] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [editValid, setEditValid] = useState(true);
  const [editTextValue, setEditTextValue] = useState('');
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState({
    max_versions: '',
    cas_required: false,
    delete_version_after: '',
    custom_metadata: '{}',
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    path: string;
    version?: number;
    destroy?: boolean;
  } | null>(null);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [wrapTtl, setWrapTtl] = useState('1h');
  const [wrapToken, setWrapToken] = useState('');
  const [busy, setBusy] = useState(false);

  const kv2 = mount ? kvVersion(mount) === 2 : false;
  const useRootKey = settings.useRootKey && Boolean(settings.rootKey);

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!mount) return;
      setLoading(true);
      setLoadError('');
      setSecret(null);
      setMetadata(null);

      try {
        if (directory) {
          const list = await listSecrets(connection, mount, logicalPath, signal);
          setEntries(list);
        } else {
          const result = await readSecret(connection, mount, logicalPath, versionParam, signal);
          setSecret(result);
          const meta = await readSecretMetadata(connection, mount, logicalPath, signal).catch(() => null);
          setMetadata(meta ?? result.metadata);
        }
      } catch (error) {
        if (signal.aborted) return;
        setLoadError(errorMessage(error));
        if (!directory && kvVersion(mount) === 2) {
          const meta = await readSecretMetadata(connection, mount, logicalPath).catch(() => null);
          setMetadata(meta);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [connection, mount, directory, logicalPath, versionParam],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  const filteredEntries = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return entries
      .filter((entry) => !needle || entry.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aDir = isDirectoryPath(a);
        const bDir = isDirectoryPath(b);
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a.localeCompare(b);
      });
  }, [entries, filter]);

  const pagedEntries = filteredEntries.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const openEntry = (entry: string) => {
    const nextPath = `${logicalPath}${entry}`;
    navigate(`${basePath}${nextPath}`);
  };

  const openNew = () => {
    setNewName('');
    setNewData({});
    setNewTextValue('');
    setNewValid(true);
    setNewOpen(true);
  };

  const createSecret = async () => {
    if (!mount) return;
    if (!newName.trim()) {
      notifyError(new Error('Enter a secret name'));
      return;
    }
    if ((!useRootKey && !newValid) || (useRootKey && !newTextValue)) {
      notifyError(new Error('The secret content is not valid'));
      return;
    }

    const payload = useRootKey ? { [settings.rootKey]: newTextValue } : newData;
    setBusy(true);
    try {
      await writeSecret(connection, mount, joinLogicalPath(logicalPath, newName.trim()), payload);
      notify(`Secret ${newName} created`);
      setNewOpen(false);
      setRefreshToken((value) => value + 1);
      navigate(`${basePath}${joinLogicalPath(logicalPath, newName.trim())}`);
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    if (!secret) return;
    setEditData(secret.data);
    setEditTextValue(
      settings.rootKey && typeof secret.data[settings.rootKey] === 'string'
        ? String(secret.data[settings.rootKey])
        : '',
    );
    setEditValid(true);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!mount) return;
    if ((!useRootKey && !editValid) || (useRootKey && !editTextValue)) {
      notifyError(new Error('The secret content is not valid'));
      return;
    }
    const payload = useRootKey ? { [settings.rootKey]: editTextValue } : editData;
    setBusy(true);
    try {
      await writeSecret(connection, mount, logicalPath, payload, {
        cas: metadata?.current_version ?? secret?.metadata?.version,
      });
      notify(`Secret ${logicalPath} updated`);
      setEditOpen(false);
      setRefreshToken((value) => value + 1);
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!mount || !deleteTarget) return;
    try {
      if (deleteTarget.destroy) {
        await destroySecret(
          connection,
          mount,
          deleteTarget.path,
          deleteTarget.version ? [deleteTarget.version] : [],
        );
        notify('Secret version destroyed');
      } else {
        await deleteSecret(
          connection,
          mount,
          deleteTarget.path,
          deleteTarget.version ? [deleteTarget.version] : undefined,
        );
        notify('Secret deleted');
      }
      setRefreshToken((value) => value + 1);
      if (!deleteTarget.path || deleteTarget.path === logicalPath) {
        navigate(
          basePath +
            (logicalPath.includes('/') ? logicalPath.slice(0, logicalPath.lastIndexOf('/') + 1) : ''),
        );
      }
    } catch (error) {
      notifyError(error);
    }
  };

  const requestDelete = (path: string, version?: number, destroy?: boolean) => {
    if (!settings.confirmDelete) {
      void (async () => {
        if (!mount) return;
        try {
          if (destroy) await destroySecret(connection, mount, path, version ? [version] : []);
          else await deleteSecret(connection, mount, path, version ? [version] : undefined);
          notify('Secret deleted');
          setRefreshToken((value) => value + 1);
        } catch (error) {
          notifyError(error);
        }
      })();
      return;
    }
    setDeleteTarget({ path, version, destroy });
  };

  const saveMetadata = async () => {
    if (!mount) return;
    let customMetadata: Record<string, string> | null;
    try {
      customMetadata = JSON.parse(metadataDraft.custom_metadata || '{}') as Record<string, string>;
    } catch {
      notifyError(new Error('Custom metadata must be valid JSON'));
      return;
    }

    setBusy(true);
    try {
      await updateSecretMetadata(connection, mount, logicalPath, {
        max_versions: metadataDraft.max_versions ? Number(metadataDraft.max_versions) : undefined,
        cas_required: metadataDraft.cas_required,
        delete_version_after: metadataDraft.delete_version_after || undefined,
        custom_metadata: customMetadata,
      });
      notify('Secret metadata updated');
      setMetadataOpen(false);
      setRefreshToken((value) => value + 1);
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  const doWrap = async () => {
    if (!mount) return;
    try {
      const info = await wrapExisting(connection, kvDataPath(mount, logicalPath), wrapTtl);
      setWrapToken(info.token);
      setWrapOpen(false);
    } catch (error) {
      notifyError(error);
    }
  };

  if (mountsLoading && !mount) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!mount) {
    return (
      <Alert severity="error">
        {mountsError || `Mount "${mountName}" was not found or your token cannot list mounts.`}
      </Alert>
    );
  }

  const breadcrumbs = logicalPath.split('/').filter(Boolean);

  const renderBreadcrumb = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
      <Link component={RouterLink} to={basePath} underline="hover" color="inherit">
        {mountName}
      </Link>
      {breadcrumbs.map((segment, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const prefix = `${breadcrumbs.slice(0, index + 1).join('/')}${isLast && !directory ? '' : '/'}`;
        return (
          <Box key={`${segment}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography color="text.secondary">/</Typography>
            {isLast && !directory ? (
              <Typography>{segment}</Typography>
            ) : (
              <Link component={RouterLink} to={`${basePath}${prefix}`} underline="hover" color="inherit">
                {segment}
              </Link>
            )}
          </Box>
        );
      })}
      {directory ? <Typography color="text.secondary">/</Typography> : null}
    </Box>
  );

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h4" sx={{ mr: 1 }}>
            {directory ? 'Secrets' : breadcrumbs[breadcrumbs.length - 1] || 'Secret'}
          </Typography>
          <Chip size="small" label={kv2 ? 'KV v2' : 'KV v1'} color={kv2 ? 'primary' : 'default'} />
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Refresh">
            <IconButton onClick={() => setRefreshToken((value) => value + 1)} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {directory ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
              New secret
            </Button>
          ) : (
            <>
              <Button startIcon={<EditIcon />} onClick={openEdit}>
                Edit
              </Button>
              {kv2 ? (
                <Button
                  startIcon={<HistoryIcon />}
                  onClick={() => {
                    setMetadataDraft({
                      max_versions: metadata?.max_versions ? String(metadata.max_versions) : '',
                      cas_required: Boolean(metadata?.cas_required),
                      delete_version_after: metadata?.delete_version_after ?? '',
                      custom_metadata: JSON.stringify(metadata?.custom_metadata ?? {}, null, 2),
                    });
                    setMetadataOpen(true);
                  }}
                >
                  Metadata
                </Button>
              ) : null}
              <Button startIcon={<LockIcon />} onClick={() => setWrapOpen(true)}>
                Wrap
              </Button>
              <Button
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => requestDelete(logicalPath, versionParam)}
              >
                Delete
              </Button>
            </>
          )}
        </Box>
        {renderBreadcrumb()}
      </Box>

      {loadError ? <Alert severity="warning">{loadError}</Alert> : null}

      {directory ? (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="Filter"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(0);
                }}
                slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> } }}
              />
              <Typography variant="body2" color="text.secondary">
                {filteredEntries.length} item{filteredEntries.length === 1 ? '' : 's'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Path: {joinLogicalPath(mountName, logicalPath) || '/'}
              </Typography>
              <CopyButton value={joinLogicalPath(mountName, logicalPath)} label="Copy path" />
            </Box>

            {loading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : filteredEntries.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {filter ? 'No matches.' : 'This path is empty.'}
              </Typography>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedEntries.map((entry) => {
                      const isDir = isDirectoryPath(entry);
                      return (
                        <TableRow
                          key={entry}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => openEntry(entry)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {isDir ? <FolderIcon color="primary" /> : <DescriptionIcon color="action" />}
                              {entry}
                            </Box>
                          </TableCell>
                          <TableCell>{isDir ? 'folder' : 'secret'}</TableCell>
                          <TableCell align="right">
                            {!isDir ? (
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    requestDelete(joinLogicalPath(logicalPath, entry));
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={filteredEntries.length}
                  page={page}
                  onPageChange={(_event, next) => setPage(next)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : secret ? (
        <>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">Secret data</Typography>
                {secret.version ? <Chip size="small" label={`version ${secret.version}`} /> : null}
                <Box sx={{ flex: 1 }} />
                {kv2 && metadata?.versions ? (
                  <TextField
                    select
                    size="small"
                    label="Version"
                    value={versionParam ?? 'current'}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === 'current') {
                        searchParams.delete('version');
                        setSearchParams(searchParams);
                      } else {
                        setSearchParams({ version: String(value) });
                      }
                    }}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="current">Current</MenuItem>
                    {Object.keys(metadata.versions)
                      .sort((a, b) => Number(b) - Number(a))
                      .map((version) => {
                        const info = metadata.versions?.[version];
                        const suffix = info?.destroyed
                          ? ' (destroyed)'
                          : info?.deletion_time
                            ? ' (deleted)'
                            : '';
                        return (
                          <MenuItem key={version} value={version}>
                            Version {version}
                            {suffix}
                          </MenuItem>
                        );
                      })}
                  </TextField>
                ) : null}
                <CopyButton value={JSON.stringify(secret.data, null, 2)} label="Copy secret JSON" />
              </Box>
              <JsonEditor value={secret.data} readOnly height={420} dark={mode === 'dark'} />
            </CardContent>
          </Card>

          {kv2 && metadata ? (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Metadata
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' },
                    gap: 1,
                  }}
                >
                  <Typography variant="body2">Created: {formatDate(metadata.created_time)}</Typography>
                  <Typography variant="body2">
                    Custom metadata:{' '}
                    {metadata.custom_metadata ? JSON.stringify(metadata.custom_metadata) : 'none'}
                  </Typography>
                </Box>
                {metadata.versions ? (
                  <Table size="small" sx={{ mt: 2 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Version</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Deleted</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(metadata.versions)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([version, info]) => (
                          <TableRow key={version}>
                            <TableCell>{version}</TableCell>
                            <TableCell>{formatDate(info.created_time)}</TableCell>
                            <TableCell>{formatDate(info.deletion_time)}</TableCell>
                            <TableCell>
                              {info.destroyed ? 'destroyed' : info.deletion_time ? 'deleted' : 'active'}
                            </TableCell>
                            <TableCell align="right">
                              <Button size="small" onClick={() => setSearchParams({ version })}>
                                View
                              </Button>
                              {info.deletion_time && !info.destroyed ? (
                                <Button
                                  size="small"
                                  onClick={async () => {
                                    try {
                                      await undeleteSecret(connection, mount, logicalPath, [Number(version)]);
                                      notify('Version undeleted');
                                      setRefreshToken((value) => value + 1);
                                    } catch (error) {
                                      notifyError(error);
                                    }
                                  }}
                                >
                                  Undelete
                                </Button>
                              ) : null}
                              <Button
                                size="small"
                                color="error"
                                onClick={() => requestDelete(logicalPath, Number(version), true)}
                              >
                                Destroy
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <Alert severity="info">
          This secret has no readable current version. It may be deleted, destroyed, or you may lack the{' '}
          <code>read</code> capability.
        </Alert>
      )}

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create secret</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Secret name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              fullWidth
            />
            <Typography variant="caption" color="text.secondary">
              Target: {joinLogicalPath(mountName, logicalPath, newName || '<name>')}
            </Typography>
            {useRootKey ? (
              <TextField
                label={`Value for key "${settings.rootKey}"`}
                value={newTextValue}
                onChange={(event) => setNewTextValue(event.target.value)}
                multiline
                minRows={4}
                fullWidth
              />
            ) : (
              <JsonEditor
                value={newData}
                onChange={(value, valid) => {
                  setNewData((value ?? {}) as Record<string, unknown>);
                  setNewValid(valid);
                }}
                height={320}
                dark={mode === 'dark'}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void createSecret()} disabled={busy}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit {logicalPath}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            {secret?.metadata?.version ? (
              <Alert severity="info">
                Editing version {secret.metadata.version}. Saving creates a new version (CAS enforced).
              </Alert>
            ) : null}
            {useRootKey ? (
              <TextField
                label={`Value for key "${settings.rootKey}"`}
                value={editTextValue}
                onChange={(event) => setEditTextValue(event.target.value)}
                multiline
                minRows={4}
                fullWidth
              />
            ) : (
              <JsonEditor
                value={editData}
                onChange={(value, valid) => {
                  setEditData((value ?? {}) as Record<string, unknown>);
                  setEditValid(valid);
                }}
                height={420}
                dark={mode === 'dark'}
              />
            )}
            {!useRootKey ? (
              <Button
                size="small"
                onClick={() => {
                  void copyText(JSON.stringify(editData, null, 2));
                  notify('Copied to clipboard');
                }}
              >
                Copy JSON
              </Button>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveEdit()} disabled={busy}>
            Save new version
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={metadataOpen} onClose={() => setMetadataOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Secret metadata</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Maximum versions"
              type="number"
              value={metadataDraft.max_versions}
              onChange={(event) =>
                setMetadataDraft((draft) => ({ ...draft, max_versions: event.target.value }))
              }
            />
            <TextField
              label="Delete version after"
              placeholder="e.g. 30d"
              value={metadataDraft.delete_version_after}
              onChange={(event) =>
                setMetadataDraft((draft) => ({ ...draft, delete_version_after: event.target.value }))
              }
            />
            <TextField
              select
              label="CAS required"
              value={metadataDraft.cas_required ? 'yes' : 'no'}
              onChange={(event) =>
                setMetadataDraft((draft) => ({ ...draft, cas_required: event.target.value === 'yes' }))
              }
            >
              <MenuItem value="no">No</MenuItem>
              <MenuItem value="yes">Yes</MenuItem>
            </TextField>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Custom metadata (JSON object)
              </Typography>
              <JsonEditor
                value={JSON.parse(metadataDraft.custom_metadata || '{}')}
                onChange={(value) =>
                  setMetadataDraft((draft) => ({ ...draft, custom_metadata: JSON.stringify(value ?? {}) }))
                }
                height={180}
                dark={mode === 'dark'}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMetadataOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveMetadata()} disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={wrapOpen} onClose={() => setWrapOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Wrap secret</DialogTitle>
        <DialogContent>
          <TextField
            label="Wrap TTL"
            value={wrapTtl}
            onChange={(event) => setWrapTtl(event.target.value)}
            helperText="Examples: 5m, 1h, 24h"
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWrapOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void doWrap()}>
            Wrap
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(wrapToken)} onClose={() => setWrapToken('')} maxWidth="sm" fullWidth>
        <DialogTitle>Secret wrapped</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This single-use token can unwrap the secret. It is shown only once.
          </Typography>
          <TextField
            value={wrapToken}
            fullWidth
            multiline
            minRows={2}
            slotProps={{ input: { readOnly: true } }}
          />
        </DialogContent>
        <DialogActions>
          <CopyButton value={wrapToken} label="Copy wrapping token" />
          <Button onClick={() => setWrapToken('')}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.destroy ? 'Destroy secret version' : 'Delete secret'}
        description={
          deleteTarget?.destroy
            ? `Destroy version ${deleteTarget?.version} of ${deleteTarget?.path}? Destroyed data cannot be recovered.`
            : `Delete ${deleteTarget?.path}${deleteTarget?.version ? ` (version ${deleteTarget.version})` : ''}? ${
                kv2
                  ? 'KV v2 soft-deletes the latest version; it can be undeleted later.'
                  : 'This cannot be undone.'
              }`
        }
        confirmLabel={deleteTarget?.destroy ? 'Destroy' : 'Delete'}
        destructive
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
