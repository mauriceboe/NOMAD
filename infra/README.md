# Skafld.Atlas — Infrastructure

Everything needed to deploy, operate, and recover Atlas as code.

## What's in here

```
infra/
├── pulumi/             Pulumi TypeScript stack — all cloud resources
│   ├── index.ts        Main entry point
│   ├── components/     Reusable Pulumi components (Railway, R2, Access, GitHub)
│   └── scripts/        Helper scripts called from Pulumi (Railway GraphQL bridge)
├── scripts/            Operational scripts (backup, restore, snapshot, rotate)
└── runbooks/           Operational procedures
```

## Quick start (first-time setup)

This is greenfield. To deploy Atlas for the first time:

1. **Install prerequisites:**

   ```bash
   brew install pulumi railway doppler awscli jq gh
   ```

2. **Authenticate everywhere:**

   ```bash
   pulumi login
   railway login
   doppler login
   gh auth login
   ```

3. **Bootstrap Railway** (creates project, service, volumes):

```bash
./infra/scripts/bootstrap-railway.sh
# Note the printed RAILWAY_PROJECT_ID and RAILWAY_ENVIRONMENT_ID
```

4. **Set up Doppler:**

   - Create project `skafld-atlas` with config `prd` in the Doppler dashboard
   - Add required secrets: `ENCRYPTION_KEY`, `JWT_SECRET`, OIDC creds (see `.env.example` in repo root for the full list)
   - Connect Doppler to Railway via the Integrations page in Doppler

5. **Connect Railway service to GitHub repo** (in Railway dashboard):

   - Service → Settings → Source → Connect GitHub repo
   - Build: Dockerfile, root: `/`

6. **Trigger first deploy** by pushing any commit to `main`. Railway builds and deploys.

7. **Run Pulumi:**

   ```bash
   cd infra/pulumi
   npm install
   pulumi stack init prod  # if not already done
   export RAILWAY_PROJECT_ID=<from step 3>
   export RAILWAY_ENVIRONMENT_ID=<from step 3>
   export RAILWAY_TOKEN=<from Railway dashboard>
   export CLOUDFLARE_API_TOKEN=<from Cloudflare dashboard>
   export CLOUDFLARE_ACCOUNT_ID=<from Cloudflare dashboard>
   export DOPPLER_TOKEN=<from Doppler>
   export GITHUB_TOKEN=<from gh auth token>
   pulumi up --stack prod
   ```

   On first run, the R2 bucket is created with placeholder access-key values in Pulumi config. The next step replaces them.

8. **Bootstrap Cloudflare manuals** (lifecycle rules + access keys — not yet supported by `@pulumi/cloudflare`):

   ```bash
   ./infra/scripts/bootstrap-cloudflare.sh
   ```

   The script walks you through creating the three lifecycle rules and an S3-compatible API token in the Cloudflare dashboard, then writes the access key + secret back into Pulumi config.

9. **Re-run Pulumi** to propagate the new R2 credentials to Railway env vars:

   ```bash
   cd infra/pulumi
   pulumi up --stack prod
   ```

10. **Add GitHub Actions secrets** so CI can deploy:

   ```bash
   gh secret set PULUMI_ACCESS_TOKEN --body "<from pulumi config>"
   gh secret set RAILWAY_TOKEN --body "<...>"
   gh secret set RAILWAY_PROJECT_ID --body "<from step 3>"
   gh secret set RAILWAY_ENVIRONMENT_ID --body "<from step 3>"
   gh secret set CLOUDFLARE_API_TOKEN --body "<...>"
   gh secret set CLOUDFLARE_ACCOUNT_ID --body "<...>"
   gh secret set DOPPLER_TOKEN --body "<...>"
   gh secret set GH_PROVIDER_TOKEN --body "<...>"  # PAT with repo + admin:org
   ```

11. **Verify:** open `https://atlas.skafld.com` — should hit Cloudflare Access auth, then Atlas itself.

## Day-to-day

- **Code change:** push to main, Railway auto-deploys. See `runbooks/deploy.md`.
- **Infra change:** PR → review preview → merge → approve in GitHub Actions. Pulumi applies.
- **Secret change:** update in Doppler, Railway auto-redeploys.
- **Backup:** automatic daily/weekly/monthly to R2. On-demand: `./infra/scripts/backup-now.sh`.
- **Restore:** `./infra/scripts/restore-from-backup.sh`. See `runbooks/backup-and-restore.md`.

## Runbooks

DocumentWhen to readdeploy.mdAny deploy, especially first timebackup-and-restore.mdBefore risky changes; quarterly verificationdisaster-recovery.mdService is gone or unrecoverablerotate-secrets.mdScheduled rotation or suspected compromisetransfer-runbook.mdAccount migration or external handoff

## Architecture decisions

A few choices worth knowing about:

- **Railway, not Vercel.** Atlas is monolithic Express + SQLite + WebSocket + cron jobs. Vercel's serverless model can't host any of these. Railway is the natural fit.
- **SQLite, not Postgres.** Per Atlas's existing architecture; not changing here. Means single-replica, vertical scaling only.
- **Two volumes.** `/app/data` (sensitive, small, frequent backups) is separated from `/app/uploads` (less sensitive, larger, different backup cadence).
- **Doppler as secrets source-of-truth.** Pulumi reads references; actual secret values live only in Doppler.
- **Cloudflare for DNS, R2, and Access.** Single-vendor for the edge layer simplifies operations and keeps DNS+TLS+SSO in one place.
- **No Pulumi provider for Railway.** Railway is provisioned once via the CLI in `bootstrap-railway.sh`; ongoing config managed via GraphQL through `pulumi.Command`. See `components/railway-service.ts` for the rationale.
- **No staging environment.** Internal tool, two users — the cost of maintaining staging exceeds its value at this scale. Easy to add later.
