#!/bin/bash
# Shutdown and optionally delete parallel test simulators
# Usage: ./cleanup-simulators.sh [--delete]
#   --delete: also remove the simulator devices

set -euo pipefail

NUM_SIMS=3
DELETE=false

if [ "${1:-}" = "--delete" ]; then
  DELETE=true
fi

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
    echo "Simulator not found: $NAME"
    continue
  fi

  echo "Shutting down: $NAME ($UDID)"
  xcrun simctl shutdown "$UDID" 2>/dev/null || true

  if [ "$DELETE" = true ]; then
    echo "Deleting: $NAME ($UDID)"
    xcrun simctl delete "$UDID" 2>/dev/null || true
  fi
done

echo "Cleanup complete."
