# Send Transaction Flow - Complete User Journey

This document covers the complete send transaction flow from tapping "Send" on the wallet screen through to successful transaction confirmation. It includes all success paths, error scenarios, validation rules, and user exit points.

---

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Step 1: Asset Selection](#step-1-asset-selection)
3. [Step 2: Address Input](#step-2-address-input)
4. [Step 3: Amount Input](#step-3-amount-input)
5. [Step 4: Processing (Create Intent)](#step-4-processing-create-intent)
6. [Step 5: Review Screen](#step-5-review-screen)
7. [Step 6: Processing (Sign & Broadcast)](#step-6-processing-sign--broadcast)
8. [Step 7: Confirmation Screen](#step-7-confirmation-screen)
9. [Back Navigation & Cancellation](#back-navigation--cancellation)
10. [Error Scenarios & Recovery](#error-scenarios--recovery)
11. [Testing Checklist](#testing-checklist)

---

## Flow Overview

The send transaction flow is a **6-screen modal stack** that overlays the main wallet screen:

```
Wallet Home [Tap "Send"]
    ↓
AssetSelector → AddressInput → AmountInput → Processing → Review → Processing → Confirmation
    ↓               ↓               ↓            ↓           ↓           ↓            ↓
[Select BTC]   [Enter addr]   [Enter amt]  [Build PSBT] [Review]   [Sign+Send]   [Success]
 or UNIT        [Validate]     [MAX btn]                [Confirm]
```

**Key Characteristics**:
- Modal presentation (overlays wallet)
- Horizontal swipe navigation between screens
- Back button on each screen
- Gestured disabled during processing/confirmation
- Auto-cleanup on dismissal (releases locked UTXOs)

**File**: `navigation/SendNavigator.js`

---

## Step 1: Asset Selection

**File**: `screens/send/AssetSelectorScreen.jsx`

### Screen State

**UI Elements**:
- Header: Back button + "Select Asset" title
- Subtitle: "Choose which asset you want to send"
- BTC Card:
  - Bitcoin logo
  - Asset name: "Bitcoin"
  - Symbol: "BTC"
  - Balance: Shows combined SegWit + Taproot balance
  - USD value
  - Right arrow icon
- UNIT Card:
  - Unit logo
  - Asset name: "Unit Rune"
  - Symbol: "UNIT"
  - Balance: Shows runes balance
  - USD value (if applicable)
  - Right arrow icon

### Balance Calculation

**BTC Balance**:
```javascript
btcBalance = segwitBalance + taprootBalance
```
- **File**: `screens/send/AssetSelectorScreen.jsx:20`

**UNIT Balance**:
```javascript
unitBalance = runesBalance[0][1] (parsed as float)
```
- **File**: `screens/send/AssetSelectorScreen.jsx:21`

### User Actions

#### Action 1: Select BTC
- Tap BTC card
- Sets `sendAssetType = 'btc'` in SendFlowContext
- **File**: `screens/send/AssetSelectorScreen.jsx:23-27`
- Navigates to: `AddressInput` screen with `assetType: 'btc'` param

#### Action 2: Select UNIT
- Tap UNIT card
- Sets `sendAssetType = 'unit'` in SendFlowContext
- **File**: `screens/send/AssetSelectorScreen.jsx:23-27`
- Navigates to: `AddressInput` screen with `assetType: 'unit'` param

#### Action 3: Go Back (Cancel)
- Tap back button
- **File**: `screens/send/AssetSelectorScreen.jsx:33`
- Calls `navigation.getParent()?.goBack()`
- Dismisses entire send flow modal
- Returns to: Wallet Home screen
- **What happens**: No state changed, clean exit

### Data Flow

**Context Updates**:
- `SendFlowContext.sendAssetType` → Set to 'btc' or 'unit'
- Passed as navigation param to next screen

**No Validation**:
- No validation required at this step
- Both assets always available for selection (even with 0 balance)

### Success Criteria

✅ User selects an asset
✅ `sendAssetType` is set in context
✅ Navigation to AddressInput occurs with correct param

---

## Step 2: Address Input

**File**: `screens/send/AddressInputScreen.jsx`

### Screen State

**UI Elements**:
- Header: Back button + "Enter Address" title
- Label: "Recipient Address"
- Input field:
  - Multiline text input (2 lines)
  - Placeholder: "tb1q... or tb1p..."
  - Auto-focused on mount
  - Auto-capitalization: none
  - Auto-correct: disabled
- Paste button (icon button next to input)
- Error text (below input, shows validation errors)
- Continue button (fixed at bottom, follows keyboard)

### Input Features

**Auto-focus**:
- Input automatically focused 300ms after screen load
- **File**: `screens/send/AddressInputScreen.jsx:40-46`

**Paste Support**:
- Tap paste button reads from clipboard
- **File**: `screens/send/AddressInputScreen.jsx:48-56`
- Uses `Clipboard.getStringAsync()`
- Populates input field immediately
- Re-focuses input after paste

**Real-time Validation**:
- Validates as user types
- **File**: `screens/send/AddressInputScreen.jsx:58-88`
- Uses `validateBitcoinAddress()` helper
- **File**: `utils/sendHelpers.js:43-48`

### Validation Rules

#### General Bitcoin Address Validation
**Function**: `validateBitcoinAddress(address)`
- Checks address format using bitcoinjs-lib
- Returns: `{ valid: boolean, error: string }`
- **File**: `utils/bitcoin.js` (core validation)

**Valid Address Formats**:
- SegWit (Native): `tb1q...` (testnet) or `bc1q...` (mainnet)
- Taproot: `tb1p...` (testnet) or `bc1p...` (mainnet)

#### UNIT-Specific Validation
**Extra Rule**: UNIT transfers REQUIRE Taproot addresses
- **File**: `screens/send/AddressInputScreen.jsx:72-79`

```javascript
if (assetType === 'unit') {
  const isTaproot = text.startsWith('tb1p') || text.startsWith('bc1p');
  if (!isTaproot) {
    setAddressError('UNIT transfers require a Taproot address (tb1p... or bc1p...)');
  }
}
```

**Reason**: UNIT is a Rune token that requires Taproot for transfers

#### Address Type Detection
**For BTC**:
- Taproot: Starts with `tb1p` or `bc1p`
- SegWit: Starts with `tb1q` or `bc1q`
- Sets `sendAddressType` accordingly
- **File**: `screens/send/AddressInputScreen.jsx:81-85`

### Error Messages

**Invalid Address Format**:
- "Invalid Bitcoin address format"
- **File**: `utils/messages.js:50`

**Invalid Address Length**:
- "Address length is invalid"
- **File**: `utils/messages.js:51`

**UNIT Taproot Requirement**:
- "UNIT transfers require a Taproot address (tb1p... or bc1p...)"
- **File**: `screens/send/AddressInputScreen.jsx:76`

### User Actions

#### Action 1: Enter/Paste Address Manually
- Type or paste Bitcoin address
- Input validates in real-time
- Error shown below input if invalid
- Error clears when user starts typing
- **File**: `screens/send/AddressInputScreen.jsx:58-88`

#### Action 2: Tap Paste Button
- Reads clipboard content
- Populates input field
- Triggers validation
- Re-focuses input
- **File**: `screens/send/AddressInputScreen.jsx:48-56`

#### Action 3: Tap Continue
- **Enabled**: When address is valid (no errors)
- **Disabled**: When address is empty or has errors
- **File**: `screens/send/AddressInputScreen.jsx:90-100`
- Validates address one final time
- Sets `sendRecipient` and `sendAddressType` in context
- Navigates to: `AmountInput` screen

#### Action 4: Go Back
- Tap back button
- **File**: `screens/send/AddressInputScreen.jsx:106`
- Calls `navigation.goBack()`
- Returns to: `AssetSelector` screen
- **State preserved**: Address input is preserved in context

### Data Flow

**Context Updates**:
- `SendFlowContext.sendRecipient` → Bitcoin address
- `SendFlowContext.sendAddressType` → 'taproot' or 'segwit'

**Keyboard Handling**:
- Continue button position adjusts based on `keyboardHeight`
- **File**: `screens/send/AddressInputScreen.jsx:141`
- Uses `useKeyboard()` hook

### Success Criteria

✅ Valid Bitcoin address entered
✅ Address type detected and set
✅ UNIT validation passes (if UNIT selected)
✅ `sendRecipient` and `sendAddressType` set in context
✅ Navigation to AmountInput occurs

---

## Step 3: Amount Input

**File**: `screens/send/AmountInputScreen.jsx`

### Screen State

**UI Elements**:
- Header:
  - Back button
  - Recipient info card (on same line):
    - Label: "To:"
    - Truncated address: "tb1qabcd...xyz123"
    - Address type badge: "Taproot" or "Native SegWit"
- Balance row:
  - Balance label: "BTC Balance: 0.12345678" or "UNIT Balance: 1000"
  - MAX button (shows spinner when calculating)
- Amount input:
  - Large font size (56pt, scales down for long numbers)
  - Asset symbol icon (BTC or UNIT)
  - Formatted with commas for thousands
  - Decimal support (for BTC)
  - Placeholder: "0"
- USD conversion: "≈ $1,234.56 USD"
- Review button (fixed at bottom, follows keyboard)

### Input Features

**Auto-focus**:
- Input automatically focused 300ms after screen load
- **File**: `screens/send/AmountInputScreen.jsx:51-57`

**Number Formatting**:
- Displays with thousand separators (commas)
- **File**: `utils/sendHelpers.js:9-18`
- Supports decimal comma from keyboards (converts to period)
- **File**: `screens/send/AmountInputScreen.jsx:59-76`

**Decimal Handling**:
```javascript
// Converts decimal comma to period
if (processed.endsWith(',') && !processed.includes('.')) {
  processed = processed.slice(0, -1) + '.';
}
```

**Dynamic Font Sizing**:
- 56pt: Default (< 8 chars)
- 44pt: Medium (8-12 chars)
- 36pt: Small (12-15 chars)
- 28pt: Extra small (> 15 chars)
- **File**: `screens/send/AmountInputScreen.jsx:179-184`

### MAX Button Functionality

**For BTC**:
- Calculates maximum sendable amount considering fees
- **File**: `screens/send/AmountInputScreen.jsx:78-97`
- Calls `calculateMaxSendableBTC()` service
- **File**: `services/transactionCalculationService.js`
- Shows loading spinner during calculation
- Accounts for:
  - Source address (SegWit or Taproot)
  - Available balance
  - Network fees for the transaction
- On error: Falls back to full balance

**For UNIT**:
- Simply uses full balance (no fee calculation needed)
- **File**: `screens/send/AmountInputScreen.jsx:98-101`
- UNIT transfers have BTC fee paid separately from UNIT amount

### Balance Display

**BTC**:
```javascript
btcBalance = segwitBalance + taprootBalance
```
- Format: Up to 8 decimal places
- Example: "0.12345678 BTC"

**UNIT**:
```javascript
unitBalance = runesBalance[0][1]
```
- Format: No decimal places (integer)
- Example: "1000 UNIT"

### USD Conversion

**For BTC**:
```javascript
usdValue = sendAmount * btcPrice
```
- Fetches `btcPrice` from PriceContext
- Format: 2 decimal places

**For UNIT**:
- Currently uses $1 per UNIT (placeholder)
- Could be updated with actual UNIT pricing

**File**: `screens/send/AmountInputScreen.jsx:116-122`

### Validation

**Client-side Validation** (this screen):
- Must enter an amount (> 0)
- Must be a valid number

**Server-side Validation** (Processing screen):
- Sufficient balance (including fees for BTC)
- Amount above dust limit
- Available confirmed UTXOs

### User Actions

#### Action 1: Enter Amount Manually
- Type amount using decimal keypad
- Supports commas and decimal points
- Real-time USD conversion updates
- **File**: `screens/send/AmountInputScreen.jsx:59-76`

#### Action 2: Tap MAX Button
- Shows loading spinner
- Calculates max sendable (BTC) or uses full balance (UNIT)
- Populates amount input
- **File**: `screens/send/AmountInputScreen.jsx:78-102`

#### Action 3: Tap Review
- **Enabled**: When amount is entered
- **Disabled**: When amount is empty
- **File**: `screens/send/AmountInputScreen.jsx:104-114`
- Blurs keyboard
- Navigates to: `Processing` screen with params:
  - `fromScreen: 'AmountInput'`
  - `action: 'create_intent'`

#### Action 4: Go Back
- Tap back button
- Returns to: `AddressInput` screen
- **State preserved**: Amount input is preserved in context

### Data Flow

**Context Updates**:
- `SendFlowContext.sendAmount` → Amount as string (e.g., "0.12345")

**Keyboard Handling**:
- Review button position adjusts based on `keyboardHeight`
- **File**: `screens/send/AmountInputScreen.jsx:205`

### Success Criteria

✅ Valid amount entered
✅ USD conversion displayed correctly
✅ `sendAmount` set in context
✅ Navigation to Processing screen occurs with correct params

---

## Step 4: Processing (Create Intent)

**File**: `screens/send/ProcessingScreen.jsx`

### Purpose

This screen handles the CPU-intensive work of building a PSBT (Partially Signed Bitcoin Transaction) without blocking the UI.

### Screen State

**UI Elements**:
- Centered content:
  - Large spinner (activity indicator)
  - Title: "Creating Transaction"
  - Cycling status messages (changes every 500ms)

### Loading Messages

**For BTC**:
1. "Collecting UTXOs..." (0ms)
2. "Building PSBT..." (500ms)

**For UNIT**:
1. "Collecting rune UTXOs..." (0ms)
2. "Constructing runestone..." (500ms)
3. "Building PSBT..." (1000ms)

**File**: `screens/send/ProcessingScreen.jsx:28-40`

### Background Processing

**What Happens**:
1. Screen renders with spinner (100ms delay)
2. Calls `createSendIntent()` from TransactionBuildContext
3. Backend service:
   - Fetches available UTXOs from wallet
   - Selects optimal UTXOs (coin selection)
   - Calculates fees based on transaction size
   - Builds PSBT structure
   - Creates change output if needed
   - Locks selected UTXOs (prevents double-spend)
4. Updates `intentStep` in SendFlowContext:
   - Success: `intentStep = 'reviewing'`
   - Failure: `intentStep = 'entering_amount'`

**File**: `screens/send/ProcessingScreen.jsx:74-104`

### Navigation Logic

**Watches**: `intentStep` and `sendIntent` state changes

**On Success** (`intentStep === 'reviewing'` AND `sendIntent` exists):
- Navigates to: `Review` screen (replace, not push)
- **File**: `screens/send/ProcessingScreen.jsx:112-116`

**On Failure** (`intentStep === 'entering_amount'`):
- Goes back to: `AmountInput` screen
- Shows error toast (after 300ms delay)
- Toast message: "Failed to create transaction. Please check your balance and try again."
- **File**: `screens/send/ProcessingScreen.jsx:117-122`

### Error Scenarios

Common failures during intent creation:
1. **Insufficient funds**
2. **Insufficient funds for fees** (BTC amount ok, but not enough for fee)
3. **No confirmed UTXOs** (all funds unconfirmed)
4. **No UNIT balance** (for UNIT transfers)
5. **Transaction too large** (too many UTXOs needed)

All errors result in:
- Return to AmountInput screen
- Error toast displayed
- User can adjust amount or cancel

### Gesture Handling

**Back/Swipe Gestures**: Enabled
- User can swipe back during processing
- Cancels the intent creation
- Returns to previous screen

### Success Criteria

✅ PSBT successfully created
✅ UTXOs locked for transaction
✅ `sendIntent` populated in context
✅ `intentStep` set to 'reviewing'
✅ Navigation to Review screen occurs

---

## Step 5: Review Screen

**File**: `screens/send/ReviewScreen.jsx`

### Purpose

Final review screen before signing and broadcasting the transaction. Shows all transaction details including fees, inputs, outputs, and warnings.

### Screen State

**UI Elements**:
- Header:
  - Back button (blue)
  - Title: "You will send"
- Scrollable content:
  - **Transaction Summary Card**:
    - Recipient address (truncated)
    - Asset type (BTC/UNIT icon)
    - Amount with formatting
    - USD equivalent
  - **Unconfirmed Warning** (if applicable):
    - Warning icon
    - Message about unconfirmed inputs
  - **Fee Breakdown Card**:
    - Network fee in BTC
    - Fee in USD
    - Fee rate (sat/vB)
  - **Transaction Details** (collapsible):
    - Chevron icon (up/down)
    - "Transaction Details" header
    - When expanded:
      - Input list (UTXOs being spent)
      - Output list (recipient + change)
      - Full addresses
      - Individual amounts
- Fixed bottom buttons:
  - Cancel button (outline style)
  - "Confirm and Sign" button (primary blue)

### Data Display

**Uses**: `useReviewScreenData()` hook
- **File**: `hooks/useReviewScreenData.js`

**Key Data**:
- `sendIntent`: Transaction intent with PSBT
- `displayAmount`: Formatted amount to send
- `usdAmount`: USD equivalent
- `actualFee`: Network fee in BTC
- `psbtInputs`: Array of input UTXOs
- `outputs`: Array of outputs (recipient + change)
- `hasUnconfirmedInputs`: Boolean flag

### Transaction Details (Collapsible)

**Default**: Collapsed (hidden)

**User can expand** to see:
- **Inputs**: UTXOs being spent
  - Address (truncated)
  - Amount in BTC
  - Confirmation status
- **Outputs**: Where BTC is going
  - Recipient output (marked)
  - Change output (if applicable)
  - Address (truncated)
  - Amount in BTC

**File**: `screens/send/ReviewScreen.jsx:88-110`

**Components**:
- `TransactionSummary` - **File**: `components/review/TransactionSummary.jsx`
- `FeeBreakdown` - **File**: `components/review/FeeBreakdown.jsx`
- `InputOutputList` - **File**: `components/review/InputOutputList.jsx`
- `UnconfirmedWarning` - **File**: `components/review/UnconfirmedWarning.jsx`

### Warnings

**Unconfirmed Inputs Warning**:
- Shown when transaction uses unconfirmed UTXOs
- **File**: `screens/send/ReviewScreen.jsx:82`
- Message warns user transaction may take longer to confirm
- Non-blocking (user can still proceed)

### User Actions

#### Action 1: Expand/Collapse Details
- Tap "Transaction Details" card
- Toggles `isDetailsExpanded` state
- Shows/hides input/output lists
- **File**: `screens/send/ReviewScreen.jsx:88-99`

#### Action 2: Go Back (Edit Amount)
- Tap back button in header
- **File**: `screens/send/ReviewScreen.jsx:56-59`
- Returns to: `AmountInput` screen
- **Intent preserved**: PSBT remains in memory, UTXOs stay locked
- User can edit amount and recreate transaction

#### Action 3: Cancel Transaction
- Tap "Cancel" button at bottom
- **File**: `screens/send/ReviewScreen.jsx:48-54`
- Calls `cancelIntent()`:
  - Releases locked UTXOs
  - Clears sendIntent
  - Resets intentStep to 'idle'
- Dismisses entire send flow modal
- Returns to: Wallet Home screen

#### Action 4: Confirm and Sign
- Tap "Confirm and Sign" button
- **File**: `screens/send/ReviewScreen.jsx:40-46`
- Navigates to: `Processing` screen with params:
  - `fromScreen: 'Review'`
  - `action: 'sign_and_broadcast'`

### No Validation

No additional validation at this step - all validation occurred during PSBT creation.

### Success Criteria

✅ All transaction details displayed correctly
✅ User reviews and understands the transaction
✅ User confirms or cancels

---

## Step 6: Processing (Sign & Broadcast)

**File**: `screens/send/ProcessingScreen.jsx`

### Purpose

This screen handles signing the PSBT and broadcasting the transaction to the Bitcoin network.

### Screen State

**UI Elements**:
- Centered content:
  - Large spinner (activity indicator)
  - Title: "Sending Transaction"
  - Cycling status messages (changes every 500ms)

### Loading Messages

1. "Signing transaction..." (0ms)
2. "Broadcasting transaction..." (500ms)

**File**: `screens/send/ProcessingScreen.jsx:47-51`

### Background Processing

**What Happens**:
1. Screen renders with spinner (100ms delay)
2. Calls `signIntent()` from TransactionExecutionContext
3. Backend service:
   - **Signs PSBT** with private keys from wallet
   - **Finalizes PSBT** (converts to raw transaction)
   - **Broadcasts** raw transaction to network via Esplora API
   - **Stores** transaction ID (`broadcastedTxid`)
   - **Releases** locked UTXOs
   - **Updates** wallet state
4. Returns success/failure

**File**: `screens/send/ProcessingScreen.jsx:84-102`

### Navigation Logic

**On Success**:
- Replaces to: `Confirmation` screen
- **File**: `screens/send/ProcessingScreen.jsx:90`

**On Failure**:
- Goes back to: `Review` screen
- Shows error toast (after 300ms delay)
- Toast message: Specific error from broadcast or "Failed to sign and broadcast transaction"
- **File**: `screens/send/ProcessingScreen.jsx:91-99`

### Error Scenarios

Common failures during signing/broadcasting:

1. **Signing Errors**:
   - Private key not found
   - Invalid PSBT structure
   - Signing failed

2. **Broadcast Errors**:
   - Network connection failed
   - Transaction rejected by mempool
   - Double-spend detected
   - Fee too low
   - Transaction already broadcast

**Error Handling**:
- All errors caught and shown as toast
- User returned to Review screen
- Intent remains active (UTXOs stay locked)
- User can try again or cancel

**File**: `screens/send/ProcessingScreen.jsx:95-99`

### Gesture Handling

**Back/Swipe Gestures**: **DISABLED**
- **File**: `navigation/SendNavigator.js:80-82`
- User cannot swipe back during signing/broadcasting
- Prevents interrupting critical operation
- Only way out is success/failure

### Success Criteria

✅ PSBT successfully signed
✅ Transaction successfully broadcast to network
✅ Transaction ID received and stored
✅ Navigation to Confirmation screen occurs

---

## Step 7: Confirmation Screen

**File**: `screens/send/ConfirmationScreen.jsx`

### Purpose

Success screen showing transaction was broadcast successfully.

### Screen State

**UI Elements**:
- Centered content:
  - Large success checkmark icon (teal)
  - Title: "Transaction Sent"
  - Subtitle: "Your transaction has been successfully broadcast to the network"
  - "View on Explorer" button (outline with arrow)
- Fixed bottom:
  - "Done" button (primary blue)

### Transaction ID

**Source**: `broadcastedTxid` from TransactionExecutionContext
- **File**: `screens/send/ConfirmationScreen.jsx:14`
- Set during broadcast in Processing screen
- Used to construct explorer URL

### User Actions

#### Action 1: View on Explorer
- Tap "View on Explorer" button
- **File**: `screens/send/ConfirmationScreen.jsx:16-20`
- Opens block explorer in browser:
  - Testnet: `https://mempool.space/testnet/tx/{txid}`
  - Mainnet: `https://mempool.space/tx/{txid}`
- Uses `getTxUrl()` helper
- **File**: `utils/constants.js`
- External link (leaves app)

#### Action 2: Done
- Tap "Done" button
- **File**: `screens/send/ConfirmationScreen.jsx:22-25`
- Calls `navigation.getParent()?.goBack()`
- Dismisses entire send flow modal
- Returns to: Wallet Home screen
- **Wallet updates**: Balance refresh triggered automatically

### Gesture Handling

**Back/Swipe Gestures**: **DISABLED**
- **File**: `navigation/SendNavigator.js:86-89`
- User must tap "Done" button
- Prevents accidental dismissal of success message

### Success Criteria

✅ Success message displayed
✅ Transaction ID available
✅ Explorer link works
✅ User can return to wallet

---

## Back Navigation & Cancellation

### Back Button Behavior by Screen

| Screen | Back Button Action | What Happens |
|--------|-------------------|--------------|
| **AssetSelector** | Dismisses send flow | Returns to Wallet Home, no state changed |
| **AddressInput** | Goes to AssetSelector | Address preserved in context |
| **AmountInput** | Goes to AddressInput | Amount preserved in context |
| **Processing (Create)** | Allowed (can swipe) | Cancels intent creation, returns to AmountInput |
| **Review** | Goes to AmountInput | Intent preserved, UTXOs stay locked |
| **Processing (Sign)** | **DISABLED** | Cannot interrupt signing/broadcasting |
| **Confirmation** | **DISABLED** | Must tap "Done" button |

### UTXO Locking & Cleanup

**When UTXOs are locked**:
- During PSBT creation (Processing screen 1)
- Prevents double-spending same coins

**When UTXOs are released**:
1. User taps "Cancel" on Review screen
2. User dismisses send flow from any screen (before Review)
3. Transaction successfully broadcasts
4. Error during PSBT creation or signing

**Cleanup Handler**:
- **File**: `navigation/SendNavigator.js:29-41`
- Listens for 'beforeRemove' event
- Calls `cancelIntent()` when user leaves send flow

```javascript
navigation.addListener('beforeRemove', (e) => {
  if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
    cancelIntent(); // Releases locked UTXOs
  }
});
```

### Cancel from Review Screen

**Special Handling**:
- Explicitly releases UTXOs via `cancelIntent()`
- **File**: `screens/send/ReviewScreen.jsx:48-54`
- Dismisses entire modal
- Clean state reset

---

## Error Scenarios & Recovery

### 1. Invalid Bitcoin Address

**When**: Address Input screen, during typing/paste

**Error Message**:
- "Invalid Bitcoin address format" (general)
- "Address length is invalid" (wrong length)
- **File**: `utils/messages.js:50-51`

**Recovery**:
- Error shown below input field
- Continue button disabled
- User can:
  - Correct the address
  - Paste different address
  - Go back to asset selection
  - Cancel send flow

**No Retry Limit**: User can try unlimited times

---

### 2. UNIT Requires Taproot Address

**When**: Address Input screen, UNIT asset selected, non-Taproot address entered

**Error Message**:
- "UNIT transfers require a Taproot address (tb1p... or bc1p...)"
- **File**: `screens/send/AddressInputScreen.jsx:76`

**Why**: Rune tokens require Taproot for transfers

**Recovery**:
- Error shown below input field
- Continue button disabled
- User must:
  - Enter/paste Taproot address (tb1p... or bc1p...)
  - OR go back and select BTC instead

**No Retry Limit**: User can try unlimited times

---

### 3. Insufficient Funds

**When**: Processing screen (Create Intent), during PSBT creation

**Error Message**:
- "Insufficient funds for this transaction"
- **File**: `utils/messages.js:5`

**Cause**:
- User entered amount > available balance
- Balance changed since screen loaded (rare)

**Recovery**:
- Returns to Amount Input screen
- Toast error shown
- User can:
  - Enter lower amount
  - Tap MAX button to use maximum available
  - Go back to address/asset
  - Cancel send flow

**File**: `screens/send/ProcessingScreen.jsx:117-122`

---

### 4. Insufficient Funds for Fees

**When**: Processing screen (Create Intent), during PSBT creation

**Error Message**:
- "Insufficient funds to cover transaction fees"
- **File**: `utils/messages.js:6`

**Cause**:
- User entered exact balance without accounting for fees
- Common with MAX button if calculation fails
- Network fees higher than expected

**Recovery**:
- Returns to Amount Input screen
- Toast error shown
- User must:
  - Enter lower amount (leave room for fees)
  - Wait for more funds
  - Cancel send flow

**Prevention**:
- MAX button tries to calculate fees correctly
- Fallback may not be perfect

---

### 5. No Confirmed Funds

**When**: Processing screen (Create Intent), during UTXO selection

**Error Message**:
- "No confirmed funds available"
- **File**: `utils/messages.js:20`

**Cause**:
- All wallet UTXOs are unconfirmed (0 confirmations)
- Cannot spend unconfirmed funds in some scenarios

**Recovery**:
- Returns to Amount Input screen
- Toast error shown
- User must:
  - Wait for confirmations
  - Cannot proceed until funds confirm

**Warning**:
- If Review screen shows unconfirmed inputs, transaction may fail

---

### 6. MAX Calculation Fails

**When**: Amount Input screen, user taps MAX button

**Error Shown**: None (silent fallback)

**What Happens**:
- **File**: `screens/send/AmountInputScreen.jsx:91-94`
- Logs error to console
- Falls back to full balance (without fee calculation)
- User may see "Insufficient funds for fees" error later

**Recovery**:
- MAX button populates full balance
- User should manually reduce amount slightly
- OR try MAX again (may succeed on retry)

---

### 7. Transaction Broadcasting Fails

**When**: Processing screen (Sign & Broadcast), during network broadcast

**Error Messages** (various):
- "Failed to broadcast transaction"
- "Transaction inputs already spent"
- "This transaction is already pending. Please wait."
- "Fee too low"
- "Network connection failed. Please check your internet."
- **File**: `utils/messages.js:5-21, 54-57`

**Causes**:
- Network connection lost
- Double-spend attempt
- Fee too low for mempool
- Transaction already broadcast
- Invalid transaction structure

**Recovery**:
- Returns to Review screen
- Toast error shown with specific message
- Intent remains active (UTXOs stay locked)
- User can:
  - Tap "Confirm and Sign" again (retry broadcast)
  - Go back to edit amount
  - Cancel transaction

**Retry**: User can retry broadcasting multiple times

---

### 8. Signing Fails

**When**: Processing screen (Sign & Broadcast), during PSBT signing

**Error Message**:
- "Failed to sign and broadcast transaction"
- OR specific signing error
- **File**: `screens/send/ProcessingScreen.jsx:93`

**Causes**:
- Private key not accessible
- PSBT structure invalid
- Wallet locked/corrupted

**Recovery**:
- Returns to Review screen
- Toast error shown
- User can:
  - Try again
  - Cancel and restart send flow
  - Restart app if persistent

---

### 9. User Cancels During Processing (Create Intent)

**When**: User swipes back during PSBT creation

**What Happens**:
- Processing interrupted
- Returns to Amount Input screen
- No error shown (user initiated)
- Intent creation cancelled
- UTXOs remain unlocked

**Recovery**:
- User can tap "Review" again to restart

---

### 10. User Cancels from Review Screen

**When**: User taps "Cancel" button on Review screen

**What Happens**:
- `cancelIntent()` called explicitly
- Releases locked UTXOs
- Clears sendIntent
- Resets intentStep to 'idle'
- Dismisses entire send flow
- Returns to Wallet Home

**File**: `screens/send/ReviewScreen.jsx:48-54`

**This is normal flow**, not an error

---

### Error Summary Table

| Error | Screen | Recovery | Can Retry? |
|-------|--------|----------|------------|
| Invalid address | AddressInput | Correct address | Yes (unlimited) |
| UNIT needs Taproot | AddressInput | Use Taproot address | Yes (unlimited) |
| Insufficient funds | Processing → AmountInput | Lower amount or add funds | Yes |
| Insufficient for fees | Processing → AmountInput | Lower amount | Yes |
| No confirmed funds | Processing → AmountInput | Wait for confirmations | No (must wait) |
| MAX calc fails | AmountInput | Manual amount or retry MAX | Yes |
| Broadcast fails | Processing → Review | Retry or cancel | Yes (unlimited) |
| Signing fails | Processing → Review | Retry or cancel | Yes |
| User cancels | Any screen | Restart send flow | N/A |

---

## Testing Checklist

### Happy Path - BTC Send

- [ ] Tap "Send" button on Wallet Home
- [ ] Asset Selector screen appears
- [ ] BTC card shows correct balance and USD value
- [ ] Tap BTC card
- [ ] Address Input screen appears
- [ ] Can paste Bitcoin address
- [ ] Valid SegWit address accepted
- [ ] Valid Taproot address accepted
- [ ] Address type badge shows "Native SegWit" or "Taproot"
- [ ] Continue button enabled when address valid
- [ ] Navigate to Amount Input
- [ ] Amount Input shows recipient address truncated
- [ ] Balance displayed correctly
- [ ] Can enter amount manually
- [ ] Thousand separators appear (commas)
- [ ] Decimal comma converts to period
- [ ] USD conversion updates in real-time
- [ ] Tap MAX button
- [ ] MAX shows loading spinner
- [ ] MAX populates calculated amount (less than balance)
- [ ] Tap Review button
- [ ] Processing screen appears with "Creating Transaction"
- [ ] Loading messages cycle (Collecting UTXOs → Building PSBT)
- [ ] Review screen appears
- [ ] Transaction summary shows correct recipient and amount
- [ ] Fee breakdown displayed
- [ ] Can expand Transaction Details
- [ ] Input/output list shows correctly
- [ ] Tap "Confirm and Sign"
- [ ] Processing screen appears with "Sending Transaction"
- [ ] Loading messages cycle (Signing → Broadcasting)
- [ ] Confirmation screen appears
- [ ] Success checkmark displayed
- [ ] "Transaction Sent" title shows
- [ ] Tap "View on Explorer"
- [ ] Browser opens with correct transaction on mempool.space
- [ ] Return to app
- [ ] Tap "Done"
- [ ] Returns to Wallet Home
- [ ] Balance updated (reduced)

### Happy Path - UNIT Send

- [ ] Tap "Send" button
- [ ] Tap UNIT card
- [ ] UNIT balance shows correctly
- [ ] Enter Taproot address (tb1p... or bc1p...)
- [ ] Address validates successfully
- [ ] Address type badge shows "Taproot"
- [ ] Navigate to Amount Input
- [ ] UNIT balance shows (no decimals)
- [ ] Enter UNIT amount
- [ ] Tap Review
- [ ] Processing shows "Collecting rune UTXOs → Constructing runestone → Building PSBT"
- [ ] Review screen shows UNIT transfer details
- [ ] Confirm and sign
- [ ] Transaction broadcasts successfully
- [ ] Confirmation screen shows

### Error Scenarios - Address

- [ ] Enter invalid address format
- [ ] Error shows: "Invalid Bitcoin address format"
- [ ] Continue button disabled
- [ ] Correct address
- [ ] Error clears
- [ ] Continue button enabled
- [ ] For UNIT: Enter SegWit address (tb1q...)
- [ ] Error shows: "UNIT transfers require a Taproot address"
- [ ] Continue button disabled
- [ ] Change to Taproot address
- [ ] Error clears and validation passes

### Error Scenarios - Amount

- [ ] Enter amount greater than balance
- [ ] Tap Review
- [ ] Processing creates intent
- [ ] Error toast: "Insufficient funds for this transaction"
- [ ] Returns to Amount Input
- [ ] Reduce amount
- [ ] Try again - succeeds
- [ ] Enter exact balance (no room for fees)
- [ ] Tap Review
- [ ] Error toast: "Insufficient funds to cover transaction fees"
- [ ] Returns to Amount Input
- [ ] Tap MAX button
- [ ] Amount slightly less than balance
- [ ] Review succeeds

### Error Scenarios - Broadcasting

- [ ] Turn off internet connection
- [ ] Complete send flow through Review
- [ ] Tap "Confirm and Sign"
- [ ] Processing screen appears
- [ ] Error toast: "Network connection failed"
- [ ] Returns to Review screen
- [ ] Turn on internet
- [ ] Tap "Confirm and Sign" again
- [ ] Broadcast succeeds

### Back Navigation & Cancellation

- [ ] From Asset Selector: Back button returns to Wallet Home
- [ ] From Address Input: Back button returns to Asset Selector
- [ ] From Address Input → Asset Selector → back to Address: Address preserved
- [ ] From Amount Input: Back button returns to Address Input
- [ ] From Amount Input → Address → back to Amount: Amount preserved
- [ ] From Review: Back button returns to Amount Input
- [ ] From Review → Amount → Review: PSBT recreated (may differ slightly)
- [ ] From Review: Tap Cancel button
- [ ] Returns to Wallet Home
- [ ] UTXOs released (balance unchanged)
- [ ] During Processing (Create): Swipe back
- [ ] Intent creation cancelled
- [ ] Returns to Amount Input
- [ ] During Processing (Sign): Cannot swipe back
- [ ] On Confirmation: Cannot swipe back
- [ ] Must tap "Done"

### UTXO Locking & Cleanup

- [ ] Start send flow
- [ ] Go to Review screen (UTXOs locked)
- [ ] Swipe down to dismiss send flow
- [ ] UTXOs released (confirmed via balance)
- [ ] Start send flow again
- [ ] Same UTXOs available

### Edge Cases

- [ ] Enter amount with many decimals (e.g., 0.12345678)
- [ ] Displays correctly on Review
- [ ] Enter large amount (e.g., 10000.5)
- [ ] Font size scales down
- [ ] Still readable
- [ ] Paste address with leading/trailing spaces
- [ ] Spaces trimmed automatically
- [ ] Address validates
- [ ] Tap MAX when balance is 0
- [ ] Shows "0" or very small amount
- [ ] Cannot proceed (no funds)
- [ ] Have only unconfirmed balance
- [ ] Tap MAX or enter amount
- [ ] Review screen shows unconfirmed warning
- [ ] Can still proceed (warning only)

---

## File Reference Index

### Navigation
- `navigation/SendNavigator.js` - Send flow navigator and cleanup handler

### Screens
- `screens/send/AssetSelectorScreen.jsx` - Asset selection (BTC/UNIT)
- `screens/send/AddressInputScreen.jsx` - Recipient address input
- `screens/send/AmountInputScreen.jsx` - Amount input with MAX button
- `screens/send/ProcessingScreen.jsx` - Processing screen (create intent + sign/broadcast)
- `screens/send/ReviewScreen.jsx` - Transaction review before signing
- `screens/send/ConfirmationScreen.jsx` - Success confirmation

### Contexts
- `contexts/SendFlowContext.js` - Send flow state (asset, recipient, amount, step)
- `contexts/TransactionBuildContext.js` - PSBT creation and intent management
- `contexts/TransactionExecutionContext.js` - Signing and broadcasting
- `contexts/WalletDataContext.js` - Balance data
- `contexts/PriceContext.js` - BTC price for USD conversion

### Components
- `components/review/TransactionSummary.jsx` - Review screen summary card
- `components/review/FeeBreakdown.jsx` - Fee display
- `components/review/InputOutputList.jsx` - UTXO inputs and outputs
- `components/review/UnconfirmedWarning.jsx` - Unconfirmed UTXO warning

### Utilities
- `utils/sendHelpers.js` - Address validation and number formatting
- `utils/bitcoin.js` - Core Bitcoin address validation
- `utils/messages.js` - Error and success messages
- `utils/constants.js` - Explorer URLs

### Services
- `services/transactionCalculationService.js` - MAX amount calculation

### Hooks
- `hooks/useReviewScreenData.js` - Review screen data aggregation
- `hooks/useKeyboard.js` - Keyboard height tracking

---

## Notes

- Send flow is a **modal overlay** that dismisses to Wallet Home
- **UTXO locking** prevents double-spends during transaction creation
- **Automatic cleanup** releases UTXOs if user exits flow before broadcasting
- **No retry limits** on user input errors (address, amount)
- **Broadcast can be retried** if it fails (network errors, etc.)
- **Processing screens cannot be interrupted** during signing/broadcasting
- **Confirmation screen must be dismissed** via "Done" button
- **Balance refreshes automatically** after successful send
- **Fee calculation** is automatic (no manual fee input)
- **MAX button** accounts for fees (BTC only)
- **UNIT transfers** require Taproot addresses
