# Manual Testing Checklist - Phase 1 Validation

After completing Phase 1 (security improvements + code quality), we need to thoroughly test all functionality.

## 🔴 Critical Security Tests

### PIN Authentication (PBKDF2 Upgrade)
- [ ] **Fresh Install - Create New PIN**
  - Install app fresh
  - Create new wallet with PIN "1234"
  - Verify wallet is created successfully
  - Lock app (background it)
  - Reopen app
  - Enter correct PIN "1234" → Should unlock
  - Enter incorrect PIN "5678" → Should fail
  - Try 5 wrong PINs → Should trigger lockout

- [ ] **PIN Change**
  - Go to Settings
  - Change PIN from "1234" to "5678"
  - Lock app
  - Try old PIN "1234" → Should fail
  - Try new PIN "5678" → Should succeed

- [ ] **Biometric Authentication**
  - Enable Face ID in Settings
  - Lock app
  - Authenticate with Face ID → Should unlock
  - Disable Face ID in Settings
  - Lock app
  - Should prompt for PIN instead

### Wallet Generation & Seed Phrase
- [ ] **New Wallet Creation**
  - Create new wallet
  - View seed phrase in Settings
  - Write down all 12 words
  - Delete wallet
  - Restore from seed phrase
  - Verify same addresses are generated

- [ ] **Wallet Import**
  - Delete current wallet
  - Import wallet with valid seed phrase
  - Verify addresses match expected
  - Verify balances load correctly

## 🟡 Core Functionality Tests

### Account Switching
- [ ] Switch to Account 2
- [ ] Verify different addresses shown
- [ ] Send transaction from Account 2
- [ ] Switch back to Account 1
- [ ] Verify Account 1 balances/addresses restored

### Bitcoin Transactions
- [ ] **Send BTC**
  - Click "Send"
  - Select Bitcoin
  - Enter valid Bitcoin address
  - Enter amount (try small amount like 0.0001)
  - Click MAX button → Verify correct amount
  - Review transaction
  - Confirm and broadcast
  - Verify transaction appears in history

- [ ] **Receive BTC**
  - Click "Receive"
  - Verify QR code displays
  - Copy address
  - Verify address format (segwit bc1q...)
  - Share address

### UNIT Rune Transactions
- [ ] **Send UNIT**
  - Click "Send"
  - Select UNIT•RUNE
  - Enter valid address
  - Enter amount
  - Click MAX → Verify full balance shown
  - Review transaction
  - Confirm and broadcast
  - Verify in history

- [ ] **Receive UNIT**
  - Click "Receive"
  - Switch to Taproot address
  - Verify QR code and address

### Vault Operations
- [ ] **Create Vault**
  - Click "Create Vault" button
  - Wait for vault initialization
  - Verify vault appears with 0% health

- [ ] **Vault Interactions** (if vault exists)
  - Deposit collateral
  - Borrow UNIT
  - Repay debt
  - Withdraw collateral
  - Verify vault health updates

### Transaction History
- [ ] Click transaction history icon
- [ ] Verify all transactions listed
- [ ] Check sent transactions show negative amounts (red)
- [ ] Check received transactions show positive amounts (green)
- [ ] Click on transaction → Opens in block explorer
- [ ] Verify vault transactions show correctly

## 🟢 UI/UX Tests

### Navigation & Screens
- [ ] Switch between Wallet and Vault tabs
- [ ] All icons render correctly
- [ ] No visual glitches or misalignments
- [ ] Amounts display with correct decimals (8 for BTC, 2 for UNIT)
- [ ] USD values calculate correctly

### Settings Screen
- [ ] Open Settings
- [ ] View seed phrase works
- [ ] Account switcher works
- [ ] PIN change works
- [ ] Face ID toggle works
- [ ] Logout works
- [ ] Delete wallet works (with confirmation)

### Error Handling
- [ ] Try to send without balance → Should show error
- [ ] Try invalid Bitcoin address → Should show error
- [ ] Try to send more than balance → Should show error
- [ ] Lose internet connection → App should handle gracefully

## 🔵 Performance Tests

### App Startup
- [ ] Cold start time (< 3 seconds)
- [ ] No crashes on startup
- [ ] Balances load within 5 seconds

### Background/Foreground
- [ ] Background app for 1 minute → Reopens smoothly
- [ ] Background app for 1 hour → Requires PIN/Face ID
- [ ] Balances refresh when returning to foreground

### Memory & Stability
- [ ] Use app for 10 minutes → No slowdowns
- [ ] Switch accounts multiple times → No crashes
- [ ] Send multiple transactions → No crashes

## 🟣 Integration Tests

### Balance Updates
- [ ] Send transaction
- [ ] Wait for confirmation
- [ ] Verify balance decreases
- [ ] Receive transaction
- [ ] Verify balance increases

### Price Updates
- [ ] Toggle between BTC and USD view
- [ ] Verify calculations are correct
- [ ] USD values update when BTC price changes

## 📝 Code Quality Validation

### ESLint
- [x] `npm run lint` shows 0 errors, 0 warnings ✅

### Console Errors
- [ ] Run app in development
- [ ] Check for console errors (should be none)
- [ ] Check for console warnings (minimal)

### Sentry Integration
- [ ] Trigger an error intentionally
- [ ] Check Sentry dashboard for error report

## 🚨 Regression Tests (Things that might have broken)

### After Inline Styles Extraction
- [x] Asset amounts align correctly (left-aligned) ✅
- [ ] All cards render properly
- [ ] Modal layouts correct
- [ ] Bottom sheets animate smoothly

### After Context Refactoring
- [ ] Send flow works end-to-end
- [ ] Navigation between screens works
- [ ] State persists correctly
- [ ] No React context errors

### After Constants Extraction
- [ ] API calls use correct URLs
- [ ] Timeouts work as expected
- [ ] Network configuration correct

---

## Test Results Log

**Date**: _____________
**Tester**: _____________
**App Version**: 1.0.0
**Device**: _____________
**OS Version**: _____________

### Critical Issues Found:
1.
2.
3.

### Minor Issues Found:
1.
2.
3.

### Notes:
