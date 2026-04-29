#!/usr/bin/env bash
# railway-graphql.sh — Railway GraphQL API wrapper used by Pulumi components.
#
# Railway has no Pulumi provider. This script is invoked by pulumi.Command
# resources to perform CRUD against Railway's GraphQL API. Each subcommand
# is idempotent — safe to call repeatedly with the same args.
#
# Auth: requires RAILWAY_TOKEN in env (project token, not personal token).
# Project: hardcoded via RAILWAY_PROJECT_ID env, set in pulumi local.Command env.
#
# Usage:
#   railway-graphql.sh lookup-service <service-name>
#   railway-graphql.sh upsert-env <service-id> <env-json>
#   railway-graphql.sh attach-domain <service-id> <domain>
#   railway-graphql.sh ensure-volume <service-id> <volume-name> <mount-path> <size-gb>
#   railway-graphql.sh get-hostname <service-id>

set -euo pipefail

API="https://backboard.railway.app/graphql/v2"
TOKEN="${RAILWAY_TOKEN:?RAILWAY_TOKEN env var required}"
PROJECT_ID="${RAILWAY_PROJECT_ID:?RAILWAY_PROJECT_ID env var required}"
ENVIRONMENT_ID="${RAILWAY_ENVIRONMENT_ID:?RAILWAY_ENVIRONMENT_ID env var required}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

gql() {
  local query="$1"
  curl -sS -X POST "$API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg q "$query" '{query: $q}')"
}

gql_with_vars() {
  local query="$1"
  local vars="$2"
  curl -sS -X POST "$API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg q "$query" --argjson v "$vars" '{query: $q, variables: $v}')"
}

die() {
  echo "Error: $*" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

cmd_lookup_service() {
  local name="$1"
  local query='query($projectId: String!) {
    project(id: $projectId) {
      services { edges { node { id name } } }
    }
  }'
  local vars
  vars=$(jq -n --arg pid "$PROJECT_ID" '{projectId: $pid}')
  local resp
  resp=$(gql_with_vars "$query" "$vars")

  local id
  id=$(echo "$resp" | jq -r --arg name "$name" \
    '.data.project.services.edges[] | select(.node.name == $name) | .node.id' | head -1)

  [[ -n "$id" && "$id" != "null" ]] || die "Service '$name' not found in project $PROJECT_ID. Run bootstrap-railway.sh first."
  echo "$id"
}

cmd_upsert_env() {
  local service_id="$1"
  local env_json="$2"

  echo "$env_json" | jq -r 'to_entries[] | "\(.key)\t\(.value)"' | \
  while IFS=$'\t' read -r key value; do
    local mutation='mutation($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }'
    local vars
    vars=$(jq -n \
      --arg pid "$PROJECT_ID" \
      --arg eid "$ENVIRONMENT_ID" \
      --arg sid "$service_id" \
      --arg k "$key" \
      --arg v "$value" \
      '{input: {projectId: $pid, environmentId: $eid, serviceId: $sid, name: $k, value: $v}}')
    gql_with_vars "$mutation" "$vars" > /dev/null
  done

  echo "ok"
}

cmd_attach_domain() {
  local service_id="$1"
  local domain="$2"

  local query='query($sid: String!, $eid: String!) {
    domains(serviceId: $sid, environmentId: $eid) {
      customDomains { domain }
      serviceDomains { domain }
    }
  }'
  local vars
  vars=$(jq -n --arg sid "$service_id" --arg eid "$ENVIRONMENT_ID" \
    '{sid: $sid, eid: $eid}')
  local existing
  existing=$(gql_with_vars "$query" "$vars" | \
    jq -r --arg d "$domain" '.data.domains.customDomains[]? | select(.domain == $d) | .domain')

  if [[ "$existing" == "$domain" ]]; then
    echo "already-attached"
    return 0
  fi

  local mutation='mutation($input: CustomDomainCreateInput!) {
    customDomainCreate(input: $input) { id }
  }'
  vars=$(jq -n \
    --arg eid "$ENVIRONMENT_ID" \
    --arg sid "$service_id" \
    --arg d "$domain" \
    '{input: {environmentId: $eid, serviceId: $sid, domain: $d}}')
  gql_with_vars "$mutation" "$vars" > /dev/null
  echo "attached"
}

cmd_ensure_volume() {
  local service_id="$1"
  local volume_name="$2"
  local mount_path="$3"
  local size_gb="$4"

  local query='query($pid: String!) {
    project(id: $pid) { volumes { edges { node { id name } } } }
  }'
  local vars
  vars=$(jq -n --arg pid "$PROJECT_ID" '{pid: $pid}')
  local found
  found=$(gql_with_vars "$query" "$vars" | \
    jq -r --arg n "$volume_name" '.data.project.volumes.edges[] | select(.node.name == $n) | .node.id' | head -1)

  [[ -n "$found" && "$found" != "null" ]] || \
    die "Volume '$volume_name' not found. Create it via bootstrap-railway.sh."

  echo "ok"
}

cmd_get_hostname() {
  local service_id="$1"
  local query='query($sid: String!, $eid: String!) {
    domains(serviceId: $sid, environmentId: $eid) {
      serviceDomains { domain }
    }
  }'
  local vars
  vars=$(jq -n --arg sid "$service_id" --arg eid "$ENVIRONMENT_ID" \
    '{sid: $sid, eid: $eid}')
  gql_with_vars "$query" "$vars" | \
    jq -r '.data.domains.serviceDomains[0].domain'
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

case "${1:-}" in
  lookup-service)  shift; cmd_lookup_service "$@" ;;
  upsert-env)      shift; cmd_upsert_env "$@" ;;
  attach-domain)   shift; cmd_attach_domain "$@" ;;
  ensure-volume)   shift; cmd_ensure_volume "$@" ;;
  get-hostname)    shift; cmd_get_hostname "$@" ;;
  *) die "Unknown subcommand: ${1:-}. See script header for usage." ;;
esac
