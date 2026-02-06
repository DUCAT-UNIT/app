#!/bin/bash
# Grant notification and paste permissions for the Ducat app on a simulator
# Usage: ./grant-permissions.sh <DEVICE_UDID>
# This writes directly to the simulator's TCC.db to pre-approve permissions
# so system dialogs don't appear during tests.

DEVICE_ID="$1"
APP_BUNDLE_ID="com.ducatprotocol.DucatProtocolWallet"

if [ -z "$DEVICE_ID" ]; then
  echo "Usage: $0 <DEVICE_UDID>"
  exit 1
fi

TCC_DB="$HOME/Library/Developer/CoreSimulator/Devices/$DEVICE_ID/data/Library/TCC/TCC.db"

if [ ! -f "$TCC_DB" ]; then
  echo "TCC.db not found for device $DEVICE_ID"
  exit 1
fi

# Grant notification permission (auth_value=2 means allowed)
sqlite3 "$TCC_DB" "INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version, indirect_object_identifier_type, flags) VALUES ('kTCCServiceUserNotification', '$APP_BUNDLE_ID', 0, 2, 0, 1, 0, 0);" 2>/dev/null

# Also grant via simctl for other permissions
xcrun simctl privacy "$DEVICE_ID" grant all "$APP_BUNDLE_ID" 2>/dev/null || true
