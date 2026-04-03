#!/bin/bash
# Run all Maestro E2E tests sequentially (one at a time on the same simulator)
# Usage: ./e2e/maestro/run-all-sequential.sh

set +e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOWS_DIR="$SCRIPT_DIR/flows"
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

# Flows reset app state themselves via Maestro helpers (clearKeychain + clearState).
# Do not manually uninstall/reinstall or delete the simulator keychain DB here,
# because that can corrupt the simulator and cause clearKeychain to fail globally.
if ! xcrun simctl get_app_container "$DEVICE_ID" "$APP_BUNDLE_ID" app > /dev/null 2>&1; then
  echo "ERROR: App is not installed on the booted simulator."
  echo "  Run: npx expo run:ios --device \"iPhone 16 Pro - Maestro\""
  exit 1
fi
echo ""

run_test() {
  local file="$1"
  local name=$(basename "$file" .yaml)
  local suite=$(basename "$(dirname "$file")")
  printf "  %-40s " "[$suite] $name"

  if maestro test --device "$DEVICE_ID" "$file" > /dev/null 2>&1; then
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
