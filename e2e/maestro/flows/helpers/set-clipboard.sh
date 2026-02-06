#!/bin/bash
# Set a valid BIP39 seed phrase to iOS simulator clipboard
# Uses a pool of pre-validated 12-word seed phrases
# Usage: ./set-clipboard.sh [DEVICE_UDID]
#   DEVICE_UDID: optional - specific simulator UDID. Falls back to first booted device.

DEVICE_ID="${1:-$(xcrun simctl list devices booted | grep -o '[A-F0-9-]\{36\}' | head -1)}"

# Pool of valid 12-word BIP39 seed phrases for testing
# Each creates a fresh wallet that auto-funds on mutinynet
SEEDS=(
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  "nation address battle bonus dignity wave bulb crouch enter night leader north"
  "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"
  "letter advice cage absurd amount doctor acoustic avoid letter advice cage above"
  "jelly better achieve collect unaware mountain thought cargo oxygen act hood bridge"
  "afford alter spike radar gate glance object seek swamp infant panel yellow"
)

# Select a random seed from the pool
RANDOM_INDEX=$((RANDOM % ${#SEEDS[@]}))
SEED="${SEEDS[$RANDOM_INDEX]}"

echo "$SEED" | xcrun simctl pbcopy "$DEVICE_ID"
echo "Clipboard set for device: $DEVICE_ID"
echo "Using seed index: $RANDOM_INDEX"
