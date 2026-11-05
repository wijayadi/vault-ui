import { vaultRequest, unwrap } from './client';
import type { VaultConnection } from './types';

const CACHE_KEY = 'vault-ui:capability-cache';

type CapabilityCache = Record<string, string[]>;

function cacheKey(connection: VaultConnection, path: string): string {
  return `${connection.url}|${connection.namespace}|${path.replace(/^\/+/, '')}`;
}

function readCache(): CapabilityCache {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CapabilityCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CapabilityCache): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage can be unavailable in private browsing; caching is optional.
  }
}

export function resetCapabilityCache(): void {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function evaluateCapabilities(granted: string[] | undefined, required: string[]): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes('root')) return true;
  return required.every((capability) => granted.includes(capability));
}

export async function getCapabilities(
  connection: VaultConnection,
  path: string,
  options: { useCache?: boolean; signal?: AbortSignal } = {},
): Promise<string[]> {
  const key = cacheKey(connection, path);
  if (options.useCache !== false) {
    const cached = readCache()[key];
    if (cached) return cached;
  }

  const response = await vaultRequest<{ data: { capabilities: string[] } }>(
    connection,
    'post',
    'sys/capabilities-self',
    { data: { path }, signal: options.signal },
  );
  const capabilities = unwrap<{ capabilities?: string[] }>(response)?.capabilities ?? [];

  const cache = readCache();
  cache[key] = capabilities;
  writeCache(cache);
  return capabilities;
}

export async function tokenHasCapabilities(
  connection: VaultConnection,
  required: string[],
  path: string,
  options: { useCache?: boolean; signal?: AbortSignal } = {},
): Promise<boolean> {
  const capabilities = await getCapabilities(connection, path, options);
  return evaluateCapabilities(capabilities, required);
}

export async function canAccess(
  connection: VaultConnection,
  required: string[],
  path: string,
  options: { useCache?: boolean; signal?: AbortSignal } = {},
): Promise<boolean> {
  try {
    return await tokenHasCapabilities(connection, required, path, options);
  } catch {
    return false;
  }
}
