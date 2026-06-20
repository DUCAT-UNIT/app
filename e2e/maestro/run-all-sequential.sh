#!/bin/bash
# Run maintained Maestro product flows sequentially against the Expo dev-client app.
# Usage: ./e2e/maestro/run-all-sequential.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
FLOWS_DIR="$SCRIPT_DIR/flows"
APP_BUNDLE_ID="com.ducatprotocol.DucatProtocolWallet"
SUITES=(auth wallet send settings vault ecash)
FLOWS=()

DEVICE_ID="$(xcrun simctl list devices booted | grep -o '[A-F0-9-]\{36\}' | head -1 || true)"
if [ -z "$DEVICE_ID" ]; then
  echo "ERROR: No booted simulator found"
  exit 1
fi

if ! xcrun simctl get_app_container "$DEVICE_ID" "$APP_BUNDLE_ID" app > /dev/null 2>&1; then
  echo "ERROR: App is not installed on the booted simulator."
  echo "  Run: npx expo run:ios --device \"iPhone 16 Pro - Maestro\""
  exit 1
fi

for suite in "${SUITES[@]}"; do
  for file in "$FLOWS_DIR/$suite"/*.yaml; do
    [ -f "$file" ] && FLOWS+=("$file")
  done
done

if [ "${#FLOWS[@]}" -eq 0 ]; then
  echo "ERROR: No Maestro flows found under $FLOWS_DIR"
  exit 1
fi

mkdir -p "$ROOT_DIR/artifacts/maestro-full" "$ROOT_DIR/artifacts/live-maestro"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_PATH="artifacts/maestro-full/product-suite-${TS}.log"
REPORT_PATH="${MAESTRO_LIVE_REPORT_PATH:-artifacts/live-maestro/product-suite-${TS}.json}"

printf "%s\n" "$LOG_PATH" > "$ROOT_DIR/artifacts/maestro-full/latest-product-suite-log.txt"
printf "%s\n" "$REPORT_PATH" > "$ROOT_DIR/artifacts/maestro-full/latest-product-suite-report.txt"

echo "Using simulator: $DEVICE_ID"
echo "Running ${#FLOWS[@]} Maestro flows through scripts/runMaestroLive.mjs"
echo "Log: $LOG_PATH"
echo "Report: $REPORT_PATH"

cd "$ROOT_DIR"

export MAESTRO_LIVE_REUSE_METRO="${MAESTRO_LIVE_REUSE_METRO:-false}"
export MAESTRO_DRIVER_CRASH_RETRIES="${MAESTRO_DRIVER_CRASH_RETRIES:-2}"
export MAESTRO_DRIVER_CRASH_HANG_TIMEOUT_MS="${MAESTRO_DRIVER_CRASH_HANG_TIMEOUT_MS:-5000}"
export MAESTRO_LIVE_REPORT_PATH="$REPORT_PATH"

set +e
node scripts/runMaestroLive.mjs "${FLOWS[@]}" 2>&1 | tee "$LOG_PATH"
STATUS="${PIPESTATUS[0]}"
set -e

exit "$STATUS"
