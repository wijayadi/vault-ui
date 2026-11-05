import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { JsonEditor } from '../components/common/JsonEditor';
import { CopyButton, copyText } from '../components/common/CopyButton';
import { IS_ELECTRON, normalizeVaultUrl } from '../api/client';
import { unwrapToken } from '../api/wrapping';
import { errorMessage } from '../context/ToastContext';
import { useResolvedThemeMode } from '../context/SettingsContext';

export function UnwrapPage() {
  const [params] = useSearchParams();
  const mode = useResolvedThemeMode();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [vaultUrl, setVaultUrl] = useState(
    params.get('vaultUrl') ?? window.localStorage.getItem('vaultUrl') ?? '',
  );
  const [namespace, setNamespace] = useState(params.get('namespace') ?? '');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doUnwrap = async (overrideToken?: string) => {
    const effectiveToken = overrideToken ?? token;
    if (!effectiveToken) {
      setError('Enter a wrapping token');
      return;
    }
    if (!normalizeVaultUrl(vaultUrl)) {
      setError('Enter the Vault URL');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await unwrapToken(
        { url: normalizeVaultUrl(vaultUrl), token: effectiveToken, namespace },
        effectiveToken,
      );
      setData(result.data);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = params.get('token');
    if (initial) void doUnwrap(initial);
    // Only run for the query token provided when the page is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 2, md: 4 },
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 900 }}>
        <CardContent sx={{ p: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <LockOpenIcon color="primary" />
            <Box>
              <Typography variant="h5">Unwrap data</Typography>
              <Typography variant="body2" color="text.secondary">
                Decode a single-use Vault wrapping token.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, mb: 2 }}>
            <TextField
              label="Wrapping token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
              <TextField
                label="Vault URL"
                value={vaultUrl}
                onChange={(event) => setVaultUrl(event.target.value)}
                fullWidth
              />
              <TextField
                label="Namespace (optional)"
                value={namespace}
                onChange={(event) => setNamespace(event.target.value)}
                fullWidth
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={() => void doUnwrap()} disabled={loading}>
                {loading ? 'Unwrapping…' : 'Unwrap'}
              </Button>
              {data ? <CopyButton value={JSON.stringify(data, null, 2)} label="Copy JSON" /> : null}
            </Box>
          </Box>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {data ? (
            <>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Unwrapped data
              </Typography>
              <JsonEditor value={data} readOnly height={420} dark={mode === 'dark'} />
              <Box sx={{ mt: 1 }}>
                <Button size="small" onClick={() => void copyText(JSON.stringify(data, null, 2))}>
                  Copy to clipboard
                </Button>
              </Box>
            </>
          ) : null}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
            Wrapping tokens are single-use. If unwrapping fails, the token may already have been consumed.
          </Typography>

          {!IS_ELECTRON ? (
            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
              <Link component={RouterLink} to="/login">
                Go to Vault UI
              </Link>
            </Typography>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
