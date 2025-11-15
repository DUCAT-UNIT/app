# Building Ducat with Passkey Support

## Why You Need a Development Build

The passkey implementation uses native modules that aren't available in Expo Go:
- `react-native-passkey` - WebAuthn/FIDO2 support
- `react-native-quick-crypto` - AES-256-GCM encryption

You must create a **development build** or **production build** to test passkey functionality.

## Option 1: Development Build (Recommended for Testing)

### For iOS Simulator:
```bash
npx expo run:ios
```

This will:
1. Install iOS CocoaPods dependencies
2. Build the native app with all required modules
3. Launch iOS Simulator with your development build
4. Enable hot reload for fast iteration

### For Physical iOS Device:
```bash
# Connect iPhone via USB, then:
npx expo run:ios --device
```

### For Android:
```bash
npx expo run:android
```

## Option 2: EAS Build (For Distribution)

### Setup EAS (First Time Only):
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Build Development Version:
```bash
# iOS development build
eas build --profile development --platform ios

# Android development build  
eas build --profile development --platform android
```

### Build Production Version:
```bash
# iOS production
eas build --profile production --platform ios

# Android production
eas build --profile production --platform android
```

## Testing Passkey Features

Once you have a development/production build running:

1. **Test in Settings:**
   - Open app → Settings → "Passkey Test (Dev)"
   - Test all passkey functions (create, unlock, recover, remove)

2. **Test Full Flow:**
   - Delete app and reinstall
   - Tap "Create with Passkey" 
   - Complete Face ID/Touch ID prompt
   - Lock app (go to home screen)
   - Reopen app → unlock with passkey button

3. **Test Cross-Device Recovery:**
   - Create wallet with passkey on Device A
   - Wait for passkey to sync to iCloud
   - Install app on Device B (same Apple ID)
   - Use "Recover with Passkey" or just unlock

## Current Build Status

**Dependencies Installed:**
- ✅ react-native-passkey@3.3.1
- ✅ react-native-quick-crypto@0.7.17
- ✅ iOS pods linked

**Implementation Complete:**
- ✅ Core passkey service (697 lines)
- ✅ WebAuthn integration
- ✅ AES-256-GCM encryption
- ✅ LockScreen integration
- ✅ WelcomeScreen integration
- ✅ PasskeyTestScreen

**Ready to build and test!**

## Troubleshooting

### "CocoaPods not installed"
```bash
sudo gem install cocoapods
cd ios && pod install && cd ..
```

### "Command not found: expo"
```bash
npm install -g expo-cli
```

### "Build failed" on iOS
```bash
# Clean and rebuild
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npx expo run:ios
```

### Passkey not working
- Ensure you're on a **real device** (simulator may have limitations)
- Check Face ID/Touch ID is enabled in Settings
- Verify associated domain is configured (for production)

## Next Steps

1. Build development version: `npx expo run:ios`
2. Test passkey creation in app
3. Test unlocking with passkey
4. If all works, configure production settings (associated domain, etc.)

