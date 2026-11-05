import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { isValidVaultUrl, normalizeVaultUrl } from '../api/client';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export function SettingsPage() {
  const { config, connection, updateConnection, logout, resetCapabilities } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { notify, notifyError } = useToast();
  const [url, setUrl] = useState(connection.url);
  const [namespace, setNamespace] = useState(connection.namespace);
  const [timeoutSeconds, setTimeoutSeconds] = useState(String((connection.timeoutMs ?? 60_000) / 1000));
  const [logoutOpen, setLogoutOpen] = useState(false);

  const saveConnection = () => {
    const nextUrl = normalizeVaultUrl(url);
    if (nextUrl && !isValidVaultUrl(nextUrl)) {
      notifyError(new Error('Vault URL must include http:// or https://'));
      return;
    }

    const timeoutMs = Math.max(5, Number(timeoutSeconds) || 60) * 1000;
    const urlChanged = nextUrl !== connection.url;
    updateConnection({ url: nextUrl, namespace, timeoutMs });
    notify(
      urlChanged ? 'Connection updated. Sign in again against the new server.' : 'Connection settings saved',
    );
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon color="primary" />
        <Typography variant="h4">Preferences</Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Connection
          </Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="Vault URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={config.defaultVaultUrlForce}
              helperText={
                config.defaultVaultUrlForce
                  ? 'The server administrator enforces this URL.'
                  : 'Changing the Vault URL clears the current session.'
              }
              fullWidth
            />
            <TextField
              label="Vault namespace"
              value={namespace}
              onChange={(event) => setNamespace(event.target.value)}
              helperText="Optional Enterprise namespace sent as X-Vault-Namespace."
              fullWidth
            />
            <TextField
              label="Request timeout (seconds)"
              type="number"
              value={timeoutSeconds}
              onChange={(event) => setTimeoutSeconds(event.target.value)}
              helperText="Time allowed for each Vault API request."
              sx={{ maxWidth: 260 }}
            />
            <Box>
              <Button variant="contained" onClick={saveConnection}>
                Save connection
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Appearance
          </Typography>
          <TextField
            select
            label="Theme"
            value={settings.themeMode}
            onChange={(event) =>
              updateSettings({ themeMode: event.target.value as 'light' | 'dark' | 'system' })
            }
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="system">Follow system</MenuItem>
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
          </TextField>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Secrets
          </Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.useRootKey}
                  onChange={(event) => updateSettings({ useRootKey: event.target.checked })}
                />
              }
              label="Use a single root key for secret text editing"
            />
            {settings.useRootKey ? (
              <TextField
                label="Root key"
                value={settings.rootKey}
                onChange={(event) => updateSettings({ rootKey: event.target.value })}
                helperText="When set, secrets are edited as a single text value stored under this key."
                sx={{ maxWidth: 360 }}
              />
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={settings.confirmDelete}
                  onChange={(event) => updateSettings({ confirmDelete: event.target.checked })}
                />
              }
              label="Ask for confirmation before deleting or revoking"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.diffAnnotations}
                  onChange={(event) => updateSettings({ diffAnnotations: event.target.checked })}
                />
              }
              label="Enable JSON diff annotations in the editor"
            />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Performance
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.capabilityCache}
                onChange={(event) => updateSettings({ capabilityCache: event.target.checked })}
              />
            }
            label="Cache capability lookups in this browser"
          />
          <Divider sx={{ my: 2 }} />
          <Button
            variant="outlined"
            onClick={() => {
              resetCapabilities();
              notify('Capability cache cleared');
            }}
          >
            Clear capability cache
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            About
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vault UI {config.version ? `v${config.version}` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connected to {connection.url || 'no server'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tokens are kept in browser local storage. Prefer short-lived tokens and HTTPS.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="error">
            Session
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Signing out revokes the current token (when permitted) and removes it from this browser.
          </Alert>
          <Button color="error" variant="outlined" onClick={() => setLogoutOpen(true)}>
            Revoke token and sign out
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out"
        description="Revoke the current token and sign out?"
        confirmLabel="Sign out"
        destructive
        onConfirm={async () => {
          await logout();
        }}
        onClose={() => setLogoutOpen(false)}
      />
    </Box>
  );
}
