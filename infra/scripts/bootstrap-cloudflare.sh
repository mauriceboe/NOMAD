#!/usr/bin/env bash
# bootstrap-cloudflare.sh — One-time manual setup for Cloudflare R2 resources
# that the Pulumi provider doesn't yet support.
#
# Run this ONCE, after `pulumi up` has created the R2 bucket itself.
# It walks you through the Cloudflare dashboard steps that can't be done
# via @pulumi/cloudflare 5.x.
#
# What you'll set up manually:
#   1. R2 lifecycle rules (object expiration by prefix)
#   2. R2 S3-compatible API token (access key + secret) scoped to the bucket
#
# After this completes, you'll write the access key + secret back into
# Pulumi config so subsequent `pulumi up` runs propagate them to Railway.

set -euo pipefail

BUCKET_NAME="${BUCKET_NAME:-skafld-atlas-backups-prod}"
DAILY_DAYS=30
WEEKLY_DAYS=90
MONTHLY_DAYS=365

cat <<EOF
=== Cloudflare R2 manual bootstrap ===

This script is interactive. Have the Cloudflare dashboard open in your
browser:
  https://dash.cloudflare.com/?to=/:account/r2/overview

Bucket: $BUCKET_NAME

Press Enter to continue...
EOF
read -r

# ---------------------------------------------------------------------------
# Step 1 — Lifecycle rules
# ---------------------------------------------------------------------------

cat <<EOF

---
Step 1 of 2: Configure lifecycle rules
---

In the Cloudflare dashboard:
  1. R2 → Buckets → $BUCKET_NAME → Settings → Object lifecycle rules
  2. Add three rules:

     Rule A: "expire-daily"
       Match: Prefix = "daily/"
       Action: Delete uploaded objects after $DAILY_DAYS days

     Rule B: "expire-weekly"
       Match: Prefix = "weekly/"
       Action: Delete uploaded objects after $WEEKLY_DAYS days

     Rule C: "expire-monthly"
       Match: Prefix = "monthly/"
       Action: Delete uploaded objects after $MONTHLY_DAYS days

  3. Save each rule.

Press Enter when all three rules are saved...
EOF
read -r

# ---------------------------------------------------------------------------
# Step 2 — API token (S3-compatible access key)
# ---------------------------------------------------------------------------

cat <<EOF

---
Step 2 of 2: Create an S3-compatible API token
---

In the Cloudflare dashboard:
  1. R2 → API → Manage API tokens → Create API token
  2. Token name: skafld-atlas-backups-rw
  3. Permissions: Object Read & Write
  4. Specify bucket: $BUCKET_NAME
  5. TTL: Forever (or set a calendar reminder to rotate annually)
  6. Click "Create API Token"
  7. Copy the "Access Key ID" and "Secret Access Key"

Once you have both values, paste them below.

EOF

read -rp "Access Key ID:        " ACCESS_KEY_ID
read -rsp "Secret Access Key:    " SECRET_ACCESS_KEY
echo

if [[ -z "$ACCESS_KEY_ID" || -z "$SECRET_ACCESS_KEY" ]]; then
  echo "Empty values entered. Aborting."
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 3 — Write back into Pulumi config
# ---------------------------------------------------------------------------

cat <<EOF

---
Step 3: Writing values to Pulumi config (prod stack)
---
EOF

cd "$(dirname "$0")/../pulumi"

pulumi config set skafld-atlas:r2AccessKeyId "$ACCESS_KEY_ID" --stack prod
pulumi config set --secret skafld-atlas:r2SecretAccessKey "$SECRET_ACCESS_KEY" --stack prod

cat <<EOF

---
Done.
---

Verify:
  pulumi config --stack prod | grep r2

Next:
  pulumi up --stack prod        # propagates new credentials to Railway env

Drift watch:
  These resources are NOT tracked by Pulumi (lifecycle rules + access keys).
  Quarterly: verify in the Cloudflare dashboard that all three lifecycle
  rules still exist and the API token has not been revoked.

  Documented in: infra/runbooks/backup-and-restore.md
EOF
