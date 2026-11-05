import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LockIcon from '@mui/icons-material/Lock';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from '../context/AuthContext';
import { LOGIN_METHODS, getLoginMethod } from '../config/loginMethods';
import type { LoginMethodType } from '../api/auth';
import { isValidVaultUrl, normalizeVaultUrl } from '../api/client';
import { errorMessage } from '../context/ToastContext';

interface Credentials {
  token: string;
  username: string;
  password: string;
  roleId: string;
  secretId: string;
  role: string;
  jwt: string;
  awsValue: string;
  awsLoginType: 'iam' | 'ec2';
}

const emptyCredentials: Credentials = {
  token: '',
  username: '',
  password: '',
  roleId: '',
  secretId: '',
  role: '',
  jwt: '',
  awsValue: '',
  awsLoginType: 'iam',
};

export function LoginPage() {
  const { config, connection, initialized, loading, login } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState(connection.url);
  const [namespace, setNamespace] = useState(connection.namespace);
  const [method, setMethod] = useState<LoginMethodType>(
    (config.defaultAuthMethod as LoginMethodType) || 'TOKEN',
  );
  const [backendPath, setBackendPath] = useState(config.defaultBackendPath || '');
  const [backendTouched, setBackendTouched] = useState(Boolean(config.defaultBackendPath));
  const [credentials, setCredentials] = useState<Credentials>(emptyCredentials);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const methodDef = useMemo(() => getLoginMethod(method) ?? LOGIN_METHODS[0], [method]);

  useEffect(() => {
    setUrl((current) => current || config.defaultVaultUrl);
    setNamespace((current) => current || config.defaultNamespace);
    if (config.defaultAuthMethod) setMethod(getLoginMethod(config.defaultAuthMethod)?.id ?? 'TOKEN');
    if (config.defaultBackendPath) {
      setBackendPath(config.defaultBackendPath);
      setBackendTouched(true);
    }
  }, [config]);

  useEffect(() => {
    if (initialized && connection.token) navigate('/', { replace: true });
  }, [initialized, connection.token, navigate]);

  useEffect(() => {
    if (!backendTouched) setBackendPath(methodDef.defaultPath);
  }, [methodDef, backendTouched]);

  const updateCredential = <K extends keyof Credentials>(key: K, value: Credentials[K]) => {
    setCredentials((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const targetUrl = normalizeVaultUrl(url);
    if (!isValidVaultUrl(targetUrl)) {
      setFormError('Enter a Vault URL including http:// or https://');
      return;
    }

    const path = (backendPath || methodDef.defaultPath).replace(/^\/+|\/+$/g, '');
    if (!path) {
      setFormError('Enter the auth backend mount path');
      return;
    }

    if (methodDef.fields.includes('token') && method === 'GITHUB' && !credentials.token) {
      setFormError('Enter a GitHub token');
      return;
    }
    if (methodDef.fields.includes('token') && method === 'TOKEN' && !credentials.token) {
      setFormError('Enter a Vault token');
      return;
    }
    if (methodDef.fields.includes('username') && !credentials.username) {
      setFormError('Enter a username');
      return;
    }
    if (methodDef.fields.includes('password') && !credentials.password) {
      setFormError('Enter a password');
      return;
    }

    try {
      const result = await login({
        method,
        backendPath: path,
        url: targetUrl,
        namespace,
        credentials: {
          token: credentials.token,
          username: credentials.username,
          password: credentials.password,
          roleId: credentials.roleId,
          secretId: credentials.secretId,
          role: credentials.role,
          jwt: credentials.jwt,
          awsValue: credentials.awsValue,
          awsLoginType: credentials.awsLoginType,
        },
      });

      if (result.authUrl) {
        window.location.assign(result.authUrl);
        return;
      }
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const renderField = (field: string) => {
    switch (field) {
      case 'token':
        return (
          <TextField
            key="token"
            label={method === 'GITHUB' ? 'GitHub token' : 'Vault token'}
            type="password"
            value={credentials.token}
            onChange={(event) => updateCredential('token', event.target.value)}
            autoFocus
            fullWidth
            autoComplete="off"
          />
        );
      case 'username':
        return (
          <TextField
            key="username"
            label="Username"
            value={credentials.username}
            onChange={(event) => updateCredential('username', event.target.value)}
            autoFocus
            fullWidth
            autoComplete="username"
          />
        );
      case 'password':
        return (
          <TextField
            key="password"
            label="Password"
            type="password"
            value={credentials.password}
            onChange={(event) => updateCredential('password', event.target.value)}
            fullWidth
            autoComplete="current-password"
          />
        );
      case 'roleId':
        return (
          <TextField
            key="roleId"
            label="Role ID"
            value={credentials.roleId}
            onChange={(event) => updateCredential('roleId', event.target.value)}
            fullWidth
            autoFocus
          />
        );
      case 'secretId':
        return (
          <TextField
            key="secretId"
            label="Secret ID"
            type="password"
            value={credentials.secretId}
            onChange={(event) => updateCredential('secretId', event.target.value)}
            fullWidth
          />
        );
      case 'role':
        return (
          <TextField
            key="role"
            label="Role (optional)"
            value={credentials.role}
            onChange={(event) => updateCredential('role', event.target.value)}
            fullWidth
          />
        );
      case 'jwt':
        return (
          <TextField
            key="jwt"
            label="JWT"
            value={credentials.jwt}
            onChange={(event) => updateCredential('jwt', event.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
        );
      case 'awsValue':
        return (
          <Box key="awsValue" sx={{ display: 'grid', gap: 2 }}>
            <TextField
              select
              label="AWS login type"
              value={credentials.awsLoginType}
              onChange={(event) => updateCredential('awsLoginType', event.target.value as 'iam' | 'ec2')}
            >
              <MenuItem value="iam">IAM signed request</MenuItem>
              <MenuItem value="ec2">EC2 PKCS7 identity document</MenuItem>
            </TextField>
            <TextField
              label={
                credentials.awsLoginType === 'iam'
                  ? 'Signed STS GetCallerIdentity request'
                  : 'PKCS7 identity document'
              }
              value={credentials.awsValue}
              onChange={(event) => updateCredential('awsValue', event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background:
          'radial-gradient(circle at 20% 20%, rgba(26,75,140,0.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(180,83,9,0.18), transparent 40%), var(--mui-palette-background-default)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 560, boxShadow: 8 }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <LockIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="h4">Vault UI</Typography>
              <Typography variant="body2" color="text.secondary">
                A modern interface for HashiCorp Vault
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box
            component="form"
            onSubmit={(event) => void handleSubmit(event)}
            sx={{ display: 'grid', gap: 2 }}
          >
            <TextField
              label="Vault URL"
              placeholder="https://vault.example.com:8200"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={Boolean(config.defaultVaultUrlForce)}
              helperText={
                config.defaultVaultUrlForce
                  ? 'This Vault URL is enforced by the server administrator.'
                  : 'The address of your Vault server, including the protocol.'
              }
              fullWidth
              required
            />
            <TextField
              select
              label="Authentication method"
              value={method}
              onChange={(event) => {
                const next = event.target.value as LoginMethodType;
                setMethod(next);
                setBackendTouched(false);
                setCredentials(emptyCredentials);
                setFormError('');
              }}
              disabled={Boolean(config.defaultAuthMethodForce)}
              fullWidth
            >
              {LOGIN_METHODS.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {methodDef.fields.map(renderField)}

            {methodDef.oidc ? (
              <Alert severity="info">
                Continue to your identity provider. After signing in you will be redirected back to Vault UI.
              </Alert>
            ) : null}

            <Button
              type="button"
              size="small"
              endIcon={<ExpandMoreIcon sx={{ transform: advancedOpen ? 'rotate(180deg)' : 'none' }} />}
              onClick={() => setAdvancedOpen((value) => !value)}
              sx={{ justifySelf: 'start', px: 0 }}
            >
              Advanced options
            </Button>
            <Collapse in={advancedOpen}>
              <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
                <TextField
                  label="Auth backend path"
                  value={backendPath}
                  onChange={(event) => {
                    setBackendPath(event.target.value);
                    setBackendTouched(true);
                  }}
                  disabled={Boolean(config.defaultBackendPathForce)}
                  helperText={
                    config.defaultBackendPathForce
                      ? 'The server administrator enforces this backend path.'
                      : 'Mount path of the auth method, for example github or userpass.'
                  }
                  fullWidth
                />
                <TextField
                  label="Vault namespace"
                  value={namespace}
                  onChange={(event) => setNamespace(event.target.value)}
                  helperText="Optional Enterprise namespace (X-Vault-Namespace)."
                  fullWidth
                />
              </Box>
            </Collapse>

            {formError ? <Alert severity="error">{formError}</Alert> : null}

            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? 'Signing in…' : methodDef.oidc ? 'Continue to identity provider' : 'Sign in'}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
            Tokens are stored in this browser's local storage and sent directly to Vault. Use HTTPS in
            production.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
