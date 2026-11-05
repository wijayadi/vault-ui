import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../context/ToastContext';

export function OidcCallbackPage() {
  const [params] = useSearchParams();
  const { completeOidc } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    // With the hash router the identity provider may append the response
    // before the fragment (`?code=...#/oidc/callback`) rather than inside it.
    const outer = new URLSearchParams(window.location.search);
    const code = params.get('code') ?? outer.get('code');
    const state = params.get('state') ?? outer.get('state');
    const oidcError =
      params.get('error_description') ??
      outer.get('error_description') ??
      params.get('error') ??
      outer.get('error');

    if (oidcError) {
      setError(oidcError);
      return;
    }
    if (!code || !state) {
      setError('The identity provider did not return an authorization code.');
      return;
    }

    completeOidc(code, state).catch((reason) => setError(errorMessage(reason)));
  }, [params, completeOidc]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Box sx={{ maxWidth: 520, textAlign: 'center' }}>
        {error ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Link component={RouterLink} to="/login">
              Return to sign in
            </Link>
          </>
        ) : (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>Completing sign in…</Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
