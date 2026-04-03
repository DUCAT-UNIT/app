# E2E Test Coverage Report

## Current State: 22 Tests, ~25-30% Feature Coverage

The existing suite covers screen-level navigation across most areas but rarely tests
actual interactions (inputs, sliders, toggles, confirmations). Almost every test follows
the same pattern: import wallet -> navigate to screen -> assertVisible on a testID -> done.

---

## What's Covered vs What Exists

| Area | Tests | Screens Reached | Interactions Tested | Real Coverage |
|------|-------|-----------------|---------------------|---------------|
| Auth/Onboarding | 5 | Welcome, Create, Import, PIN, Lock | PIN entry, seed typing, wrong PIN error | ~70% |
| Wallet Home | 4 | Balance, Receive BTC, Receive UNIT, History | Tap deposit/history buttons | ~30% |
| Send | 2 | Send input screen | Invalid address entry | ~10% |
| Vault Ops | 4 | Deposit/Borrow/Repay/Withdraw input screens | None - just assertVisible | ~10% |
| Settings | 7 | Settings, Security, Preferences, Advanced, Cashu, Delete modal | PIN change, toggle preferences, enable dev mode | ~45% |
| Asset Detail | 0 | Never opened | None | 0% |
| Ecash/Turbo | 0 | Never opened | None | 0% |
| Error Handling | 1 | Send invalid address | One error message check | ~5% |
| Modals/Sheets | 1 | Delete wallet modal (cancel) | Cancel button | ~5% |

---

## Instrumented testIDs NOT Used by Any Test

These testIDs exist in the codebase but no E2E test exercises them:

### Send Flow (high value, fully instrumented)
- `send-address-input` - Address text input field
- `address-paste-btn` - Paste address button
- `address-scan-btn` - QR scan button
- `address-continue-btn` - Continue after address entry
- `amount-input-screen` - Amount entry screen
- `amount-input` - Amount text input
- `amount-usd-value` - USD conversion display
- `amount-max-btn` - MAX amount button
- `amount-review-btn` - Proceed to review button
- `review-screen` - Review/confirm screen
- `review-confirm-btn` - Confirm send button
- `review-cancel-btn` - Cancel send button
- `review-back-btn` - Back from review
- `processing-screen` - Transaction processing screen
- `processing-spinner` - Loading indicator
- `confirmation-screen` - Success screen
- `confirmation-done-btn` - Done button after send

### Vault Flow (high value, fully instrumented)
- `vault-deposit-continue-btn` - Continue from deposit input
- `vault-deposit-confirm-screen` - Deposit confirm screen
- `vault-deposit-confirm-btn` - Confirm deposit button
- `vault-deposit-processing-screen` - Deposit processing
- `vault-deposit-success-screen` - Deposit success
- `vault-borrow-continue-btn` - Continue from borrow input
- `vault-borrow-confirm-screen` - Borrow confirm screen
- `vault-borrow-confirm-btn` - Confirm borrow button
- `vault-repay-continue-btn` - Continue from repay input
- `vault-repay-confirm-screen` - Repay confirm screen
- `vault-repay-confirm-btn` - Confirm repay button
- `vault-withdraw-continue-btn` - Continue from withdraw input
- `vault-withdraw-confirm-screen` - Withdraw confirm screen
- `vault-withdraw-confirm-btn` - Confirm withdraw button
- `vault-success-done-btn` - Done after vault operation
- `btc-slider-quarter-btn` - 25% amount preset
- `btc-slider-half-btn` - 50% amount preset
- `btc-slider-max-btn` - MAX amount preset
- `unit-slider-quarter-btn` - 25% UNIT preset
- `unit-slider-half-btn` - 50% UNIT preset
- `unit-slider-max-btn` - MAX UNIT preset
- `create-vault-btn` - Create vault from vault card

### Auth
- `lock-faceid-btn` - Face ID unlock button
- `lock-passkey-btn` - Passkey unlock button
- `seed-verify-btn` - Seed verification confirm
- `seed-choice-*` - Seed word selection buttons

### Turbo Send
- `turbo-processing-screen` - Turbo processing
- `turbo-claiming-screen` - Turbo claiming
- `turbo-loading-screen` - Turbo loading

### Settings
- `preferences-notifications-btn` - Notifications toggle
- `settings-clear-cache-btn` - Clear cache button
- `security-backup-btn` - View seed backup

---

## Gap Analysis: What to Build

### Phase 1: Complete the Core Flows (highest ROI)

These flows are already instrumented with testIDs. The only work is writing the YAML.

#### P1-1: Send BTC End-to-End
**Why**: The most common user action has zero completion coverage.
**Flow**: Funded wallet -> withdraw -> BTC -> enter address -> enter amount -> review -> confirm
**testIDs available**: `send-address-input`, `amount-input`, `amount-review-btn`, `review-screen`, `review-confirm-btn`
**Approach**: Use a testnet address. Type address, type small amount, tap review, verify review screen shows correct values, tap confirm. Don't need to actually broadcast - getting to the review screen with correct data is the critical path.
**New test**: `send/03-send-btc-review.yaml`

#### P1-2: Send with MAX Amount
**Why**: MAX button is commonly used and involves balance calculation logic.
**Flow**: Send BTC screen -> tap MAX -> verify amount populates -> proceed to review
**testIDs available**: `amount-max-btn`, `amount-input`, `amount-review-btn`
**New test**: `send/04-send-max-amount.yaml`

#### P1-3: Vault Deposit with Amount Selection
**Why**: Every vault test stops at the empty input screen. None test the slider/amount selection.
**Flow**: Wallet -> deposit -> vault -> tap 25% button -> tap continue -> verify confirm screen
**testIDs available**: `btc-slider-quarter-btn`, `vault-deposit-continue-btn`, `vault-deposit-confirm-screen`, `vault-deposit-confirm-btn`
**Approach**: Tap the 25% preset button (avoids slider drag complexity), then continue to confirm screen. Verify confirm screen shows the amount and has confirm button.
**New test**: `vault/05-deposit-with-amount.yaml`

#### P1-4: Vault Borrow with Amount Selection
**Why**: Same gap as deposit - tests stop at input screen.
**Flow**: Wallet -> borrow -> tap 25% -> continue -> verify confirm screen
**testIDs available**: `unit-slider-quarter-btn`, `vault-borrow-continue-btn`, `vault-borrow-confirm-screen`
**New test**: `vault/06-borrow-with-amount.yaml`

#### P1-5: Send Address Paste
**Why**: Paste is the most common way users enter addresses. Tests clipboard + validation.
**Flow**: Send BTC screen -> tap paste button -> verify address populates
**testIDs available**: `address-paste-btn`, `send-address-input`
**Approach**: Set clipboard with a testnet address via shell script before test, then tap paste.
**New test**: `send/05-send-paste-address.yaml`

---

### Phase 2: Settings & Security Depth

#### P2-1: View Seed Phrase Backup
**Why**: If this breaks, users lose access to funds permanently.
**Flow**: Settings -> security -> backup -> PIN entry -> verify seed words display
**testIDs available**: `security-backup-btn`, `seed-display-screen`, `seed-word-0` through `seed-word-11`
**New test**: `settings/08-view-seed-backup.yaml`

#### P2-2: Toggle Biometric Auth
**Why**: Biometric toggle affects lock screen behavior.
**Flow**: Settings -> security -> tap biometric toggle -> verify state changes
**testIDs available**: `security-biometric-btn`
**Note**: May need simulator biometric enrollment. Test the toggle UI, not actual Face ID.
**New test**: `settings/09-toggle-biometric.yaml`

#### P2-3: Delete Local Wallet - Full Flow
**Why**: Current test only tests cancel. Need to verify the destructive path works.
**Flow**: Settings -> security -> delete -> confirm -> verify returns to welcome screen
**testIDs available**: `security-delete-btn`, `welcome-screen`
**New test**: `settings/10-delete-wallet-confirm.yaml`

#### P2-4: Toggle Notifications
**Why**: Untested preferences toggle.
**Flow**: Settings -> preferences -> toggle notifications -> verify still on preferences
**testIDs available**: `preferences-notifications-btn`, `preferences-screen`
**New test**: Can add to existing `settings/04-toggle-preferences.yaml` or create separate.

---

### Phase 3: Asset Detail & Transaction Depth

These screens have NO testIDs. Requires adding testIDs first.

#### P3-1: BTC Asset Detail Screen
**Why**: Most-visited screen after wallet home, zero coverage.
**What to instrument**:
- `asset-detail-screen` on container
- `asset-tabs-activity` / `asset-tabs-about` on tab buttons
- `asset-price-chart` on chart container
- `asset-send-btn` / `asset-receive-btn` on action buttons
**Flow**: Wallet -> tap BTC card -> verify detail screen -> tap activity tab -> tap about tab
**New test**: `wallet/05-btc-asset-detail.yaml`

#### P3-2: Transaction Detail Sheet
**Why**: Users tap transactions to see details - verifies data rendering.
**What to instrument**:
- `transaction-item` on list items (for tap target)
- `transaction-detail-sheet` on the sheet
- `transaction-detail-txid` on the transaction ID display
**Flow**: Funded wallet -> history -> tap first transaction -> verify detail sheet opens
**New test**: `wallet/06-transaction-detail.yaml`

#### P3-3: Receive Address Copy
**Why**: Broken copy = users share wrong address = lost funds.
**What to instrument**:
- `receive-copy-btn` on copy button
- `receive-address-text` on address display
- `receive-qr-code` on QR image
**Flow**: Receive BTC screen -> tap copy -> verify clipboard matches displayed address
**New test**: `wallet/07-receive-copy-address.yaml`

#### P3-4: Receive Address Type Toggle
**Why**: Segwit vs Taproot is a real user choice.
**What to instrument**:
- `receive-segwit-tab` / `receive-taproot-tab` on toggle buttons
**Flow**: Receive screen -> verify segwit default -> tap taproot -> verify address changes
**New test**: `wallet/08-receive-address-toggle.yaml`

---

### Phase 4: Error States & Edge Cases

#### P4-1: Send Insufficient Balance
**Why**: Common real-world scenario, needs graceful handling.
**What to instrument**: `send-error-message` or `send-insufficient-balance` on error text
**Flow**: Send BTC -> enter amount larger than balance -> verify error appears
**New test**: `send/06-send-insufficient-balance.yaml`

#### P4-2: Vault Health Warning
**Why**: Users need to see when vault health is dangerous.
**What to instrument**: Health-related warnings on vault input screens
**Flow**: Vault borrow -> select high amount -> verify health warning appears
**New test**: `vault/07-vault-health-warning.yaml`

#### P4-3: App Background -> Auto-Lock
**Why**: Security feature - app should lock after backgrounding.
**Flow**: Import wallet -> background app -> wait -> foreground -> verify lock screen
**New test**: `auth/06-auto-lock.yaml`

---

### Phase 5: Ecash/Turbo (stretch goal)

#### P5-1: Turbo Send Toggle
**What to instrument**: `turbo-toggle` on the toggle component in send flow
**Flow**: Send UNIT -> verify turbo toggle exists -> enable -> verify turbo indicator

#### P5-2: Ecash Token Receive
**What to instrument**: Token paste input, validate button
**Flow**: Cashu receive screen -> paste token -> verify validation

#### P5-3: Low Ecash Balance Modal Interaction
**Already instrumented**: `low-ecash-modal`, `low-ecash-dismiss-btn`
**Flow**: Trigger low ecash state -> verify modal appears -> test both dismiss and accept

---

## Implementation Approach

### Step 1: Write Phase 1 tests (no code changes needed)
All testIDs exist. Just write YAML flows. Estimated: 5 new tests.
After this: ~40% coverage.

### Step 2: Write Phase 2 tests (no code changes needed)
All testIDs exist for settings flows. Estimated: 3-4 new tests.
After this: ~50% coverage.

### Step 3: Add testIDs for Phase 3 screens, then write tests
Requires modifying: AssetDetailScreen, AssetHeader, AssetTabs, AssetActivityList,
TransactionHistoryScreen, ReceiveScreen/ReceiveQRScreen.
Estimated: ~15 testIDs to add, 4 new tests.
After this: ~65% coverage.

### Step 4: Add testIDs for Phase 4 error states, then write tests
Requires modifying: SendInputScreen (error displays), VaultInputScreen (health warnings).
Estimated: ~5 testIDs to add, 3 new tests.
After this: ~75% coverage.

### Step 5: Instrument and test Ecash/Turbo (Phase 5)
Requires modifying: TurboToggle, CashuReceiveScreen, and related components.
Estimated: ~8 testIDs to add, 3 new tests.
After this: ~80-85% coverage.

---

## Priority Order for Maximum Impact

| # | Test | Effort | Impact | Needs testID Changes |
|---|------|--------|--------|---------------------|
| 1 | Send BTC to review screen | Low | Critical | No |
| 2 | Vault deposit with amount | Low | Critical | No |
| 3 | View seed backup from settings | Low | Critical | No |
| 4 | Send paste address | Low | High | No |
| 5 | Send MAX amount | Low | High | No |
| 6 | Vault borrow with amount | Low | High | No |
| 7 | Delete wallet full flow | Low | High | No |
| 8 | BTC asset detail screen | Medium | High | Yes - add ~5 testIDs |
| 9 | Transaction detail sheet | Medium | Medium | Yes - add ~3 testIDs |
| 10 | Receive copy address | Medium | Critical | Yes - add ~3 testIDs |
| 11 | Receive address toggle | Medium | Medium | Yes - add ~2 testIDs |
| 12 | Send insufficient balance | Medium | High | Yes - add ~1 testID |
| 13 | Auto-lock on background | Low | High | No |
| 14 | Vault health warning | Medium | Medium | Yes - add ~1 testID |
| 15 | Toggle biometric | Low | Medium | No |

---

## Target: 37 Tests at ~75% Coverage

Current: 22 tests, ~25-30% coverage
After Phase 1-2 (no code changes): 30 tests, ~50% coverage
After Phase 3-4 (testID additions): 37 tests, ~75% coverage
After Phase 5 (ecash/turbo): 40 tests, ~85% coverage

The remaining ~15% is deep interaction testing (slider drag precision, chart scrubbing,
pull-to-refresh timing, deep link handling) that has diminishing returns for Maestro-based
E2E tests and is better covered by integration/unit tests.
