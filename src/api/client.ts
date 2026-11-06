import axios, { AxiosError, type AxiosRequestConfig, type Method } from 'axios';
import type { VaultConnection } from './types';

export const IS_ELECTRON = import.meta.env.MODE === 'electron';

export class VaultApiError extends Error {
  status?: number;
  errors: string[];
  data?: unknown;

  constructor(message: string, options: { status?: number; errors?: string[]; data?: unknown } = {}) {
    super(message);
    this.name = 'VaultApiError';
    this.status = options.status;
    this.errors = options.errors ?? [message];
    this.data = options.data;
  }
}

export function normalizeVaultUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function isValidVaultUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function toVaultApiError(error: unknown): VaultApiError {
  if (error instanceof VaultApiError) return error;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>;
    const body = axiosError.response?.data;
    let errors: string[] = [];

    if (body && typeof body === 'object' && 'errors' in body && Array.isArray(body.errors)) {
      errors = body.errors.map(String);
    }

    const status = axiosError.response?.status;
    const message =
      errors.length > 0
        ? errors.join(', ')
        : status
          ? `Vault returned HTTP ${status}`
          : axiosError.code === 'ECONNABORTED'
            ? 'Vault request timed out'
            : axiosError.message;

    return new VaultApiError(message, { status, errors: errors.length > 0 ? errors : [message], data: body });
  }

  return new VaultApiError(error instanceof Error ? error.message : String(error));
}

export interface VaultRequestOptions {
  query?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  validateStatus?: (status: number) => boolean;
}

function createHeaders(connection: VaultConnection, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (connection.token) headers['X-Vault-Token'] = connection.token;
  if (connection.namespace) headers['X-Vault-Namespace'] = connection.namespace;
  return headers;
}

/**
 * Low-level Vault request helper.
 *
 * In web builds the request goes through Vault-UI's proxy (`/v1/`) and the
 * target address is passed as `vaultaddr`. Desktop builds talk to Vault
 * directly so no Node server is required.
 */
export async function vaultRequest<T = unknown>(
  connection: VaultConnection,
  method: Method,
  path: string,
  options: VaultRequestOptions = {},
): Promise<T> {
  const url = normalizeVaultUrl(connection.url);
  const cleanPath = path.replace(/^\/+/, '');
  const params: Record<string, unknown> = { ...(options.query ?? {}) };
  if (!IS_ELECTRON) params.vaultaddr = url;

  const config: AxiosRequestConfig = {
    method,
    baseURL: IS_ELECTRON ? `${url}/v1/` : '/v1/',
    url: encodeURI(cleanPath),
    params,
    data: options.data,
    headers: createHeaders(connection, options.headers),
    timeout: options.timeoutMs ?? connection.timeoutMs ?? 60_000,
    signal: options.signal,
    // Passing `undefined` here would override Axios' default and cause every
    // HTTP error to resolve, so only health checks opt out of strict statuses.
    validateStatus: options.validateStatus ?? ((status) => status >= 200 && status < 300),
  };

  try {
    const response = await axios.request<T>(config);
    return response.data;
  } catch (error) {
    throw toVaultApiError(error);
  }
}

/** Returns the meaningful payload of a Vault response. */
export function unwrap<T = unknown>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function unwrapErrors(payload: unknown): string[] {
  if (payload && typeof payload === 'object' && 'errors' in payload && Array.isArray(payload.errors)) {
    return payload.errors.map(String);
  }
  return [];
}
