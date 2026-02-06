#!/bin/bash
# Create and boot simulators for parallel E2E testing
# Usage: ./setup-parallel-simulators.sh [count]
#   count: number of simulators to create (default: 3)
# Outputs one UDID per line for each booted simulator

set -euo pipefail

NUM_SIMS="${1:-3}"
DEVICE_TYPE="iPhone 16 Pro"
RUNTIME_ID="com.apple.CoreSimulator.SimRuntime.iOS-18-0"

find_udid() {
  local name="$1"
  python3 - "$name" <<'PY'
import json, subprocess, sys
name = sys.argv[1]
info = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "-j"]))
for runtime, devices in info.get("devices", {}).items():
    for d in devices:
        if d.get("name") == name:
            print(d.get("udid"))
            sys.exit(0)
PY
}

for i in $(seq 1 "$NUM_SIMS"); do
  NAME="iPhone 16 Pro - Maestro $i"

  UDID="$(find_udid "$NAME" || true)"
  if [ -z "$UDID" ]; then
    UDID="$(xcrun simctl create "$NAME" "$DEVICE_TYPE" "$RUNTIME_ID")"
    echo "Created simulator: $NAME ($UDID)" >&2
  else
    echo "Found existing simulator: $NAME ($UDID)" >&2
  fi

  xcrun simctl boot "$UDID" 2>/dev/null || true

  # Suppress "Open in <App>?" deep link confirmation dialog
  xcrun simctl spawn "$UDID" defaults write com.apple.springboard SBUniversalLinkPromptingDisabled -bool true 2>/dev/null || true

  echo "$UDID"
done

echo "All $NUM_SIMS simulators booted." >&2
