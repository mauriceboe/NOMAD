# TREK Helm Chart

This is a minimal Helm chart for deploying the TREK app.

## Features
- Deploys the TREK container
- Exposes port 3000 via Service
- Optional persistent storage for `/app/data` and `/app/uploads`
- Configurable environment variables and secrets
- Optional generic Ingress support
- Health checks on `/api/health`

## Usage

```sh
helm install trek ./chart \
  --set jwt.secret=your_jwt_secret \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=yourdomain.com
```

See `values.yaml` for more options.

## Files
- `Chart.yaml` — chart metadata
- `values.yaml` — configuration values
- `templates/` — Kubernetes manifests

## Notes
- Ingress is off by default. Enable and configure hosts for your domain.
- PVCs require a default StorageClass or specify one as needed.
- JWT secret must be provided for production. Preferred ways:
  - `--set jwt.generateSecret=true` to have Helm generate a secret at install
  - `--set jwt.existingSecret=my-k8s-secret` to reference an existing Kubernetes Secret
  - `--set jwt.secret=...` (not recommended for production)
- If using ingress, you must manually keep `env.ALLOWED_ORIGINS` and `ingress.hosts` in sync to ensure CORS works correctly. The chart does not sync these automatically.

## Recommendations
- Let the chart create the initial JWT secret. Afterwards, note the name of the created secret (usually `trek-jwt-secret`), change `jwt.generateSecret` to `false` and set `jwt.existingSecret`.
- OIDC-configuration should be done in a Kubernetes secret. Create one manually (or use external secrets operator) and use `additionalEnvFromSecrets` to include the environment in the container.
