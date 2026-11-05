# Vault UI

A modern web and desktop interface for [HashiCorp Vault](https://www.vaultproject.io/).

Vault UI is a TypeScript React application backed by a small Node/Express BFF (backend-for-frontend). It runs as a shared web application, a Docker container, or an Electron desktop app.

## Highlights

- **KV secrets engines** — browse KV v1 and v2 mounts, edit JSON, search and paginate.
- **KV v2 versioning** — read historical versions, soft-delete/undelete, destroy versions, and edit metadata (custom metadata, max versions, CAS, delete-after).
- **Auth backend management** — configure and manage AppRole, AWS IAM/EC2, Azure, Cert, GCP, GitHub, JWT, Kubernetes, LDAP, OIDC, Okta, RADIUS, Userpass, and Token backends from declarative schemas.
- **Token management** — inspect the current token, renew leases, list accessors, revoke tokens, create tokens and token roles, and view accessor details.
- **ACL policies** — read and write policies through `sys/policies/acl` with a fallback to the legacy `sys/policy` API.
- **Mount management** — mount, tune, and disable secret engines and auth methods.
- **Health and seal operations** — inspect cluster health/leader state, unseal with key shares, and seal the cluster.
- **Namespaces** — send `X-Vault-Namespace` for Vault Enterprise namespaces.
- **Wrapping** — wrap data or existing secrets, unwrap tokens, rewrap, and share single-use unwrap URLs.
- **Login methods** — Token, Username & Password, LDAP, Okta, GitHub, AppRole, JWT, OIDC/SSO, AWS, and Kubernetes.
- **Modern UI** — Material UI, responsive layout, light/dark/system themes, code-split routes, and JSON editing powered by `vanilla-jsoneditor`.

## Requirements

- Node.js **22.12+** (Node 24 LTS recommended)
- pnpm **10+**
- A reachable Vault server (Vault 1.x or later)

## Quick start

```bash
pnpm install
pnpm dev
```

This starts:

- the Vite frontend on <http://localhost:5173>
- the Express API/proxy server on <http://localhost:8000>

Vite proxies `/api` and `/v1` to the API server. Open the frontend URL and enter your Vault address.

### Production build

```bash
pnpm build       # frontend -> dist/, server -> dist-server/
pnpm start       # serves dist/ and proxies /v1 on port 8000
```

## Make targets

`make help` lists everything. Common targets:

| Target              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `make install`      | Install dependencies with pnpm                   |
| `make dev`          | Run frontend and API server together             |
| `make build`        | Build frontend and server                        |
| `make start`        | Start the compiled server                        |
| `make lint`         | Run ESLint                                       |
| `make typecheck`    | Type-check frontend, server, and Electron        |
| `make test`         | Run the Vitest suite                             |
| `make coverage`     | Run tests with coverage                          |
| `make check`        | Lint + type-check + tests                        |
| `make docker-build` | Build the production Docker image                |
| `make docker-up`    | Start Vault and Vault UI with Docker Compose     |
| `make docker-down`  | Stop Docker Compose services                     |
| `make package`      | Build a desktop package for the current platform |

## Docker

```bash
docker compose up -d --build
```

The compose file starts a Vault dev server (`http://localhost:8200`, root token `root`) and Vault UI at <http://localhost:8000>. The application is pre-configured with `VAULT_URL_DEFAULT=http://vault:8200` and token authentication.

Build and run the image without Compose:

```bash
docker build -t vault-ui .
docker run --rm -p 8000:8000 \
  -e VAULT_URL_DEFAULT=https://vault.example.com:8200 \
  vault-ui
```

The container runs as a non-root user and exposes a `/healthz` health check.

## Configuration

The web server reads the following environment variables:

| Variable                        | Default      | Description                                                                                                             |
| ------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `PORT`                          | `8000`       | HTTP listen port                                                                                                        |
| `HOST`                          | `0.0.0.0`    | HTTP listen address                                                                                                     |
| `VAULT_URL_DEFAULT`             | empty        | Default Vault address shown on the login page                                                                           |
| `VAULT_URL_DEFAULT_FORCE`       | `false`      | Prevent users from changing the Vault URL                                                                               |
| `VAULT_AUTH_DEFAULT`            | `TOKEN`      | Default login method (`TOKEN`, `USERPASSWORD`, `LDAP`, `OKTA`, `GITHUB`, `APPROLE`, `JWT`, `OIDC`, `AWS`, `KUBERNETES`) |
| `VAULT_AUTH_DEFAULT_FORCE`      | `false`      | Prevent users from changing the login method                                                                            |
| `VAULT_AUTH_BACKEND_PATH`       | empty        | Default auth mount path                                                                                                 |
| `VAULT_AUTH_BACKEND_PATH_FORCE` | `false`      | Prevent users from changing the auth mount path                                                                         |
| `VAULT_NAMESPACE_DEFAULT`       | empty        | Default Vault Enterprise namespace                                                                                      |
| `VAULT_SUPPLIED_TOKEN_HEADER`   | empty        | Trust a token from this request header (for SSO middleware)                                                             |
| `VAULT_PROXY_TIMEOUT_MS`        | `60000`      | Upstream Vault request timeout                                                                                          |
| `CORS_ORIGIN`                   | disabled     | Enable CORS for a comma-separated list of origins, or `*`                                                               |
| `SERVE_STATIC`                  | `true`       | Serve the built SPA from the API server                                                                                 |
| `TRUST_PROXY`                   | `false`      | Trust the first reverse-proxy hop                                                                                       |
| `MAX_REQUEST_BODY`              | `10mb`       | Maximum JSON request body                                                                                               |
| `CUSTOM_CA_CERT`                | empty        | PEM certificate written to a temporary trust store                                                                      |
| `NODE_TLS_REJECT_UNAUTHORIZED`  | Node default | Set to `0` only for self-signed development certificates                                                                |

For the desktop build, defaults can be supplied at build time with `VITE_VAULT_URL_DEFAULT`, `VITE_VAULT_AUTH_DEFAULT`, `VITE_VAULT_AUTH_BACKEND_PATH`, and `VITE_VAULT_NAMESPACE_DEFAULT`.

## Required Vault policy

Vault UI degrades gracefully when permissions are missing, but a typical operator token needs:

```hcl
# Capability checks and discovery
path "sys/capabilities-self" {
  capabilities = ["update"]
}
path "sys/mounts" {
  capabilities = ["read", "list"]
}
path "sys/auth" {
  capabilities = ["read", "list"]
}
path "sys/internal/ui/mounts" {
  capabilities = ["read"]
}
path "sys/health" {
  capabilities = ["read"]
}
path "sys/seal-status" {
  capabilities = ["read"]
}
path "sys/leader" {
  capabilities = ["read"]
}

# Policies
path "sys/policies/acl" {
  capabilities = ["read", "list"]
}
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Token management
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
path "auth/token/revoke-self" {
  capabilities = ["update"]
}
path "auth/token/accessors" {
  capabilities = ["sudo", "list"]
}
path "auth/token/lookup-accessor" {
  capabilities = ["update"]
}
path "auth/token/revoke-accessor" {
  capabilities = ["update"]
}
path "auth/token/create" {
  capabilities = ["update"]
}
path "auth/token/create-orphan" {
  capabilities = ["update"]
}
path "auth/token/roles/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# KV v2 (adjust the mount name)
path "secret/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/*" {
  capabilities = ["read", "list", "delete"]
}
path "secret/delete/*" {
  capabilities = ["update"]
}
path "secret/undelete/*" {
  capabilities = ["update"]
}
path "secret/destroy/*" {
  capabilities = ["update"]
}
```

Add the corresponding `auth/<mount>/*`, `sys/mounts/*`, `sys/auth/*`, and wrapping paths as needed.

## Architecture

```
src/                  React + TypeScript frontend (Vite)
  api/                Vault API client, KV helpers, capabilities, policies
  components/         layout and reusable UI components
  config/             declarative auth backend/login method definitions
  context/            auth, settings, and toast providers
  pages/              route-level pages (lazy loaded)
server/               Express 5 API server (TypeScript)
  config.ts           environment configuration
  proxy.ts            stateless /v1 reverse proxy to Vault
  app.ts              routes, static hosting, and SPA fallback
electron/             Electron main process (ESM)
tests/                shared test setup
```

Web requests flow through the Node proxy: the browser calls `/v1/...?vaultaddr=...`, and the server forwards the request to the chosen Vault. This avoids browser CORS issues and keeps self-signed certificates manageable. Desktop builds call Vault directly and use a hash router.

## Development

```bash
pnpm dev            # API + frontend
pnpm dev:web        # frontend only
pnpm dev:server     # API only, hot reload through tsx
pnpm dev:desktop    # Electron + Vite dev server
```

Run the demo Vault environment:

```bash
./run-docker-compose-dev
```

This starts Vault, enables several auth methods, seeds KV v2 secrets, and builds the UI container.

## Testing and quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
pnpm check
```

Tests use Vitest, Testing Library, jsdom, and Supertest. Server proxy tests inject a mock `fetch` implementation.

## Desktop app

```bash
pnpm dev:desktop
pnpm build:desktop
pnpm package           # electron-builder for the current platform
pnpm package:linux     # or :mac / :win
```

Desktop builds use `contextIsolation`, disable `nodeIntegration`, and open external links in the system browser. Because the desktop client talks to arbitrary Vault servers that typically do not send CORS headers, the renderer's same-origin policy is disabled while Node integration remains off. Prefer the web build when you need strict browser sandboxing.

## Migrating from Vault UI 2.x

- The Webpack/Babel/React 15 stack has been replaced by Vite, React 19, TypeScript, and Material UI.
- `server.js`/`src/*.js` were replaced by the typed Express 5 server in `server/`.
- `yarn` was replaced by `pnpm`; `yarn.lock` is intentionally removed.
- Policies now use `sys/policies/acl` first, with automatic fallback to `sys/policy`.
- The old `/vaultui` configuration endpoint is still supported alongside `/api/config`.
- Tokens persisted by 2.x under `vaultAccessToken`/`vaultUrl` are migrated automatically on first load.
- Secret paths follow Vault's KV v2 conventions internally; no user data is migrated by Vault UI itself.

## Security notes

- Tokens are stored in browser `localStorage` (required for a serverless desktop client). Prefer short-lived tokens, HTTPS, and a strict CSP at your reverse proxy.
- The `/v1` proxy is intentionally open to the Vault address supplied by the client. Run Vault UI only on trusted networks, or restrict `VAULT_URL_DEFAULT`/egress at the network layer.
- CORS is disabled by default. Enable `CORS_ORIGIN` only when the frontend is served from a different origin than the API.
- `VAULT_SUPPLIED_TOKEN_HEADER` must only be set behind a trusted authenticating proxy; otherwise a client can forge the header.

## License

ISC. See [LICENSE](LICENSE).
