import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import HandymanIcon from '@mui/icons-material/Handyman';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useResolvedThemeMode } from '../context/SettingsContext';
import { IS_ELECTRON } from '../api/client';
import { rewrap, unwrapToken, wrapData } from '../api/wrapping';
import { JsonEditor } from '../components/common/JsonEditor';
import { CopyButton } from '../components/common/CopyButton';
import { errorMessage } from '../context/ToastContext';
import type { WrapInfo } from '../api/types';

const DEFAULT_DATA = {
  username: 'demo',
  password: 'change-me',
};

export function ToolsPage() {
  const { connection } = useAuth();
  const { notify, notifyError } = useToast();
  const mode = useResolvedThemeMode();
  const [tab, setTab] = useState('wrap');

  const [wrapValues, setWrapValues] = useState<Record<string, unknown>>(DEFAULT_DATA);
  const [wrapValid, setWrapValid] = useState(true);
  const [wrapTtl, setWrapTtl] = useState('5m');
  const [wrapInfo, setWrapInfo] = useState<WrapInfo | null>(null);

  const [unwrapValue, setUnwrapValue] = useState('');
  const [unwrapped, setUnwrapped] = useState<Record<string, unknown> | null>(null);
  const [unwrapError, setUnwrapError] = useState('');

  const [rewrapValue, setRewrapValue] = useState('');
  const [rewrapTtl, setRewrapTtl] = useState('5m');
  const [rewrapped, setRewrapped] = useState<WrapInfo | null>(null);

  const [busy, setBusy] = useState(false);

  const wrapUrl = (token: string) => {
    const vaultUrl = encodeURIComponent(connection.url);
    if (IS_ELECTRON) {
      return `vaultui://#/unwrap~token=${token}&vaultUrl=${vaultUrl}`;
    }
    return `${window.location.origin}/unwrap?token=${encodeURIComponent(token)}&vaultUrl=${vaultUrl}`;
  };

  const doWrap = async () => {
    if (!wrapValid) {
      notifyError(new Error('The JSON is not valid'));
      return;
    }
    setBusy(true);
    try {
      const info = await wrapData(connection, wrapValues, wrapTtl);
      setWrapInfo(info);
      notify('Data wrapped');
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  const doUnwrap = async () => {
    if (!unwrapValue) {
      setUnwrapError('Enter a wrapping token');
      return;
    }
    setBusy(true);
    setUnwrapError('');
    try {
      const result = await unwrapToken({ ...connection, token: unwrapValue }, unwrapValue);
      setUnwrapped(result.data);
      notify('Token unwrapped');
    } catch (error) {
      setUnwrapError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const doRewrap = async () => {
    if (!rewrapValue) {
      notifyError(new Error('Enter a wrapping token'));
      return;
    }
    setBusy(true);
    try {
      const info = await rewrap(connection, rewrapValue, rewrapTtl);
      setRewrapped(info);
      notify('Token rewrapped');
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HandymanIcon color="primary" />
        <Typography variant="h4">Wrap / unwrap</Typography>
      </Box>

      <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
        <Tab value="wrap" label="Wrap data" />
        <Tab value="unwrap" label="Unwrap token" />
        <Tab value="rewrap" label="Rewrap" />
      </Tabs>

      {tab === 'wrap' ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wrapping creates a single-use token that can be exchanged for the data by another client. The
              response token is displayed only once.
            </Typography>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField
                label="Wrap TTL"
                value={wrapTtl}
                onChange={(event) => setWrapTtl(event.target.value)}
                helperText="Examples: 5m, 1h, 24h. Limited by the token's max TTL."
                sx={{ maxWidth: 260 }}
              />
              <JsonEditor
                value={wrapValues}
                onChange={(value, valid) => {
                  setWrapValues((value ?? {}) as Record<string, unknown>);
                  setWrapValid(valid);
                }}
                height={320}
                dark={mode === 'dark'}
              />
              <Box>
                <Button variant="contained" onClick={() => void doWrap()} disabled={busy}>
                  Wrap data
                </Button>
              </Box>
            </Box>

            {wrapInfo ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Wrapping token
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="caption"
                    className="monospace"
                    sx={{ wordBreak: 'break-all', flex: 1 }}
                  >
                    {wrapInfo.token}
                  </Typography>
                  <CopyButton value={wrapInfo.token} label="Copy token" />
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Shareable URL
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="caption"
                    className="monospace"
                    sx={{ wordBreak: 'break-all', flex: 1 }}
                  >
                    {wrapUrl(wrapInfo.token)}
                  </Typography>
                  <CopyButton value={wrapUrl(wrapInfo.token)} label="Copy URL" />
                </Box>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : tab === 'unwrap' ? (
        <Card>
          <CardContent>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField
                label="Wrapping token"
                value={unwrapValue}
                onChange={(event) => setUnwrapValue(event.target.value)}
                fullWidth
              />
              <Box>
                <Button variant="contained" onClick={() => void doUnwrap()} disabled={busy}>
                  Unwrap
                </Button>
              </Box>
              {unwrapError ? <Alert severity="error">{unwrapError}</Alert> : null}
              {unwrapped ? (
                <>
                  <Typography variant="subtitle1">Unwrapped data</Typography>
                  <JsonEditor value={unwrapped} readOnly height={360} dark={mode === 'dark'} />
                  <Box>
                    <CopyButton value={JSON.stringify(unwrapped, null, 2)} label="Copy JSON" />
                  </Box>
                </>
              ) : null}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Rewrap exchanges a wrapping token for a new wrapping token with a fresh TTL, without exposing
                the wrapped data.
              </Typography>
              <TextField
                label="Wrapping token"
                value={rewrapValue}
                onChange={(event) => setRewrapValue(event.target.value)}
                fullWidth
              />
              <TextField
                label="New wrap TTL"
                value={rewrapTtl}
                onChange={(event) => setRewrapTtl(event.target.value)}
                sx={{ maxWidth: 260 }}
              />
              <Box>
                <Button variant="contained" onClick={() => void doRewrap()} disabled={busy}>
                  Rewrap
                </Button>
              </Box>
              {rewrapped ? (
                <Alert severity="success">
                  <Typography variant="caption" className="monospace" sx={{ wordBreak: 'break-all' }}>
                    {rewrapped.token}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <CopyButton value={rewrapped.token} label="Copy new token" />
                  </Box>
                </Alert>
              ) : null}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
