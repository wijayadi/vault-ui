import type { Request, Response } from 'express';
import type { AppConfig } from './config.js';

/** Hop-by-hop headers must not be proxied (RFC 7230 section 6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

export type FetchLike = typeof fetch;

export interface ProxyOptions {
  fetchImpl?: FetchLike;
}

function buildTargetUrl(vaultAddr: string, pathname: string, query: Request['query']): string {
  const base = vaultAddr.replace(/\/+$/, '');
  const url = new URL(`${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`);

  for (const [key, value] of Object.entries(query)) {
    if (key === 'vaultaddr' || value === undefined) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (typeof entry === 'string') url.searchParams.append(key, entry);
    }
  }

  return url.toString();
}

function copyHeaders(source: NodeJS.Dict<string | string[]>, target: Headers): void {
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined || HOP_BY_HOP.has(name.toLowerCase())) continue;
    // Axios/Express may expose arrays for repeated headers.
    target.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
}

/**
 * Creates the Express middleware that reverse-proxies `/v1/*` to a Vault
 * server. The browser normally supplies the target in `?vaultaddr=`, which
 * keeps the server stateless and lets users switch clusters at runtime.
 */
export function createVaultProxy(config: AppConfig, options: ProxyOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function vaultProxy(req: Request, res: Response): Promise<void> {
    const requestedAddress = typeof req.query.vaultaddr === 'string' ? req.query.vaultaddr : '';
    const vaultAddr = requestedAddress || config.vaultUrlDefault;

    if (!vaultAddr) {
      res.status(400).json({
        errors: ['Missing vaultaddr parameter. Configure a Vault URL in the login settings.'],
      });
      return;
    }

    let target: string;
    try {
      // The path is derived from originalUrl because this middleware is mounted
      // at /v1 and req.path would only contain the remainder.
      const queryIndex = req.originalUrl.indexOf('?');
      const pathname = queryIndex === -1 ? req.originalUrl : req.originalUrl.slice(0, queryIndex);
      target = buildTargetUrl(decodeURIComponent(vaultAddr), pathname, req.query);
    } catch {
      res.status(400).json({ errors: [`Invalid Vault address: ${vaultAddr}`] });
      return;
    }

    const headers = new Headers();
    copyHeaders(req.headers, headers);

    if (config.vaultNamespaceDefault && !headers.has('x-vault-namespace')) {
      headers.set('x-vault-namespace', config.vaultNamespaceDefault);
    }

    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const body = hasBody ? JSON.stringify(req.body ?? {}) : undefined;

    try {
      const upstream = await fetchImpl(target, {
        method: req.method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(config.proxyTimeoutMs),
      });

      res.status(upstream.status);
      res.setHeader('Cache-Control', 'no-store');

      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      for (const header of ['x-vault-request', 'x-vault-index', 'www-authenticate']) {
        const value = upstream.headers.get(header);
        if (value) res.setHeader(header, value);
      }

      const payload = Buffer.from(await upstream.arrayBuffer());
      res.send(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      res.status(isTimeout ? 504 : 502).json({
        errors: [
          isTimeout
            ? `Vault request timed out after ${config.proxyTimeoutMs}ms`
            : `Unable to reach Vault at ${vaultAddr}: ${message}`,
        ],
      });
    }
  };
}
