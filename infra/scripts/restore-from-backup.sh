#!/usr/bin/env bash
# restore-from-backup.sh — Restore Atlas data + uploads from an R2 backup.
#
# CRITICAL: This is destructive. It overwrites /app/data and /app/uploads.
# Always run a fresh `backup-now.sh` immediately before restoring, in case
# the restore is wrong and you need to roll back.
#
# Usage:
#   ./restore-from-backup.sh                       # interactive; lists backups
#   ./restore-from-backup.sh daily/2026-04-15-120000.tar.gz   # specific backup
#   ./restore-from-backup.sh --latest             # most recent daily backup

set -euo pipefail

: "${BACKUP_R2_BUCKET:?required}"
: "${BACKUP_R2_ACCESS_KEY_ID:?required}"
: "${BACKUP_R2_SECRET_ACCESS_KEY:?required}"
: "${BACKUP_R2_ENDPOINT:?required}"

export AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto

S3_OPTS=(--endpoint-url "$BACKUP_R2_ENDPOINT")

KEY=""
case "${1:-}" in
  "")
    echo "Available backups (most recent first):"
    aws s3 ls "s3://$BACKUP_R2_BUCKET/daily/" "${S3_OPTS[@]}" | sort -r | head -20
    echo
    read -rp "Backup key (e.g. daily/2026-04-15-120000.tar.gz): " KEY
    ;;
  --latest)
    KEY=$(aws s3 ls "s3://$BACKUP_R2_BUCKET/daily/" "${S3_OPTS[@]}" | \
      sort -r | head -1 | awk '{print "daily/" $NF}')
    echo "Latest backup: $KEY"
    ;;
  *)
    KEY="$1"
    ;;
esac

[[ -n "$KEY" ]] || { echo "No backup selected"; exit 1; }

echo
echo "About to restore from: $KEY"
echo "This will OVERWRITE /app/data and /app/uploads."
read -rp "Type 'yes' to continue: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "Aborted."; exit 1; }

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
ARCHIVE="$WORKDIR/restore.tar.gz"

echo "Downloading $KEY..."
aws s3 cp "s3://$BACKUP_R2_BUCKET/$KEY" "$ARCHIVE" "${S3_OPTS[@]}" --no-progress

echo "Stopping any running Atlas process (if applicable)..."
pkill -f "node.*atlas" 2>/dev/null || true
sleep 2

echo "Extracting to /..."
tar xzf "$ARCHIVE" -C /

echo
echo "Restore complete. Verify:"
echo "  ls -la /app/data /app/uploads"
echo "  sqlite3 /app/data/travel.db 'SELECT COUNT(*) FROM trips;'"
echo
echo "Then restart the container (Railway: railway service restart, or push a deploy)."
