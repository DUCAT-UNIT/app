#!/bin/bash
# Build and deploy to iOS device with automatic provisioning
cd "$(dirname "$0")"
npx expo run:ios --device "Piloto" -- -allowProvisioningUpdates
