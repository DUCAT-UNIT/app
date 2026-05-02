#!/bin/bash
# Run Maestro E2E tests in parallel across 3 iOS simulators
# Usage: ./e2e/maestro/run-parallel.sh
#
# Suite distribution:
#   Sim 1: auth (8) + ecash (5)       = 13 tests
#   Sim 2: wallet (17) + send (9)     = 26 tests
#   Sim 3: settings (17) + vault (9)  = 26 tests

set +e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOWS_DIR="$SCRIPT_DIR/flows"
HELPERS_DIR="$SCRIPT_DIR/helpers"
RESULTS_DIR="$(mktemp -d)"

# Suite groups for each simulator
GROUP1_SUITES="auth ecash"
GROUP2_SUITES="wallet send"
GROUP3_SUITES="settings vault"

# ─── Simulator Setup ──────────────────────────────────────────────

echo "Booting 3 simulators..."
UDIDS=()
while IFS= read -r udid; do
  [ -n "$udid" ] && UDIDS+=("$udid")
done < <(bash "$SCRIPT_DIR/scripts/setup-parallel-simulators.sh" 3)

if [ "${#UDIDS[@]}" -ne 3 ]; then
  echo "ERROR: Expected 3 simulators, got ${#UDIDS[@]}"
  exit 1
fi

echo "Simulators:"
echo "  Sim 1 (auth+ecash):     ${UDIDS[0]}"
echo "  Sim 2 (wallet+send):    ${UDIDS[1]}"
echo "  Sim 3 (settings+vault): ${UDIDS[2]}"
echo ""

# Wait for simulators to fully boot
echo "Waiting for simulators to finish booting..."
for udid in "${UDIDS[@]}"; do
  xcrun simctl bootstatus "$udid" -b 2>/dev/null || true
done
echo ""

APP_BUNDLE_ID="com.ducatprotocol.DucatProtocolWallet"

# ─── Suppress System Dialogs ──────────────────────────────────────

# Suppress system dialogs and grant permissions on each simulator
echo "Configuring simulator permissions..."
for udid in "${UDIDS[@]}"; do
  # Disable "Open in <App>?" deep link confirmation dialog
  xcrun simctl spawn "$udid" defaults write com.apple.springboard SBUniversalLinkPromptingDisabled -bool true 2>/dev/null || true
  # Grant all available privacy permissions (location, photos, etc.)
  xcrun simctl privacy "$udid" grant all "$APP_BUNDLE_ID" 2>/dev/null || true
done
echo ""

# ─── Install App ──────────────────────────────────────────────────

# Find the app bundle - check the original "iPhone 16 Pro - Maestro" sim first
ORIGINAL_SIM=$(python3 -c "
import json, subprocess, sys
info = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', '-j']))
for rt, devs in info.get('devices', {}).items():
    for d in devs:
        if d.get('name') == 'iPhone 16 Pro - Maestro':
            print(d['udid']); sys.exit(0)
" 2>/dev/null || true)

APP_PATH=""
if [ -n "$ORIGINAL_SIM" ]; then
  APP_PATH=$(find ~/Library/Developer/CoreSimulator/Devices/"$ORIGINAL_SIM" -maxdepth 8 -name "*.app" -path "*${APP_BUNDLE_ID}*" 2>/dev/null | head -1 || true)
fi

# Fallback: search all simulators
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "Searching for app bundle..."
  APP_PATH=$(find ~/Library/Developer/CoreSimulator/Devices -maxdepth 8 -name "*.app" -path "*${APP_BUNDLE_ID}*" 2>/dev/null | head -1 || true)
fi

if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
  echo "Clean installing app on parallel simulators..."
  for udid in "${UDIDS[@]}"; do
    # Uninstall first to ensure clean state (no leftover keychain/data)
    xcrun simctl uninstall "$udid" "$APP_BUNDLE_ID" 2>/dev/null || true
    xcrun simctl install "$udid" "$APP_PATH" && echo "  Installed on $udid" || echo "  FAILED on $udid"
  done
  echo ""
else
  echo "ERROR: Could not find app bundle. Make sure the app is built and installed on at least one simulator."
  echo "  Run: npx expo run:ios --device \"iPhone 16 Pro - Maestro\""
  exit 1
fi

# ─── Test Runner ──────────────────────────────────────────────────

run_group() {
  local group_id="$1"
  local device_udid="$2"
  shift 2
  local suites=("$@")

  local passed=0
  local failed=0
  local failures=""
  local result_file="$RESULTS_DIR/group${group_id}.txt"

  for suite in "${suites[@]}"; do
    echo "[Sim $group_id] === $(echo "$suite" | tr '[:lower:]' '[:upper:]') SUITE ==="
    for file in "$FLOWS_DIR/$suite"/*.yaml; do
      [ -f "$file" ] || continue
      local name
      name=$(basename "$file" .yaml)

      sleep 1

      # Clean app state: uninstall/reinstall preserves TCC but wipes app data
      xcrun simctl terminate "$device_udid" "$APP_BUNDLE_ID" > /dev/null 2>&1 || true
      xcrun simctl uninstall "$device_udid" "$APP_BUNDLE_ID" > /dev/null 2>&1 || true
      xcrun simctl install "$device_udid" "$APP_PATH" > /dev/null 2>&1 || true
      # Re-grant permissions after reinstall
      bash "$HELPERS_DIR/grant-permissions.sh" "$device_udid" > /dev/null 2>&1 || true
      # Set clipboard for this specific simulator
      bash "$HELPERS_DIR/set-clipboard.sh" "$device_udid" > /dev/null 2>&1
      sleep 0.5

      if maestro --device "$device_udid" test "$file" > /dev/null 2>&1; then
        echo "[Sim $group_id]   $name  ✓"
        passed=$((passed + 1))
      else
        echo "[Sim $group_id]   $name  ✗"
        failed=$((failed + 1))
        failures="$failures\n  [$suite] $name"
      fi
    done
  done

  # Write results to file for collection
  echo "$passed $failed" > "$result_file"
  [ -n "$failures" ] && echo -e "$failures" >> "$result_file"
}

START_TIME=$(date +%s)

echo "Starting parallel test execution..."
echo ""

# Launch all 3 groups in parallel
run_group 1 "${UDIDS[0]}" $GROUP1_SUITES &
PID1=$!

run_group 2 "${UDIDS[1]}" $GROUP2_SUITES &
PID2=$!

run_group 3 "${UDIDS[2]}" $GROUP3_SUITES &
PID3=$!

# Wait for all groups to finish
wait $PID1 $PID2 $PID3

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

# ─── Collect Results ──────────────────────────────────────────────

echo ""
echo "==============================="
echo "Parallel E2E Test Results"
echo "==============================="

TOTAL_PASSED=0
TOTAL_FAILED=0
ALL_FAILURES=""

for i in 1 2 3; do
  result_file="$RESULTS_DIR/group${i}.txt"
  if [ -f "$result_file" ]; then
    read -r p f < "$result_file"
    TOTAL_PASSED=$((TOTAL_PASSED + p))
    TOTAL_FAILED=$((TOTAL_FAILED + f))
    # Collect failure details (lines after the first)
    if [ "$(wc -l < "$result_file")" -gt 1 ]; then
      ALL_FAILURES="$ALL_FAILURES$(tail -n +2 "$result_file")\n"
    fi
  fi
done

TOTAL=$((TOTAL_PASSED + TOTAL_FAILED))
echo "Results: $TOTAL_PASSED/$TOTAL passed, $TOTAL_FAILED failed"
echo "Time: ${MINUTES}m ${SECONDS}s"
echo ""

if [ -n "$ALL_FAILURES" ]; then
  echo "Failed tests:"
  echo -e "$ALL_FAILURES"
fi

# Cleanup temp dir
rm -rf "$RESULTS_DIR"

exit $TOTAL_FAILED
