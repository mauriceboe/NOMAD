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
  --set secretEnv.JWT_SECRET=your_jwt_secret \
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
- JWT_SECRET must be set for production use.
- If using ingress, you must manually keep `env.ALLOWED_ORIGINS` and `ingress.hosts` in sync to ensure CORS works correctly. The chart does not sync these automatically.
