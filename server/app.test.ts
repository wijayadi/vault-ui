import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';

const baseConfig: AppConfig = {
  port: 0,
  host: '127.0.0.1',
  vaultUrlDefault: '',
  vaultUrlDefaultForce: false,
  vaultAuthDefault: 'TOKEN',
  vaultAuthDefaultForce: false,
  vaultAuthBackendPath: '',
  vaultAuthBackendPathForce: false,
  vaultNamespaceDefault: '',
  suppliedTokenHeader: '',
  proxyTimeoutMs: 5_000,
  corsOrigin: false,
  serveStatic: false,
  trustProxy: false,
};

describe('Vault-UI server', () => {
  it('reports health', async () => {
    const app = createApp({ config: baseConfig });
    const response = await request(app).get('/healthz').expect(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('returns deployment configuration and supplied tokens', async () => {
    const app = createApp({
      config: {
        ...baseConfig,
        vaultUrlDefault: 'https://vault.example.com:8200',
        vaultUrlDefaultForce: true,
        vaultAuthDefault: 'GITHUB',
        vaultAuthBackendPath: 'github-prod',
        vaultNamespaceDefault: 'team-a',
        suppliedTokenHeader: 'X-Remote-User',
      },
    });

    const response = await request(app).get('/api/config').set('X-Remote-User', 'header-token').expect(200);

    expect(response.body).toMatchObject({
      defaultVaultUrl: 'https://vault.example.com:8200',
      defaultVaultUrlForce: true,
      defaultAuthMethod: 'GITHUB',
      defaultBackendPath: 'github-prod',
      defaultNamespace: 'team-a',
      suppliedAuthToken: 'header-token',
    });

    const legacy = await request(app).get('/vaultui').expect(200);
    expect(legacy.body.defaultVaultUrl).toBe('https://vault.example.com:8200');
  });

  it('rejects proxied requests without a Vault address', async () => {
    const app = createApp({ config: baseConfig });
    const response = await request(app).get('/v1/sys/health').expect(400);
    expect(response.body.errors[0]).toMatch(/vaultaddr/i);
  });

  it('forwards requests to Vault and strips the vaultaddr parameter', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ initialized: true, sealed: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const app = createApp({
      config: { ...baseConfig, vaultUrlDefault: 'http://vault.internal:8200' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const response = await request(app)
      .get('/v1/sys/health?vaultaddr=http%3A%2F%2Fvault.example.com%3A8200&standbyok=true')
      .set('X-Vault-Token', 'abc123')
      .expect(200);

    expect(response.body).toEqual({ initialized: true, sealed: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://vault.example.com:8200/v1/sys/health?standbyok=true');
    expect(init.method).toBe('GET');
    const headers = init.headers as Headers;
    expect(headers.get('x-vault-token')).toBe('abc123');
  });

  it('forwards request bodies and namespaces', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const app = createApp({
      config: { ...baseConfig, vaultNamespaceDefault: 'admin' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await request(app)
      .post('/v1/secret/data/app?vaultaddr=http%3A%2F%2Fvault.example.com%3A8200')
      .set('X-Vault-Token', 'token')
      .send({ data: { password: 'x' } })
      .expect(200);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ data: { password: 'x' } }));
    const headers = init.headers as Headers;
    expect(headers.get('x-vault-namespace')).toBe('admin');
  });

  it('returns 502 when the Vault server is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    const app = createApp({
      config: baseConfig,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const response = await request(app)
      .get('/v1/sys/health?vaultaddr=http%3A%2F%2Fvault.example.com%3A8200')
      .expect(502);
    expect(response.body.errors[0]).toMatch(/Unable to reach Vault/);
  });

  it('returns 400 for malformed Vault addresses', async () => {
    const app = createApp({ config: baseConfig });
    const response = await request(app).get('/v1/sys/health?vaultaddr=not-a-url').expect(400);
    expect(response.body.errors[0]).toMatch(/Invalid Vault address/);
  });
});
