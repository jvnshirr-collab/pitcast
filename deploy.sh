#!/usr/bin/env bash
# deploy.sh — one-command PitCast deploy
#
# Pipeline:
#   1. wrangler pages deploy . --project-name=pitcast --branch=main
#      → uploads current ./pitcast-web/ to the CF Pages project, promoting
#        to the production alias pitcast.pages.dev
#   2. POST /zones/<zone>/purge_cache {"purge_everything": true}
#      → flushes the austenite.org CDN edge so pitcast.austenite.org refreshes
#   3. Poll pitcast.austenite.org until it serves the new app.js?v=<expected>
#      → fails loudly if the CDN doesn't catch up within 90s
#
# Usage:    cd pitcast-web && ./deploy.sh "commit message goes here"
# Setup:    copy .cf-tokens.env.example to .cf-tokens.env and fill in tokens.
#
# Tokens needed (gitignored, kept in .cf-tokens.env):
#   CF_PURGE_TOKEN  — Zone | Cache Purge | Purge (austenite.org)
#   CF_DNS_TOKEN    — Zone | DNS | Edit         (optional — only used if you
#                                                 ever need to flip the CNAME
#                                                 back to Pages)
set -euo pipefail

cd "$(dirname "$0")"   # always run from pitcast-web/

# --- load tokens ----------------------------------------------------------
if [ ! -f .cf-tokens.env ]; then
  echo "ERR: .cf-tokens.env not found. Copy .cf-tokens.env.example and fill in tokens." >&2
  exit 1
fi
set -a; source .cf-tokens.env; set +a
: "${CF_PURGE_TOKEN:?missing in .cf-tokens.env}"
: "${CF_ZONE_AUSTENITE_ORG:?missing in .cf-tokens.env}"

COMMIT_MSG="${1:-update}"

# --- derive expected app.js version from index.html (cache-bust source of truth)
EXPECTED_VER=$(grep -oE 'app\.js\?v=[0-9]+' index.html | head -1 | sed 's/.*v=//')
if [ -z "$EXPECTED_VER" ]; then
  echo "ERR: could not find app.js?v=<n> in index.html" >&2; exit 1
fi
echo "→ Deploying app.js?v=$EXPECTED_VER  ($COMMIT_MSG)"

# --- 1. wrangler deploy ---------------------------------------------------
echo "→ wrangler pages deploy …"
DEPLOY_OUT=$(npx -y wrangler@latest pages deploy . \
  --project-name=pitcast \
  --branch=main \
  --commit-dirty=true \
  --commit-message="$COMMIT_MSG" 2>&1)
echo "$DEPLOY_OUT" | tail -4
DEPLOY_URL=$(echo "$DEPLOY_OUT" | grep -oE 'https://[a-f0-9]+\.pitcast\.pages\.dev' | head -1)
if [ -z "$DEPLOY_URL" ]; then
  echo "ERR: wrangler did not return a deployment URL" >&2; exit 1
fi
echo "→ deploy: $DEPLOY_URL"

# --- 2. purge CF edge cache for austenite.org -----------------------------
echo "→ purging austenite.org cache …"
PURGE_RESP=$(curl -s -X POST \
  -H "Authorization: Bearer $CF_PURGE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' \
  "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_AUSTENITE_ORG/purge_cache")
if echo "$PURGE_RESP" | grep -q '"success":true'; then
  echo "→ cache purged"
else
  echo "WARN: purge did not return success — proceeding anyway:"
  echo "$PURGE_RESP"
fi

# --- 3. poll until live ---------------------------------------------------
echo "→ verifying pitcast.austenite.org serves app.js?v=$EXPECTED_VER"
DEADLINE=$(( $(date +%s) + 90 ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  LIVE=$(curl -s --max-time 5 "https://pitcast.austenite.org/?_cb=$(date +%s%N)" 2>/dev/null \
    | grep -oE 'app\.js\?v=[0-9]+' | head -1 | sed 's/.*v=//' || true)
  if [ "$LIVE" = "$EXPECTED_VER" ]; then
    echo "✓ LIVE — pitcast.austenite.org serves app.js?v=$EXPECTED_VER"
    exit 0
  fi
  echo "  [$(date +%H:%M:%S)] live=$LIVE expected=$EXPECTED_VER — waiting …"
  sleep 5
done

echo "ERR: pitcast.austenite.org still not serving app.js?v=$EXPECTED_VER after 90 s." >&2
echo "     Live build at: $DEPLOY_URL" >&2
echo "     Check pitcast.pages.dev to confirm Pages-side success." >&2
exit 1
