import { vaultRequest, unwrap } from './client';
import type { HealthStatus, MountInfo, VaultConnection } from './types';

interface RawMount {
  type?: string;
  description?: string;
  options?: Record<string, string> | null;
  config?: Record<string, unknown> | null;
  accessor?: string;
  local?: boolean;
  seal_wrap?: boolean;
  external_entropy_access?: boolean;
}

function toMounts(record: Record<string, RawMount> | undefined): MountInfo[] {
  if (!record) return [];
  return Object.entries(record)
    .map(([path, value]) => ({
      path,
      type: value.type ?? 'unknown',
      description: value.description ?? '',
      options: value.options ?? {},
      config: value.config ?? {},
      accessor: value.accessor,
      local: value.local,
      seal_wrap: value.seal_wrap,
      external_entropy_access: value.external_entropy_access,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function listMounts(connection: VaultConnection, signal?: AbortSignal): Promise<MountInfo[]> {
  const response = await vaultRequest<unknown>(connection, 'get', 'sys/mounts', { signal });
  return toMounts(unwrap<Record<string, RawMount>>(response));
}

/** Mounts visible to the current token (Vault 1.10+). */
export async function listVisibleMounts(
  connection: VaultConnection,
  signal?: AbortSignal,
): Promise<{ secrets: MountInfo[]; auth: MountInfo[] }> {
  const response = await vaultRequest<unknown>(connection, 'get', 'sys/internal/ui/mounts', { signal });
  const payload = unwrap<{ secret?: Record<string, RawMount>; auth?: Record<string, RawMount> }>(response);
  return { secrets: toMounts(payload?.secret), auth: toMounts(payload?.auth) };
}

export async function listAuthMounts(
  connection: VaultConnection,
  signal?: AbortSignal,
): Promise<MountInfo[]> {
  const response = await vaultRequest<unknown>(connection, 'get', 'sys/auth', { signal });
  return toMounts(unwrap<Record<string, RawMount>>(response));
}

function mountPath(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

export async function mountSecretEngine(
  connection: VaultConnection,
  path: string,
  type: string,
  options: { description?: string; version?: string; config?: Record<string, unknown> } = {},
): Promise<void> {
  const data: Record<string, unknown> = { type };
  if (options.description) data.description = options.description;
  if (options.config) data.config = options.config;
  if (options.version) data.options = { version: options.version };
  await vaultRequest(connection, 'post', `sys/mounts/${mountPath(path)}`, { data });
}

export async function mountAuthBackend(
  connection: VaultConnection,
  path: string,
  type: string,
  options: { description?: string; config?: Record<string, unknown> } = {},
): Promise<void> {
  const data: Record<string, unknown> = { type };
  if (options.description) data.description = options.description;
  if (options.config) data.config = options.config;
  await vaultRequest(connection, 'post', `sys/auth/${mountPath(path)}`, { data });
}

export async function tuneMount(
  connection: VaultConnection,
  path: string,
  kind: 'secret' | 'auth',
  data: Record<string, unknown>,
): Promise<void> {
  const prefix = kind === 'auth' ? 'sys/auth' : 'sys/mounts';
  await vaultRequest(connection, 'post', `${prefix}/${mountPath(path)}tune`, { data });
}

export async function disableMount(
  connection: VaultConnection,
  path: string,
  kind: 'secret' | 'auth',
): Promise<void> {
  const prefix = kind === 'auth' ? 'sys/auth' : 'sys/mounts';
  await vaultRequest(connection, 'delete', `${prefix}/${mountPath(path)}`);
}

export async function getHealth(connection: VaultConnection, signal?: AbortSignal): Promise<HealthStatus> {
  const health = await vaultRequest<HealthStatus & { errors?: string[] }>(connection, 'get', 'sys/health', {
    signal,
    validateStatus: (status) => status > 0 && status < 600,
  });

  const payload = health as unknown as { sealed?: boolean; errors?: string[] } | null;
  if (!payload || typeof payload !== 'object' || !('sealed' in payload)) {
    throw new Error(payload?.errors?.join(', ') || 'Vault returned an invalid health response');
  }

  return health;
}

export async function sealStatus(connection: VaultConnection, signal?: AbortSignal): Promise<HealthStatus> {
  return vaultRequest<HealthStatus>(connection, 'get', 'sys/seal-status', {
    signal,
    validateStatus: (status) => status > 0 && status < 600,
  });
}

export async function unseal(connection: VaultConnection, key: string): Promise<HealthStatus> {
  return vaultRequest<HealthStatus>(connection, 'post', 'sys/unseal', { data: { key } });
}

export async function seal(connection: VaultConnection): Promise<void> {
  await vaultRequest(connection, 'post', 'sys/seal');
}

export async function getLeader(
  connection: VaultConnection,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return vaultRequest<Record<string, unknown>>(connection, 'get', 'sys/leader', { signal });
}
