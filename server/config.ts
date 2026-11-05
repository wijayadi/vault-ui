/**
 * Runtime configuration for the Vault-UI web server.
 *
 * All values can be supplied through environment variables so the container
 * image stays configuration-free. See README.md for the documented list.
 */

const asBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
};

const asNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export interface AppConfig {
  port: number;
  host: string;
  vaultUrlDefault: string;
  vaultUrlDefaultForce: boolean;
  vaultAuthDefault: string;
  vaultAuthDefaultForce: boolean;
  vaultAuthBackendPath: string;
  vaultAuthBackendPathForce: boolean;
  vaultNamespaceDefault: string;
  suppliedTokenHeader: string;
  proxyTimeoutMs: number;
  corsOrigin: string | false;
  serveStatic: boolean;
  trustProxy: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: asNumber(env.PORT, 8000),
    host: env.HOST || '0.0.0.0',
    vaultUrlDefault: env.VAULT_URL_DEFAULT || '',
    vaultUrlDefaultForce: asBoolean(env.VAULT_URL_DEFAULT_FORCE),
    vaultAuthDefault: env.VAULT_AUTH_DEFAULT || 'TOKEN',
    vaultAuthDefaultForce: asBoolean(env.VAULT_AUTH_DEFAULT_FORCE),
    vaultAuthBackendPath: env.VAULT_AUTH_BACKEND_PATH || '',
    vaultAuthBackendPathForce: asBoolean(env.VAULT_AUTH_BACKEND_PATH_FORCE),
    vaultNamespaceDefault: env.VAULT_NAMESPACE_DEFAULT || '',
    suppliedTokenHeader: env.VAULT_SUPPLIED_TOKEN_HEADER || '',
    proxyTimeoutMs: asNumber(env.VAULT_PROXY_TIMEOUT_MS, 60_000),
    corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN : false,
    serveStatic: asBoolean(env.SERVE_STATIC, true),
    trustProxy: asBoolean(env.TRUST_PROXY),
  };
}

export const config = loadConfig();
