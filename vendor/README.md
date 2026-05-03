# Vendored Packages

The app vendors the exact `@ducat-unit/client-sdk@0.7.23` and `@ducat-unit/runestone@1.0.5` packages that were previously installed from GitHub Packages.

This keeps `npm ci` reproducible for GitHub Actions and clean local checkouts without requiring a private package token. The vendored copies include the React Native compatibility fixes previously applied by `patch-package`.
