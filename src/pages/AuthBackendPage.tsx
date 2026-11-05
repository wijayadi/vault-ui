import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
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
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
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
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import BadgeIcon from '@mui/icons-material/Badge';
import KeyIcon from '@mui/icons-material/Key';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings, useResolvedThemeMode } from '../context/SettingsContext';
import { getAuthBackend, type AuthCollection } from '../config/authBackends';
import { vaultRequest, unwrap } from '../api/client';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { DynamicForm } from '../components/common/DynamicForm';
import { CopyButton } from '../components/common/CopyButton';
import { defaultValues, payloadFromValues, valuesFromPayload, type FieldValues } from '../utils/fields';
import { errorMessage } from '../context/ToastContext';

interface ItemDialogState {
  open: boolean;
  isNew: boolean;
  name: string;
  values: FieldValues;
}

const emptyDialog: ItemDialogState = { open: false, isNew: false, name: '', values: {} };

export function AuthBackendPage() {
  const { type = '', mount = '', '*': splat = '' } = useParams();
  const { connection } = useAuth();
  const { notify, notifyError } = useToast();
  const { settings } = useSettings();
  const mode = useResolvedThemeMode();
  const navigate = useNavigate();
  const def = getAuthBackend(type);

  const segments = splat.split('/').filter(Boolean);
  const activeTab = segments[0] || (def?.collections[0]?.key ?? (def?.config ? 'config' : ''));
  const activeCollection = def?.collections.find((collection) => collection.key === activeTab);
  const itemName = segments.slice(1).join('/');
  const baseRoute = `/auth/${type}/${mount}/`;
  const baseVault = `auth/${mount}`;

  const [configValues, setConfigValues] = useState<FieldValues>({});
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [listErrors, setListErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState<ItemDialogState>(emptyDialog);
  const [saving, setSaving] = useState(false);
  const [deleteName, setDeleteName] = useState<string | null>(null);

  const configFields = useMemo(() => def?.config?.fields ?? [], [def]);

  const loadConfig = useCallback(async () => {
    if (!def?.config) return;
    setConfigError('');
    try {
      const response = await vaultRequest<unknown>(connection, 'get', `${baseVault}/${def.config.path}`);
      const payload = unwrap<Record<string, unknown>>(response) ?? {};
      setConfigValues(valuesFromPayload(configFields, payload));
    } catch (error) {
      setConfigValues(defaultValues(configFields));
      setConfigError(errorMessage(error));
    } finally {
      setConfigLoaded(true);
    }
  }, [connection, baseVault, def, configFields]);

  const loadLists = useCallback(async () => {
    if (!def) return;
    setLoading(true);
    const nextLists: Record<string, string[]> = {};
    const nextErrors: Record<string, string> = {};

    await Promise.all(
      def.collections.map(async (collection) => {
        try {
          const response = await vaultRequest<unknown>(connection, 'get', `${baseVault}/${collection.path}`, {
            query: { list: true },
          });
          const payload = unwrap<{ keys?: string[] }>(response);
          nextLists[collection.key] = payload?.keys ?? [];
        } catch (error) {
          nextLists[collection.key] = [];
          const message = errorMessage(error);
          if (!message.toLowerCase().includes('404') && !message.toLowerCase().includes('not found')) {
            nextErrors[collection.key] = message;
          }
        }
      }),
    );

    setLists(nextLists);
    setListErrors(nextErrors);
    setLoading(false);
  }, [connection, baseVault, def]);

  useEffect(() => {
    if (def?.config) void loadConfig();
  }, [def, loadConfig]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!def) return;
    if (!splat) {
      navigate(`${baseRoute}${def.collections[0]?.key ?? 'config'}/`, { replace: true });
    }
  }, [def, splat, baseRoute, navigate]);

  const refreshAll = () => {
    if (def?.config) void loadConfig();
    void loadLists();
  };

  const buildItemPath = useCallback(
    (collection: AuthCollection, name: string) => `${baseVault}/${collection.path}/${name}`,
    [baseVault],
  );

  const openNew = (collection: AuthCollection) => {
    setDialog({
      open: true,
      isNew: true,
      name: '',
      values: defaultValues(collection.fields),
    });
  };

  const openEdit = useCallback(
    async (collection: AuthCollection, name: string) => {
      try {
        const response = await vaultRequest<unknown>(connection, 'get', buildItemPath(collection, name));
        const payload = unwrap<Record<string, unknown>>(response) ?? {};
        const values = valuesFromPayload(collection.fields, payload);

        if (collection.policiesKey && collection.policiesKey !== 'policies') {
          const raw = payload[collection.policiesKey];
          values.policies = Array.isArray(raw)
            ? raw.map(String)
            : raw
              ? String(raw).split(',').filter(Boolean)
              : [];
        }

        setDialog({ open: true, isNew: false, name, values });
      } catch (error) {
        notifyError(error);
      }
    },
    [connection, notifyError, buildItemPath],
  );

  useEffect(() => {
    if (!activeCollection || !itemName) return;
    void openEdit(activeCollection, itemName);
  }, [activeCollection, itemName, openEdit]);

  const closeDialog = () => {
    setDialog(emptyDialog);
    if (itemName) navigate(`${baseRoute}${activeTab}/`);
  };

  const buildPayload = (collection: AuthCollection, values: FieldValues): Record<string, unknown> => {
    const payload = payloadFromValues(collection.fields, values);
    const policies = Array.isArray(values.policies) ? (values.policies as string[]) : [];
    if (collection.policiesKey) {
      payload[collection.policiesKey] = collection.policiesFormat === 'csv' ? policies.join(',') : policies;
    } else {
      payload.policies = policies;
    }
    return payload;
  };

  const saveItem = async () => {
    if (!activeCollection) return;
    const name = dialog.name.trim();
    if (!name) {
      notifyError(new Error(`Enter a ${activeCollection.itemLabel} name`));
      return;
    }

    setSaving(true);
    try {
      await vaultRequest(connection, 'post', buildItemPath(activeCollection, name), {
        data: buildPayload(activeCollection, dialog.values),
      });
      notify(`${activeCollection.itemLabel} ${name} saved`);
      setDialog(emptyDialog);
      navigate(`${baseRoute}${activeCollection.key}/`);
      await loadLists();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!activeCollection || !deleteName) return;
    try {
      await vaultRequest(connection, 'delete', buildItemPath(activeCollection, deleteName));
      notify(`${activeCollection.itemLabel} ${deleteName} deleted`);
      setDeleteName(null);
      if (itemName === deleteName) navigate(`${baseRoute}${activeCollection.key}/`);
      await loadLists();
    } catch (error) {
      notifyError(error);
    }
  };

  const requestDelete = (collection: AuthCollection, name: string) => {
    if (!settings.confirmDelete) {
      void (async () => {
        try {
          await vaultRequest(connection, 'delete', buildItemPath(collection, name));
          notify(`${collection.itemLabel} ${name} deleted`);
          await loadLists();
        } catch (error) {
          notifyError(error);
        }
      })();
      return;
    }
    setDeleteName(name);
  };

  const saveConfig = async () => {
    if (!def?.config) return;
    setConfigSaving(true);
    try {
      await vaultRequest(connection, 'post', `${baseVault}/${def.config.path}`, {
        data: payloadFromValues(configFields, configValues),
      });
      notify('Backend configuration saved');
      setConfigError('');
    } catch (error) {
      notifyError(error);
    } finally {
      setConfigSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!activeCollection) return [];
    const items = lists[activeCollection.key] ?? [];
    const needle = filter.trim().toLowerCase();
    return (needle ? items.filter((item) => item.toLowerCase().includes(needle)) : items).sort();
  }, [activeCollection, lists, filter]);

  if (!def) {
    return (
      <Alert severity="warning">
        The authentication backend type <code>{type}</code> is not supported by Vault UI.{' '}
        <Link component={RouterLink} to="/system/mounts">
          Manage mounts
        </Link>
      </Alert>
    );
  }

  const tabs = [
    ...def.collections.map((collection) => ({ key: collection.key, label: collection.label })),
    ...(def.config ? [{ key: 'config', label: 'Configuration' }] : []),
  ];

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h4">{def.label}</Typography>
          <Chip size="small" label={mount} />
          {def.type === 'token' ? (
            <Button component={RouterLink} to="/tokens" size="small" startIcon={<BadgeIcon />}>
              Open token manager
            </Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Refresh">
            <IconButton onClick={refreshAll} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography color="text.secondary">{def.description}</Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_event, value) => navigate(`${baseRoute}${value}/`)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {tabs.map((tab) => (
          <Tab key={tab.key} value={tab.key} label={tab.label} />
        ))}
      </Tabs>

      {activeTab === 'config' && def.config ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {def.label} configuration
            </Typography>
            {def.config.intro ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {def.config.intro}
              </Typography>
            ) : null}
            {configError ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {configError}
              </Alert>
            ) : null}
            {!configLoaded ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <DynamicForm
                  fields={configFields}
                  values={configValues}
                  onChange={(key, value) => setConfigValues((current) => ({ ...current, [key]: value }))}
                  dark={mode === 'dark'}
                />
                <Divider sx={{ my: 2 }} />
                <Button variant="contained" onClick={() => void saveConfig()} disabled={configSaving}>
                  Save configuration
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : activeCollection ? (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openNew(activeCollection)}>
                New {activeCollection.itemLabel}
              </Button>
              <TextField
                size="small"
                label="Filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <Typography variant="body2" color="text.secondary">
                {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}
              </Typography>
            </Box>

            {listErrors[activeCollection.key] ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {listErrors[activeCollection.key]}
              </Alert>
            ) : null}

            {loading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
                <CircularProgress />
              </Box>
            ) : filteredItems.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No {activeCollection.label.toLowerCase()} found.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{activeCollection.nameLabel ?? activeCollection.itemLabel}</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow
                      key={item}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`${baseRoute}${activeCollection.key}/${item}`)}
                    >
                      <TableCell>{item}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openEdit(activeCollection, item);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(event) => {
                              event.stopPropagation();
                              requestDelete(activeCollection, item);
                            }}
                          >
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
      ) : null}

      {def.notes?.length ? (
        <Alert severity="info">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {def.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialog.isNew ? `New ${activeCollection?.itemLabel}` : `Edit ${dialog.name}`}
        </DialogTitle>
        <DialogContent>
          {activeCollection ? (
            <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
              {dialog.isNew ? (
                <TextField
                  label={activeCollection.nameLabel ?? 'Name'}
                  value={dialog.name}
                  onChange={(event) => setDialog((current) => ({ ...current, name: event.target.value }))}
                  fullWidth
                  autoFocus
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Path: {baseVault}/{activeCollection.path}/{dialog.name}
                  </Typography>
                  <CopyButton
                    value={`${baseVault}/${activeCollection.path}/${dialog.name}`}
                    label="Copy Vault path"
                  />
                </Box>
              )}

              <DynamicForm
                fields={activeCollection.fields}
                values={dialog.values}
                onChange={(key, value) =>
                  setDialog((current) => ({
                    ...current,
                    values: { ...current.values, [key]: value },
                  }))
                }
                dark={mode === 'dark'}
              />

              {type === 'approle' && !dialog.isNew ? (
                <AppRoleExtras mount={mount} name={dialog.name} />
              ) : null}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveItem()} disabled={saving}>
            {dialog.isNew ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteName)}
        title={`Delete ${activeCollection?.itemLabel ?? 'item'}`}
        description={`Delete ${deleteName}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteItem}
        onClose={() => setDeleteName(null)}
      />
    </Box>
  );
}

function AppRoleExtras({ mount, name }: { mount: string; name: string }) {
  const { connection } = useAuth();
  const { notify, notifyError } = useToast();
  const base = `auth/${mount}/role/${name}`;
  const [roleId, setRoleId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [secretId, setSecretId] = useState<{ id: string; accessor: string } | null>(null);
  const [accessors, setAccessors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRoleId = useCallback(async () => {
    try {
      const response = await vaultRequest<unknown>(connection, 'get', `${base}/role-id`);
      const payload = unwrap<{ role_id?: string }>(response);
      setRoleId(payload?.role_id ?? '');
      setNewRoleId(payload?.role_id ?? '');
    } catch (error) {
      notifyError(error);
    }
  }, [base, connection, notifyError]);

  useEffect(() => {
    void loadRoleId();
  }, [loadRoleId]);

  const updateRoleId = async () => {
    try {
      await vaultRequest(connection, 'post', `${base}/role-id`, { data: { role_id: newRoleId } });
      setRoleId(newRoleId);
      notify('Role ID updated');
    } catch (error) {
      notifyError(error);
    }
  };

  const generateSecretId = async () => {
    setLoading(true);
    try {
      const response = await vaultRequest<unknown>(connection, 'post', `${base}/secret-id`);
      const payload = unwrap<{ secret_id?: string; secret_id_accessor?: string }>(response);
      setSecretId({ id: payload?.secret_id ?? '', accessor: payload?.secret_id_accessor ?? '' });
      notify('Secret ID generated');
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  const listAccessors = async () => {
    try {
      const response = await vaultRequest<unknown>(connection, 'get', `${base}/secret-id`, {
        query: { list: true },
      });
      const payload = unwrap<{ keys?: string[] }>(response);
      setAccessors(payload?.keys ?? []);
    } catch (error) {
      notifyError(error);
    }
  };

  const destroyAccessor = async (accessor: string) => {
    try {
      await vaultRequest(connection, 'post', `${base}/secret-id-accessor/destroy`, {
        data: { secret_id_accessor: accessor },
      });
      notify('Secret ID accessor destroyed');
      await listAccessors();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          AppRole credentials
        </Typography>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Role ID"
              value={newRoleId}
              onChange={(event) => setNewRoleId(event.target.value)}
              sx={{ minWidth: 320 }}
            />
            <Button
              variant="outlined"
              onClick={() => void updateRoleId()}
              disabled={!newRoleId || newRoleId === roleId}
            >
              Update Role ID
            </Button>
            <CopyButton value={roleId} label="Copy Role ID" />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              startIcon={<KeyIcon />}
              variant="contained"
              onClick={() => void generateSecretId()}
              disabled={loading}
            >
              Generate Secret ID
            </Button>
            <Button onClick={() => void listAccessors()}>List Secret ID accessors</Button>
          </Box>

          {secretId ? (
            <Alert severity="success">
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                Secret ID: {secretId.id}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                Accessor: {secretId.accessor}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <CopyButton value={secretId.id} label="Copy Secret ID" />
                <CopyButton value={secretId.accessor} label="Copy accessor" />
              </Box>
            </Alert>
          ) : null}

          {accessors.length > 0 ? (
            <Box>
              <Typography variant="body2" gutterBottom>
                Secret ID accessors
              </Typography>
              {accessors.map((accessor) => (
                <Box key={accessor} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ wordBreak: 'break-all', flex: 1 }}>
                    {accessor}
                  </Typography>
                  <Button size="small" color="error" onClick={() => void destroyAccessor(accessor)}>
                    Destroy
                  </Button>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
}
