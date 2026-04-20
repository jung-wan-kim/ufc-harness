#!/usr/bin/env bash
# UFC-Harness — GitHub OAuth one-time setup
#
# Usage:
#   1. Create OAuth App at https://github.com/settings/applications/new with:
#        Application name: UFC-Harness
#        Homepage URL:    https://ufc-harness.vercel.app
#        Callback URL:    https://hihafrpktdotahsbcqfa.supabase.co/auth/v1/callback
#   2. Copy Client ID + generate Client Secret
#   3. Get Supabase Personal Access Token from https://supabase.com/dashboard/account/tokens
#   4. Run:
#        ./scripts/setup-github-oauth.sh <CLIENT_ID> <CLIENT_SECRET> <SUPABASE_PAT>
#
# What it does:
#   - PATCHes Supabase project auth config to enable GitHub provider
#   - Stores backup of credentials in private.secrets (for any future use)
#   - Verifies provider is enabled

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <GITHUB_CLIENT_ID> <GITHUB_CLIENT_SECRET> <SUPABASE_PAT>"
  echo ""
  echo "Steps to get values:"
  echo "  1. https://github.com/settings/applications/new"
  echo "       Homepage:  https://ufc-harness.vercel.app"
  echo "       Callback:  https://hihafrpktdotahsbcqfa.supabase.co/auth/v1/callback"
  echo "  2. https://supabase.com/dashboard/account/tokens (create new)"
  exit 1
fi

CLIENT_ID="$1"
CLIENT_SECRET="$2"
SUPABASE_PAT="$3"
PROJECT_REF="hihafrpktdotahsbcqfa"

echo "→ Configuring Supabase Auth (project: $PROJECT_REF)..."

RESP=$(curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_PAT}" \
  -H "Content-Type: application/json" \
  -d "{
    \"external_github_enabled\": true,
    \"external_github_client_id\": \"${CLIENT_ID}\",
    \"external_github_secret\": \"${CLIENT_SECRET}\"
  }")

if echo "$RESP" | grep -q "external_github_enabled.*true"; then
  echo "✅ GitHub OAuth provider enabled"
else
  echo "❌ Failed:"
  echo "$RESP"
  exit 1
fi

echo "→ Backing up credentials in private.secrets..."

# Use psql via Supabase API (apply_migration equivalent)
curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_PAT}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"INSERT INTO private.secrets (key, value) VALUES ('GITHUB_OAUTH_CLIENT_ID', '${CLIENT_ID}'), ('GITHUB_OAUTH_CLIENT_SECRET', '${CLIENT_SECRET}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();\"}" \
  > /dev/null

echo "✅ Credentials backed up"
echo ""
echo "🥊 Done. Test login at https://ufc-harness.vercel.app/auth/login"
