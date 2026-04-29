# Deploy Runbook — Skafld.Atlas

How to deploy changes to Atlas, day-to-day.

## TL;DR

Application code changes deploy automatically. Infrastructure changes require a PR + merge through GitHub Actions.

```
Code change      → push to main → Railway redeploys automatically
Infra change     → PR → review preview → merge → manual approval → pulumi up
Secret change    → update in Doppler → Railway redeploys automatically
```

---

## Application Code Deploys

The Atlas service is connected to the GitHub repo. Any push to `main` triggers a Railway build from the Dockerfile, followed by a rolling restart.

**Deploy a code change:**

1. Open a PR. CI runs the test suite.
2. Get review (Mike or Charles).
3. Merge to `main`.
4. Watch the deploy in the Railway dashboard or via `railway logs --service atlas`.
5. Verify: `curl https://atlas.skafld.com/api/health`

**Roll back a code change:**

```bash
# Find the previous deploy
railway deployments list --service atlas

# Redeploy a specific commit
railway deployment redeploy <deployment-id>
```

**Important:** Rollback is *only* safe for code. If a deploy ran a database migration, rolling back the code without rolling back the migration can break things. SQLite migrations are in `server/migrations/`; check whether the bad deploy ran one.

---

## Infrastructure Deploys

Anything in `infra/pulumi/` is infrastructure. Changing it requires the Pulumi pipeline.

**Deploy an infra change:**

1. Make changes locally in `infra/pulumi/`.
2. Test locally: `cd infra/pulumi && pulumi preview --stack prod`
3. Open a PR. The `pulumi-preview` workflow runs and posts the diff as a comment.
4. **Carefully read the preview comment.** Look for:
   - `~` (update) — usually fine
   - `+` (create) — fine if expected
   - `-` (delete) — DANGEROUS if it's a volume, database, or DNS record
   - `+-` (replace) — even more dangerous; means the resource will be destroyed and recreated
5. Get review.
6. Merge to `main`. The `pulumi-deploy` workflow starts but pauses at the `prod` environment gate.
7. Approve the deployment in GitHub Actions (Settings → Environments → prod → Pending review).
8. Watch the run. Verify the apply succeeds.
9. Smoke test: `curl https://atlas.skafld.com/api/health`

**Roll back an infra change:**

There's no automatic rollback. Options:

- **Revert the PR** — open a revert PR, get it through the same flow. Cleanest.
- **Manual `pulumi up` on a previous commit** — last resort, only if the broken state can't wait. Run `pulumi up --stack prod` from a checkout of the last-good commit. Doc what you did in the next PR.

---

## Secret Changes

Secrets live in Doppler, not Pulumi. Change them there.

**Add or update a secret:**

1. Doppler dashboard → `skafld-atlas` project → `prd` config.
2. Add or update the secret.
3. Save. Railway picks up the change and redeploys within ~30s.
4. Verify: `railway logs --service atlas | tail -20` — confirm the service started cleanly.

**Special case — `ENCRYPTION_KEY`:** Do NOT change this directly. Use `infra/scripts/rotate-encryption-key.sh` and follow `runbooks/rotate-secrets.md`. Changing it directly will make encrypted data unreadable.

---

## Pre-Deploy Checklist (for risky changes)

For changes touching volumes, secrets, DNS, or anything in production data:

- [ ] Run `infra/scripts/volume-snapshot.sh` to capture current state
- [ ] Confirm the latest R2 backup is recent (< 24h old): `aws s3 ls s3://skafld-atlas-backups-prod/daily/ --endpoint-url <r2-endpoint> | tail -3`
- [ ] Tell Mike a deploy is happening
- [ ] Have the runbook for the operation open in a tab
- [ ] Have rollback steps reviewed before starting

---

## Common Pitfalls

**The Pulumi preview shows a volume being recreated.** Stop. This will destroy data. Likely causes: someone changed `volumes[].name` or `mountPath`. Fix the code so it matches the existing volume's config; don't merge the PR as-is.

**Doppler secret added but Railway didn't redeploy.** Confirm the Doppler-Railway integration is still connected. Dashboard → Integrations → Railway. Reconnect if missing.

**Cloudflare Access locked you out.** If you change the policy and your own email gets removed, you're locked out. Recovery: log into Cloudflare → Zero Trust → Access → Applications → Skafld Atlas → temporarily disable the policy, fix Pulumi, redeploy, re-enable.

**Domain shows as "pending" in Railway.** Cloudflare proxy is hiding the actual TLS handshake. Set the DNS record to "DNS only" (gray cloud) for ~5 minutes until Railway validates, then turn the proxy back on. Pulumi managed records default to proxied; toggle manually for this case.
