import { VaultApiError, vaultRequest, unwrap } from './client';
import type { VaultConnection } from './types';

export interface PolicySummary {
  name: string;
  policy: string;
}

/**
 * Vault 0.9+ exposes ACL policies at sys/policies/acl. Older clusters only
 * have sys/policy; the helpers below transparently fall back.
 */
async function withPolicyFallback<T>(modern: () => Promise<T>, legacy: () => Promise<T>): Promise<T> {
  try {
    return await modern();
  } catch (error) {
    if (error instanceof VaultApiError && (error.status === 404 || error.status === 405)) {
      return legacy();
    }
    throw error;
  }
}

export async function listPolicies(connection: VaultConnection, signal?: AbortSignal): Promise<string[]> {
  return withPolicyFallback(
    async () => {
      const response = await vaultRequest<unknown>(connection, 'get', 'sys/policies/acl', {
        query: { list: true },
        signal,
      });
      const payload = unwrap<{ keys?: string[] }>(response);
      return payload?.keys ?? [];
    },
    async () => {
      const response = await vaultRequest<unknown>(connection, 'get', 'sys/policy', { signal });
      const payload = unwrap<{ policies?: string[]; keys?: string[] }>(response);
      return payload?.policies ?? payload?.keys ?? [];
    },
  );
}

export async function readPolicy(
  connection: VaultConnection,
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  return withPolicyFallback(
    async () => {
      const response = await vaultRequest<unknown>(
        connection,
        'get',
        `sys/policies/acl/${encodeURIComponent(name)}`,
        {
          signal,
        },
      );
      const payload = unwrap<{ policy?: string; rules?: string }>(response);
      return payload?.policy ?? payload?.rules ?? '';
    },
    async () => {
      const response = await vaultRequest<unknown>(
        connection,
        'get',
        `sys/policy/${encodeURIComponent(name)}`,
        {
          signal,
        },
      );
      const payload = unwrap<{ policy?: string; rules?: string }>(response);
      return payload?.policy ?? payload?.rules ?? '';
    },
  );
}

export async function writePolicy(connection: VaultConnection, name: string, policy: string): Promise<void> {
  return withPolicyFallback(
    () =>
      vaultRequest(connection, 'put', `sys/policies/acl/${encodeURIComponent(name)}`, {
        data: { policy },
      }),
    () =>
      vaultRequest(connection, 'put', `sys/policy/${encodeURIComponent(name)}`, {
        data: { rules: policy },
      }),
  );
}

export async function deletePolicy(connection: VaultConnection, name: string): Promise<void> {
  return withPolicyFallback(
    () => vaultRequest(connection, 'delete', `sys/policies/acl/${encodeURIComponent(name)}`),
    () => vaultRequest(connection, 'delete', `sys/policy/${encodeURIComponent(name)}`),
  );
}

export const POLICY_TEMPLATE = `# Example policy
path "secret/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/metadata/*" {
  capabilities = ["read", "list", "delete"]
}

path "sys/capabilities-self" {
  capabilities = ["update"]
}
`;
