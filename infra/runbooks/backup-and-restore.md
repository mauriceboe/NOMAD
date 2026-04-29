# Backup & Restore Runbook — Skafld.Atlas

## What gets backed up

Two volumes contain all stateful data:

| Path | Contents | Size order |
|------|----------|-----------|
| `/app/data` | SQLite DB, JWT secret, encryption key, logs, backups, tmp | MB |
| `/app/uploads` | User-uploaded photos, files, covers, avatars | GB |

Everything else (code, config) is recreatable from Git + Doppler.

## Backup destinations

DestinationCadenceRetentionPurpose`/app/data/backups/` (in-volume)Hourly via cron in container7 daysQuick local restoreR2 `daily/`Daily at 03:00 UTC30 daysOff-site DRR2 `weekly/`Sunday 03:00 UTC90 daysMid-term retentionR2 `monthly/`1st of month 03:00 UTC365 daysLong-term retention

**Note on the R2 setup:** as of `@pulumi/cloudflare` 5.x, lifecycle rules and S3-compatible access keys aren't supported by the Pulumi provider. They're configured manually in the Cloudflare dashboard via `infra/scripts/bootstrap-cloudflare.sh` (one-time). The bucket itself is Pulumi-managed and drift-detected; the rules and keys are not. **Quarterly check** during the backup verification drill: confirm the three lifecycle rules still exist and the API token hasn't been revoked.

## Manual backup

Before any risky change:

```bash
./infra/scripts/backup-now.sh --remote
```

This runs from your laptop, pulls a snapshot from Railway, and pushes to R2 under `daily/`. Tagged with the current timestamp.

## Restore procedures

### Scenario 1: Recover a single trip / record

Use the in-volume hourly backup, not R2.

```bash
railway run --service atlas -- ls /app/data/backups/
railway run --service atlas -- sqlite3 /app/data/backups/<chosen>.db "SELECT * FROM trips WHERE id = ?"
# Manually copy the rows you need into the live DB via the Atlas admin UI
# or careful sqlite3 INSERTs.
```

Don't restore the whole DB to fix one record — too much data loss risk.

### Scenario 2: Restore from yesterday (recent corruption)

```bash
# 1. Snapshot current state first (in case the restore is wrong)
./infra/scripts/volume-snapshot.sh

# 2. Stop the Atlas service
railway service stop --service atlas

# 3. Run the restore inside the container's volume context
railway run --service atlas -- /infra-scripts/restore-from-backup.sh --latest

# 4. Restart
railway service start --service atlas

# 5. Verify
```
curl https://atlas.skafld.com/api/health
# Spot-check: log in, view a recent trip, confirm uploads load
```

### Scenario 3: Full DR — Railway service is gone

See `runbooks/disaster-recovery.md`. This is a different runbook because it involves rebuilding the service itself, not just restoring data.

## Verification (quarterly)

Untested backups are theoretical. Run this every quarter:

1. Pick a recent R2 backup (not the latest — pick one ~7 days old to test retention).
2. Spin up a local Docker container with empty volumes:
   ```bash
   docker run --rm -it \
     -v $(pwd)/test-data:/app/data \
     -v $(pwd)/test-uploads:/app/uploads \
     -e BACKUP_R2_BUCKET=... \
     -e BACKUP_R2_ACCESS_KEY_ID=... \
     -e BACKUP_R2_SECRET_ACCESS_KEY=... \
     -e BACKUP_R2_ENDPOINT=... \
     skafld-atlas:latest /infra-scripts/restore-from-backup.sh daily/<chosen>.tar.gz
   ```
3. Start Atlas locally, log in, verify a few trips load with their uploaded photos intact.
4. Tear down. Note the date in `runbooks/restore-test-log.md`.

If any step fails, that's a P0 — fix the backup pipeline before doing anything else.

## Backup health checks

Drift detection won't catch silent backup failures (e.g., R2 credentials expired, cron stopped firing). Add these to a regular check:

- **Daily:** `aws s3 ls s3://skafld-atlas-backups-prod/daily/ --endpoint-url <r2-endpoint> | tail -1` should show today's date.
- **Weekly:** Same for `weekly/`.
- **Monthly:** Same for `monthly/`.

Worth automating these into a tiny GitHub Action that opens an issue if the latest backup is older than expected. Not implemented in v1 — add when convenient.
