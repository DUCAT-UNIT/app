# Onboarding Flows - Fresh Install to Wallet Page

This document covers all possible onboarding flows from a fresh app install through to successfully landing on the main wallet page. Each flow includes success paths, error scenarios, and graceful retry mechanisms.

---

## Table of Contents

1. [Flow 1: Create New Wallet (Passkey)](#flow-1-create-new-wallet-passkey)
2. [Flow 2: Import Wallet from Seed Phrase](#flow-2-import-wallet-from-seed-phrase)
3. [Flow 3: Restore Wallet with Passkey](#flow-3-restore-wallet-with-passkey)
4. [Common Error Scenarios & Retry Mechanisms](#common-error-scenarios--retry-mechanisms)
5. [State Management & Recovery](#state-management--recovery)

---

## Flow 1: Create New Wallet (Passkey)

### Overview
User creates a brand new wallet using passkey authentication, verifies their seed phrase, sets up a PIN, and optionally enables biometric authentication.

### Flow Steps

#### Step 1: Welcome Screen
**File**: `screens/auth/WelcomeScreen.jsx:88-117`

**Screen State**: Initial welcome (no wallet exists)

**UI Elements**:
- DUCΔT logo
- Title: "DUCΔT"
- Tagline: "A Decentralised Credit Platform"
- Button: "Create a new wallet"
- Button: "Restore an existing wallet"

**User Action**: Tap "Create a new wallet"

**What Happens**:
- Triggers `createWalletWithPasskey()` function (from `usePasskeyCreation` hook)
- **File**: `hooks/usePasskeyCreation.js:18-39`

**Validation**:
- Checks if device supports passkeys
- **Error**: If passkeys not supported → Shows toast: "Passkeys are not supported on this device"
- **Retry**: User returns to welcome screen, must use "Restore an existing wallet" → seed phrase import flow

**Success**: Proceeds to Passkey PIN Setup

---

#### Step 2: Passkey PIN Setup
**File**: `pages/OnboardingPage.js:252-347`

**Screen State**: `showPinInput = true`, `confirmingPin = false`

**UI Elements**:
- Title: "Create a 6-digit PIN"
- Subtitle: "This PIN will be used with your passkey to encrypt your wallet"
- 6 PIN dots (empty)
- Number keypad (0-9)
- Delete button
- Cancel button

**User Action**: Enter 6 digits

**Validation**:
- PIN must be exactly 6 digits
- Auto-advances to confirmation when 6 digits entered

**Error Scenarios**:
- None at entry stage (validation happens at confirmation)

**Success**: Auto-advances to PIN confirmation step

---

#### Step 2b: Passkey PIN Confirmation
**File**: `pages/OnboardingPage.js:252-347`

**Screen State**: `showPinInput = true`, `confirmingPin = true`

**UI Elements**:
- Title: "Confirm your PIN"
- Subtitle: "Enter your PIN again to confirm"
- 6 PIN dots (empty)
- Number keypad (0-9)
- Delete button
- Cancel button

**User Action**: Re-enter the same 6 digits

**Validation**:
- Must match the first PIN entry
- **File**: `hooks/usePasskeyCreation.js:40-70`

**Error Scenarios**:
1. **PINs don't match**
   - Shows toast: "PINs do not match. Please try again."
   - **Retry**: Resets to Step 2 (enter new PIN)
   - User can try again with fresh PIN entry

2. **PIN entry fails**
   - Shows toast with error message
   - **Retry**: Resets to Step 2
   - User can try again

**User Action (Cancel)**: Tap "Cancel" button
- Calls `resetPasskeyCreation()` - **File**: `hooks/usePasskeyCreation.js:133-142`
- Clears all passkey creation state:
  - `setShowPinInput(false)` - Hides PIN input screen
  - `setPasskeyPin('')` - Clears entered PIN
  - `setPasskeyPinConfirm('')` - Clears confirmation PIN
  - `setConfirmingPin(false)` - Resets confirmation state
  - `setCreatingWithPasskey(false)` - Exits passkey flow
- **File**: `pages/OnboardingPage.js:334-338`
- **Returns to**: Welcome Screen (Step 1)
- **User can**: Start over or choose "Restore an existing wallet"

**What Happens on Cancel**:
1. All PIN entry is cleared (no state preserved)
2. User returns to fresh Welcome Screen
3. No wallet has been created yet (safe to cancel)
4. User can retry "Create a new wallet" for fresh attempt
5. OR choose "Restore an existing wallet" instead

**Success**: Proceeds to wallet creation with passkey

---

#### Step 3: Wallet Creation with Passkey
**File**: `hooks/usePasskeyCreation.js:72-120`

**Background Process**:
1. Creates passkey credential with device
2. Generates 12-word mnemonic phrase
3. Derives Bitcoin addresses from mnemonic
4. Encrypts wallet with passkey + PIN
5. Saves encrypted wallet to secure storage
6. Loads wallet into app context
7. Sets authentication state

**Error Scenarios**:
1. **User cancels passkey authentication prompt**
   - When iOS prompts for Face ID/Touch ID, user taps "Cancel"
   - OR user dismisses the passkey prompt
   - Throws error that gets caught in `createWalletWithPasskey()`
   - **File**: `hooks/usePasskeyCreation.js:118-127`
   - Shows toast: "Failed to create wallet with passkey" (or specific error message)
   - Resets all passkey state:
     - `setCreatingWithPasskey(false)`
     - `setIsCreating(false)`
     - `setConfirmingPin(false)`
     - `setPasskeyPin('')`
     - `setPasskeyPinConfirm('')`
   - **Returns to**: Welcome Screen
   - **User can**:
     - Try "Create a new wallet" again (fresh attempt)
     - Choose "Restore an existing wallet" instead

2. **Passkey creation fails**
   - Passkey service throws error during wallet creation
   - iCloud Keychain unavailable/disabled
   - Device doesn't support passkeys properly
   - Shows toast: "Failed to create wallet with passkey" (or specific error)
   - **File**: `hooks/usePasskeyCreation.js:119`
   - **Retry**: Returns to Welcome Screen (same as scenario 1)
   - User can tap "Create a new wallet" to try again
   - OR choose "Restore an existing wallet" for seed phrase flow

3. **Wallet generation fails**
   - Error during mnemonic generation or address derivation
   - Same error handling as above
   - **Retry**: Returns to Welcome Screen

**Success**:
- User is authenticated (`isAuthenticated = true`)
- Seed phrase confirmed (`seedConfirmed = true`)
- Proceeds to Main Wallet Page
- Balance fetch begins in background

**Expected Outcome**: User lands on Wallet Home screen with new wallet

---

### Complete Flow Summary

```
Welcome Screen
    ↓ [Tap "Create a new wallet"]
Passkey PIN Setup (Enter PIN)
    ↓ [Enter 6 digits] → auto-advance
Passkey PIN Setup (Confirm PIN)
    ↓ [Enter same 6 digits]
    ↓ [PINs match ✓]
Wallet Creation (Background)
    ↓ [Passkey + wallet created ✓]
Main Wallet Page ✓
```

---

## Flow 2: Import Wallet from Seed Phrase

### Overview
User imports an existing wallet using their 12-word recovery phrase, sets up a PIN, optionally enables biometric authentication, and gets option to migrate to passkey.

### Flow Steps

#### Step 1: Welcome Screen
**File**: `screens/auth/WelcomeScreen.jsx:88-117`

**Screen State**: Initial welcome (no wallet exists)

**User Action**: Tap "Restore an existing wallet"

**What Happens**:
- Sets `restoringWithPasskey = true`
- Shows restore choice screen

**Success**: Proceeds to Restore Choice Screen

---

#### Step 2: Restore Choice Screen
**File**: `screens/auth/WelcomeScreen.jsx:119-155`

**Screen State**: `restoringWithPasskey = true`, `importingWallet = false`

**UI Elements**:
- Title: "Restore Wallet"
- Label: "Choose how to restore your wallet:"
- Button: "From Seed Phrase"
- Button: "From Passkey" (if available)
- Button: "Cancel"

**User Action**: Tap "From Seed Phrase"

**What Happens**:
- Sets `restoringWithPasskey = false`
- Sets `importingWallet = true`

**User Action (Cancel)**: Tap "Cancel"
- Returns to Welcome Screen (Step 1)
- User can choose different option

**Success**: Proceeds to Seed Phrase Import Screen

---

#### Step 3: Seed Phrase Import Screen
**File**: `screens/auth/WelcomeScreen.jsx:157-268`

**Screen State**: `importingWallet = true`

**UI Elements**:
- Title: "Import Wallet"
- Label: "Enter your 12-word seed phrase:"
- 12 text input fields (numbered 1-12)
- Button: "Import Wallet"
- Button: "Cancel"

**User Action**: Enter 12-word seed phrase

**Input Features**:
- Auto-lowercase and trim
- Paste support (splits across multiple fields)
- Auto-advance to next field after 3+ characters
- Submit key advances to next field
- **File**: `screens/auth/WelcomeScreen.jsx:186-227`

**User Action**: Tap "Import Wallet"

**Validation**:
- All 12 words must be filled
- Words are validated as proper BIP39 words
- **File**: `hooks/useWalletImport.js:85-147`

**Error Scenarios**:
1. **Invalid seed phrase** (wrong words, wrong count, invalid BIP39)
   - Shows toast: "Failed to import wallet. Please check your seed phrase and try again."
   - **File**: `hooks/useWalletImport.js:141`
   - **Retry**: Seed phrase fields remain populated
   - User can correct their seed phrase and tap "Import Wallet" again
   - Form is NOT cleared on error (preserves user input)

2. **Import process fails** (storage error, wallet derivation error)
   - Same error toast as above
   - **Retry**: User can fix and retry
   - Can tap "Cancel" to start over

**User Action (Cancel)**: Tap "Cancel"
- Clears seed phrase form
- Returns to Restore Choice Screen (Step 2)
- User can choose different restore method

**Loading State**:
- Button shows "Importing..." while processing
- Button is disabled during import
- **File**: `screens/auth/WelcomeScreen.jsx:245-251`

**Success**:
- Wallet saved to secure storage
- Sets `settingUpPin = true`
- Sets `isImportedWallet = true`
- Stores mnemonic for passkey migration later
- Proceeds to PIN Setup Screen

---

#### Step 4: PIN Setup Screen (Step 4 of 4)
**File**: `screens/auth/PinSetupScreen.jsx:150-214`

**Screen State**: `settingUpPin = true`, `changingPin = false`, `pinStep = 'enter'`

**UI Elements**:
- Title: "Enter 6-Digit PIN"
- 6 PIN dots (empty)
- Number keypad (0-9)
- Delete button

**User Action**: Enter 6 digits

**Validation**:
- PIN must be exactly 6 digits
- Auto-advances to confirmation when 6 digits entered
- **File**: `screens/auth/PinSetupScreen.jsx:40-49`

**Success**: Auto-advances to PIN confirmation

---

#### Step 4b: PIN Confirmation
**File**: `screens/auth/PinSetupScreen.jsx:150-214`

**Screen State**: `settingUpPin = true`, `changingPin = false`, `pinStep = 'confirm'`

**UI Elements**:
- Title: "Confirm Your PIN"
- Error message (if PINs don't match)
- 6 PIN dots (empty)
- Number keypad (0-9)
- Delete button

**User Action**: Re-enter the same 6 digits

**Validation**:
- Must match the first PIN entry
- **File**: `screens/auth/PinSetupScreen.jsx:51-108`

**Error Scenarios**:
1. **PINs don't match**
   - Shows error: "PINs don't match. Please try again."
   - **File**: `screens/auth/PinSetupScreen.jsx:100`
   - **Retry**: Resets both PIN entries
   - Returns to Step 4 (enter new PIN)
   - User starts fresh with new PIN

2. **PIN save fails**
   - Shows error: "Failed to save PIN. Please try again."
   - **File**: `screens/auth/PinSetupScreen.jsx:91`
   - **Retry**: Resets both PIN entries
   - Returns to Step 4 (enter new PIN)
   - User can try again

**Success**:
- PIN saved to secure storage
- If biometric supported → Shows biometric prompt
- If not supported → Completes setup

---

#### Step 4c: Biometric Authentication Prompt (Optional)
**File**: `screens/auth/PinSetupScreen.jsx:216-240`

**Screen State**: `showBiometricPrompt = true` (only if device supports biometrics)

**UI Elements**:
- Modal overlay
- Title: "Biometric Authentication"
- Text: "Do you want to use biometric authentication (FaceID or TouchID) for UNIT Wallet?"
- Button: "Yes, Enable"
- Button: "No, Thanks"

**User Action**: Tap "Yes, Enable" or "No, Thanks"

**What Happens (Yes)**:
- Saves biometric preference to secure storage
- Triggers biometric authentication prompt
- **File**: `screens/auth/PinSetupScreen.jsx:120-138`
- Completes setup regardless of biometric result

**What Happens (No)**:
- Saves biometric preference as disabled
- **File**: `screens/auth/PinSetupScreen.jsx:140-146`
- Completes setup

**Success**: Proceeds to complete setup

---

#### Step 5: Complete Setup & Load Wallet
**File**: `pages/OnboardingPage.js:169-228`

**Background Process**:
1. Loads wallet into app context
2. Sets authentication state (`isAuthenticated = true`)
3. Sets seed confirmed (`seedConfirmed = true`)
4. Triggers balance fetch in background
5. Navigates to main app
6. After 2-second delay → Shows passkey migration modal

**Passkey Migration Modal** (appears after landing on wallet):
- **File**: Referenced in `pages/OnboardingPage.js:218-222`
- Offers user option to migrate to passkey authentication
- Non-blocking (user can dismiss and use wallet)
- User can choose to migrate now or skip

**Expected Outcome**: User lands on Wallet Home screen with imported wallet

---

### Complete Flow Summary

```
Welcome Screen
    ↓ [Tap "Restore an existing wallet"]
Restore Choice Screen
    ↓ [Tap "From Seed Phrase"]
Seed Phrase Import Screen
    ↓ [Enter 12 words] → [Tap "Import Wallet"]
    ↓ [Valid seed phrase ✓]
PIN Setup (Enter PIN)
    ↓ [Enter 6 digits] → auto-advance
PIN Setup (Confirm PIN)
    ↓ [Enter same 6 digits]
    ↓ [PINs match ✓]
Biometric Prompt (Optional)
    ↓ [Enable or Skip]
Complete Setup (Background)
    ↓ [Wallet loaded ✓]
Main Wallet Page ✓
    ↓ [After 2 seconds]
Passkey Migration Modal (Optional, non-blocking)
```

---

## Flow 3: Restore Wallet with Passkey

### Overview
User restores an existing passkey-encrypted wallet from iCloud Keychain using their passkey and PIN.

### Flow Steps

#### Step 1: Welcome Screen
**File**: `screens/auth/WelcomeScreen.jsx:88-117`

**Screen State**: Initial welcome (no wallet exists)

**User Action**: Tap "Restore an existing wallet"

**Success**: Proceeds to Restore Choice Screen

---

#### Step 2: Restore Choice Screen
**File**: `screens/auth/WelcomeScreen.jsx:119-155`

**Screen State**: `restoringWithPasskey = true`, `importingWallet = false`

**User Action**: Tap "From Passkey"

**What Happens**:
- Triggers `restoreWithPasskey()` function (from `usePasskeyRestore` hook)
- **File**: `hooks/usePasskeyRestore.js:18-38`

**Validation**:
1. Checks if device supports passkeys
2. Checks if passkey wallet exists in iCloud

**Error Scenarios**:
1. **Passkeys not supported**
   - Shows toast: "Passkeys are not supported on this device"
   - **Retry**: Returns to Restore Choice Screen
   - User must use "From Seed Phrase" option instead

2. **No passkey wallet found**
   - Shows toast: "No passkey wallet found in iCloud"
   - **Retry**: Returns to Restore Choice Screen
   - User must use "From Seed Phrase" option instead

3. **Restore start fails**
   - Shows toast with error message
   - **Retry**: Returns to Restore Choice Screen
   - User can try again or use seed phrase

**User Action (Cancel)**: Tap "Cancel"
- Returns to Welcome Screen
- User can choose different option

**Success**: Proceeds to Passkey PIN Entry

---

#### Step 3: Passkey Restore PIN Entry
**File**: `pages/OnboardingPage.js:349-437`

**Screen State**: `showRestorePinInput = true`

**UI Elements**:
- Title: "Enter your PIN"
- Subtitle: "Enter the PIN you created with your passkey wallet"
- 6 PIN dots (empty)
- Number keypad (0-9)
- Delete button
- Cancel button

**User Action**: Enter 6-digit PIN

**What Happens**:
- Auto-submits when 6 digits entered
- Triggers `restoreWalletWithPasskey(pin)` function
- **File**: `hooks/usePasskeyRestore.js:44-84`

**Background Process**:
1. Authenticates with passkey
2. Decrypts wallet using passkey + PIN
3. Loads wallet into secure storage
4. Loads wallet into app context
5. Sets authentication state

**Error Scenarios**:
1. **User cancels passkey authentication prompt**
   - When iOS prompts for Face ID/Touch ID during restore, user taps "Cancel"
   - OR user dismisses the passkey authentication prompt
   - Throws error caught in `restoreWalletWithPasskey()`
   - **File**: `hooks/usePasskeyRestore.js:82`
   - Shows toast: "Failed to restore wallet with passkey" (or specific error message)
   - **Retry**: PIN field remains (can try again with same/different PIN)
   - Each new PIN attempt will trigger a new passkey prompt
   - User can tap "Cancel" button to return to Restore Choice Screen

2. **Invalid PIN** (wrong PIN for this passkey)
   - PIN doesn't match the one used to encrypt the wallet
   - Passkey authentication succeeds but decryption fails
   - Shows toast: "Failed to restore wallet with passkey" (or specific error)
   - **File**: `hooks/usePasskeyRestore.js:82`
   - **Retry**: PIN field clears automatically
   - User can re-enter correct PIN
   - Can tap "Cancel" to go back to Restore Choice Screen

3. **Passkey authentication fails**
   - Biometric authentication fails (wrong face/fingerprint)
   - Too many failed biometric attempts
   - Shows toast with error message
   - **Retry**: Can try entering PIN again (triggers new passkey prompt)
   - System may fall back to device passcode

4. **Wallet decrypt fails**
   - Wallet data corrupted in iCloud
   - Wrong PIN/passkey combination
   - Passkey credential changed/rotated
   - Shows toast with error message
   - **Retry**: Can try entering PIN again
   - If persistent, user must use "From Seed Phrase" option

**User Action (Cancel)**: Tap "Cancel" button
- Calls `resetPasskeyRestore()` - **File**: `pages/OnboardingPage.js:424-428`
- Clears passkey restore state:
  - `setRestorePin('')` - Clears entered PIN
  - `resetPasskeyRestore()` - Resets restoration state
  - `setRestoringWithPasskey(true)` - Returns to restore choice
- **Returns to**: Restore Choice Screen (Step 2)
- **User can**:
  - Try "From Passkey" again (fresh attempt)
  - Choose "From Seed Phrase" instead
  - Tap "Cancel" on Restore Choice to return to Welcome Screen

**What Happens on Cancel**:
1. PIN entry is cleared (no state preserved)
2. User returns to Restore Choice Screen
3. No wallet has been modified (safe to cancel)
4. User can retry passkey restore with fresh PIN entry
5. OR switch to seed phrase import method

**Success**:
- User is authenticated (`isAuthenticated = true`)
- Seed phrase confirmed (`seedConfirmed = true`)
- Proceeds to Main Wallet Page
- Balance fetch begins in background

**Expected Outcome**: User lands on Wallet Home screen with restored passkey wallet

---

### Complete Flow Summary

```
Welcome Screen
    ↓ [Tap "Restore an existing wallet"]
Restore Choice Screen
    ↓ [Tap "From Passkey"]
    ↓ [Passkey exists in iCloud ✓]
Passkey PIN Entry
    ↓ [Enter 6-digit PIN]
    ↓ [Passkey auth ✓] [Decrypt wallet ✓]
Main Wallet Page ✓
```

---

## Passkey Cancellation Flows

### Summary: What Happens When User Cancels Passkey Operations

Passkey operations can be cancelled at multiple points. Here's what happens in each case:

#### During Passkey Wallet Creation

**Cancel Point 1: Tap "Cancel" button during PIN setup**
```
Welcome Screen
    ↓ [Tap "Create a new wallet"]
Passkey PIN Setup (Enter PIN)
    ↓ [User enters some digits]
    ↓ [Tap "Cancel" button]
    ↓ resetPasskeyCreation() called
    ↓ All state cleared
Welcome Screen (fresh start)
```
- **File**: `pages/OnboardingPage.js:334-338`
- **Result**: Returns to Welcome Screen, no wallet created
- **User can**: Try again or choose seed phrase import

**Cancel Point 2: Cancel iOS passkey/biometric prompt**
```
Welcome Screen
    ↓ [Tap "Create a new wallet"]
Passkey PIN Setup (Enter PIN)
    ↓ [Enter 6 digits]
Passkey PIN Setup (Confirm PIN)
    ↓ [Enter 6 digits, PINs match]
iOS Passkey/Biometric Prompt
    ↓ [User taps "Cancel" or dismisses]
    ↓ Error thrown and caught
    ↓ Error toast shown
    ↓ All state reset
Welcome Screen (fresh start)
```
- **File**: `hooks/usePasskeyCreation.js:118-127`
- **Result**: Returns to Welcome Screen, no wallet created
- **User can**: Try again or choose seed phrase import

---

#### During Passkey Wallet Restore

**Cancel Point 1: Tap "Cancel" button during PIN entry**
```
Welcome Screen
    ↓ [Tap "Restore an existing wallet"]
Restore Choice Screen
    ↓ [Tap "From Passkey"]
Passkey PIN Entry
    ↓ [User enters some digits]
    ↓ [Tap "Cancel" button]
    ↓ resetPasskeyRestore() called
    ↓ PIN cleared, state reset
Restore Choice Screen
```
- **File**: `pages/OnboardingPage.js:424-428`
- **Result**: Returns to Restore Choice Screen
- **User can**: Try passkey again, use seed phrase, or go back to welcome

**Cancel Point 2: Cancel iOS passkey/biometric prompt during restore**
```
Welcome Screen
    ↓ [Tap "Restore an existing wallet"]
Restore Choice Screen
    ↓ [Tap "From Passkey"]
Passkey PIN Entry
    ↓ [Enter 6 digits]
iOS Passkey/Biometric Prompt
    ↓ [User taps "Cancel" or dismisses]
    ↓ Error thrown and caught
    ↓ Error toast shown
Passkey PIN Entry (stays on same screen)
```
- **File**: `hooks/usePasskeyRestore.js:82`
- **Result**: Stays on PIN entry screen, can retry
- **User can**:
  - Enter PIN again (triggers new passkey prompt)
  - Tap "Cancel" button to return to Restore Choice
  - Switch to seed phrase import

---

### Key Differences: Creation vs Restore Cancellation

| Aspect | Passkey Creation Cancel | Passkey Restore Cancel |
|--------|------------------------|------------------------|
| **Cancel button destination** | Welcome Screen | Restore Choice Screen |
| **Passkey prompt cancel destination** | Welcome Screen | Stays on PIN entry |
| **Can retry immediately?** | No (returns to welcome) | Yes (stays on PIN screen) |
| **State cleared?** | Yes (full reset) | Partial (PIN cleared only) |
| **Wallet affected?** | No (none created) | No (not modified) |

---

## Common Error Scenarios & Retry Mechanisms

### 1. App Backgrounding / State Loss During Onboarding

**Scenario**: User backgrounds the app during wallet creation flow before completing PIN setup

**Protection**: State persistence via AsyncStorage
- **File**: `hooks/useWalletCreation.js:36-77`
- Saves creation state (mnemonic, current step)
- Restores state on app foreground

**Recovery**:
- User returns to exact step they were on
- Can continue from where they left off
- Can tap "Cancel" to start over

**Files**:
- `hooks/useWalletCreation.js` - Creates `CREATION_STATE_KEY`
- `hooks/useWalletImport.js` - Creates `IMPORT_STATE_KEY`
- `hooks/useSeedVerification.js` - Creates `VERIFICATION_STATE_KEY`

---

### 2. User Closes App Before Completing Onboarding

**Scenario**: User creates wallet, sees seed phrase, but closes app before verification

**Protection**:
- Wallet is NOT saved to storage until PIN is set
- **File**: `hooks/useWalletCreation.js:98-99`
- Persisted state allows resuming onboarding

**Recovery on Restart**:
- Loads persisted creation state
- Shows seed phrase display screen
- User can continue with verification
- OR tap "Cancel" / "Start Over" to reset completely
- **File**: `pages/OnboardingPage.js:236-249`

---

### 3. Invalid Seed Phrase Import

**Scenario**: User enters wrong seed phrase words

**Error**: "Failed to import wallet. Please check your seed phrase and try again."
- **File**: `hooks/useWalletImport.js:141`

**Retry Mechanism**:
- Form remains populated (doesn't clear)
- User can correct individual words
- Tap "Import Wallet" again
- No limit on retry attempts

---

### 4. PIN Mismatch During Setup

**Scenario**: User enters different PINs during confirmation

**Error**: "PINs don't match. Please try again."
- **File**: `screens/auth/PinSetupScreen.jsx:100`

**Retry Mechanism**:
- Both PIN entries reset to empty
- User returns to "Enter 6-Digit PIN" step
- Can enter fresh PIN
- No limit on retry attempts

---

### 5. PIN Save Failure

**Scenario**: Secure storage fails when saving PIN

**Error**: "Failed to save PIN. Please try again."
- **File**: `screens/auth/PinSetupScreen.jsx:91`

**Retry Mechanism**:
- Both PIN entries reset
- User returns to PIN entry step
- Can try again immediately
- If persistent failure, indicates device/OS issue

---

### 6. Wallet Generation Failure

**Scenario**: Random number generation or wallet derivation fails

**Error**: Error message from wallet service
- **File**: `hooks/useWalletCreation.js:117`

**Retry Mechanism**:
- Returns to Welcome Screen
- User can tap "Create a new wallet" again
- Fresh generation attempt with new randomness

---

### 7. Passkey Not Supported

**Scenario**: Device doesn't support passkey authentication

**Error**: "Passkeys are not supported on this device"
- **File**: `hooks/usePasskeyCreation.js:29`

**Retry Mechanism**:
- Returns to Welcome Screen
- User must use "Restore an existing wallet" → Seed phrase import
- Cannot use passkey creation on this device

---

### 8. No Passkey Wallet Found

**Scenario**: User tries to restore with passkey but has no passkey wallet in iCloud

**Error**: "No passkey wallet found in iCloud"
- **File**: `hooks/usePasskeyRestore.js:30`

**Retry Mechanism**:
- Returns to Restore Choice Screen
- User must use "From Seed Phrase" option
- Or create new wallet

---

### 9. User Cancels Passkey Authentication (During Creation)

**Scenario**: User enters PIN for passkey wallet creation, then taps "Cancel" on the iOS passkey/biometric prompt

**Error**: "Failed to create wallet with passkey"
- **File**: `hooks/usePasskeyCreation.js:118-127`

**Retry Mechanism**:
- All passkey creation state is reset
- Returns to Welcome Screen
- User can try again: "Create a new wallet" (fresh attempt)
- OR switch to: "Restore an existing wallet" → "From Seed Phrase"
- No wallet created (safe to cancel)

---

### 10. User Cancels During Passkey PIN Setup

**Scenario**: User is entering/confirming PIN for passkey creation and taps "Cancel" button

**Behavior**: Graceful cancellation
- **File**: `pages/OnboardingPage.js:334-338`

**Retry Mechanism**:
- Calls `resetPasskeyCreation()` - clears all state
- PIN entries cleared
- Returns to Welcome Screen
- User can start over or choose different option
- No wallet created (safe to cancel)

---

### 11. User Cancels Passkey Authentication (During Restore)

**Scenario**: User enters PIN for passkey restore, then taps "Cancel" on the iOS passkey/biometric prompt

**Error**: "Failed to restore wallet with passkey"
- **File**: `hooks/usePasskeyRestore.js:82`

**Retry Mechanism**:
- PIN field remains visible
- User can enter PIN again (triggers new passkey prompt)
- Can tap "Cancel" button to return to Restore Choice Screen
- Can switch to "From Seed Phrase" method
- Each retry triggers fresh passkey authentication

---

### 12. User Cancels During Passkey Restore PIN Entry

**Scenario**: User is entering PIN for passkey restore and taps "Cancel" button

**Behavior**: Graceful cancellation
- **File**: `pages/OnboardingPage.js:424-428`

**Retry Mechanism**:
- Clears PIN field
- Returns to Restore Choice Screen
- User can try passkey restore again
- OR switch to seed phrase import
- OR tap Cancel to return to Welcome Screen

---

### 13. Biometric Authentication Failure

**Scenario**: User enables biometric but authentication fails

**Behavior**: Non-blocking failure
- **File**: `screens/auth/PinSetupScreen.jsx:120-138`
- Setup completes anyway
- User can use PIN to unlock
- Can enable biometric later in Settings

---

### 14. Balance Fetch Failure After Onboarding

**Scenario**: Wallet loads successfully but balance fetch fails

**Behavior**: Silent failure / background retry
- User lands on wallet page successfully
- Balance shows as loading or 0
- App retries balance fetch automatically
- User can manually refresh

**Not a blocking error**: Onboarding is considered complete

---

## State Management & Recovery

### Navigation State Logic

**File**: `hooks/useNavigationState.js`

**Determines**: `shouldShowAuth` (show auth screens vs main app)

```javascript
shouldShowAuth = true if:
  - !wallet (no wallet created)
  - wallet && !seedConfirmed (seed not confirmed yet)
  - settingUpPin && !changingPin (first-time PIN setup)
  - showPinEntry (PIN entry required)
  - !isAuthenticated && wallet && seedConfirmed (locked state)

shouldShowAuth = false if:
  - wallet && isAuthenticated && seedConfirmed (fully set up)
```

### Critical State Variables

**From AuthContext** (`contexts/AuthContext.js`):
- `isAuthenticated` - User has entered correct PIN
- `settingUpPin` - User is in PIN setup flow
- `showPinEntry` - Needs to show PIN entry screen

**From WalletContext** (`contexts/WalletContext.js`):
- `wallet` - Wallet exists in storage
- `seedConfirmed` - User has confirmed seed phrase backup

**From Onboarding State**:
- `showingIntro` - Step 1 of wallet creation
- `showingSeeds` - Step 2 (seed display)
- `verifyingSeeds` - Step 3 (seed verification)
- `importingWallet` - Importing from seed phrase
- `isImportedWallet` - Flag for imported wallet (triggers passkey migration)

### Persisted State Keys

**AsyncStorage Keys**:
- `wallet_creation_state` - Wallet creation progress
- `wallet_import_state` - Import progress
- `seed_verification_state` - Verification progress

**Cleared When**:
- Onboarding completes successfully
- User cancels onboarding
- User taps "Start Over"

### Complete Onboarding Success Criteria

User has successfully completed onboarding when ALL are true:
1. `wallet !== null` (wallet exists in secure storage)
2. `isAuthenticated === true` (PIN verified)
3. `seedConfirmed === true` (seed backup confirmed OR imported wallet)
4. Navigation state shows main app (`shouldShowAuth === false`)

**Result**: User lands on `WalletPage` (main wallet screen)

---

## Testing Checklist

Use this checklist to ensure all onboarding flows work correctly:

### Flow 1: Create New Wallet (Passkey)
- [ ] Welcome screen displays correctly
- [ ] "Create a new wallet" button triggers passkey PIN setup
- [ ] Can enter 6-digit PIN
- [ ] Can delete digits using delete button
- [ ] PIN confirmation requires exact match
- [ ] Mismatch shows error and resets to PIN entry
- [ ] PIN match triggers wallet creation
- [ ] Passkey/biometric prompt appears during creation
- [ ] Can cancel passkey prompt (returns to welcome, shows error)
- [ ] Wallet creation succeeds and loads (if not cancelled)
- [ ] Lands on wallet page successfully
- [ ] Balance fetch begins
- [ ] Can tap "Cancel" button at PIN setup and return to welcome
- [ ] Cancel button clears all PIN state and resets flow
- [ ] Passkey not supported shows error and returns to welcome
- [ ] Can retry after cancellation with fresh attempt
- [ ] Can switch to seed phrase import after cancelling passkey

### Flow 2: Import Wallet from Seed Phrase
- [ ] Welcome screen → "Restore an existing wallet"
- [ ] Restore choice screen shows
- [ ] "From Seed Phrase" shows import screen
- [ ] Can enter 12 words
- [ ] Can paste full seed phrase (splits across fields)
- [ ] Auto-advance works between fields
- [ ] Invalid seed shows error toast
- [ ] Error doesn't clear the form (allows correction)
- [ ] Valid seed advances to PIN setup
- [ ] PIN setup works (enter → confirm → match)
- [ ] PIN mismatch shows error and resets
- [ ] Biometric prompt shows (if supported)
- [ ] Can skip biometric prompt
- [ ] Wallet loads successfully
- [ ] Lands on wallet page
- [ ] Passkey migration modal appears after 2 seconds
- [ ] Can cancel at import screen and return to restore choice
- [ ] Can cancel at restore choice and return to welcome

### Flow 3: Restore Wallet with Passkey
- [ ] Welcome screen → "Restore an existing wallet"
- [ ] Restore choice screen shows
- [ ] "From Passkey" triggers passkey check
- [ ] No passkey found shows error and returns to restore choice
- [ ] Passkey not supported shows error and returns to restore choice
- [ ] Passkey found advances to PIN entry
- [ ] Can enter 6-digit PIN
- [ ] Invalid PIN shows error and allows retry
- [ ] Valid PIN triggers passkey/biometric authentication
- [ ] Can cancel passkey prompt (shows error, stays on PIN screen)
- [ ] Can retry PIN entry after cancelling passkey prompt
- [ ] Each PIN retry triggers new passkey authentication
- [ ] Successful auth decrypts wallet
- [ ] Wallet loads successfully
- [ ] Lands on wallet page
- [ ] Can tap "Cancel" button at PIN entry and return to restore choice
- [ ] Cancel button clears PIN and returns to restore choice
- [ ] Can switch to seed phrase import after cancelling passkey restore

### State Persistence & Recovery
- [ ] Background app during wallet creation resumes correctly
- [ ] Background app during seed display resumes correctly
- [ ] Background app during seed verification resumes correctly
- [ ] Background app during import resumes correctly
- [ ] Cancel during any flow clears persisted state
- [ ] Complete onboarding clears persisted state

### Error Handling
- [ ] Invalid seed phrase shows error and preserves input
- [ ] PIN mismatch shows error and resets both PINs
- [ ] PIN save failure shows error and resets
- [ ] Wallet generation failure returns to welcome
- [ ] Passkey creation failure returns to welcome
- [ ] Passkey restore failure allows retry
- [ ] Network failure during balance fetch doesn't block onboarding

---

## File Reference Index

### Screen Components
- `screens/auth/WelcomeScreen.jsx` - Welcome, import, seed display/verification
- `screens/auth/PinSetupScreen.jsx` - PIN creation and confirmation
- `screens/auth/LockScreen.jsx` - PIN entry for authentication

### Page Container
- `pages/OnboardingPage.js` - Main onboarding orchestrator

### Hooks
- `hooks/useWalletCreation.js` - New wallet creation logic
- `hooks/useWalletImport.js` - Seed phrase import logic
- `hooks/useSeedVerification.js` - Seed verification logic
- `hooks/usePasskeyCreation.js` - Passkey wallet creation
- `hooks/usePasskeyRestore.js` - Passkey wallet restore
- `hooks/useNavigationState.js` - Navigation state logic

### Services
- `services/walletService.js` - Wallet generation and import
- `services/authService.js` - PIN saving and verification
- `services/passkeyService.js` - Passkey operations

### Constants
- `utils/messages.js` - All error messages and success messages
- `utils/constants.js` - Secure storage keys

---

## Notes

- All onboarding flows are designed to be interruptible and resumable
- User can always cancel and return to previous step or start over
- No destructive actions until user completes entire flow
- State is persisted to handle app backgrounding gracefully
- Errors are user-friendly and provide clear retry paths
- No retry limits on user actions (allows unlimited attempts)
