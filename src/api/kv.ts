import { vaultRequest, unwrap } from './client';
import type { JsonObject, MountInfo, SecretReadResult, VaultConnection } from './types';

export const KV_MOUNT_TYPES = new Set(['kv', 'generic']);

export function isKvMount(mount: MountInfo): boolean {
  return KV_MOUNT_TYPES.has(mount.type);
}

export function kvVersion(mount: MountInfo): 1 | 2 {
  return mount.options?.version === '2' ? 2 : 1;
}

export function joinLogicalPath(...segments: string[]): string {
  return segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

export function normalizeLogicalPath(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  return trimmed.endsWith('/') || trimmed === '' ? trimmed : trimmed;
}

export function isDirectoryPath(path: string): boolean {
  return path === '' || path.endsWith('/');
}

export function kvDataPath(mount: MountInfo, logicalPath: string): string {
  const relative = logicalPath.replace(/^\/+/, '');
  return kvVersion(mount) === 2
    ? joinLogicalPath(mount.path, 'data', relative)
    : joinLogicalPath(mount.path, relative);
}

export function kvMetadataPath(mount: MountInfo, logicalPath: string): string {
  const relative = logicalPath.replace(/^\/+/, '');
  return joinLogicalPath(mount.path, kvVersion(mount) === 2 ? 'metadata' : '', relative);
}

export function kvDeletePath(
  mount: MountInfo,
  logicalPath: string,
  action: 'delete' | 'undelete' | 'destroy',
): string {
  const relative = logicalPath.replace(/^\/+/, '');
  return joinLogicalPath(mount.path, action, relative);
}

export async function listSecrets(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const path = kvMetadataPath(mount, logicalPath);
  const response = await vaultRequest<unknown>(connection, 'get', path, {
    query: { list: true },
    signal,
  });
  const payload = unwrap<{ keys?: string[] }>(response);
  return Array.isArray(payload?.keys) ? payload.keys : [];
}

export async function readSecret(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  version?: number,
  signal?: AbortSignal,
): Promise<SecretReadResult> {
  const path = kvDataPath(mount, logicalPath);
  const query: Record<string, unknown> = {};
  if (kvVersion(mount) === 2 && version) query.version = version;

  const response = await vaultRequest<unknown>(connection, 'get', path, { query, signal });

  if (kvVersion(mount) === 2) {
    const payload = unwrap<{
      data?: Record<string, unknown>;
      metadata?: SecretReadResult['metadata'];
    }>(response);
    return {
      data: payload?.data ?? {},
      metadata: payload?.metadata ?? null,
      version: payload?.metadata?.version ?? version ?? null,
    };
  }

  return {
    data: unwrap<Record<string, unknown>>(response) ?? {},
    metadata: null,
    version: null,
  };
}

export async function readSecretMetadata(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  signal?: AbortSignal,
): Promise<SecretReadResult['metadata']> {
  if (kvVersion(mount) !== 2) return null;
  const response = await vaultRequest<unknown>(connection, 'get', kvMetadataPath(mount, logicalPath), {
    signal,
  });
  return unwrap<SecretReadResult['metadata']>(response) ?? null;
}

export async function writeSecret(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  data: JsonObject,
  options: { cas?: number; customMetadata?: Record<string, string> } = {},
): Promise<void> {
  if (kvVersion(mount) === 2) {
    const payload: JsonObject = { data };
    if (options.cas !== undefined) payload.options = { cas: options.cas };
    await vaultRequest(connection, 'post', kvDataPath(mount, logicalPath), { data: payload });
    if (options.customMetadata) {
      await vaultRequest(connection, 'post', kvMetadataPath(mount, logicalPath), {
        data: { custom_metadata: options.customMetadata },
      });
    }
    return;
  }

  await vaultRequest(connection, 'post', kvDataPath(mount, logicalPath), { data });
}

export async function deleteSecret(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  versions?: number[],
): Promise<void> {
  if (kvVersion(mount) === 2) {
    await vaultRequest(connection, 'post', kvDeletePath(mount, logicalPath, 'delete'), {
      data: versions?.length ? { versions } : {},
    });
    return;
  }
  await vaultRequest(connection, 'delete', kvDataPath(mount, logicalPath));
}

export async function undeleteSecret(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  versions: number[],
): Promise<void> {
  await vaultRequest(connection, 'post', kvDeletePath(mount, logicalPath, 'undelete'), {
    data: { versions },
  });
}

export async function destroySecret(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  versions: number[],
): Promise<void> {
  await vaultRequest(connection, 'post', kvDeletePath(mount, logicalPath, 'destroy'), { data: { versions } });
}

export async function updateSecretMetadata(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
  metadata: {
    max_versions?: number;
    cas_required?: boolean;
    delete_version_after?: string;
    custom_metadata?: Record<string, string> | null;
  },
): Promise<void> {
  await vaultRequest(connection, 'post', kvMetadataPath(mount, logicalPath), { data: metadata });
}

export async function deleteSecretMetadata(
  connection: VaultConnection,
  mount: MountInfo,
  logicalPath: string,
): Promise<void> {
  await vaultRequest(connection, 'delete', kvMetadataPath(mount, logicalPath));
}
