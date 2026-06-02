# Patches

This directory contains patches for npm packages that are applied automatically via `patch-package` during `npm install`.

The Ducat SDK and runestone React Native compatibility changes are baked into the
vendored packages under `vendor/`. They are no longer patch-package entries
because CI must install without access to private GitHub Packages.

## Current Patches

### @react-navigation/bottom-tabs+7.8.5.patch

Enables native bottom-tab state control, resolves platform icon payloads, and
passes `tabBarHidden` through to native tab screens.

### react-native-screens+4.16.0.patch

Adds native `tabBarHidden` support used by the patched React Navigation native
bottom tabs implementation.

## react-native-passkey+3.3.1.patch

Forces iOS module initialization onto the main queue.
