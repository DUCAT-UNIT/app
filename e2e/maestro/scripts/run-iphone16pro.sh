#!/bin/bash
set -euo pipefail

DEVICE_NAME="iPhone 16 Pro - Maestro"
DEVICE_TYPE="iPhone 16 Pro"
RUNTIME_ID="com.apple.CoreSimulator.SimRuntime.iOS-18-0"

find_udid() {
  python3 - "$DEVICE_NAME" <<'PY'
import json, subprocess, sys
name = sys.argv[1]
info = json.loads(subprocess.check_output(["xcrun","simctl","list","devices","-j"]))
for runtime, devices in info.get("devices", {}).items():
    for d in devices:
        if d.get("name") == name:
            print(d.get("udid"))
            sys.exit(0)
PY
}

UDID="$(find_udid "$DEVICE_NAME" || true)"
if [ -z "$UDID" ]; then
  UDID="$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$RUNTIME_ID")"
fi

xcrun simctl boot "$UDID" >/dev/null 2>&1 || true
open -a Simulator --args -CurrentDeviceUDID "$UDID"

if [ "$#" -gt 0 ]; then
  maestro test --device "$UDID" "$@"
else
  maestro test --device "$UDID" e2e/maestro/flows/**
fi
