import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PolicyIcon from '@mui/icons-material/Policy';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { POLICY_TEMPLATE, deletePolicy, listPolicies, readPolicy, writePolicy } from '../api/policies';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CopyButton } from '../components/common/CopyButton';
import { errorMessage } from '../context/ToastContext';

interface PolicyDialogState {
  open: boolean;
  isNew: boolean;
  name: string;
  text: string;
}

export function PoliciesPage() {
  const { connection } = useAuth();
  const { notify, notifyError } = useToast();
  const { settings } = useSettings();
  const [policies, setPolicies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<PolicyDialogState>({ open: false, isNew: true, name: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [deleteName, setDeleteName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listPolicies(connection);
      setPolicies(list.sort());
    } catch (reason) {
      setError(errorMessage(reason));
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setDialog({ open: true, isNew: true, name: '', text: POLICY_TEMPLATE });
  };

  const openEdit = async (name: string) => {
    try {
      const text = await readPolicy(connection, name);
      setDialog({ open: true, isNew: false, name, text });
    } catch (reason) {
      notifyError(reason);
    }
  };

  const save = async () => {
    const name = dialog.name.trim();
    if (!name) {
      notifyError(new Error('Enter a policy name'));
      return;
    }
    if (!dialog.text.trim()) {
      notifyError(new Error('Policy rules cannot be empty'));
      return;
    }

    setSaving(true);
    try {
      await writePolicy(connection, name, dialog.text);
      notify(`Policy ${name} saved`);
      setDialog((current) => ({ ...current, open: false }));
      await load();
    } catch (reason) {
      notifyError(reason);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteName) return;
    try {
      await deletePolicy(connection, deleteName);
      notify(`Policy ${deleteName} deleted`);
      setDeleteName(null);
      await load();
    } catch (reason) {
      notifyError(reason);
    }
  };

  const requestDelete = (name: string) => {
    if (!settings.confirmDelete) {
      void (async () => {
        try {
          await deletePolicy(connection, name);
          notify(`Policy ${name} deleted`);
          await load();
        } catch (reason) {
          notifyError(reason);
        }
      })();
      return;
    }
    setDeleteName(name);
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <PolicyIcon color="primary" />
        <Typography variant="h4">Policies</Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={() => void load()} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          New policy
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            ACL policies use Vault's HCL syntax. Vault UI writes them through <code>sys/policies/acl</code>{' '}
            and falls back to <code>sys/policy</code> on older clusters.
          </Typography>

          {error ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : policies.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No policies found or your token cannot list policies.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow
                    key={policy}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => void openEdit(policy)}
                  >
                    <TableCell>
                      {policy}
                      {policy === 'root' || policy === 'default' ? (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          built-in
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            void openEdit(policy);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={policy === 'root' || policy === 'default'}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDelete(policy);
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

      <Dialog
        open={dialog.open}
        onClose={() => setDialog((current) => ({ ...current, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{dialog.isNew ? 'New policy' : `Edit policy ${dialog.name}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Policy name"
              value={dialog.name}
              onChange={(event) => setDialog((current) => ({ ...current, name: event.target.value }))}
              disabled={!dialog.isNew}
              fullWidth
              autoFocus={dialog.isNew}
            />
            <TextField
              label="Policy (HCL)"
              value={dialog.text}
              onChange={(event) => setDialog((current) => ({ ...current, text: event.target.value }))}
              multiline
              minRows={18}
              fullWidth
              slotProps={{
                input: { className: 'monospace', style: { fontFamily: 'monospace', fontSize: 13 } },
              }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <CopyButton value={dialog.text} label="Copy policy" />
              <Button
                size="small"
                onClick={() => setDialog((current) => ({ ...current, text: POLICY_TEMPLATE }))}
              >
                Insert example
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog((current) => ({ ...current, open: false }))}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            Save policy
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteName)}
        title="Delete policy"
        description={`Delete policy ${deleteName}? Tokens that rely on it will lose its permissions.`}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
        onClose={() => setDeleteName(null)}
      />
    </Box>
  );
}
