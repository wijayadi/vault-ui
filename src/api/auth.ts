import { vaultRequest, unwrap } from './client';
import type { AuthInfo, TokenIdentity, VaultConnection } from './types';

export type LoginMethodType =
  'TOKEN' | 'USERPASSWORD' | 'LDAP' | 'OKTA' | 'GITHUB' | 'APPROLE' | 'JWT' | 'OIDC' | 'AWS' | 'KUBERNETES';

export interface LoginCredentials {
  username?: string;
  password?: string;
  roleId?: string;
  secretId?: string;
  role?: string;
  jwt?: string;
  token?: string;
  awsLoginType?: 'iam' | 'ec2';
  awsValue?: string;
}

export interface LoginResult {
  token: string;
  auth?: AuthInfo;
  authUrl?: string;
}

function loginPath(basePath: string, suffix = ''): string {
  const path = basePath.replace(/^\/+|\/+$/g, '');
  return `auth/${path}${suffix}`;
}

export async function login(
  connection: VaultConnection,
  method: LoginMethodType,
  backendPath: string,
  credentials: LoginCredentials,
  redirectUri?: string,
): Promise<LoginResult> {
  switch (method) {
    case 'TOKEN': {
      const token = credentials.token ?? connection.token;
      const identity = await vaultRequest<unknown>(
        { ...connection, token },
        'get',
        loginPath(backendPath, '/lookup-self'),
      );
      void identity;
      return { token };
    }
    case 'GITHUB': {
      const response = await vaultRequest<{ auth?: AuthInfo }>(
        connection,
        'post',
        loginPath(backendPath, '/login'),
        {
          data: { token: credentials.token },
        },
      );
      return { token: response.auth?.client_token ?? '', auth: response.auth };
    }
    case 'USERPASSWORD':
    case 'LDAP':
    case 'OKTA': {
      const response = await vaultRequest<{ auth?: AuthInfo }>(
        connection,
        'post',
        loginPath(backendPath, `/login/${encodeURIComponent(credentials.username ?? '')}`),
        { data: { password: credentials.password } },
      );
      return { token: response.auth?.client_token ?? '', auth: response.auth };
    }
    case 'APPROLE': {
      const response = await vaultRequest<{ auth?: AuthInfo }>(
        connection,
        'post',
        loginPath(backendPath, '/login'),
        {
          data: { role_id: credentials.roleId, secret_id: credentials.secretId },
        },
      );
      return { token: response.auth?.client_token ?? '', auth: response.auth };
    }
    case 'JWT':
    case 'KUBERNETES': {
      const response = await vaultRequest<{ auth?: AuthInfo }>(
        connection,
        'post',
        loginPath(backendPath, '/login'),
        {
          data: { role: credentials.role, jwt: credentials.jwt },
        },
      );
      return { token: response.auth?.client_token ?? '', auth: response.auth };
    }
    case 'AWS': {
      const data =
        credentials.awsLoginType === 'ec2'
          ? { role: credentials.role, pkcs7: credentials.awsValue }
          : { role: credentials.role, iam: credentials.awsValue };
      const response = await vaultRequest<{ auth?: AuthInfo }>(
        connection,
        'post',
        loginPath(backendPath, '/login'),
        {
          data,
        },
      );
      return { token: response.auth?.client_token ?? '', auth: response.auth };
    }
    case 'OIDC': {
      const response = await vaultRequest<{ data?: { auth_url?: string }; auth_url?: string }>(
        connection,
        'post',
        loginPath(backendPath, '/oidc/auth_url'),
        {
          data: {
            role: credentials.role || undefined,
            redirect_uri:
              redirectUri ?? `${window.location.origin}${window.location.pathname}#/oidc/callback`,
          },
        },
      );
      const authUrl = response.data?.auth_url ?? response.auth_url ?? '';
      return { token: '', authUrl };
    }
    default:
      throw new Error(`Unsupported login method: ${method}`);
  }
}

export async function completeOidcLogin(
  connection: VaultConnection,
  backendPath: string,
  code: string,
  state: string,
): Promise<LoginResult> {
  const response = await vaultRequest<{ auth?: AuthInfo }>(
    connection,
    'get',
    loginPath(backendPath, '/oidc/callback'),
    {
      query: { code, state },
    },
  );
  return { token: response.auth?.client_token ?? '', auth: response.auth };
}

export async function lookupSelf(connection: VaultConnection, signal?: AbortSignal): Promise<TokenIdentity> {
  const response = await vaultRequest<unknown>(connection, 'get', 'auth/token/lookup-self', { signal });
  return unwrap<TokenIdentity>(response) ?? {};
}

export async function renewSelf(connection: VaultConnection): Promise<AuthInfo | undefined> {
  const response = await vaultRequest<{ auth?: AuthInfo }>(connection, 'post', 'auth/token/renew-self', {
    data: { increment: 0 },
  });
  return response.auth;
}

export async function revokeSelf(connection: VaultConnection): Promise<void> {
  await vaultRequest(connection, 'post', 'auth/token/revoke-self');
}

export interface CreateTokenPayload {
  display_name?: string;
  policies?: string[];
  no_default_policy?: boolean;
  renewable?: boolean;
  orphan?: boolean;
  num_uses?: number;
  ttl?: string;
  explicit_max_ttl?: string;
  meta?: Record<string, string>;
  type?: string;
}

export async function createToken(
  connection: VaultConnection,
  payload: CreateTokenPayload,
  orphan = false,
): Promise<AuthInfo | undefined> {
  const endpoint = orphan ? 'auth/token/create-orphan' : 'auth/token/create';
  const response = await vaultRequest<{ auth?: AuthInfo }>(connection, 'post', endpoint, { data: payload });
  return response.auth;
}

export async function createTokenFromRole(
  connection: VaultConnection,
  role: string,
): Promise<AuthInfo | undefined> {
  const response = await vaultRequest<{ auth?: AuthInfo }>(
    connection,
    'post',
    `auth/token/create/${encodeURIComponent(role)}`,
  );
  return response.auth;
}

export async function listAccessors(connection: VaultConnection, signal?: AbortSignal): Promise<string[]> {
  const response = await vaultRequest<unknown>(connection, 'get', 'auth/token/accessors', {
    query: { list: true },
    signal,
  });
  const payload = unwrap<{ keys?: string[] }>(response);
  return payload?.keys ?? [];
}

export async function lookupAccessor(
  connection: VaultConnection,
  accessor: string,
  signal?: AbortSignal,
): Promise<TokenIdentity> {
  const response = await vaultRequest<unknown>(connection, 'post', 'auth/token/lookup-accessor', {
    data: { accessor },
    signal,
  });
  return unwrap<TokenIdentity>(response) ?? {};
}

export async function revokeAccessor(connection: VaultConnection, accessor: string): Promise<void> {
  await vaultRequest(connection, 'post', 'auth/token/revoke-accessor', { data: { accessor } });
}

export interface TokenRole extends Record<string, unknown> {
  name?: string;
  allowed_policies?: string[];
  disallowed_policies?: string[];
  orphan?: boolean;
  renewable?: boolean;
  path_suffix?: string;
  explicit_max_ttl?: number;
  period?: number;
  token_type?: string;
  token_num_uses?: number;
  token_ttl?: number;
  token_max_ttl?: number;
  token_bound_cidrs?: string[];
}

export async function listTokenRoles(connection: VaultConnection, signal?: AbortSignal): Promise<string[]> {
  const response = await vaultRequest<unknown>(connection, 'get', 'auth/token/roles', {
    query: { list: true },
    signal,
  });
  const payload = unwrap<{ keys?: string[] }>(response);
  return payload?.keys ?? [];
}

export async function readTokenRole(connection: VaultConnection, name: string): Promise<TokenRole> {
  const response = await vaultRequest<unknown>(
    connection,
    'get',
    `auth/token/roles/${encodeURIComponent(name)}`,
  );
  return unwrap<TokenRole>(response) ?? {};
}

export async function writeTokenRole(
  connection: VaultConnection,
  name: string,
  role: TokenRole,
): Promise<void> {
  const payload = { ...role, name: undefined };
  await vaultRequest(connection, 'post', `auth/token/roles/${encodeURIComponent(name)}`, { data: payload });
}

export async function deleteTokenRole(connection: VaultConnection, name: string): Promise<void> {
  await vaultRequest(connection, 'delete', `auth/token/roles/${encodeURIComponent(name)}`);
}
