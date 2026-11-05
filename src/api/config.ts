import axios from 'axios';
import type { ServerConfig } from './types';
import { IS_ELECTRON } from './client';

const env = import.meta.env;

/** Defaults baked into the bundle. Mostly useful for the desktop build. */
export const builtInConfig: ServerConfig = {
  version: env.VITE_APP_VERSION,
  defaultVaultUrl: env.VITE_VAULT_URL_DEFAULT ?? '',
  defaultVaultUrlForce: false,
  defaultAuthMethod: env.VITE_VAULT_AUTH_DEFAULT ?? 'TOKEN',
  defaultAuthMethodForce: false,
  defaultBackendPath: env.VITE_VAULT_AUTH_BACKEND_PATH ?? '',
  defaultBackendPathForce: false,
  defaultNamespace: env.VITE_VAULT_NAMESPACE_DEFAULT ?? '',
  suppliedAuthToken: '',
};

/**
 * Loads deployment defaults. The web build asks the Node server (which reads
 * environment variables); the desktop build has no server and uses compiled
 * defaults or values persisted in localStorage.
 */
export async function loadServerConfig(): Promise<ServerConfig> {
  if (IS_ELECTRON) return builtInConfig;

  try {
    const response = await axios.get<ServerConfig>('/api/config', { timeout: 10_000 });
    return { ...builtInConfig, ...response.data };
  } catch {
    try {
      // Older deployments expose the same payload at /vaultui.
      const response = await axios.get<ServerConfig>('/vaultui', { timeout: 10_000 });
      return { ...builtInConfig, ...response.data };
    } catch {
      return builtInConfig;
    }
  }
}
