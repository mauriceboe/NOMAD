# Install: Helm

Deploy TREK on Kubernetes using the official Helm chart.

## Add the Chart Repository

```bash
helm repo add trek https://mauriceboe.github.io/TREK
helm repo update
```

## Basic Install

```bash
helm install trek trek/trek
```

This deploys TREK with default values: a `ClusterIP` service on port 3000, 1 Gi PVCs for data and uploads, and no ingress.

## Encryption Key

`ENCRYPTION_KEY` encrypts stored secrets (API keys, MFA, SMTP, OIDC) at rest. There are three ways to handle it:

**Option 1 — Let the chart generate a random key (recommended for new installs):**

```bash
helm install trek trek/trek --set generateEncryptionKey=true
```

The chart generates a 32-character alphanumeric key at install time and preserves it across upgrades. Note that this differs from the 64-character hex key produced by `openssl rand -hex 32` — both formats are accepted by the server.

**Option 2 — Set an explicit key:**

```bash
helm install trek trek/trek \
  --set secretEnv.ENCRYPTION_KEY=$(openssl rand -hex 32)
```

**Option 3 — Use an existing Kubernetes Secret:**

```bash
kubectl create secret generic trek-secrets \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -hex 32)

helm install trek trek/trek \
  --set existingSecret=trek-secrets
```

If `existingSecret` uses a different key name than `ENCRYPTION_KEY`, specify it with `--set existingSecretKey=MY_KEY_NAME`.

> **Note:** If both `generateEncryptionKey` and `existingSecret` are set, `existingSecret` takes precedence. Only one method should be active at a time.

> **Note:** If `ENCRYPTION_KEY` is left empty, the server resolves it automatically: existing installs fall back to `data/.jwt_secret` (encrypted data stays readable after upgrade); fresh installs auto-generate a key persisted to the data PVC.

> **Note:** `JWT_SECRET` is managed entirely by the server — auto-generated on first start and persisted to the data PVC. It can be rotated via the admin panel (Settings → Danger Zone → Rotate JWT Secret). No Helm configuration is needed or supported for it.

## Admin Account

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are set via `secretEnv`. They are only used on first boot when no users exist yet. **Both must be set together** — if either is missing, the server ignores both values and instead creates the admin account with email `admin@trek.local` and a random password, which is printed to the server log.

```bash
helm install trek trek/trek \
  --set secretEnv.ADMIN_EMAIL=admin@example.com \
  --set secretEnv.ADMIN_PASSWORD=<your-secure-password>
```

> **Note:** When `OIDC_ONLY=true` is configured together with `OIDC_ISSUER` and `OIDC_CLIENT_ID`, no local admin account is created on first boot. Instead, the first user to log in via SSO automatically becomes admin.

## Key `values.yaml` Settings

### Image

```yaml
image:
  repository: mauriceboe/trek
  # tag: latest        # defaults to the chart's appVersion
  pullPolicy: IfNotPresent

# Optional: pull secrets for private registries
imagePullSecrets: []
  # - name: my-registry-secret
```

### Service

```yaml
service:
  type: ClusterIP   # change to LoadBalancer or NodePort to expose externally
  port: 3000
```

### Plain Environment Variables (`env`)

```yaml
env:
  NODE_ENV: production
  PORT: 3000
  # TZ: "Europe/Berlin"          # timezone for logs, reminders, cron jobs
  # LOG_LEVEL: "info"            # "info" = concise, "debug" = verbose
  # DEFAULT_LANGUAGE: "en"       # fallback language on login page; supported: de, en, es, fr, hu, nl, br, cs, pl, ru, zh, zh-TW, it, ar
  # ALLOWED_ORIGINS: "https://trek.example.com"
  # APP_URL: "https://trek.example.com"
  # FORCE_HTTPS: "false"         # enable HTTPS redirect + HSTS; requires TRUST_PROXY
  # TRUST_PROXY: "1"             # proxy hops for X-Forwarded-For/Proto; defaults to 1 in production
  # COOKIE_SECURE: "true"        # auto-derived; set "false" only for local HTTP testing
  # ALLOW_INTERNAL_NETWORK: "false"  # set "true" if Immich or other services are on a private network
  # DEMO_MODE: "false"           # enable demo mode (hourly data resets)
  # MCP_RATE_LIMIT: "300"        # max MCP requests per user per minute
  # OIDC_ISSUER: "https://auth.example.com"
  # OIDC_CLIENT_ID: "trek"
  # OIDC_DISPLAY_NAME: "SSO"
  # OIDC_ONLY: "false"           # force SSO-only mode; disables password login
  # OIDC_ADMIN_CLAIM: ""         # OIDC claim used to identify admin users
  # OIDC_ADMIN_VALUE: ""         # value of that claim that grants admin role
  # OIDC_SCOPE: "openid email profile groups"
  # OIDC_DISCOVERY_URL: ""       # override for providers with non-standard discovery paths (e.g. Authentik)
```

### Sensitive Variables (`secretEnv`)

These are stored in a Kubernetes Secret and injected as environment variables:

```yaml
secretEnv:
  ENCRYPTION_KEY: ""        # recommended: openssl rand -hex 32
  ADMIN_EMAIL: ""           # initial admin email (first boot only)
  ADMIN_PASSWORD: ""        # initial admin password (first boot only)
  OIDC_CLIENT_SECRET: ""    # set if using OIDC
```

Alternatively, use `generateEncryptionKey: true` to let the chart generate and manage the encryption key, or point `existingSecret` / `existingSecretKey` at an existing Kubernetes Secret.

### Persistent Storage

```yaml
persistence:
  enabled: true
  data:
    size: 1Gi     # SQLite database, logs, secrets
  uploads:
    size: 1Gi     # uploaded files — increase if you expect large media uploads
```

### Resource Limits

```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### Ingress

```yaml
ingress:
  enabled: true
  className: "nginx"   # your ingress class
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "86400"  # required for WebSockets
    nginx.ingress.kubernetes.io/proxy-body-size: "500m"       # required for backup restore
  hosts:
    - host: trek.example.com
      paths:
        - /
  tls:
    - secretName: trek-tls
      hosts:
        - trek.example.com
```

> **Important:** TREK uses WebSockets on `/ws`. Your ingress controller must support WebSocket upgrades. Set `proxy-read-timeout` to at least `86400` and `proxy-body-size` to at least `500m` for backup restores.

> **Note:** Keep `env.ALLOWED_ORIGINS` in sync with `ingress.hosts` — the chart does not synchronize these automatically.

> **Note:** When using ingress with TLS termination, set `env.FORCE_HTTPS: "true"` and `env.TRUST_PROXY: "1"` to enable HTTPS redirects, HSTS, and secure cookies.

## Upgrade

```bash
helm repo update
helm upgrade trek trek/trek
```

## Full Values Reference

See the [`charts/README.md`](https://github.com/mauriceboe/TREK/blob/main/charts/README.md) for all available values.

## Next Steps

- [Environment-Variables] — full variable reference
- [Reverse-Proxy] — proxy configuration for non-Kubernetes deployments
