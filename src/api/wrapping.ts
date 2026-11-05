import { vaultRequest, unwrap } from './client';
import type { VaultConnection, WrapInfo } from './types';

export async function wrapData(
  connection: VaultConnection,
  data: Record<string, unknown>,
  ttl: string,
): Promise<WrapInfo> {
  const response = await vaultRequest<{ wrap_info?: WrapInfo }>(connection, 'post', 'sys/wrapping/wrap', {
    data,
    headers: { 'X-Vault-Wrap-TTL': ttl },
  });
  if (!response.wrap_info) throw new Error('Vault did not return wrap information');
  return response.wrap_info;
}

export async function wrapExisting(
  connection: VaultConnection,
  path: string,
  ttl: string,
): Promise<WrapInfo> {
  const response = await vaultRequest<{ wrap_info?: WrapInfo }>(connection, 'get', path, {
    headers: { 'X-Vault-Wrap-TTL': ttl },
  });
  if (!response.wrap_info) throw new Error('Vault did not return wrap information');
  return response.wrap_info;
}

export async function unwrapToken(
  connection: VaultConnection,
  token: string,
): Promise<{ data: Record<string, unknown>; wrapInfo?: WrapInfo | null }> {
  const response = await vaultRequest<{ data?: Record<string, unknown>; wrap_info?: WrapInfo | null }>(
    { ...connection, token },
    'post',
    'sys/wrapping/unwrap',
  );
  if (response.data) return { data: response.data, wrapInfo: response.wrap_info };
  return { data: unwrap<Record<string, unknown>>(response) ?? {}, wrapInfo: response.wrap_info };
}

export async function rewrap(connection: VaultConnection, token: string, ttl: string): Promise<WrapInfo> {
  const response = await vaultRequest<{ wrap_info?: WrapInfo }>(connection, 'post', 'sys/wrapping/rewrap', {
    data: { token },
    headers: { 'X-Vault-Wrap-TTL': ttl },
  });
  if (!response.wrap_info) throw new Error('Vault did not return wrap information');
  return response.wrap_info;
}
