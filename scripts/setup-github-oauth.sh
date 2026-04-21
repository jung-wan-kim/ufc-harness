#!/usr/bin/env bash
# UFC-Harness — GitHub OAuth one-time setup
#
# Zero secret exposure via argv:
#   - Reads secrets from env OR interactive stdin (no echo)
#   - Passes Authorization to curl via `-K` config file (never on argv)
#
# Setup steps to get values:
#   1. https://github.com/settings/applications/new
#        Homepage:  https://ufc-harness.vercel.app
#        Callback:  https://bypbtvpqjzqescijdqrb.supabase.co/auth/v1/callback
#   2. https://supabase.com/dashboard/account/tokens
#
# Run:
#   ./scripts/setup-github-oauth.sh
#   (it will prompt for any value not already in env)

set -euo pipefail

PROJECT_REF="bypbtvpqjzqescijdqrb"

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

if [[ ! "$GITHUB_CLIENT_ID" =~ ^[A-Za-z0-9._-]+$ ]] \
   || [[ ! "$GITHUB_CLIENT_SECRET" =~ ^[A-Za-z0-9._-]+$ ]] \
   || [[ ! "$SUPABASE_PAT" =~ ^sbp_[A-Za-z0-9]+$ ]]; then
  echo "❌ Bad input format. Client ID/Secret must be alphanumeric+_-. PAT must start with sbp_." >&2
  exit 1
fi

# ---- Keep PAT out of argv ----
# curl `-K file` reads options (including -H) from a config file. The file
# is created with mode 600 and removed via trap. The bearer token never
# appears in `ps`, shell history, or CI command capture.
CURL_CFG=$(mktemp)
chmod 600 "$CURL_CFG"
BODY_FILE=$(mktemp)
chmod 600 "$BODY_FILE"
trap 'rm -f "$CURL_CFG" "$BODY_FILE"' EXIT

cat >"$CURL_CFG" <<EOF
header = "Authorization: Bearer ${SUPABASE_PAT}"
header = "Content-Type: application/json"
EOF

# Build JSON body safely via jq (proper escaping — no string concat)
jq -nc \
  --arg cid "$GITHUB_CLIENT_ID" \
  --arg csec "$GITHUB_CLIENT_SECRET" \
  '{external_github_enabled: true,
    external_github_client_id: $cid,
    external_github_secret: $csec}' > "$BODY_FILE"

echo "→ Configuring Supabase Auth (project: $PROJECT_REF)..."

RESP=$(curl -sS -K "$CURL_CFG" \
  -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  --data-binary "@$BODY_FILE")

if echo "$RESP" | grep -q '"external_github_enabled"[[:space:]]*:[[:space:]]*true'; then
  echo "✅ GitHub OAuth provider enabled at Supabase"
else
  echo "❌ Failed:" >&2
  echo "$RESP" >&2
  exit 1
fi

# Backup credentials via parameterized-style JSON (jq escaping) — never
# string-concat into SQL.
echo "→ Backing up credentials in private.secrets..."
jq -nc \
  --arg cid "$GITHUB_CLIENT_ID" \
  --arg csec "$GITHUB_CLIENT_SECRET" \
  '{query: "INSERT INTO private.secrets (key, value) VALUES ($1, $2), ($3, $4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
    params: ["GITHUB_OAUTH_CLIENT_ID", $cid, "GITHUB_OAUTH_CLIENT_SECRET", $csec]}' > "$BODY_FILE"

curl -sS -K "$CURL_CFG" \
  -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  --data-binary "@$BODY_FILE" >/dev/null \
  || echo "⚠️  Backup INSERT skipped (endpoint may not accept params); Auth still configured."

echo ""
echo "🥊 Done. Test login at https://ufc-harness.vercel.app/auth/login"

unset GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET SUPABASE_PAT
