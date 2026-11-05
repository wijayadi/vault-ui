import { useCallback, useEffect, useMemo, useState } from 'react';
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
import TablePagination from '@mui/material/TablePagination';
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings, useResolvedThemeMode } from '../context/SettingsContext';
import {
  createToken,
  createTokenFromRole,
  deleteTokenRole,
  listAccessors,
  listTokenRoles,
  lookupAccessor,
  readTokenRole,
  revokeAccessor,
  writeTokenRole,
  type TokenRole,
} from '../api/auth';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CopyButton } from '../components/common/CopyButton';
import { DynamicForm } from '../components/common/DynamicForm';
import { JsonEditor } from '../components/common/JsonEditor';
import { PolicyPicker } from '../components/common/PolicyPicker';
import type { FieldDef } from '../config/authBackends';
import { payloadFromValues, valuesFromPayload, type FieldValues } from '../utils/fields';
import { errorMessage } from '../context/ToastContext';
import type { TokenIdentity } from '../api/types';

const roleFields: FieldDef[] = [
  { key: 'allowed_policies', label: 'Allowed policies', type: 'policies' },
  { key: 'disallowed_policies', label: 'Disallowed policies', type: 'policies' },
  { key: 'orphan', label: 'Orphan tokens', type: 'boolean', defaultValue: false },
  { key: 'renewable', label: 'Renewable', type: 'boolean', defaultValue: true },
  { key: 'path_suffix', label: 'Path suffix', type: 'text' },
  { key: 'explicit_max_ttl', label: 'Explicit max TTL (seconds)', type: 'number', min: 0 },
  { key: 'period', label: 'Period (seconds)', type: 'number', min: 0 },
  {
    key: 'token_type',
    label: 'Token type',
    type: 'select',
    options: [
      { value: 'default', label: 'Default' },
      { value: 'service', label: 'Service' },
      { value: 'batch', label: 'Batch' },
    ],
  },
  { key: 'token_num_uses', label: 'Max uses', type: 'number', min: 0 },
  { key: 'token_ttl', label: 'Token TTL (seconds)', type: 'number', min: 0 },
  { key: 'token_max_ttl', label: 'Token max TTL (seconds)', type: 'number', min: 0 },
  { key: 'token_bound_cidrs', label: 'Bound CIDRs', type: 'csv' },
];

const roleDefaults: FieldValues = {
  allowed_policies: [],
  disallowed_policies: [],
  orphan: false,
  renewable: true,
  path_suffix: '',
  explicit_max_ttl: '',
  period: '',
  token_type: 'default',
  token_num_uses: '',
  token_ttl: '',
  token_max_ttl: '',
  token_bound_cidrs: '',
};

interface RoleDialogState {
  open: boolean;
  isNew: boolean;
  name: string;
  values: FieldValues;
}

function formatEpoch(seconds: number | undefined): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleString();
}

export function TokensPage() {
  const { connection, identity, logout } = useAuth();
  const { notify, notifyError } = useToast();
  const { settings } = useSettings();
  const mode = useResolvedThemeMode();

  const [tab, setTab] = useState('accessors');
  const [accessors, setAccessors] = useState<string[]>([]);
  const [accessorDetails, setAccessorDetails] = useState<Record<string, TokenIdentity>>({});
  const [accessorError, setAccessorError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loadingAccessors, setLoadingAccessors] = useState(false);
  const [selectedAccessor, setSelectedAccessor] = useState<string | null>(null);
  const [detailAccessor, setDetailAccessor] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revokeSelfOpen, setRevokeSelfOpen] = useState(false);

  const [roles, setRoles] = useState<string[]>([]);
  const [roleError, setRoleError] = useState('');
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [roleDialog, setRoleDialog] = useState<RoleDialogState>({
    open: false,
    isNew: true,
    name: '',
    values: roleDefaults,
  });
  const [deleteRoleName, setDeleteRoleName] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const [newTokenOpen, setNewTokenOpen] = useState(false);
  const [tokenForm, setTokenForm] = useState({
    displayName: '',
    policies: ['default'],
    ttlHours: '',
    maxUses: '',
    renewable: true,
    orphan: false,
  });
  const [createdToken, setCreatedToken] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);

  const loadAccessors = useCallback(async () => {
    setLoadingAccessors(true);
    setAccessorError('');
    try {
      const list = await listAccessors(connection);
      setAccessors(list);
      setPage(0);
    } catch (error) {
      setAccessorError(errorMessage(error));
      setAccessors([]);
    } finally {
      setLoadingAccessors(false);
    }
  }, [connection]);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    setRoleError('');
    try {
      setRoles(await listTokenRoles(connection));
    } catch (error) {
      setRoleError(errorMessage(error));
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadAccessors();
    void loadRoles();
  }, [loadAccessors, loadRoles]);

  const pagedAccessors = useMemo(
    () => accessors.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [accessors, page, rowsPerPage],
  );

  useEffect(() => {
    let cancelled = false;
    const missing = pagedAccessors.filter((accessor) => !accessorDetails[accessor]);
    if (missing.length === 0) return;

    void Promise.all(
      missing.map(async (accessor) => {
        try {
          const details = await lookupAccessor(connection, accessor);
          if (!cancelled) {
            setAccessorDetails((current) => ({ ...current, [accessor]: details }));
          }
        } catch {
          // Individual accessor lookups can fail due to permissions.
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [pagedAccessors, accessorDetails, connection]);

  const openRole = async (name?: string) => {
    if (!name) {
      setRoleDialog({ open: true, isNew: true, name: '', values: { ...roleDefaults } });
      return;
    }

    try {
      const role = await readTokenRole(connection, name);
      setRoleDialog({
        open: true,
        isNew: false,
        name,
        values: { ...roleDefaults, ...valuesFromPayload(roleFields, role as Record<string, unknown>) },
      });
    } catch (error) {
      notifyError(error);
    }
  };

  const saveRole = async () => {
    if (!roleDialog.name.trim()) {
      notifyError(new Error('Enter a role name'));
      return;
    }

    const values = roleDialog.values;
    const payload: Record<string, unknown> = payloadFromValues(
      roleFields.filter((field) => field.type !== 'policies'),
      values,
    );
    payload.allowed_policies = values.allowed_policies ?? [];
    payload.disallowed_policies = values.disallowed_policies ?? [];

    setSavingRole(true);
    try {
      await writeTokenRole(connection, roleDialog.name.trim(), payload as TokenRole);
      notify(`Role ${roleDialog.name} saved`);
      setRoleDialog({ open: false, isNew: true, name: '', values: roleDefaults });
      await loadRoles();
    } catch (error) {
      notifyError(error);
    } finally {
      setSavingRole(false);
    }
  };

  const removeRole = async () => {
    if (!deleteRoleName) return;
    try {
      await deleteTokenRole(connection, deleteRoleName);
      notify(`Role ${deleteRoleName} deleted`);
      setDeleteRoleName(null);
      await loadRoles();
    } catch (error) {
      notifyError(error);
    }
  };

  const revoke = async (accessor: string) => {
    try {
      await revokeAccessor(connection, accessor);
      notify('Token accessor revoked');
      setAccessorDetails((current) => {
        const next = { ...current };
        delete next[accessor];
        return next;
      });
      setSelectedAccessor(null);
      await loadAccessors();
    } catch (error) {
      notifyError(error);
    }
  };

  const requestRevoke = (accessor: string) => {
    if (!settings.confirmDelete) {
      void revoke(accessor);
      return;
    }
    setRevokeTarget(accessor);
  };

  const createNewToken = async () => {
    setCreatingToken(true);
    try {
      const auth = await createToken(
        connection,
        {
          display_name: tokenForm.displayName || undefined,
          policies: tokenForm.policies,
          no_default_policy: tokenForm.policies.length > 0 && !tokenForm.policies.includes('default'),
          renewable: tokenForm.renewable,
          num_uses: tokenForm.maxUses ? Number(tokenForm.maxUses) : undefined,
          ttl: tokenForm.ttlHours ? `${tokenForm.ttlHours}h` : undefined,
        },
        tokenForm.orphan,
      );
      if (!auth?.client_token) throw new Error('Vault did not return a token');
      setCreatedToken(auth.client_token);
      setNewTokenOpen(false);
      await loadAccessors();
    } catch (error) {
      notifyError(error);
    } finally {
      setCreatingToken(false);
    }
  };

  const createFromRole = async (role: string) => {
    try {
      const auth = await createTokenFromRole(connection, role);
      if (!auth?.client_token) throw new Error('Vault did not return a token');
      setCreatedToken(auth.client_token);
      await loadAccessors();
    } catch (error) {
      notifyError(error);
    }
  };

  const currentRoleValues = roleDialog.values;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <BadgeIcon color="primary" />
        <Typography variant="h4">Tokens</Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => {
              void loadAccessors();
              void loadRoles();
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewTokenOpen(true)}>
          New token
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h6">Current token</Typography>
              <Typography variant="body2" color="text.secondary">
                {identity?.display_name || identity?.id || 'unknown'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(identity?.policies ?? identity?.token_policies ?? []).map((policy) => (
                <Chip key={policy} size="small" label={policy} />
              ))}
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<KeyIcon />} onClick={() => setRevokeSelfOpen(true)} color="error">
              Revoke current token
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
        <Tab value="accessors" label={`Accessors (${accessors.length})`} />
        <Tab value="roles" label={`Roles (${roles.length})`} />
      </Tabs>

      {tab === 'accessors' ? (
        <Card>
          <CardContent>
            {accessorError ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {accessorError}
              </Alert>
            ) : null}
            {loadingAccessors ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
                <CircularProgress />
              </Box>
            ) : accessors.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No token accessors are visible. Listing accessors requires <code>sudo</code> and{' '}
                <code>list</code> on <code>auth/token/accessors</code>.
              </Typography>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Accessor</TableCell>
                      <TableCell>Display name</TableCell>
                      <TableCell>Policies</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Orphan</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedAccessors.map((accessor) => {
                      const details = accessorDetails[accessor];
                      return (
                        <TableRow
                          key={accessor}
                          hover
                          selected={selectedAccessor === accessor}
                          onClick={() =>
                            setSelectedAccessor((current) => (current === accessor ? null : accessor))
                          }
                        >
                          <TableCell>
                            <Typography variant="caption" className="monospace">
                              {accessor}
                            </Typography>
                          </TableCell>
                          <TableCell>{details?.display_name || '—'}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {(details?.policies ?? [])
                                .filter((policy) => policy !== 'default')
                                .map((policy) => (
                                  <Chip key={policy} size="small" label={policy} />
                                ))}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {formatEpoch(
                              (details as unknown as { creation_time?: number } | undefined)?.creation_time,
                            )}
                          </TableCell>
                          <TableCell>{details?.orphan ? 'yes' : 'no'}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Details">
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDetailAccessor(accessor);
                                }}
                                disabled={!details}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Revoke">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  requestRevoke(accessor);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={accessors.length}
                  page={page}
                  onPageChange={(_event, next) => setPage(next)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openRole()}>
                New role
              </Button>
              <Typography variant="body2" color="text.secondary">
                Token roles constrain the tokens created from them.
              </Typography>
            </Box>
            {roleError ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {roleError}
              </Alert>
            ) : null}
            {loadingRoles ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
                <CircularProgress />
              </Box>
            ) : roles.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No token roles configured.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Role</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role} hover>
                      <TableCell>{role}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => void createFromRole(role)}>
                          Create token
                        </Button>
                        <IconButton size="small" onClick={() => void openRole(role)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteRoleName(role)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={newTokenOpen} onClose={() => setNewTokenOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create token</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Display name"
              value={tokenForm.displayName}
              onChange={(event) => setTokenForm((form) => ({ ...form, displayName: event.target.value }))}
              fullWidth
            />
            <PolicyPicker
              value={tokenForm.policies}
              onChange={(policies) => setTokenForm((form) => ({ ...form, policies }))}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="TTL (hours)"
                type="number"
                value={tokenForm.ttlHours}
                onChange={(event) => setTokenForm((form) => ({ ...form, ttlHours: event.target.value }))}
                helperText="Leave blank for the backend default."
              />
              <TextField
                label="Maximum uses"
                type="number"
                value={tokenForm.maxUses}
                onChange={(event) => setTokenForm((form) => ({ ...form, maxUses: event.target.value }))}
                helperText="0 or blank means unlimited."
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                select
                label="Renewable"
                value={tokenForm.renewable ? 'yes' : 'no'}
                onChange={(event) =>
                  setTokenForm((form) => ({ ...form, renewable: event.target.value === 'yes' }))
                }
                sx={{ flex: 1 }}
              >
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
              <TextField
                select
                label="Orphan"
                value={tokenForm.orphan ? 'yes' : 'no'}
                onChange={(event) =>
                  setTokenForm((form) => ({ ...form, orphan: event.target.value === 'yes' }))
                }
                sx={{ flex: 1 }}
                helperText="Requires create-orphan permission."
              >
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTokenOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void createNewToken()} disabled={creatingToken}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(createdToken)} onClose={() => setCreatedToken('')} maxWidth="sm" fullWidth>
        <DialogTitle>Token created</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is the only time the token is displayed. Copy it now.
          </Alert>
          <TextField
            value={createdToken}
            fullWidth
            multiline
            minRows={2}
            slotProps={{ input: { readOnly: true } }}
          />
        </DialogContent>
        <DialogActions>
          <CopyButton value={createdToken} label="Copy token" />
          <Button onClick={() => setCreatedToken('')}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={roleDialog.open}
        onClose={() => setRoleDialog((state) => ({ ...state, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{roleDialog.isNew ? 'New token role' : `Edit role ${roleDialog.name}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            {roleDialog.isNew ? (
              <TextField
                label="Role name"
                value={roleDialog.name}
                onChange={(event) => setRoleDialog((state) => ({ ...state, name: event.target.value }))}
                fullWidth
                autoFocus
              />
            ) : null}
            <DynamicForm
              fields={roleFields}
              values={currentRoleValues}
              onChange={(key, value) =>
                setRoleDialog((state) => ({
                  ...state,
                  values: { ...state.values, [key]: value },
                }))
              }
              dark={mode === 'dark'}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialog((state) => ({ ...state, open: false }))}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveRole()} disabled={savingRole}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailAccessor)} onClose={() => setDetailAccessor(null)} maxWidth="md" fullWidth>
        <DialogTitle>Accessor details</DialogTitle>
        <DialogContent>
          {detailAccessor ? (
            <JsonEditor
              value={accessorDetails[detailAccessor] ?? {}}
              readOnly
              height={420}
              dark={mode === 'dark'}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          {detailAccessor ? <CopyButton value={detailAccessor} label="Copy accessor" /> : null}
          <Button onClick={() => setDetailAccessor(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke token"
        description={`Revoke accessor ${revokeTarget}? Any client using this token will be logged out immediately.`}
        confirmLabel="Revoke"
        destructive
        onConfirm={async () => {
          if (revokeTarget) await revoke(revokeTarget);
          setRevokeTarget(null);
        }}
        onClose={() => setRevokeTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteRoleName)}
        title="Delete token role"
        description={`Delete role ${deleteRoleName}? Tokens already created from it are not affected.`}
        confirmLabel="Delete"
        destructive
        onConfirm={removeRole}
        onClose={() => setDeleteRoleName(null)}
      />

      <ConfirmDialog
        open={revokeSelfOpen}
        title="Revoke current token"
        description="Revoke the token used by this session? You will be signed out immediately."
        confirmLabel="Revoke and sign out"
        destructive
        onConfirm={async () => {
          try {
            await logout();
          } finally {
            setRevokeSelfOpen(false);
          }
        }}
        onClose={() => setRevokeSelfOpen(false)}
      />
    </Box>
  );
}
