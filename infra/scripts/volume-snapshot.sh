#!/usr/bin/env bash
# volume-snapshot.sh — Captures a complete Atlas state snapshot to local disk.
#
# Use cases:
#   - Migration: snapshot before moving Atlas to new infrastructure
#   - DR drill: capture a known-good state to test restore against
#   - Forensics: preserve state at a specific moment for analysis
#
# Output: ./snapshots/atlas-snapshot-YYYY-MM-DD-HHMMSS/
#   ├── data.tar.gz       (the SQLite DB + secrets + logs + backups)
#   ├── uploads.tar.gz    (user-uploaded photos/files/avatars/covers)
#   ├── env.json          (Doppler-managed env vars at snapshot time)
#   ├── pulumi-state.json (current Pulumi stack outputs)
#   └── manifest.json     (metadata: timestamp, git sha, sizes, checksums)

set -euo pipefail

TIMESTAMP=$(date -u +%Y-%m-%d-%H%M%S)
SNAPSHOT_DIR="./snapshots/atlas-snapshot-${TIMESTAMP}"
mkdir -p "$SNAPSHOT_DIR"

echo "=== Atlas volume snapshot ==="
echo "Output: $SNAPSHOT_DIR"
echo

command -v railway >/dev/null || { echo "railway CLI required"; exit 1; }

echo "Pulling /app/data..."
railway run --service atlas -- \
  sh -c "sqlite3 /app/data/travel.db 'PRAGMA wal_checkpoint(TRUNCATE);' && \
         tar czf - -C /app data" > "$SNAPSHOT_DIR/data.tar.gz"

echo "Pulling /app/uploads..."
railway run --service atlas -- \
  tar czf - -C /app uploads > "$SNAPSHOT_DIR/uploads.tar.gz"

if command -v doppler >/dev/null; then
  echo "Snapshotting Doppler env..."
  doppler secrets download \
    --project skafld-atlas \
    --config prd \
    --no-file \
    --format json > "$SNAPSHOT_DIR/env.json"
else
  echo "  doppler CLI not found; skipping env snapshot"
  echo "{}" > "$SNAPSHOT_DIR/env.json"
fi

if command -v pulumi >/dev/null && [[ -d infra/pulumi ]]; then
  echo "Snapshotting Pulumi outputs..."
  (cd infra/pulumi && pulumi stack output --json --stack prod) > "$SNAPSHOT_DIR/pulumi-state.json"
else
  echo "  pulumi not found or not in infra repo; skipping"
  echo "{}" > "$SNAPSHOT_DIR/pulumi-state.json"
fi

GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
DATA_SIZE=$(du -h "$SNAPSHOT_DIR/data.tar.gz" | cut -f1)
UPLOADS_SIZE=$(du -h "$SNAPSHOT_DIR/uploads.tar.gz" | cut -f1)
DATA_SHA=$(shasum -a 256 "$SNAPSHOT_DIR/data.tar.gz" | cut -d' ' -f1)
UPLOADS_SHA=$(shasum -a 256 "$SNAPSHOT_DIR/uploads.tar.gz" | cut -d' ' -f1)

cat > "$SNAPSHOT_DIR/manifest.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "git_sha": "$GIT_SHA",
  "data": {
    "size": "$DATA_SIZE",
    "sha256": "$DATA_SHA"
  },
  "uploads": {
    "size": "$UPLOADS_SIZE",
    "sha256": "$UPLOADS_SHA"
  }
}
EOF

echo
echo "Snapshot complete:"
ls -lh "$SNAPSHOT_DIR"
echo
echo "Total size: $(du -sh "$SNAPSHOT_DIR" | cut -f1)"
