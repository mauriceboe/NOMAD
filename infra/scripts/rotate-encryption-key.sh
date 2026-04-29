#!/usr/bin/env bash
# rotate-encryption-key.sh — Rotate ENCRYPTION_KEY safely.
#
# WARNING: ENCRYPTION_KEY is used by Atlas to encrypt sensitive fields at
# rest. If you rotate it without re-encrypting existing data, that data
# becomes unreadable.

set -euo pipefail

echo "=== ENCRYPTION_KEY rotation ==="
echo
echo "This procedure has manual steps. Read carefully before continuing."
echo
read -rp "Type 'I understand' to continue: " CONFIRM
[[ "$CONFIRM" == "I understand" ]] || { echo "Aborted."; exit 1; }

echo
echo "Step 1: Capturing pre-rotation snapshot..."
./infra/scripts/volume-snapshot.sh

NEW_KEY=$(openssl rand -hex 32)
echo
echo "Step 2: New ENCRYPTION_KEY generated."
echo "  Length: ${#NEW_KEY} chars"
echo "  Value:  $NEW_KEY"
echo
echo "Save this securely — you will need it for the next steps."
echo

cat <<EOF
Step 3: MANUAL — Add the new key alongside the old one.

  In Doppler (skafld-atlas / prd):
    1. Add a new secret:  ENCRYPTION_KEY_NEW = $NEW_KEY
    2. Leave ENCRYPTION_KEY unchanged for now.
    3. Save. Railway will redeploy automatically.

  Verify Atlas is running with both keys available:
    railway logs --service atlas | grep -i 'encryption keys loaded'

Press Enter when this is done...
EOF
read -r

cat <<EOF
Step 4: MANUAL — Run the re-encryption migration.

  This must be a script in the Atlas codebase that:
    - Reads each encrypted field with ENCRYPTION_KEY (old)
    - Re-encrypts it with ENCRYPTION_KEY_NEW (new)
    - Writes it back

  Run it via:
    railway run --service atlas -- node scripts/reencrypt-all.js

  Verify all data was re-encrypted:
    - Check the migration's report output
    - Hit a few endpoints that read encrypted fields and confirm they work

Press Enter when migration is complete and verified...
EOF
read -r

cat <<EOF
Step 5: MANUAL — Promote the new key.

  In Doppler (skafld-atlas / prd):
    1. Update ENCRYPTION_KEY = $NEW_KEY
    2. Delete ENCRYPTION_KEY_NEW
    3. Save. Railway will redeploy.

  Verify:
    - Atlas starts cleanly with the new key as primary
    - All endpoints work
    - No "decrypt failed" errors in logs for at least 24 hours

Press Enter when complete...
EOF
read -r

echo
echo "=== Rotation complete ==="
echo
echo "Post-rotation:"
echo "  - Verify clean logs for 24 hours before deleting the snapshot."
echo "  - The pre-rotation snapshot is in ./snapshots/ — keep it for at least"
echo "    7 days in case of latent decrypt failures."
echo "  - Update runbooks/rotate-secrets.md with the rotation date."
