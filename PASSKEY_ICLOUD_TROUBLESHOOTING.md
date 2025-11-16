# Passkey + iCloud Recovery Implementation - Troubleshooting Guide

## Overview

This document details the implementation and debugging process for getting passkey-based wallet recovery with iCloud storage working in production TestFlight builds.

## Architecture

The wallet recovery system uses two separate iCloud services:

1. **iCloud Keychain** - Stores the WebAuthn passkey credential
2. **iCloud Key-Value Storage** - Stores the encrypted wallet mnemonic backup

### Why Both Are Needed

- **Passkey** (iCloud Keychain): Provides the cryptographic key material for authentication
- **Encrypted Mnemonic** (Key-Value Storage): Stores the actual wallet seed, encrypted with a key derived from passkey + PIN
- Together they enable cross-device recovery while maintaining security (Apple has the passkey but not the PIN)

## What Worked Locally But Failed in TestFlight

The app worked perfectly in local development builds (`npx expo run:ios`) but failed in TestFlight with the error:
```
No passkey wallet found in iCloud
```

## Root Cause: Missing iCloud Container Configuration

The fundamental issue was that **iCloud Key-Value Storage requires an iCloud container to be registered and assigned to your App ID in Apple Developer portal**, even though Key-Value Storage doesn't technically use containers the same way CloudKit does.

### What Was Missing

1. **No iCloud Container Registered**: The container `iCloud.com.anonymous.SimpleWallet` didn't exist
2. **Not Assigned to App ID**: Even after creation, it wasn't assigned to the App ID capabilities
3. **Provisioning Profile Outdated**: The provisioning profile didn't include the iCloud container entitlements

## Issues Encountered & Solutions

### Issue 1: Passkey Authentication Failed - Missing `rpId`

**Error:**
```
Error: Swift.DecodingError.keyNotFound(CodingKeys(stringValue: "rpId", intValue: nil)
```

**Cause:** `react-native-passkey` requires `rpId` to be a non-optional string, but it was set to `null`.

**Solution:**
```javascript
// constants/security.js
export const PASSKEY = {
  RP_NAME: 'Ducat Wallet',
  RP_ID: 'ducatprotocol.com', // Must be a valid domain, not null
  // ...
}
```

### Issue 2: AASA File Missing `applinks`

**Error:**
```
Application with identifier Q8HU4KXHK4.com.anonymous.SimpleWallet is not associated with domain com.anonymous.SimpleWallet
```

**Cause:** The `apple-app-site-association` file only had `webcredentials`, not `applinks` (needed for passkeys).

**Solution:**
```json
{
  "webcredentials": {
    "apps": ["Q8HU4KXHK4.com.anonymous.SimpleWallet"]
  },
  "applinks": {
    "details": [{
      "appID": "Q8HU4KXHK4.com.anonymous.SimpleWallet",
      "paths": ["*"]
    }]
  }
}
```

### Issue 3: Native Module Not Linked in EAS Builds

**Symptom:** iCloud saves appeared to succeed but data wasn't actually stored.

**Cause:** `react-native-icloudstore` native module wasn't being linked in EAS production builds.

**Solution:** Added explicit pod dependency in `ios/Podfile`:
```ruby
target 'DUCAT' do
  use_expo_modules!

  # Add react-native-icloudstore manually
  pod 'RNICloudStore', :path => '../node_modules/react-native-icloudstore'

  # ... rest of Podfile
end
```

### Issue 4: iCloud Container Not Registered ⭐ **ROOT CAUSE**

**Symptom:** Even with native module linked, iCloud Key-Value Storage silently failed in TestFlight.

**Cause:** No iCloud container was registered in Apple Developer portal.

**Solution:**

1. **Go to Apple Developer Portal** → Certificates, Identifiers & Profiles → Identifiers
2. **Find your App ID** (e.g., `com.anonymous.SimpleWallet`)
3. **Click on iCloud capability** → Configure
4. **Register an iCloud Container**:
   - Identifier: `iCloud.com.anonymous.SimpleWallet`
   - Description: "Ducat Wallet iCloud Storage"
5. **Assign container to App ID**: Check the container in the list
6. **Save**

### Issue 5: Provisioning Profile Didn't Include Container

**Error:**
```
Provisioning profile doesn't support the iCloud.com.anonymous.SimpleWallet iCloud Container
```

**Cause:** Provisioning profile was created before the iCloud container was assigned.

**Solution:**

1. Delete the old provisioning profile:
```bash
eas credentials --platform ios
# Select production → Build Credentials → Provisioning Profile: Delete
```

2. Rebuild - EAS will auto-generate a new provisioning profile with updated entitlements

### Issue 6: Entitlements Configuration

**Final working configuration in `app.json`:**

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.anonymous.SimpleWallet",
      "usesIcloudStorage": true,
      "iCloudContainerEnvironment": "Production",
      "entitlements": {
        "com.apple.developer.icloud-container-identifiers": [
          "iCloud.com.anonymous.SimpleWallet"
        ],
        "com.apple.developer.ubiquity-kvstore-identifier": "$(TeamIdentifierPrefix)$(CFBundleIdentifier)"
      },
      "associatedDomains": [
        "webcredentials:ducatprotocol.com",
        "applinks:ducatprotocol.com"
      ]
    }
  }
}
```

**And in `ios/DUCAT/DUCAT.entitlements`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
      <string>webcredentials:ducatprotocol.com</string>
      <string>applinks:ducatprotocol.com</string>
    </array>
    <key>com.apple.developer.ubiquity-kvstore-identifier</key>
    <string>$(TeamIdentifierPrefix)$(CFBundleIdentifier)</string>
  </dict>
</plist>
```

## Why It Worked Locally But Not in TestFlight

### Local Development Builds

- Uses Development iCloud container (if `iCloudContainerEnvironment` was set)
- Or creates a default container automatically
- Less strict entitlement validation
- Native module already linked via `npx expo run:ios`

### TestFlight/Production Builds

- Requires explicit Production container configuration
- Strict entitlement validation by Apple
- Provisioning profile must include all capabilities
- Native modules must be explicitly linked in Podfile for EAS builds

## Complete Checklist for iCloud + Passkey Setup

### Apple Developer Portal
- [ ] iCloud capability enabled on App ID
- [ ] iCloud container registered (e.g., `iCloud.com.anonymous.SimpleWallet`)
- [ ] Container assigned to App ID
- [ ] Associated Domains configured with `applinks:yourdomain.com`

### Server Configuration
- [ ] `apple-app-site-association` file uploaded to `https://yourdomain.com/.well-known/`
- [ ] File includes both `webcredentials` and `applinks` sections
- [ ] App ID format: `TEAMID.BUNDLEID`

### App Configuration (`app.json`)
- [ ] `usesIcloudStorage: true`
- [ ] `iCloudContainerEnvironment: "Production"`
- [ ] `entitlements` with both container identifiers and kvstore identifier
- [ ] `associatedDomains` includes both `webcredentials:` and `applinks:`

### Native Code (`ios/Podfile`)
- [ ] `react-native-icloudstore` explicitly added as pod dependency

### Code (`constants/security.js`)
- [ ] `PASSKEY.RP_ID` set to valid domain (not null)
- [ ] `PASSKEY.RP_NAME` set appropriately

### Build Process
- [ ] After making iCloud changes in Apple portal, delete old provisioning profile
- [ ] Let EAS regenerate provisioning profile on next build
- [ ] Verify build includes updated entitlements in build logs

## Testing Checklist

### On TestFlight Build
1. **Create wallet with passkey**
   - Should see: "Wallet created with passkey!" (success)
   - Should NOT see: Warning about iCloud backup failure

2. **Verify passkey in Settings**
   - iOS Settings → Passwords → Passkeys
   - Should see entry for `ducatprotocol.com`

3. **Delete wallet**
   - Local data cleared
   - iCloud backup should remain (intentional for recovery)

4. **Recover wallet**
   - Should authenticate with passkey
   - Should load encrypted backup from iCloud
   - Should decrypt with PIN
   - Should restore wallet successfully

### Cross-Device Recovery
1. Install app on second device with same Apple ID
2. Select "Recover with Passkey"
3. Authenticate with synced passkey
4. Enter PIN
5. Wallet should restore with same addresses

## Build History

- **Build #39**: Fixed passkey `rpId` and AASA file
- **Build #40**: Attempted iCloud container environment fix (didn't work - wrong approach)
- **Build #41**: Added `react-native-icloudstore` to Podfile
- **Build #42-44**: Various credential/entitlement attempts
- **Build #45**: ✅ **SUCCESS** - Proper iCloud container registered and assigned

## Key Learnings

1. **Always check Apple Developer portal configuration first** before debugging code
2. **iCloud Key-Value Storage requires a container** even though it's not CloudKit
3. **Provisioning profiles must be regenerated** after capability changes
4. **EAS builds need explicit native module linking** in Podfile
5. **Local development can mask configuration issues** that only appear in production

## Resources

- [Apple Developer - iCloud Key-Value Storage](https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/DesigningForKey-ValueDataIniCloud.html)
- [Expo - iOS Entitlements](https://docs.expo.dev/build-reference/ios-capabilities/)
- [react-native-passkey Documentation](https://github.com/f-23/react-native-passkey)
- [react-native-icloudstore Documentation](https://github.com/npomfret/react-native-icloudstore)

## Future Considerations

- Monitor iCloud storage quota (1MB limit for Key-Value Storage)
- Handle iCloud sync conflicts gracefully
- Consider CloudKit for larger data storage needs
- Test behavior when user is not signed into iCloud
- Test behavior when iCloud Drive is disabled
