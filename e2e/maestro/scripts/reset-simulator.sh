#!/bin/bash
# Reset iOS Simulator for E2E testing
# Usage: ./reset-simulator.sh [full]

APP_BUNDLE_ID="com.ducatprotocol.DucatProtocolWallet"

echo "Uninstalling $APP_BUNDLE_ID from booted simulator..."
xcrun simctl uninstall booted "$APP_BUNDLE_ID" 2>/dev/null

if [ "$1" = "full" ]; then
  echo "Performing full simulator erase..."
  xcrun simctl shutdown booted 2>/dev/null || true
  xcrun simctl erase booted
  echo "Simulator fully erased."
else
  echo "App uninstalled. Use './reset-simulator.sh full' for full erase."
fi

echo "Done."
