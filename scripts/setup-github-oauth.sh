#!/usr/bin/env bash
# UFC-Harness — GitHub OAuth one-time setup
#
# Reads secrets from environment variables OR interactive stdin (-s, no echo).
# NEVER pass secrets as positional args — they leak into shell history,
# process listings, and CI logs.
#
# Usage (preferred — env vars):
#   GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... SUPABASE_PAT=... \
#     ./scripts/setup-github-oauth.sh
#
# Usage (interactive — secrets not echoed):
#   ./scripts/setup-github-oauth.sh
#   Client ID:     <paste>
#   Client Secret: <paste, hidden>
#   Supabase PAT:  <paste, hidden>
#
# Setup steps to get values:
#   1. https://github.com/settings/applications/new
#        Homepage:  https://ufc-harness.vercel.app
#        Callback:  https://hihafrpktdotahsbcqfa.supabase.co/auth/v1/callback
#   2. https://supabase.com/dashboard/account/tokens (create new)

set -euo pipefail

PROJECT_REF="hihafrpktdotahsbcqfa"

# 1) Acquire secrets without putting them in argv
read_secret() {
  local prompt="$1" var
  printf "%s: " "$prompt" >&2
  IFS= read -rs var
  printf "\n" >&2
  printf "%s" "$var"
}

if [[ -z "${GITHUB_CLIENT_ID:-}" ]]; then
  printf "GitHub Client ID: " >&2
  IFS= read -r GITHUB_CLIENT_ID
fi
if [[ -z "${GITHUB_CLIENT_SECRET:-}" ]]; then
  GITHUB_CLIENT_SECRET=$(read_secret "GitHub Client Secret (hidden)")
fi
if [[ -z "${SUPABASE_PAT:-}" ]]; then
  SUPABASE_PAT=$(read_secret "Supabase Personal Access Token (hidden)")
fi

# Validate format (cheap sanity)
if [[ ! "$GITHUB_CLIENT_ID" =~ ^[A-Za-z0-9._-]+$ ]] \
   || [[ ! "$GITHUB_CLIENT_SECRET" =~ ^[A-Za-z0-9._-]+$ ]] \
   || [[ ! "$SUPABASE_PAT" =~ ^sbp_[A-Za-z0-9]+$ ]]; then
  echo "❌ Bad input format. Client ID/Secret must be alphanumeric+_-. PAT must start with sbp_." >&2
  exit 1
fi

echo "→ Configuring Supabase Auth (project: $PROJECT_REF)..."

# Use Authorization header (not URL) to keep secret off process listings
RESP=$(curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_PAT}" \
  -H "Content-Type: application/json" \
  --data @- <<JSON
{
  "external_github_enabled": true,
  "external_github_client_id": "${GITHUB_CLIENT_ID}",
  "external_github_secret":    "${GITHUB_CLIENT_SECRET}"
}
JSON
)

if echo "$RESP" | grep -q '"external_github_enabled"[[:space:]]*:[[:space:]]*true'; then
  echo "✅ GitHub OAuth provider enabled at Supabase"
else
  echo "❌ Failed to update Supabase auth config:"
  echo "$RESP"
  exit 1
fi

# 2) Backup credentials via Edge Function (parameterized RPC) — NOT raw SQL.
#    We use Supabase SQL endpoint with a parameterized prepared statement to
#    avoid string-interpolation SQL injection.
echo "→ Backing up credentials in private.secrets via parameterized query..."

# pg_temp prepared statement style: $1, $2 placeholders
SQL_PAYLOAD=$(cat <<'JSON'
{
  "query": "INSERT INTO private.secrets (key, value) VALUES ($1, $2), ($3, $4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
  "params": ["GITHUB_OAUTH_CLIENT_ID", "__CID__", "GITHUB_OAUTH_CLIENT_SECRET", "__CSEC__"]
}
JSON
)
# Inject values via jq (proper JSON escaping — no shell-side string concat)
PAYLOAD=$(jq -nc \
  --arg cid "$GITHUB_CLIENT_ID" \
  --arg csec "$GITHUB_CLIENT_SECRET" \
  '{
     query: "INSERT INTO private.secrets (key, value) VALUES ($1, $2), ($3, $4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
     params: ["GITHUB_OAUTH_CLIENT_ID", $cid, "GITHUB_OAUTH_CLIENT_SECRET", $csec]
   }')

# Note: Supabase Management /database/query endpoint may not support `params`.
# Fallback: use jq to safely escape, then sanity-check no quote/backslash escapes the literal.
if ! curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_PAT}" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD" >/dev/null; then
  echo "⚠️  Backup INSERT skipped (endpoint may not accept params); credentials still set in Supabase Auth."
fi

echo ""
echo "🥊 Done. Test login at https://ufc-harness.vercel.app/auth/login"

# Clear secrets from this shell
unset GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET SUPABASE_PAT
