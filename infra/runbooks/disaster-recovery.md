# Disaster Recovery Runbook — Skafld.Atlas

When everything is gone and you need to rebuild from scratch.

## Scope

This runbook covers:
- Railway service is destroyed or unrecoverable
- Volume corruption beyond local recovery
- Region outage requiring rebuild elsewhere
- Account compromise requiring full migration

This runbook does NOT cover:
- Bug deploys → see `deploy.md` for rollback
- Lost single records → see `backup-and-restore.md`
- Locked-out auth → see `rotate-secrets.md`

## RTO / RPO targets

These are the targets. Test against them quarterly.

| Metric | Target | Rationale |
|--------|--------|-----------|
| RTO (Recovery Time Objective) | 4 hours | Internal tool, not customer-facing |
| RPO (Recovery Point Objective) | 24 hours | Daily backup cadence |

If targets aren't being hit during DR drills, either improve the runbook or revise the targets (and tell the team).

## Prerequisites

Before starting recovery, you need:

- [ ] Access to GitHub repo `skafld-studio/skafld-atlas`
- [ ] Pulumi account with access to the `skafld/atlas` stack
- [ ] Railway account access (or ability to create a fresh one)
- [ ] Cloudflare account access (for DNS + R2)
- [ ] Doppler account access
- [ ] R2 backup bucket still intact (this is the critical assumption — if backups are also gone, RPO is "the last full snapshot you have on disk somewhere")
- [ ] Your laptop with: `pulumi`, `railway`, `gh`, `doppler`, `aws`, `jq` installed

If any of these are gone too, this is a worse situation than DR — escalate to recovering the *meta* infrastructure first.

## Recovery procedure

### Phase 1: Stand up new infrastructure (target: 90 minutes)

1. **Verify backups are reachable.** Before doing anything else:
   ```bash
   aws s3 ls s3://skafld-atlas-backups-prod/daily/ --endpoint-url <r2-endpoint>
   ```
   If this fails, stop. Recovery is impossible without backups; figure out the R2 access issue first.

2. **Decide: same Railway account or new?**
   - If Railway account is fine → reuse it, move to step 3.
   - If Railway account is compromised → create a new account, then continue.

3. **Re-bootstrap Railway:**
   ```bash
   cd skafld-atlas
   ./infra/scripts/bootstrap-railway.sh
   ```
   Note the new project ID and environment ID.

4. **Update GitHub Actions secrets** with the new IDs:
   ```bash
   gh secret set RAILWAY_PROJECT_ID --body "<new-id>"
   gh secret set RAILWAY_ENVIRONMENT_ID --body "<new-id>"
   ```

5. **Connect Railway service to GitHub repo** via Railway dashboard:
   - Service → Settings → Source → Connect Repo
   - Repo: `skafld-studio/skafld-atlas`, Dockerfile, root `/`

6. **Trigger initial deploy.** Push a no-op commit or use the dashboard. Wait for build to succeed. Container will start with empty volumes — that's expected.

7. **Run Pulumi up** to apply config:
   ```bash
   cd infra/pulumi
   export RAILWAY_PROJECT_ID=<new>
   export RAILWAY_ENVIRONMENT_ID=<new>
   pulumi up --stack prod
   ```
   This sets env vars, attaches the domain, configures Cloudflare DNS + Access.

### Phase 2: Restore data (target: 60 minutes)

1. **Pick a backup.** Latest daily, unless you suspect the latest backup is corrupted (e.g., the failure happened mid-write).
   ```bash
   aws s3 ls s3://skafld-atlas-backups-prod/daily/ --endpoint-url <r2-endpoint> | tail -10
   ```

2. **Stop the Atlas service** so it's not writing to volumes during restore:
   ```bash
   railway service stop --service atlas
   ```

3. **Restore:**
   ```bash
   railway run --service atlas -- /infra-scripts/restore-from-backup.sh daily/<chosen>.tar.gz
   ```

4. **Restart:**
   ```bash
   railway service start --service atlas
   ```

5. **Verify:**
   - `curl https://atlas.skafld.com/api/health` → 200
   - Log in via the web UI
   - Open a recent trip, verify it loads
   - Open a trip with photos, verify uploads load
   - Check `railway logs --service atlas` for decrypt errors (would indicate ENCRYPTION_KEY mismatch with restored data)

### Phase 3: Verify and communicate (target: 30 minutes)

1. **Smoke test the full app:**
   - Create a new trip
   - Add a budget item
   - Upload a photo
   - Log out, log back in
   - Verify the new data persists

2. **Tell Mike** the recovery is complete and what (if anything) was lost.

3. **Document the incident** in `runbooks/incidents/YYYY-MM-DD-incident-name.md`:
   - What happened
   - When detected
   - Recovery start/end times
   - Data loss (if any)
   - What we did
   - What to change to prevent recurrence

4. **Schedule a post-mortem** within a week if the DR was real (not a drill).

## What to do if the runbook fails

The runbook is wrong somewhere. Don't keep trying the broken step — note where it failed, work around it, and fix the runbook in the next PR. The point of DR is to recover, not to follow procedure.

## DR drills

Run a drill at least once a year, ideally twice. A drill = run this procedure end-to-end against a *parallel* deploy (different domain, different volume names) and time it. Update RTO/RPO numbers based on actual performance.

A drill is the only thing that turns this document from theoretical to actually-useful.
