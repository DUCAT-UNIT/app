# DUCAT Wallet - Complete Flow Test Guide

This document provides step-by-step instructions for manually testing all application flows.

---

## Table of Contents

1. [Authentication & Onboarding](#1-authentication--onboarding)
2. [Wallet Operations](#2-wallet-operations)
3. [Send Flows](#3-send-flows)
4. [Receive Flows](#4-receive-flows)
5. [Cashu/Ecash Flows](#5-cashuecash-flows)
6. [Vault Flows](#6-vault-flows)
7. [Settings Flows](#7-settings-flows)
8. [Asset Detail Flows](#8-asset-detail-flows)
9. [Transaction History Flows](#9-transaction-history-flows)
10. [Error & Edge Case Flows](#10-error--edge-case-flows)
11. [Background & Lifecycle Flows](#11-background--lifecycle-flows)

---

## 1. Authentication & Onboarding

### 1.1 New Wallet Creation

**Preconditions:** Fresh app install or deleted wallet data

**Steps:**
1. Launch the app
2. Wait for SplashScreen to complete
3. On WelcomeScreen, tap "Create New Wallet"
4. View InitialWelcome screen, tap "Continue"
5. On SeedPhraseDisplay:
   - Verify 12/24 words are displayed
   - Write down the seed phrase
   - Tap "I've saved my seed phrase"
6. On SeedPhraseVerify:
   - Enter the requested words in correct order
   - Tap "Verify"
7. On PinSetupScreen:
   - Enter a 6-digit PIN
   - Confirm the PIN
8. Verify navigation to WalletScreen

**Expected Results:**
- Seed phrase is generated and displayed
- Verification requires correct words
- PIN is set successfully
- Wallet opens with zero balance

---

### 1.2 Import Wallet from Seed Phrase

**Preconditions:** Fresh app install, have a valid seed phrase ready

**Steps:**
1. Launch the app
2. On WelcomeScreen, tap "Restore Wallet"
3. On RestoreChoiceScreen, tap "Import from Seed Phrase"
4. On ImportWalletScreen:
   - Enter each word of your seed phrase
   - Tap "Import"
5. On PinSetupScreen:
   - Enter a 6-digit PIN
   - Confirm the PIN
6. Verify navigation to WalletScreen

**Expected Results:**
- Seed phrase is validated
- Invalid words show error
- Wallet restores with correct balance
- Transaction history loads

---

### 1.3 Passkey Wallet Creation

**Preconditions:** Fresh app install, device supports WebAuthn/Passkeys

**Steps:**
1. Launch the app
2. On WelcomeScreen, tap "Create with Passkey"
3. Complete device biometric/passkey prompt
4. Verify wallet creation completes
5. Navigate to WalletScreen

**Expected Results:**
- Passkey is registered with device
- No seed phrase shown (passkey-based)
- Wallet opens successfully

---

### 1.4 Passkey Wallet Restore

**Preconditions:** Previously created passkey wallet on same device/account

**Steps:**
1. Launch the app
2. On WelcomeScreen, tap "Restore Wallet"
3. On RestoreChoiceScreen, tap "Restore with Passkey"
4. Complete device biometric/passkey prompt
5. Verify wallet restoration

**Expected Results:**
- Passkey is recognized
- Wallet restores with previous balance
- All settings preserved

---

### 1.5 PIN Entry (Unlock)

**Preconditions:** Existing wallet, app is locked

**Steps:**
1. Launch app or return from background
2. On LockScreen, enter 6-digit PIN
3. Verify navigation to WalletScreen

**Expected Results:**
- Correct PIN unlocks wallet
- Wallet data loads correctly

---

### 1.6 Biometric Authentication

**Preconditions:** Existing wallet, biometrics enabled in settings

**Steps:**
1. Launch app or return from background
2. On LockScreen, biometric prompt appears
3. Complete FaceID/TouchID authentication
4. Verify navigation to WalletScreen

**Expected Results:**
- Biometric prompt appears automatically
- Successful auth unlocks wallet
- Can fall back to PIN if biometric fails

---

### 1.7 PIN Lockout (Failed Attempts)

**Preconditions:** Existing wallet, app is locked

**Steps:**
1. Launch app
2. On LockScreen, enter wrong PIN 5 times
3. Observe lockout timer
4. Wait for timer to expire
5. Enter correct PIN

**Expected Results:**
- After 5 wrong attempts, lockout timer appears
- Cannot attempt PIN during lockout
- After timer expires, can try again
- Correct PIN unlocks wallet

---

## 2. Wallet Operations

### 2.1 View Total Balance

**Preconditions:** Unlocked wallet with balance

**Steps:**
1. On WalletScreen, observe TotalBalanceSection
2. Tap on balance to toggle USD/BTC display
3. Observe UnitBalanceBreakdown below

**Expected Results:**
- Total balance displays correctly
- Tapping toggles between USD and BTC
- Breakdown shows on-chain vs ecash

---

### 2.2 View Asset Cards

**Preconditions:** Unlocked wallet

**Steps:**
1. On WalletScreen, scroll to asset cards
2. Observe BTC AssetCard
3. Observe UNIT AssetCard
4. Verify balances match total

**Expected Results:**
- BTC card shows Bitcoin balance
- UNIT card shows UNIT balance
- Prices update periodically

---

### 2.3 Pull to Refresh

**Preconditions:** Unlocked wallet

**Steps:**
1. On WalletScreen, pull down from top
2. Observe loading indicator
3. Wait for refresh to complete

**Expected Results:**
- Loading spinner appears
- Balances update
- Transaction history refreshes
- Price data updates

---

### 2.4 Account Switcher - Switch Accounts

**Preconditions:** Multiple accounts created

**Steps:**
1. On WalletScreen, tap account icon in WalletHeader
2. AccountSwitcherModal opens
3. Tap on a different account
4. Verify wallet switches

**Expected Results:**
- Modal shows all accounts
- Tapping account switches context
- Balance updates to selected account
- Modal closes

---

### 2.5 Account Switcher - Create New Account

**Preconditions:** Unlocked wallet

**Steps:**
1. Tap account icon in WalletHeader
2. In AccountSwitcherModal, tap "Add Account"
3. Complete account creation flow
4. Verify new account appears

**Expected Results:**
- New account is created
- Account appears in switcher
- Can switch to new account
- New account has zero balance

---

## 3. Send Flows

### 3.1 Send BTC - Standard Flow

**Preconditions:** Wallet with BTC balance

**Steps:**
1. Tap "Send" in bottom navigation
2. On AssetSelectorScreen, select "BTC"
3. On SendInputScreen:
   - Enter valid Bitcoin address
   - Enter amount in BTC or USD
   - Tap "Review"
5. On ReviewScreen:
   - Verify recipient address
   - Verify amount
   - Verify fee breakdown
   - Tap "Send"
6. On ProcessingScreen, wait for broadcast
7. On ConfirmationScreen, verify success

**Expected Results:**
- Valid addresses accepted
- Invalid addresses show error
- Amount cannot exceed balance
- Fee is calculated correctly
- Transaction broadcasts successfully
- Confirmation shows txid

---

### 3.2 Send UNIT - Standard Flow

**Preconditions:** Wallet with UNIT balance

**Steps:**
1. Tap "Send" in bottom navigation
2. On AssetSelectorScreen, select "UNIT"
3. On SendInputScreen:
   - Enter valid UNIT address
   - Enter amount
   - Tap "Review"
5. On ReviewScreen:
   - Verify all details
   - Tap "Send"
6. Complete processing and confirmation

**Expected Results:**
- UNIT addresses validated correctly
- Amount respects UNIT balance
- Transaction completes successfully

---

### 3.3 Send UNIT - Turbo Flow

**Preconditions:** Wallet with UNIT balance, Turbo enabled

**Steps:**
1. Tap "Send" in bottom navigation
2. Select "UNIT" asset
3. Enter recipient address
4. Enter amount
5. On ReviewScreen, observe "Turbo" indicator
6. Tap "Send"
7. On TurboLoadingScreen, wait for P2PK setup
8. On TurboProcessingScreen, wait for ecash
9. On TurboClaimingScreen, wait for claim
10. Verify confirmation

**Expected Results:**
- Turbo flow activates for eligible transactions
- P2PK keys generated
- Ecash tokens created
- Recipient can claim instantly
- Confirmation shows turbo completion

---

### 3.4 Send - Scan QR for Address

**Preconditions:** Wallet with balance, QR code ready

**Steps:**
1. Tap "Send" in bottom navigation
2. Select asset
3. On SendInputScreen, tap QR scanner icon
4. QRScanner opens
5. Point camera at QR code
6. Verify address populates

**Expected Results:**
- Camera permission requested if needed
- QR scanner opens
- Valid address QR populates field
- Invalid QR shows error toast
- Can cancel and return

---

### 3.5 Send - Paste Address

**Preconditions:** Valid address copied to clipboard

**Steps:**
1. Copy a valid address to clipboard
2. Navigate to Send -> Asset -> SendInputScreen
3. Tap "Paste" button
4. Verify address populates

**Expected Results:**
- Paste button reads clipboard
- Valid address populates and validates
- Invalid address shows error

---

### 3.6 Send - MAX Amount

**Preconditions:** Wallet with balance

**Steps:**
1. Navigate to Send -> Asset -> SendInputScreen
2. Tap "MAX" button
3. Observe amount field

**Expected Results:**
- MAX calculates total balance minus fees
- Amount field populates with max
- Fee is accounted for

---

### 3.7 Send - Insufficient Balance Error

**Preconditions:** Wallet with low/zero balance

**Steps:**
1. Navigate to Send -> Asset -> SendInputScreen
2. Enter amount greater than balance
3. Tap "Review"

**Expected Results:**
- Error message displays
- Cannot proceed past send input screen
- For Turbo: InsufficientTurboSheet appears

---

### 3.8 Send - Invalid Address Error

**Preconditions:** Wallet with balance

**Steps:**
1. Navigate to Send -> Asset -> SendInputScreen
2. Enter invalid address (wrong format, wrong network)
3. Tap "Review"

**Expected Results:**
- Validation error appears
- Cannot proceed to review screen
- Clear error message explains issue

---

## 4. Receive Flows

### 4.1 Receive BTC - Display QR

**Preconditions:** Unlocked wallet

**Steps:**
1. Tap "Receive" in bottom navigation
2. On ReceiveScreen, ensure BTC is selected
3. Observe QR code display
4. Observe address below QR

**Expected Results:**
- QR code renders correctly
- Address is valid Bitcoin address
- Address matches QR content

---

### 4.2 Receive UNIT - Display QR

**Preconditions:** Unlocked wallet

**Steps:**
1. Tap "Receive" in bottom navigation
2. On ReceiveScreen, select UNIT
3. Observe QR code and address

**Expected Results:**
- QR code updates for UNIT
- Address is valid UNIT address

---

### 4.3 Receive - Copy Address

**Preconditions:** On ReceiveScreen

**Steps:**
1. On ReceiveScreen, tap address or copy icon
2. Observe toast confirmation
3. Paste elsewhere to verify

**Expected Results:**
- Address copies to clipboard
- Toast confirms "Address copied"
- Pasted address matches displayed

---

### 4.4 Receive - Full Screen QR Modal

**Preconditions:** On ReceiveScreen

**Steps:**
1. Tap on QR code or "Enlarge" button
2. ReceiveQRScreen opens (full screen)
3. Observe larger QR
4. Tap to close or swipe down

**Expected Results:**
- Full screen QR modal opens
- QR is larger and scannable
- Can close modal easily

---

### 4.5 Receive - Share QR

**Preconditions:** On ReceiveScreen

**Steps:**
1. Tap "Share" button
2. System share sheet opens
3. Select share destination

**Expected Results:**
- Share sheet appears
- Can share QR image or address text
- Share completes successfully

---

## 5. Cashu/Ecash Flows

### 5.1 Cashu Send - Generate Token

**Preconditions:** Wallet with ecash balance

**Steps:**
1. Navigate to CashuSendScreen
2. Enter amount to send
3. Tap "Generate Token"
4. Observe QR code with token

**Expected Results:**
- Token is generated
- QR code displays token
- Can copy token string
- Balance decreases by amount

---

### 5.2 Cashu Receive - Scan Token

**Preconditions:** Have a cashu token QR to scan

**Steps:**
1. Navigate to CashuReceiveScreen
2. Tap "Scan" to open scanner
3. Scan cashu token QR
4. Confirm redemption

**Expected Results:**
- Scanner opens
- Token is parsed from QR
- TokenDetailsSheet shows token info
- Redemption adds to balance

---

### 5.3 Cashu Receive - Paste Token

**Preconditions:** Have cashu token string copied

**Steps:**
1. Navigate to CashuReceiveScreen
2. Tap "Paste" button
3. Token populates
4. Confirm redemption

**Expected Results:**
- Token string is pasted
- Token is validated
- Redemption processes
- Balance increases

---

### 5.4 Mint (UNIT → Ecash)

**Preconditions:** Wallet with UNIT balance

**Steps:**
1. Initiate mint flow (from settings or prompt)
2. Enter amount to convert
3. Confirm mint operation
4. Wait for processing

**Expected Results:**
- UNIT balance decreases
- Ecash balance increases
- Transaction recorded

---

### 5.5 Melt (Ecash → UNIT)

**Preconditions:** Wallet with ecash balance

**Steps:**
1. Initiate melt flow
2. Select amount/tokens to melt
3. Confirm melt operation
4. Wait for processing

**Expected Results:**
- Ecash balance decreases
- UNIT balance increases
- On-chain transaction created

---

### 5.6 Low Ecash Balance - Auto Top-up Prompt

**Preconditions:** Ecash balance below threshold, UNIT balance available

**Steps:**
1. Perform action that triggers balance check
2. LowEcashBalanceModal appears
3. Tap "Top Up" or "Later"

**Expected Results:**
- Modal appears when below threshold
- "Top Up" initiates mint flow
- "Later" dismisses modal
- Can configure threshold in settings

---

### 5.7 Token Details Inspection

**Preconditions:** Have ecash tokens

**Steps:**
1. Navigate to token list
2. Tap on a token
3. TokenDetailsSheet opens
4. View token details

**Expected Results:**
- Sheet shows token amount
- Shows mint URL
- Shows token age/expiry if applicable
- Can close sheet

---

## 6. Vault Flows

### 6.1 Enter Vault via Tap

**Preconditions:** Unlocked wallet, vault available

**Steps:**
1. On WalletScreen, tap VaultCard
2. VaultScreen loads with WebView

**Expected Results:**
- Navigates to VaultScreen
- WebView loads vault interface
- Credentials injected automatically

---

### 6.2 Enter Vault via Swipe

**Preconditions:** Unlocked wallet

**Steps:**
1. On WalletScreen, swipe right
2. VaultScreen appears

**Expected Results:**
- Swipe gesture recognized
- Smooth transition to vault
- Can swipe back to wallet

---

### 6.3 Exit Vault via Swipe

**Preconditions:** In VaultScreen

**Steps:**
1. Swipe left from VaultScreen
2. Return to WalletScreen

**Expected Results:**
- Swipe gesture recognized
- Returns to wallet
- Wallet state preserved

---

### 6.4 Vault WebView Operations

**Preconditions:** In VaultScreen

**Steps:**
1. Interact with vault WebView
2. Perform vault-specific operations
3. Verify operations complete

**Expected Results:**
- WebView is interactive
- Operations process correctly
- Data syncs with wallet

---

## 7. Settings Flows

### 7.1 Navigate to Settings

**Preconditions:** Unlocked wallet

**Steps:**
1. Tap settings icon in header or bottom nav
2. SettingsScreen opens

**Expected Results:**
- Settings menu displays
- All options visible
- Can navigate to sub-screens

---

### 7.2 Preferences - Toggle Options

**Preconditions:** In Settings

**Steps:**
1. Tap "Preferences"
2. On PreferencesScreen:
   - Toggle "Hide Zero Balances"
   - Toggle "Notifications"
3. Return to wallet

**Expected Results:**
- Toggles persist
- Hide zero balances affects asset display
- Notification permissions requested if needed

---

### 7.3 Security - View Seed Phrase

**Preconditions:** In Settings, seed phrase wallet

**Steps:**
1. Tap "Security"
2. On SecurityScreen, tap "View Seed Phrase"
3. Complete authentication (PIN/biometric)
4. SeedPhraseOverlay displays
5. View 12/24 words

**Expected Results:**
- Authentication required
- Seed phrase displays correctly
- Can copy or write down
- Warning about security shown

---

### 7.4 Security - Change PIN

**Preconditions:** In Settings

**Steps:**
1. Tap "Security"
2. Tap "Change PIN"
3. Enter current PIN
4. Enter new PIN
5. Confirm new PIN

**Expected Results:**
- Current PIN verified
- New PIN set
- Next unlock uses new PIN

---

### 7.5 Security - Toggle Biometrics

**Preconditions:** In Settings, device has biometrics

**Steps:**
1. Tap "Security"
2. Toggle "Biometric Authentication"
3. If enabling, complete biometric prompt
4. Verify toggle state

**Expected Results:**
- Toggle changes state
- Biometric prompt if enabling
- Lock screen behavior changes accordingly

---

### 7.6 Security - Delete Local Wallet

**Preconditions:** In Settings

**Steps:**
1. Tap "Security"
2. Tap "Delete Local Wallet"
3. Read warning
4. Confirm deletion
5. Enter PIN to confirm

**Expected Results:**
- Warning explains local data loss and preserved backup behavior
- PIN required to confirm
- Local wallet data deleted
- Returns to WelcomeScreen

---

### 7.7 Advanced - Advanced Mode Toggle

**Preconditions:** In Settings

**Steps:**
1. Tap "Advanced"
2. On AdvancedScreen, toggle "Advanced Mode"
3. Return to wallet

**Expected Results:**
- Toggle persists
- Advanced features appear/hide
- UI adjusts accordingly

---

### 7.8 Advanced - Ecash Threshold

**Preconditions:** In Settings

**Steps:**
1. Tap "Advanced"
2. Tap "Ecash Threshold"
3. EcashThresholdSheet opens
4. Adjust threshold value
5. Save

**Expected Results:**
- Sheet shows current threshold
- Can adjust value
- New threshold persists
- Affects auto-top-up behavior

---

### 7.9 Advanced - Clear Cache

**Preconditions:** In Settings

**Steps:**
1. Tap "Advanced"
2. Tap "Clear Cache"
3. Confirm action

**Expected Results:**
- Cache is cleared
- App may reload data
- Settings preserved

---

### 7.10 About Screen

**Preconditions:** In Settings

**Steps:**
1. Tap "About"
2. View AboutScreen

**Expected Results:**
- Version number displayed
- Build number displayed
- Legal links work
- Support links work

---

### 7.11 Cashu Settings

**Preconditions:** In Settings

**Steps:**
1. Tap "Cashu Settings"
2. On CashuSettingsScreen:
   - View mint URL
   - Manage tokens if available

**Expected Results:**
- Current mint displayed
- Can view token info
- Settings persist

---

### 7.12 Turbo History

**Preconditions:** In Settings, have turbo transactions

**Steps:**
1. Tap "Turbo History"
2. On TurboHistoryScreen:
   - View list of turbo transactions
   - Tap on item for details

**Expected Results:**
- History loads
- Transactions display correctly
- Details accessible

---

### 7.13 Turbo QR Code

**Preconditions:** In Settings

**Steps:**
1. Navigate to TurboQRCodeScreen
2. View turbo QR code

**Expected Results:**
- QR code displays
- Can share or copy

---

## 8. Asset Detail Flows

### 8.1 BTC Detail - View Price Chart

**Preconditions:** Unlocked wallet

**Steps:**
1. Tap BTC AssetCard
2. AssetDetailScreen opens
3. View AssetPriceChart

**Expected Results:**
- Chart loads with price data
- Current price displayed
- Price change percentage shown

---

### 8.2 BTC Detail - Change Time Range

**Preconditions:** On BTC AssetDetailScreen

**Steps:**
1. Tap time range selector (1D, 1W, 1M, 1Y, ALL)
2. Chart updates

**Expected Results:**
- Each range loads corresponding data
- Chart animates to new data
- Price change recalculates

---

### 8.3 BTC Detail - View About Tab

**Preconditions:** On BTC AssetDetailScreen

**Steps:**
1. Tap "About" tab
2. View AssetAbout content

**Expected Results:**
- About section displays
- Asset description shown
- Links work if present

---

### 8.4 BTC Detail - View Activity Tab

**Preconditions:** On BTC AssetDetailScreen

**Steps:**
1. Tap "Activity" tab
2. View AssetActivityList

**Expected Results:**
- Transaction list loads
- Only BTC transactions shown
- Can scroll through history

---

### 8.5 UNIT Detail - View Balance Breakdown

**Preconditions:** Unlocked wallet with UNIT

**Steps:**
1. Tap UNIT AssetCard
2. AssetDetailScreen opens
3. View AssetInfo section

**Expected Results:**
- Total UNIT balance shown
- Breakdown: on-chain vs ecash
- Accurate calculations

---

### 8.6 UNIT Detail - View Turbo List

**Preconditions:** On UNIT AssetDetailScreen, have turbo transactions

**Steps:**
1. View AssetTurboList section
2. Scroll through turbo items

**Expected Results:**
- Turbo transactions listed
- Status indicators shown
- Can view details

---

## 9. Transaction History Flows

### 9.1 View All Transactions

**Preconditions:** Unlocked wallet with transaction history

**Steps:**
1. Navigate to TransactionHistoryScreen
2. Scroll through list

**Expected Results:**
- All transactions display
- Sorted by date (newest first)
- Different types distinguished

---

### 9.2 View BTC Transactions Only

**Preconditions:** On AssetDetailScreen for BTC

**Steps:**
1. Go to BTC Asset Detail
2. View Activity tab

**Expected Results:**
- Only BTC transactions shown
- Filters work correctly

---

### 9.3 View UNIT Transactions Only

**Preconditions:** On AssetDetailScreen for UNIT

**Steps:**
1. Go to UNIT Asset Detail
2. View Activity/Turbo sections

**Expected Results:**
- Only UNIT transactions shown
- Includes both on-chain and turbo

---

### 9.4 Transaction Item Types

**Preconditions:** Have various transaction types

**Steps:**
1. View transaction history
2. Identify RegularTransactionItem (BTC)
3. Identify VaultTransactionItem (vault)
4. Identify EcashTransactionItem (ecash)

**Expected Results:**
- Each type renders correctly
- Appropriate icons/colors
- Correct amounts shown

---

## 10. Error & Edge Case Flows

### 10.1 Network Error - Banner Display

**Preconditions:** Disable network connection

**Steps:**
1. Disable WiFi/cellular
2. Open app or perform action
3. Observe ErrorBanner

**Expected Results:**
- Error banner appears
- Clear error message
- Retry option available
- Banner dismisses when resolved

---

### 10.2 Invalid QR Scan - Error Toast

**Preconditions:** Have non-address QR code

**Steps:**
1. Open QR scanner
2. Scan invalid QR (not an address)

**Expected Results:**
- Toast appears with error
- Scanner remains open
- Can try again

---

### 10.3 Transaction Failure - Error Modal

**Preconditions:** Attempt transaction that will fail

**Steps:**
1. Start send flow
2. Proceed to processing
3. Transaction fails (network, insufficient fee, etc.)

**Expected Results:**
- Error modal appears
- Clear error explanation
- Can retry or cancel
- Balance unchanged

---

### 10.4 JS Error - ErrorBoundary

**Preconditions:** Trigger a JavaScript error (dev only)

**Steps:**
1. Trigger error condition
2. ErrorBoundary catches error

**Expected Results:**
- App doesn't crash
- Error screen displays
- Can recover/restart
- Error logged

---

### 10.5 Unconfirmed UTXO Warning

**Preconditions:** Have unconfirmed incoming transaction

**Steps:**
1. Attempt to spend unconfirmed funds
2. Proceed to ReviewScreen

**Expected Results:**
- UnconfirmedWarning component displays
- Warning explains situation
- Can proceed with caution or wait

---

### 10.6 Mint Recovery Flow

**Preconditions:** Have failed mint operation

**Steps:**
1. Navigate to RecoverMintScreen
2. View pending mint operations
3. Attempt recovery

**Expected Results:**
- Pending operations listed
- Recovery option available
- Successful recovery restores funds

---

## 11. Background & Lifecycle Flows

### 11.1 App Background → Foreground

**Preconditions:** Unlocked wallet

**Steps:**
1. Open wallet, note state
2. Press home (background app)
3. Wait a few seconds
4. Return to app

**Expected Results:**
- If within timeout: wallet unlocked
- State preserved
- Data refreshes in background

---

### 11.2 Inactivity Timeout → Auto-lock

**Preconditions:** Unlocked wallet, inactivity timeout set

**Steps:**
1. Open wallet
2. Do nothing for timeout duration
3. Observe lock screen

**Expected Results:**
- App locks after timeout
- LockScreen appears
- Must authenticate to continue

---

### 11.3 Deep Link - Navigation

**Preconditions:** Have deep link URL

**Steps:**
1. Click deep link (bitcoin:address, cashu:token)
2. App opens/focuses
3. Navigates to appropriate screen

**Expected Results:**
- App handles URL scheme
- Correct screen opens
- Data pre-populated

---

### 11.4 Background Task - State Save

**Preconditions:** Performing operation

**Steps:**
1. Start long operation
2. Background app
3. Return to app

**Expected Results:**
- Operation continues or resumes
- State saved on background
- No data loss

---

## Quick Reference Checklist

### Critical Path Tests (Must Pass)
- [ ] New wallet creation
- [ ] Wallet import from seed
- [ ] PIN lock/unlock
- [ ] Send BTC complete flow
- [ ] Send UNIT complete flow
- [ ] Receive address generation
- [ ] View balances correctly

### High Priority Tests
- [ ] Biometric authentication
- [ ] Turbo send flow
- [ ] Cashu send/receive
- [ ] All settings persist
- [ ] Transaction history loads
- [ ] Asset details display

### Medium Priority Tests
- [ ] Account switching
- [ ] Vault access
- [ ] QR scanning
- [ ] Error handling
- [ ] Network recovery

### Edge Cases
- [ ] Insufficient balance
- [ ] Invalid addresses
- [ ] PIN lockout
- [ ] Unconfirmed UTXOs
- [ ] Mint recovery

---

## Test Environment Setup

### Testnet/Mutinynet
1. Go to Settings → Advanced
2. Enable "Mutinynet" toggle
3. Restart app
4. Use testnet faucet for funds

### Test Data
- Valid BTC testnet address: `tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx`
- Invalid address: `invalid123`
- Sample cashu token: (generate from mint)

### Simulators/Devices
- Test on iOS Simulator
- Test on physical device (for biometrics)
- Test on different screen sizes

---

*Last updated: November 2024*
*Total flows: 80+*
*Estimated full test time: 4-6 hours*
