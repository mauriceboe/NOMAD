#!/usr/bin/env bash
# bootstrap-railway.sh — One-time Railway provisioning for Skafld.Atlas.
#
# Run this ONCE per environment, before the first `pulumi up`. It uses the
# Railway CLI (not the GraphQL API) to do things the GraphQL API doesn't
# support cleanly: creating the project, service, and volumes.
#
# After this runs successfully, Pulumi takes over for ongoing config.
#
# Prerequisites:
#   - Railway CLI installed: brew install railway
#   - Logged in: railway login
#   - jq installed
#
# Outputs:
#   - Prints the Railway project ID and environment ID. Save these — you'll
#     need them as env vars for `pulumi up`:
#       export RAILWAY_PROJECT_ID=<printed>
#       export RAILWAY_ENVIRONMENT_ID=<printed>

set -euo pipefail

PROJECT_NAME="skafld-atlas"
SERVICE_NAME="atlas"
ENV_NAME="production"
DATA_VOLUME_NAME="atlas-data"
DATA_VOLUME_PATH="/app/data"
DATA_VOLUME_SIZE_GB=5
UPLOADS_VOLUME_NAME="atlas-uploads"
UPLOADS_VOLUME_PATH="/app/uploads"
UPLOADS_VOLUME_SIZE_GB=20

echo "=== Skafld.Atlas Railway bootstrap ==="
echo

# ---------------------------------------------------------------------------
# Sanity checks
# ---------------------------------------------------------------------------

command -v railway >/dev/null || { echo "railway CLI not found. brew install railway"; exit 1; }
command -v jq >/dev/null || { echo "jq not found. brew install jq"; exit 1; }
railway whoami >/dev/null || { echo "Not logged in. Run: railway login"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Create or get project
# ---------------------------------------------------------------------------

echo "Step 1: Creating Railway project '$PROJECT_NAME'..."
if railway list --json | jq -e --arg n "$PROJECT_NAME" '.[] | select(.name == $n)' >/dev/null; then
  echo "  Project already exists."
else
  railway init --name "$PROJECT_NAME"
fi

railway link --project "$PROJECT_NAME"

PROJECT_ID=$(railway status --json | jq -r '.id')
ENVIRONMENT_ID=$(railway status --json | jq -r --arg n "$ENV_NAME" \
  '.environments[] | select(.name == $n) | .id')

[[ -n "$PROJECT_ID" ]] || { echo "Failed to read project ID"; exit 1; }
[[ -n "$ENVIRONMENT_ID" ]] || { echo "Failed to read environment ID"; exit 1; }

echo "  Project ID:     $PROJECT_ID"
echo "  Environment ID: $ENVIRONMENT_ID"

# ---------------------------------------------------------------------------
# 2. Create service
# ---------------------------------------------------------------------------

echo "Step 2: Creating service '$SERVICE_NAME'..."
if railway service list --json 2>/dev/null | jq -e --arg n "$SERVICE_NAME" \
  '.[] | select(.name == $n)' >/dev/null; then
  echo "  Service already exists."
else
  railway service create --name "$SERVICE_NAME"
  echo "  NOTE: Connect this service to the GitHub repo via the Railway dashboard:"
  echo "        Settings → Source → Connect Repo → skafld-studio/skafld-atlas"
  echo "        Build: Dockerfile, root: /"
fi

# ---------------------------------------------------------------------------
# 3. Create volumes
# ---------------------------------------------------------------------------

echo "Step 3: Creating persistent volumes..."

create_volume_if_missing() {
  local name="$1"
  local mount="$2"
  local size="$3"
  if railway volume list --json 2>/dev/null | jq -e --arg n "$name" \
    '.[] | select(.name == $n)' >/dev/null; then
    echo "  Volume '$name' already exists."
  else
    railway volume create \
      --service "$SERVICE_NAME" \
      --name "$name" \
      --mount-path "$mount"
    echo "  Created volume '$name' at '$mount'."
    echo "  NOTE: Adjust size to ${size}GB via dashboard if needed (CLI doesn't expose size)."
  fi
}

create_volume_if_missing "$DATA_VOLUME_NAME" "$DATA_VOLUME_PATH" "$DATA_VOLUME_SIZE_GB"
create_volume_if_missing "$UPLOADS_VOLUME_NAME" "$UPLOADS_VOLUME_PATH" "$UPLOADS_VOLUME_SIZE_GB"

# ---------------------------------------------------------------------------
# 4. Done — print env vars to export
# ---------------------------------------------------------------------------

echo
echo "=== Bootstrap complete ==="
echo
echo "Add these to your shell or .env.pulumi file:"
echo
echo "  export RAILWAY_PROJECT_ID=$PROJECT_ID"
echo "  export RAILWAY_ENVIRONMENT_ID=$ENVIRONMENT_ID"
echo
echo "Next steps:"
echo "  1. In the Railway dashboard, connect the '$SERVICE_NAME' service to the"
echo "     skafld-studio/skafld-atlas GitHub repo (Dockerfile build)."
echo "  2. Trigger an initial deploy from main."
echo "  3. cd infra/pulumi && pulumi up --stack prod"
echo
