import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { config as defaultConfig, type AppConfig } from './config.js';
import { createVaultProxy, type ProxyOptions } from './proxy.js';

const APP_VERSION = process.env.npm_package_version ?? '3.0.0';

export interface CreateAppOptions extends ProxyOptions {
  config?: AppConfig;
  distDir?: string;
}

/**
 * Builds the Express application. Exported separately from the listener so the
 * behaviour can be exercised in tests without opening a port.
 */
export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? defaultConfig;
  const distDir = options.distDir ?? path.resolve(process.cwd(), 'dist');
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      // The SPA uses inline styles (MUI/emotion) and connects to arbitrary
      // user-supplied Vault URLs, so a strict CSP is not practical here.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  if (config.corsOrigin) {
    app.use(
      cors({
        origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((entry) => entry.trim()),
        credentials: true,
      }),
    );
  }

  app.use(express.json({ limit: process.env.MAX_REQUEST_BODY || '10mb' }));

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: APP_VERSION });
  });

  const configHandler = (req: Request, res: Response): void => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      version: APP_VERSION,
      defaultVaultUrl: config.vaultUrlDefault,
      defaultVaultUrlForce: config.vaultUrlDefaultForce,
      defaultAuthMethod: config.vaultAuthDefault,
      defaultAuthMethodForce: config.vaultAuthDefaultForce,
      defaultBackendPath: config.vaultAuthBackendPath,
      defaultBackendPathForce: config.vaultAuthBackendPathForce,
      defaultNamespace: config.vaultNamespaceDefault,
      suppliedAuthToken: config.suppliedTokenHeader ? req.header(config.suppliedTokenHeader) || '' : '',
    });
  };

  app.get('/api/config', configHandler);
  // Backwards-compatible alias for existing deployments and health probes.
  app.get('/vaultui', configHandler);

  app.use('/v1', createVaultProxy(config, options));

  if (config.serveStatic) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));

    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }

      const indexFile = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexFile)) {
        res.status(503).json({
          errors: ['Vault-UI frontend has not been built. Run `pnpm build` or use `pnpm dev`.'],
        });
        return;
      }

      res.sendFile(indexFile);
    });
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ errors: ['Not found'] });
  });

  return app;
}
