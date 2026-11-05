import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { Method } from 'axios';
import { builtInConfig, loadServerConfig } from '../api/config';
import {
  IS_ELECTRON,
  VaultApiError,
  normalizeVaultUrl,
  vaultRequest,
  type VaultRequestOptions,
} from '../api/client';
import {
  completeOidcLogin,
  login as loginRequest,
  lookupSelf,
  renewSelf,
  revokeSelf,
  type LoginCredentials,
  type LoginMethodType,
} from '../api/auth';
import { getHealth } from '../api/system';
import { resetCapabilityCache, tokenHasCapabilities } from '../api/capabilities';
import type { HealthStatus, ServerConfig, TokenIdentity, VaultConnection } from '../api/types';
import { useToast } from './ToastContext';
import { useSettings } from './SettingsContext';

const CONNECTION_KEY = 'vault-ui:connection';
const LEGACY_TOKEN_KEY = 'vaultAccessToken';
const LEGACY_URL_KEY = 'vaultUrl';
const OIDC_PENDING_KEY = 'vault-ui:oidc-pending';

interface StoredOidcPending {
  url: string;
  namespace: string;
  backendPath: string;
  method: LoginMethodType;
}

export interface LoginOptions {
  method: LoginMethodType;
  backendPath: string;
  credentials: LoginCredentials;
  url?: string;
  namespace?: string;
}

interface AuthContextValue {
  config: ServerConfig;
  connection: VaultConnection;
  identity: TokenIdentity | null;
  health: HealthStatus | null;
  initialized: boolean;
  loading: boolean;
  login: (options: LoginOptions) => Promise<{ authUrl?: string }>;
  completeOidc: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  renew: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  updateConnection: (patch: { url?: string; namespace?: string; timeoutMs?: number }) => void;
  hasCapabilities: (required: string[], path: string) => Promise<boolean>;
  request: <T = unknown>(method: Method, path: string, options?: VaultRequestOptions) => Promise<T>;
  resetCapabilities: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredConnection(): Partial<VaultConnection> {
  try {
    const raw = window.localStorage.getItem(CONNECTION_KEY);
    if (raw) return JSON.parse(raw) as Partial<VaultConnection>;
  } catch {
    // fall through to legacy keys
  }

  return {
    token: window.localStorage.getItem(LEGACY_TOKEN_KEY) ?? '',
    url: window.localStorage.getItem(LEGACY_URL_KEY) ?? '',
  };
}

function persistConnection(connection: VaultConnection): void {
  try {
    window.localStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
    // Keep the legacy keys in sync for older builds/tools.
    window.localStorage.setItem(LEGACY_TOKEN_KEY, connection.token);
    window.localStorage.setItem(LEGACY_URL_KEY, connection.url);
  } catch {
    // Storage is optional.
  }
}

function clearStoredConnection(): void {
  try {
    window.localStorage.removeItem(CONNECTION_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore
  }
}

function redirectUri(): string {
  if (IS_ELECTRON) return `${window.location.origin}${window.location.pathname}#/oidc/callback`;
  return `${window.location.origin}/oidc/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { notify, notifyError } = useToast();
  const { settings } = useSettings();
  const [config, setConfig] = useState<ServerConfig>(builtInConfig);
  const [connection, setConnection] = useState<VaultConnection>({
    url: '',
    token: '',
    namespace: '',
    timeoutMs: 60_000,
  });
  const [identity, setIdentity] = useState<TokenIdentity | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const connectionRef = useRef(connection);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const applyConnection = useCallback((next: VaultConnection) => {
    setConnection(next);
    persistConnection(next);
  }, []);

  const refreshHealth = useCallback(async () => {
    const current = connectionRef.current;
    if (!current.url) return;
    try {
      const status = await getHealth(current);
      setHealth(status);
    } catch {
      setHealth(null);
    }
  }, []);

  const refreshIdentity = useCallback(async () => {
    const current = connectionRef.current;
    if (!current.url || !current.token) return;
    const nextIdentity = await lookupSelf(current);
    setIdentity(nextIdentity);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const serverConfig = await loadServerConfig();
      if (cancelled) return;

      const stored = readStoredConnection();
      const url = normalizeVaultUrl(
        serverConfig.defaultVaultUrlForce
          ? serverConfig.defaultVaultUrl
          : stored.url || serverConfig.defaultVaultUrl || '',
      );
      const namespace = stored.namespace ?? serverConfig.defaultNamespace ?? '';
      const suppliedToken = serverConfig.suppliedAuthToken || '';
      const token = stored.token || suppliedToken;

      const initial: VaultConnection = {
        url,
        token,
        namespace,
        timeoutMs: stored.timeoutMs ?? 60_000,
      };

      setConfig(serverConfig);
      setConnection(initial);
      connectionRef.current = initial;

      if (url && token) {
        try {
          const nextIdentity = await lookupSelf(initial);
          if (cancelled) return;
          setIdentity(nextIdentity);
          persistConnection(initial);
          const status = await getHealth(initial).catch(() => null);
          if (!cancelled) setHealth(status);
        } catch (error) {
          if (cancelled) return;
          const rejected =
            error instanceof VaultApiError &&
            (error.status === 400 || error.status === 401 || error.status === 403);

          if (rejected) {
            clearStoredConnection();
            const signedOut = { ...initial, token: '' };
            connectionRef.current = signedOut;
            setConnection(signedOut);
            setIdentity(null);
          } else {
            // A network outage should not destroy a still-valid token.
            persistConnection(initial);
          }
        }
      }

      if (!cancelled) setInitialized(true);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (options: LoginOptions): Promise<{ authUrl?: string }> => {
      const base = connectionRef.current;
      const target: VaultConnection = {
        ...base,
        url: normalizeVaultUrl(options.url ?? base.url),
        namespace: options.namespace ?? base.namespace,
        token: '',
      };

      setLoading(true);
      try {
        const result = await loginRequest(
          target,
          options.method,
          options.backendPath,
          options.credentials,
          redirectUri(),
        );

        if (result.authUrl) {
          const pending: StoredOidcPending = {
            url: target.url,
            namespace: target.namespace,
            backendPath: options.backendPath,
            method: options.method,
          };
          window.localStorage.setItem(OIDC_PENDING_KEY, JSON.stringify(pending));
          return { authUrl: result.authUrl };
        }

        if (!result.token) throw new Error('Vault did not return a client token');

        const authenticated: VaultConnection = { ...target, token: result.token };
        const nextIdentity = await lookupSelf(authenticated);

        applyConnection(authenticated);
        connectionRef.current = authenticated;
        setIdentity(nextIdentity);
        resetCapabilityCache();
        await refreshHealth();
        notify('Signed in to Vault');
        return {};
      } catch (error) {
        notifyError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [applyConnection, notify, notifyError, refreshHealth],
  );

  const completeOidc = useCallback(
    async (code: string, state: string): Promise<void> => {
      const raw = window.localStorage.getItem(OIDC_PENDING_KEY);
      if (!raw) throw new Error('OIDC login session not found. Please sign in again.');
      const pending = JSON.parse(raw) as StoredOidcPending;

      setLoading(true);
      try {
        const target: VaultConnection = {
          url: pending.url,
          namespace: pending.namespace,
          token: '',
        };
        const result = await completeOidcLogin(target, pending.backendPath, code, state);
        if (!result.token) throw new Error('Vault did not return a client token');

        const authenticated = { ...target, token: result.token };
        const nextIdentity = await lookupSelf(authenticated);
        applyConnection(authenticated);
        connectionRef.current = authenticated;
        setIdentity(nextIdentity);
        resetCapabilityCache();
        await refreshHealth();
        window.localStorage.removeItem(OIDC_PENDING_KEY);
        notify('Signed in to Vault');
        navigate('/');
      } catch (error) {
        notifyError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [applyConnection, navigate, notify, notifyError, refreshHealth],
  );

  const logout = useCallback(async () => {
    const current = connectionRef.current;
    if (current.url && current.token) {
      await revokeSelf(current).catch(() => undefined);
    }
    clearStoredConnection();
    resetCapabilityCache();
    const signedOut = { ...connectionRef.current, token: '' };
    connectionRef.current = signedOut;
    setConnection(signedOut);
    setIdentity(null);
    setHealth(null);
    navigate('/login');
  }, [navigate]);

  const renew = useCallback(async () => {
    await renewSelf(connectionRef.current);
    await refreshIdentity();
    await refreshHealth();
    notify('Token lease renewed');
  }, [notify, refreshHealth, refreshIdentity]);

  const updateConnection = useCallback(
    (patch: { url?: string; namespace?: string; timeoutMs?: number }) => {
      const prev = connectionRef.current;
      const url = patch.url !== undefined ? normalizeVaultUrl(patch.url) : prev.url;
      const urlChanged = url !== prev.url;
      const next: VaultConnection = {
        ...prev,
        url,
        namespace: patch.namespace !== undefined ? patch.namespace : prev.namespace,
        timeoutMs: patch.timeoutMs ?? prev.timeoutMs,
        token: urlChanged ? '' : prev.token,
      };

      applyConnection(next);
      connectionRef.current = next;
      if (urlChanged) {
        setIdentity(null);
        setHealth(null);
      }
    },
    [applyConnection],
  );

  const request = useCallback(
    <T,>(method: Method, path: string, options: VaultRequestOptions = {}) =>
      vaultRequest<T>(connectionRef.current, method, path, options),
    [],
  );

  const hasCapabilities = useCallback(
    (required: string[], path: string) =>
      tokenHasCapabilities(connectionRef.current, required, path, {
        useCache: settings.capabilityCache,
      }),
    [settings.capabilityCache],
  );

  const resetCapabilities = useCallback(() => resetCapabilityCache(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      config,
      connection,
      identity,
      health,
      initialized,
      loading,
      login,
      completeOidc,
      logout,
      renew,
      refreshIdentity,
      refreshHealth,
      updateConnection,
      hasCapabilities,
      request,
      resetCapabilities,
    }),
    [
      config,
      connection,
      identity,
      health,
      initialized,
      loading,
      login,
      completeOidc,
      logout,
      renew,
      refreshIdentity,
      refreshHealth,
      updateConnection,
      hasCapabilities,
      request,
      resetCapabilities,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
