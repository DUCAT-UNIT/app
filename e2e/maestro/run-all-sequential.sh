#!/bin/bash
# Run all Maestro E2E tests sequentially (one at a time on the same simulator)
# Usage: ./e2e/maestro/run-all-sequential.sh

set +e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOWS_DIR="$SCRIPT_DIR/flows"
HELPERS_DIR="$SCRIPT_DIR/helpers"
PASSED=0
FAILED=0
FAILURES=""

APP_BUNDLE_ID="com.ducatprotocol.DucatProtocolWallet"

# Get the booted device UDID
DEVICE_ID=$(xcrun simctl list devices booted | grep -o '[A-F0-9-]\{36\}' | head -1)
if [ -z "$DEVICE_ID" ]; then
  echo "ERROR: No booted simulator found"
  exit 1
fi
echo "Using simulator: $DEVICE_ID"

# Find the installed app bundle and copy it to a stable location
# (uninstall deletes the bundle from the sim, so we need an external copy)
STABLE_APP="/tmp/ducat-e2e-app/DucatWallet.app"
mkdir -p /tmp/ducat-e2e-app

if [ ! -d "$STABLE_APP" ]; then
  # Find app from the current sim or any other sim
  SIM_APP=$(find ~/Library/Developer/CoreSimulator/Devices/"$DEVICE_ID" -maxdepth 8 -name "*.app" -path "*${APP_BUNDLE_ID}*" 2>/dev/null | head -1)
  if [ -z "$SIM_APP" ]; then
    SIM_APP=$(find ~/Library/Developer/CoreSimulator/Devices -maxdepth 8 -name "*.app" -path "*${APP_BUNDLE_ID}*" 2>/dev/null | head -1)
  fi
  if [ -z "$SIM_APP" ] || [ ! -d "$SIM_APP" ]; then
    echo "ERROR: Could not find app bundle. Build the app first."
    echo "  Run: npx expo run:ios --device \"iPhone 16 Pro - Maestro\""
    exit 1
  fi
  cp -R "$SIM_APP" "$STABLE_APP"
  echo "Copied app to stable location: $STABLE_APP"
else
  echo "Using cached app: $STABLE_APP"
fi

APP_PATH="$STABLE_APP"
echo ""

run_test() {
  local file="$1"
  local name=$(basename "$file" .yaml)
  local suite=$(basename "$(dirname "$file")")
  printf "  %-40s " "[$suite] $name"

  sleep 1

  # Clean app state: uninstall + wipe keychain + reinstall
  xcrun simctl terminate "$DEVICE_ID" "$APP_BUNDLE_ID" > /dev/null 2>&1 || true
  xcrun simctl uninstall "$DEVICE_ID" "$APP_BUNDLE_ID" > /dev/null 2>&1 || true

  # Clear keychain (iOS persists keychain across uninstall/reinstall)
  local keychain_dir="$HOME/Library/Developer/CoreSimulator/Devices/$DEVICE_ID/data/Library/Keychains"
  rm -f "$keychain_dir"/keychain-2-debug.db* 2>/dev/null || true

  xcrun simctl install "$DEVICE_ID" "$APP_PATH" > /dev/null 2>&1 || true

  # Re-grant permissions after reinstall
  bash "$HELPERS_DIR/grant-permissions.sh" "$DEVICE_ID" > /dev/null 2>&1 || true

  # Set clipboard for paste-based wallet import
  bash "$HELPERS_DIR/set-clipboard.sh" "$DEVICE_ID" > /dev/null 2>&1

  sleep 0.5

  if maestro test "$file" > /dev/null 2>&1; then
    echo "✓ PASSED"
    PASSED=$((PASSED + 1))
  else
    echo "✗ FAILED"
    FAILED=$((FAILED + 1))
    FAILURES="$FAILURES\n  [$suite] $name"
  fi
}

START_TIME=$(date +%s)

echo "Running E2E tests sequentially..."
echo ""

for suite in auth wallet send settings vault ecash; do
  echo "=== $(echo "$suite" | tr '[:lower:]' '[:upper:]') SUITE ==="
  for file in "$FLOWS_DIR/$suite"/*.yaml; do
    [ -f "$file" ] && run_test "$file"
  done
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

TOTAL=$((PASSED + FAILED))
echo "==============================="
echo "Results: $PASSED/$TOTAL passed, $FAILED failed"
echo "Time: ${MINUTES}m ${SECONDS}s"

if [ -n "$FAILURES" ]; then
  echo ""
  echo "Failed tests:"
  echo -e "$FAILURES"
fi

exit $FAILED
