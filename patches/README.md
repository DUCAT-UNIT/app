# Patches

This directory contains patches for npm packages that are applied automatically via `patch-package` during `npm install`.

The Ducat SDK and runestone React Native compatibility changes are baked into the vendored packages under `vendor/`. They are no longer patch-package entries because CI must install without access to private GitHub Packages.

## react-native-passkey+3.3.1.patch

Forces iOS module initialization onto the main queue.
