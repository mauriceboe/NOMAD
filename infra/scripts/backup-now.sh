#!/usr/bin/env bash
# backup-now.sh — On-demand backup of Atlas data + uploads to R2.
#
# Can be run two ways:
#   1. Inside the Railway container (manual exec): pushes from local volumes.
#   2. From your local machine: pulls from Railway, archives locally, pushes
#      to R2. Requires `railway run` access.
#
# The container's existing cron job runs the in-container path automatically.
# This script is for ad-hoc backups (before deploys, before risky changes,
# etc.) and matches the same archive layout the cron job uses, so restores
# work identically.
#
# Archive layout in R2:
#   daily/YYYY-MM-DD-HHMMSS.tar.gz
#
# Usage:
#   ./backup-now.sh                 # runs inside container; assumes vol mounts
#   ./backup-now.sh --remote        # runs locally; pulls from Railway

set -euo pipefail

REMOTE=0
[[ "${1:-}" == "--remote" ]] && REMOTE=1

TIMESTAMP=$(date -u +%Y-%m-%d-%H%M%S)
ARCHIVE="atlas-backup-${TIMESTAMP}.tar.gz"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# ---------------------------------------------------------------------------
# Required env (provided by Railway/Pulumi via Doppler)
# ---------------------------------------------------------------------------

: "${BACKUP_R2_BUCKET:?required}"
: "${BACKUP_R2_ACCESS_KEY_ID:?required}"
: "${BACKUP_R2_SECRET_ACCESS_KEY:?required}"
: "${BACKUP_R2_ENDPOINT:?required}"

# ---------------------------------------------------------------------------
# Collect data
# ---------------------------------------------------------------------------

if [[ $REMOTE -eq 1 ]]; then
  echo "Pulling backup from Railway service..."
  command -v railway >/dev/null || { echo "railway CLI required for --remote"; exit 1; }
  railway run --service atlas -- \
    tar czf - -C / app/data app/uploads > "$WORKDIR/$ARCHIVE"
else
  echo "Archiving local /app/data and /app/uploads..."
  [[ -d /app/data ]] || { echo "/app/data not found — are you inside the container?"; exit 1; }
  [[ -d /app/uploads ]] || { echo "/app/uploads not found"; exit 1; }

  if [[ -f /app/data/travel.db ]] && command -v sqlite3 >/dev/null; then
    echo "  Checkpointing SQLite WAL..."
    sqlite3 /app/data/travel.db "PRAGMA wal_checkpoint(TRUNCATE);"
  fi

  tar czf "$WORKDIR/$ARCHIVE" -C / app/data app/uploads
fi

SIZE=$(du -h "$WORKDIR/$ARCHIVE" | cut -f1)
echo "Archive size: $SIZE"

# ---------------------------------------------------------------------------
# Upload to R2 via aws-cli (S3-compatible)
# ---------------------------------------------------------------------------

command -v aws >/dev/null || { echo "aws CLI required (brew install awscli)"; exit 1; }

export AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto

KEY="daily/$ARCHIVE"
echo "Uploading to s3://$BACKUP_R2_BUCKET/$KEY..."
aws s3 cp "$WORKDIR/$ARCHIVE" "s3://$BACKUP_R2_BUCKET/$KEY" \
  --endpoint-url "$BACKUP_R2_ENDPOINT" \
  --no-progress

echo "Done. Backup saved as $KEY"
