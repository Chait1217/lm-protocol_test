#!/usr/bin/env bash
# Deploy vault + margin engine to Polygon and update frontend/.env.local with new addresses.
# Run from repo root or from demo-real/.
# Requires: PRIVATE_KEY and POLYGON_RPC_URL (in contracts/.env or export).
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="${SCRIPT_DIR}/contracts"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
ENV_LOCAL="${FRONTEND_DIR}/.env.local"
OUTPUT_FILE="${SCRIPT_DIR}/.deploy-output.txt"

cd "$CONTRACTS_DIR"

# Load env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$POLYGON_RPC_URL" ]; then
  echo "POLYGON_RPC_URL not set. Use https://polygon-rpc.com or set in contracts/.env"
  export POLYGON_RPC_URL="${POLYGON_RPC_URL:-https://polygon-rpc.com}"
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "PRIVATE_KEY not set. Set it in contracts/.env or export PRIVATE_KEY=0x..."
  exit 1
fi

echo "Deploying to Polygon (rpc: $POLYGON_RPC_URL)..."
forge script script/DeployPolygonVault.s.sol:DeployPolygonVault \
  --rpc-url "$POLYGON_RPC_URL" \
  --broadcast \
  2>&1 | tee "$OUTPUT_FILE"

echo ""
echo "Parsing deployment output and updating ${ENV_LOCAL}..."

touch "$ENV_LOCAL"

# Build new .env.local: keep existing lines that are not NEXT_PUBLIC_* overwritten by deploy output
declare -A DEPLOY_VARS
while IFS= read -r line; do
  if [[ "$line" =~ ^NEXT_PUBLIC_[A-Z_]+=.+ ]]; then
    key="${line%%=*}"
    value="${line#*=}"
    DEPLOY_VARS[$key]="$value"
  fi
done < <(grep -E "^NEXT_PUBLIC_" "$OUTPUT_FILE" || true)

# Write .env.local: existing keys not in DEPLOY_VARS stay; DEPLOY_VARS overwrite or append
TMP_ENV=$(mktemp)
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ ^(NEXT_PUBLIC_[A-Z_]+)= ]]; then
    key="${BASH_REMATCH[1]}"
    [[ -n "${DEPLOY_VARS[$key]:-}" ]] && echo "${key}=${DEPLOY_VARS[$key]}" >> "$TMP_ENV" || echo "$line" >> "$TMP_ENV"
  else
    echo "$line" >> "$TMP_ENV"
  fi
done < "$ENV_LOCAL"
for key in "${!DEPLOY_VARS[@]}"; do
  grep -q "^${key}=" "$TMP_ENV" 2>/dev/null || echo "${key}=${DEPLOY_VARS[$key]}" >> "$TMP_ENV"
done
mv "$TMP_ENV" "$ENV_LOCAL"
rm -f "$OUTPUT_FILE"
echo "Done. Updated frontend/.env.local with Polygon contract addresses."
echo "Restart the frontend (npm run dev) and use the vault page with the new addresses."
