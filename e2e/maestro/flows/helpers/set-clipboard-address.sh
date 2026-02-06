#!/bin/bash
# Set the iOS simulator clipboard with a testnet BTC address
DEVICE_ID=$(xcrun simctl list devices booted | grep -o '[A-F0-9-]\{36\}' | head -1)
echo "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx" | xcrun simctl pbcopy "$DEVICE_ID"
echo "Clipboard set with testnet address for device: $DEVICE_ID"
