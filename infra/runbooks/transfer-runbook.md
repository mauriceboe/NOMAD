# Transfer Runbook — Skafld.Atlas

Atlas is currently internal-only. This runbook exists anyway for two reasons:

1. **Muscle memory.** The transfer pattern is core to SkaFld's venture model. Practicing on Atlas (low stakes) prepares the team for client transfers (high stakes).
2. **Optionality.** If Atlas ever becomes a SkaFld product offering or gets handed to a partner, this is what we'd need.

The pattern below mirrors the one used for client ventures (Comply AI etc.) — the same shape, tested at small scale.

---

## The transfer model

Transfer = redeploy the entire stack in a new set of accounts, migrate data, point DNS, decommission the old stack. The only thing that changes between source and target is the *credentials and account IDs* that Pulumi reads from config. Pulumi code itself is unchanged.

This works because the stack is parameterized:

```yaml
# Pulumi.prod.yaml (current)
config:
  skafld-atlas:cloudflareZone: skafld.com
  skafld-atlas:githubOwner: skafld-studio
  ...
```

A transfer creates `Pulumi.client.yaml` with different values, runs `pulumi up`, migrates data, swaps DNS.

---

## Transfer phases

### T-2 weeks: Pre-flight

- [ ] Recipient creates accounts: Railway, Cloudflare, Doppler, GitHub org (or repo), R2 (Cloudflare bundles this)
- [ ] Recipient adds SkaFld as admin on each account
- [ ] Capture all recipient account IDs:
  - Cloudflare account ID
  - Cloudflare zone ID for their domain
  - Railway team ID
  - Doppler workspace
  - GitHub org/owner
- [ ] Recipient picks a target domain (e.g., `atlas.recipientcompany.com`)
- [ ] Create a new Pulumi stack pointing at recipient accounts:
  ```bash
  cd infra/pulumi
  pulumi stack init recipient
  ```
- [ ] Populate `Pulumi.recipient.yaml` with recipient values (mirror prod, swap account IDs and domain)
- [ ] Run `pulumi preview --stack recipient` — confirm the plan looks right (everything as a `+ create`)
- [ ] Tear down preview: do NOT `pulumi up` yet

### T-1 week: Dry run

- [ ] Run `pulumi up --stack recipient` — provisions parallel infra in recipient accounts
- [ ] Recipient's Atlas service comes up empty
- [ ] Take a fresh snapshot of source: `./infra/scripts/volume-snapshot.sh`
- [ ] Restore snapshot to recipient's Atlas via `restore-from-backup.sh` (point env vars at recipient's R2 bucket; copy the latest source backup over to recipient's bucket first)
- [ ] Smoke test recipient's Atlas at its temporary URL (Railway-provided hostname before DNS swap)
- [ ] Document any issues — likely candidates: encryption key mismatch, OIDC config differences, DNS propagation
- [ ] Tear down recipient infra after dry run: `pulumi destroy --stack recipient` (keeps the stack config, removes resources)

### T-day: Cutover

- [ ] Announce planned downtime to users (45 min window)
- [ ] Snapshot source state final time: `./infra/scripts/volume-snapshot.sh`
- [ ] Stop source Atlas: `railway service stop --service atlas` (in source Railway account)
- [ ] Take post-stop incremental backup of any in-flight changes
- [ ] Provision recipient infra: `pulumi up --stack recipient`
- [ ] Restore data into recipient infra
- [ ] Update DNS: change source `atlas.skafld.com` to point at recipient's Railway hostname (or update recipient's own domain)
- [ ] Recipient verifies access via their domain
- [ ] Both parties sign off

### T+1 day to T+30: Cool-off

- [ ] Source stack remains provisioned but stopped, in case rollback is needed
- [ ] Recipient operates normally
- [ ] Daily check-ins for the first week

### T+30: Decommission source

- [ ] Confirm recipient is operating cleanly
- [ ] Final snapshot of source for archive: `./infra/scripts/volume-snapshot.sh` → save to long-term archive (S3 Glacier or similar)
- [ ] Run `pulumi destroy --stack prod` against source
- [ ] Archive (don't delete) the Pulumi stack: `pulumi stack rename prod prod-archived-YYYY-MM-DD`
- [ ] Transfer GitHub repo ownership to recipient (Settings → Transfer ownership)
- [ ] Update this file with completion notes

---

## Per-service transfer notes

Things that need special attention for each provider:

**Railway:** Each account has its own project structure. Recipient's Railway will have a fresh project ID and environment ID. These propagate via `Pulumi.recipient.yaml`. The `bootstrap-railway.sh` script creates the recipient's project — run it pointed at recipient's account first.

**Cloudflare:** R2 buckets are tied to accounts. Backups in source's R2 must be copied to recipient's R2 before cutover (use `aws s3 sync` with two endpoint URLs). DNS records are tied to zones, which are tied to accounts; recipient must own the target domain's zone.

**Doppler:** Secrets must be re-entered in recipient's Doppler workspace. Don't export source secrets to a file — copy them through Doppler's transfer features or via secure channels (1Password share). Some secrets need regeneration: any OAuth client secrets must be re-issued for recipient's domains.

**GitHub:** Repo transfer is a single action (Settings → Transfer). Issues, PRs, Actions secrets, and webhooks transfer with the repo. Branch protection rules transfer. The Pulumi Github provider needs a new GITHUB_TOKEN scoped to recipient's org afterward.

---

## Rollback

If cutover fails and recipient can't bring Atlas up:

1. Restart source: `railway service start --service atlas` (in source account)
2. Revert DNS to point back at source's Railway hostname
3. Communicate the rollback to users
4. Keep recipient infra in place (don't destroy) — debug from there
5. Re-attempt cutover when issues are resolved

The 30-day cool-off period exists specifically so source is recoverable during this window.

---

## Internal-only addendum

Since Atlas is internal-only today, the realistic transfer is "from one SkaFld account to another" if SkaFld restructures or migrates accounts. The procedure is the same.
