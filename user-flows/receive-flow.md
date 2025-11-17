# Receive Flow - Complete User Journey

This document covers the complete receive flow for users to receive Bitcoin (BTC) and UNIT tokens. It includes opening the receive sheet, viewing addresses, expanding QR codes, copying addresses, and dismissing the flow.

---

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Entry Points](#entry-points)
3. [Step 1: Receive Bottom Sheet](#step-1-receive-bottom-sheet)
4. [Step 2: QR Code Modal](#step-2-qr-code-modal)
5. [Alternative: ReceiveQR Navigation Screen](#alternative-receiveqr-navigation-screen)
6. [Copy Address Functionality](#copy-address-functionality)
7. [Share Address Functionality](#share-address-functionality)
8. [Dismissing & Closing](#dismissing--closing)
9. [Animations & Gestures](#animations--gestures)
10. [Testing Checklist](#testing-checklist)

---

## Flow Overview

The receive flow is a **bottom sheet overlay** with an optional **QR code modal** that slides in from the right:

```
Wallet Home [Tap "Receive"]
    ↓
Receive Bottom Sheet
├─ BTC Address Row → [Tap QR icon] → QR Code Modal
└─ UNIT Address Row → [Tap QR icon] → QR Code Modal
    ↓
QR Code Modal
├─ QR Code display
├─ Full address display
├─ Copy address (tap address)
├─ Share address button
└─ Back button / Swipe right to dismiss
```

**Key Characteristics**:
- Bottom sheet presentation (slides up from bottom)
- Swipe-to-dismiss gesture on sheet
- QR modal slides in horizontally from right
- Swipe-to-dismiss gesture on QR modal (horizontal)
- Backdrop tap to dismiss receive sheet
- All copy actions show toast confirmation

**Files**:
- `screens/wallet/ReceiveScreen.jsx` - Main receive bottom sheet
- `screens/wallet/ReceiveQRScreen.jsx` - Alternative navigation screen
- `components/receive/AddressRow.jsx` - Address row component
- `components/receive/QRModal.jsx` - QR code modal component
- `hooks/useReceiveScreenAnimations.js` - Animation management

---

## Entry Points

### Entry Point 1: Tap "Receive" Button on Wallet Home

**Location**: Wallet Home screen, main action buttons

**Trigger**:
- User taps "Receive" button
- **File**: `pages/WalletPage.js:364`

**What Happens**:
```javascript
onReceivePress={() => setShowReceiveSheet(true)}
```

**Result**:
- `showReceiveSheet` state set to `true`
- Receive bottom sheet animates in from bottom
- Backdrop appears behind sheet (semi-transparent)
- **No auto-open QR**: User sees address selection

---

### Entry Point 2: Deep Link / Navigation Param

**Location**: External navigation (e.g., from transaction history, deep link)

**Trigger**:
- Navigation with `openReceive: true` param
- **File**: `pages/WalletPage.js:118-128`

**What Happens**:
```javascript
useEffect(() => {
  if (route?.params?.openReceive) {
    setShowReceiveSheet(true);
  }
}, [route?.params?.openReceive]);
```

**Result**:
- Same as Entry Point 1
- Useful for deep linking to receive flow

---

### Entry Point 3: Asset Detail Screen (Auto-open QR)

**Location**: Asset Detail screen (tap on BTC or UNIT card on wallet)

**Trigger**:
- User navigates to asset detail
- Taps "Receive" button for specific asset
- **File**: `screens/wallet/AssetDetailScreen.jsx`

**What Happens**:
- Opens receive sheet with `autoOpenQR={true}`
- Pre-selects address based on asset
- Immediately shows QR code modal
- Skips address selection step

**Props Passed**:
```javascript
autoOpenQR={true}
preSelectedAddress={address}
preSelectedType={'BTC Address' or 'UNIT Address'}
```

**Result**:
- Receive sheet opens (hidden behind QR modal)
- QR code modal immediately slides in
- Shows QR for the specific asset

---

## Step 1: Receive Bottom Sheet

**File**: `screens/wallet/ReceiveScreen.jsx`

### Screen State

**UI Elements**:
- Backdrop (semi-transparent, dismisses on tap)
- Bottom sheet container (white background)
- Handle bar (drag indicator at top)
- Title: "Receive"
- **BTC Address Row**:
  - Label: "BTC Address"
  - Address: Truncated SegWit address (ellipsized middle)
  - Tag: "BTC" badge (orange)
  - QR icon button (blue)
- **UNIT Address Row**:
  - Label: "UNIT Address"
  - Address: Truncated Taproot address (ellipsized middle)
  - Tag: "UNIT" badge (blue)
  - QR icon button (blue)

### Address Display

**BTC Address (SegWit)**:
- Type: Native SegWit (bc1q... on mainnet, tb1q... on testnet)
- Source: `wallet.segwitAddress`
- **File**: `screens/wallet/ReceiveScreen.jsx:156-164`
- Label: "BTC Address"
- Tag: "BTC" (orange background, dark text)

**UNIT Address (Taproot)**:
- Type: Taproot (bc1p... on mainnet, tb1p... on testnet)
- Source: `wallet.taprootAddress`
- **File**: `screens/wallet/ReceiveScreen.jsx:166-175`
- Label: "UNIT Address"
- Tag: "UNIT" (blue background, light text)
- **Note**: UNIT tokens require Taproot addresses for transfers

### AddressRow Component

**File**: `components/receive/AddressRow.jsx`

**Structure**:
```
AddressRow
├─ TouchableOpacity (entire row, triggers copy)
│  ├─ Address Info Container
│  │  ├─ Label (e.g., "BTC Address")
│  │  └─ Address (truncated, ellipsizeMode="middle")
│  └─ QR Icon Button (stops propagation, triggers QR modal)
```

**Tap Behaviors**:
1. **Tap address row**: Copies address to clipboard
2. **Tap QR icon**: Opens QR code modal (stops propagation)

**File**: `components/receive/AddressRow.jsx:22-38`

### User Actions

#### Action 1: Tap BTC Address Row (Copy)
- Taps anywhere on BTC address row (except QR icon)
- **File**: `components/receive/AddressRow.jsx:22`
- Calls `onCopy()` → `handleCopyAddress(segwitAddress, 'BTC')`
- **File**: `screens/wallet/ReceiveScreen.jsx:47-50`

**What Happens**:
```javascript
Clipboard.setString(address);
showToast(`BTC address copied to clipboard`);
```

**Result**:
- Address copied to device clipboard
- Toast appears: "BTC address copied to clipboard"
- Sheet remains open

---

#### Action 2: Tap UNIT Address Row (Copy)
- Taps anywhere on UNIT address row (except QR icon)
- Same behavior as BTC, but for Taproot address
- Toast: "UNIT address copied to clipboard"

---

#### Action 3: Tap BTC QR Icon
- Taps QR code icon on BTC row
- **File**: `components/receive/AddressRow.jsx:29-36`
- Event propagation stopped (`e.stopPropagation()`)
- Calls `onQrPress()` → `handleQrPress(segwitAddress, 'BTC Address')`
- **File**: `screens/wallet/ReceiveScreen.jsx:93-98`

**What Happens**:
```javascript
setSelectedAddress(address);
setSelectedType('BTC Address');
setShowQrModal(true);
prepareQrAnimation();
```

**Result**:
- QR modal slides in from right
- Shows QR code for BTC address
- Receive sheet remains visible behind (dimmed)

---

#### Action 4: Tap UNIT QR Icon
- Taps QR code icon on UNIT row
- Same behavior as BTC QR, but for Taproot address
- QR modal shows UNIT address with UNIT logo

---

#### Action 5: Swipe Down to Dismiss
- User swipes down on the sheet
- **File**: `hooks/useReceiveScreenAnimations.js:59-94`
- Pan responder detects downward swipe

**Gesture Detection**:
```javascript
onMoveShouldSetPanResponder: (_, gestureState) => {
  if (showQrModalRef.current) return false; // Don't respond if QR showing
  const isDownwardSwipe = gestureState.dy > 2 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
  return isDownwardSwipe;
}
```

**Dismiss Threshold**:
- Distance: > 100 pixels down
- OR Velocity: > 0.5 px/ms downward
- **File**: `hooks/useReceiveScreenAnimations.js:82`

**Animation**:
```javascript
Animated.timing(receiveTranslateY, {
  toValue: SCREEN_HEIGHT,
  duration: 250,
  useNativeDriver: true,
}).start(() => {
  receiveSheetOpacity.setValue(0);
  onClose();
});
```

**Result**:
- Sheet slides down and fades out
- `onClose()` called → `setShowReceiveSheet(false)`
- **File**: `pages/WalletPage.js:388`
- Returns to Wallet Home

---

#### Action 6: Tap Backdrop
- User taps semi-transparent backdrop behind sheet
- **File**: `screens/wallet/ReceiveScreen.jsx:134-139`
- Calls `handleDismiss()`

**Result**:
- Same animation as swipe-to-dismiss
- Sheet closes and returns to Wallet Home

---

### Data Flow

**Props Received** (from WalletPage):
- `showReceiveSheet`: Boolean to show/hide sheet
- `onClose`: Callback to close sheet
- `segwitAddress`: BTC SegWit address string
- `taprootAddress`: UNIT Taproot address string
- `showToast`: Function to display toast messages
- `autoOpenQR`: Optional, auto-opens QR for specific asset
- `preSelectedAddress`: Optional, pre-selected address for auto-open
- `preSelectedType`: Optional, pre-selected type for auto-open

**State Management**:
- `showQrModal`: Local state, controls QR modal visibility
- `selectedAddress`: Local state, address to show in QR
- `selectedType`: Local state, type label for QR modal

---

## Step 2: QR Code Modal

**File**: `components/receive/QRModal.jsx`

### Screen State

**UI Elements**:
- Backdrop (optional, only if `allowBackdropDismiss={true}`)
- Modal container (full screen, slides in from right)
- Network banner: "Mutinynet Edition" (purple text, top)
- Header:
  - Back button (left)
  - Title: "Bitcoin address" or "UNIT address" (centered)
- Subtitle: "Only use this address to receive Bitcoin." or "...receive UNIT."
- QR Code:
  - Large QR code (responsive size)
  - White background with padding
  - Logo in center (BTC or UNIT logo)
- Address Container (tap to copy):
  - Label row:
    - Type label: "BTC Address", "UNIT Address", "Native SegWit", or "Taproot"
    - "Tap to copy" hint (blue text, right-aligned)
  - Full address text (multi-line, all characters shown)
- Share Button:
  - Outline button style
  - Share arrow icon
  - "Share" text

### QR Code Rendering

**Library**: `react-native-qrcode-svg`

**Configuration**:
```javascript
<QRCode
  value={address}           // Bitcoin address
  size={QR_SIZE}            // Responsive: 180-220px
  backgroundColor="white"
  color="black"
  logo={btc_logo or unit_logo} // Centered logo
  logoSize={LOGO_SIZE}      // 21% of QR size
  logoBackgroundColor="white"
  logoBorderRadius={Math.floor(LOGO_SIZE / 2)} // Circular
/>
```

**File**: `components/receive/QRModal.jsx:81-90`

**Responsive Sizing**:
```javascript
const QR_SIZE = SCREEN_WIDTH < 375
  ? Math.min(SCREEN_WIDTH * 0.5, 180)
  : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);
```
- Small screens (< 375px): 50% width, max 180px
- Larger screens: 60% width, max 220px
- Logo: 21% of QR size

**File**: `components/receive/QRModal.jsx:15-18`

### User Actions

#### Action 1: Tap Back Button
- Taps back arrow in header
- **File**: `components/receive/QRModal.jsx:70-72`
- Calls `onBack()` → `handleQrBackPress()`
- **File**: `screens/wallet/ReceiveScreen.jsx:100-119`

**What Happens** (Normal Mode - `autoOpenQR={false}`):
```javascript
handleQrBack().start(() => {
  setShowQrModal(false);
  setSelectedAddress(null);
  setSelectedType(null);
  resetAfterQr();
});
```

**Animation**:
```javascript
Animated.parallel([
  Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: 250 }),
  Animated.timing(qrOpacity, { toValue: 0, duration: 150 }),
]);
```

**Result**:
- QR modal slides right and fades out
- Returns to: Receive bottom sheet (address selection)
- Sheet remains open

**What Happens** (Auto-Open Mode - `autoOpenQR={true}`):
```javascript
handleQrBack().start(() => {
  setShowQrModal(false);
  setSelectedAddress(null);
  setSelectedType(null);
  resetAfterQr();
  onClose(); // Close the entire receive sheet
});
```

**Result**:
- QR modal slides right and fades out
- Receive sheet also closes
- Returns to: Previous screen (e.g., Asset Detail)

**File**: `screens/wallet/ReceiveScreen.jsx:102-109`

---

#### Action 2: Swipe Right to Dismiss
- User swipes right on QR modal
- **File**: `hooks/useReceiveScreenAnimations.js:103-132`
- Pan responder detects rightward swipe

**Gesture Detection**:
```javascript
onMoveShouldSetPanResponder: (_, gestureState) => {
  const isSwipeRight = gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
  return isSwipeRight;
}
```

**Dismiss Threshold**:
- Distance: > 100 pixels right
- OR Velocity: > 0.5 px/ms rightward
- **File**: `hooks/useReceiveScreenAnimations.js:117`

**What Happens**:
- Calls `onQrSwipeDismiss` callback
- **File**: `hooks/useReceiveScreenAnimations.js:119-121`
- Executes same logic as back button
- **File**: `screens/wallet/ReceiveScreen.jsx:53-74`

**Result**:
- Same as tapping back button
- Depends on `autoOpenQR` mode

---

#### Action 3: Tap Address Container (Copy)
- Taps anywhere on the address container
- **File**: `components/receive/QRModal.jsx:94-98`
- Calls `onCopy()` → `handleCopyAddress(selectedAddress, selectedType)`

**What Happens**:
```javascript
Clipboard.setString(address);
showToast(`${type} address copied to clipboard`);
```

**Result**:
- Address copied to clipboard
- Toast appears with confirmation
- QR modal remains open

**"Tap to copy" Feedback**:
- Text changes to "Copied!" briefly (ReceiveQRScreen only)
- **File**: `screens/wallet/ReceiveQRScreen.jsx:24-31`
- Reverts after 2 seconds

---

#### Action 4: Tap Share Button
- Taps "Share" button below address
- **File**: `components/receive/QRModal.jsx:109-112`
- Calls `onShare()` → `handleShare()`
- **File**: `screens/wallet/ReceiveScreen.jsx:121-129`

**What Happens**:
```javascript
await Share.share({
  message: selectedAddress,
});
```

**Result**:
- Opens native share sheet
- User can share address via:
  - Messages, Email, AirDrop, etc.
- On cancel: Silently fails (no error)
- QR modal remains open

---

#### Action 5: Tap Backdrop (Auto-Open Mode Only)
- Only available when `allowBackdropDismiss={true}`
- Typically used with `autoOpenQR={true}`
- **File**: `components/receive/QRModal.jsx:38-45`
- Taps semi-transparent backdrop

**Result**:
- Calls `onBack()` (same as back button)
- Closes QR modal and receive sheet
- Returns to previous screen

---

### Auto-Open Behavior

**When**: `autoOpenQR={true}` (from Asset Detail screen)

**Timing**:
- Receive sheet opens
- 50ms delay
- QR modal automatically slides in
- **File**: `screens/wallet/ReceiveScreen.jsx:76-91`

**Code**:
```javascript
useEffect(() => {
  if (showReceiveSheet && autoOpenQR && preSelectedAddress && preSelectedType && !hasAutoOpenedRef.current) {
    hasAutoOpenedRef.current = true;
    setTimeout(() => {
      setShowQrModal(true);
      setSelectedAddress(preSelectedAddress);
      setSelectedType(preSelectedType);
      prepareQrAnimation();
    }, 50);
  }
}, [showReceiveSheet, autoOpenQR, preSelectedAddress, preSelectedType]);
```

**Effect**:
- User sees QR code immediately
- Skips address selection step
- Dismissing QR closes entire receive flow

---

## Alternative: ReceiveQR Navigation Screen

**File**: `screens/wallet/ReceiveQRScreen.jsx`

### Purpose

This is an alternative to the QR modal, used when navigating via React Navigation instead of bottom sheet.

### Differences from QR Modal

| Feature | QR Modal | ReceiveQR Screen |
|---------|----------|------------------|
| **Presentation** | Modal overlay | Navigation screen |
| **Entry** | From receive sheet | Direct navigation |
| **Animation** | Slides in horizontally | Stack navigation |
| **Dismissal** | Swipe right or back | Back button only |
| **Backdrop** | Optional | None |
| **Use Case** | Receive flow | Direct link to QR |

### Navigation Entry

**Route Params**:
- `address`: Bitcoin address string
- `addressType`: 'Native SegWit' or 'Taproot'

**Example**:
```javascript
navigation.navigate('ReceiveQR', {
  address: wallet.segwitAddress,
  addressType: 'Native SegWit'
});
```

### UI Elements

Same as QR Modal:
- Network banner
- Back button + title
- Subtitle
- QR code with logo
- Address container (tap to copy)
- Share button

### User Actions

Same actions as QR Modal, except:
- No swipe-to-dismiss (uses standard navigation)
- No backdrop dismiss
- "Tap to copy" shows "Copied!" feedback for 2 seconds
- **File**: `screens/wallet/ReceiveQRScreen.jsx:27-31`

---

## Copy Address Functionality

**All copy actions use the same pattern**:

### Implementation

**Library**: `expo-clipboard`

**Function**:
```javascript
const handleCopyAddress = (address, type) => {
  Clipboard.setString(address);
  showToast(`${type} address copied to clipboard`);
};
```
**File**: `screens/wallet/ReceiveScreen.jsx:47-50`

### Copy Locations

1. **Tap address row** on receive sheet
2. **Tap address container** in QR modal
3. **Tap address container** in ReceiveQR screen

### Toast Messages

- BTC: "BTC address copied to clipboard"
- UNIT: "UNIT address copied to clipboard"
- Generic: "{type} address copied to clipboard"

### No Errors

- Copy operation does not throw errors
- Always succeeds (Clipboard API is reliable)
- No failure state needed

---

## Share Address Functionality

**Available in**:
- QR modal
- ReceiveQR screen

### Implementation

**Library**: `react-native` (Share API)

**Function**:
```javascript
const handleShare = async () => {
  try {
    await Share.share({
      message: selectedAddress,
    });
  } catch (error) {
    // Silently fail - user cancelled or share unavailable
  }
};
```
**File**: `screens/wallet/ReceiveScreen.jsx:121-129`

### Share Options

Depends on device and installed apps:
- Messages (SMS/iMessage)
- Email
- AirDrop (iOS)
- Nearby Share (Android)
- Copy (falls back to clipboard)
- Third-party apps (WhatsApp, Telegram, etc.)

### Error Handling

**All errors silently fail**:
- User cancels share sheet: No error
- Share unavailable: No error
- Network issues: No error (share is local)

**Why silent**:
- User-initiated cancellation is not an error
- Prevents unnecessary error messages

---

## Dismissing & Closing

### Dismiss Triggers

| Trigger | Action | Result |
|---------|--------|--------|
| **Swipe down sheet** | Gesture on receive sheet | Closes sheet, returns to Wallet |
| **Tap backdrop** | Tap outside sheet | Closes sheet, returns to Wallet |
| **QR back button** | Tap back in QR modal | Returns to sheet (or Wallet if auto-open) |
| **QR swipe right** | Gesture on QR modal | Returns to sheet (or Wallet if auto-open) |
| **QR backdrop tap** | Tap outside QR (auto-open only) | Closes QR + sheet, returns to previous |

### State Cleanup

**On close**:
- `showReceiveSheet` → `false`
- `showQrModal` → `false`
- `selectedAddress` → `null`
- `selectedType` → `null`
- All animation values reset

**File**: `screens/wallet/ReceiveScreen.jsx:100-119`

### Animation Cleanup

**After dismissing**:
```javascript
const resetAfterQr = () => {
  translateX.setValue(0);
  translateY.setValue(0);
  qrOpacity.setValue(0);
  receiveTranslateY.setValue(0);
  receiveSheetOpacity.setValue(1);
};
```
**File**: `hooks/useReceiveScreenAnimations.js:152-160`

**Purpose**:
- Ensures clean state for next open
- Prevents animation glitches
- Resets all transform values

---

## Animations & Gestures

### Receive Sheet Animation

**Open**:
- Slides up from bottom
- Opacity fades in
- Duration: Automatic (spring animation)

**Close**:
- Slides down to bottom
- Opacity fades out
- Duration: 250ms
- **File**: `hooks/useReceiveScreenAnimations.js:26-34`

**Gesture**:
- Downward swipe to dismiss
- Follows finger during drag
- Snaps back if not enough distance/velocity
- **File**: `hooks/useReceiveScreenAnimations.js:74-93`

---

### QR Modal Animation

**Open**:
- Slides in from right
- Opacity fades in
- Duration: Automatic (spring animation)

**Close**:
- Slides right to edge
- Opacity fades out
- Duration: 250ms (slide) + 150ms (fade)
- **File**: `hooks/useReceiveScreenAnimations.js:36-49`

**Gesture**:
- Rightward swipe to dismiss
- Follows finger during drag
- Snaps back if not enough distance/velocity
- **File**: `hooks/useReceiveScreenAnimations.js:111-130`

---

### Pan Responder Details

**Receive Sheet Pan Responder**:
- Only responds to downward swipes
- Ignores if QR modal is showing
- Threshold: 100px or 0.5px/ms velocity
- **File**: `hooks/useReceiveScreenAnimations.js:59-94`

**QR Modal Pan Responder**:
- Only responds to rightward swipes
- Horizontal movement only
- Threshold: 100px or 0.5px/ms velocity
- **File**: `hooks/useReceiveScreenAnimations.js:103-132`

**Native Driver**:
- All animations use `useNativeDriver: true`
- Ensures 60fps smooth animations
- Runs on native thread (not JS thread)

---

## Testing Checklist

### Basic Receive Flow

- [ ] Tap "Receive" on Wallet Home
- [ ] Receive sheet slides up from bottom
- [ ] Backdrop appears behind sheet
- [ ] Sheet handle visible at top
- [ ] Title "Receive" displayed
- [ ] BTC address row shows truncated address
- [ ] BTC tag badge shows (orange)
- [ ] UNIT address row shows truncated address
- [ ] UNIT tag badge shows (blue)
- [ ] Both addresses are different
- [ ] QR icons visible on both rows

### BTC Address Actions

- [ ] Tap BTC address row (not QR icon)
- [ ] Toast shows: "BTC address copied to clipboard"
- [ ] Paste address elsewhere - correct SegWit address
- [ ] Sheet remains open after copy
- [ ] Tap BTC QR icon
- [ ] QR modal slides in from right
- [ ] QR code displays correctly
- [ ] BTC logo in center of QR code
- [ ] Title: "Bitcoin address"
- [ ] Subtitle: "Only use this address to receive Bitcoin."
- [ ] Full address displayed (all characters)
- [ ] "Tap to copy" hint shows
- [ ] Back button visible (top left)

### UNIT Address Actions

- [ ] Tap UNIT address row (not QR icon)
- [ ] Toast shows: "UNIT address copied to clipboard"
- [ ] Paste address elsewhere - correct Taproot address
- [ ] Sheet remains open after copy
- [ ] Tap UNIT QR icon
- [ ] QR modal slides in from right
- [ ] UNIT logo in center of QR code
- [ ] Title shows UNIT or Taproot
- [ ] Subtitle: "Only use this address to receive UNIT."
- [ ] Taproot address displayed

### QR Modal Actions

- [ ] Tap address container in QR modal
- [ ] Toast shows address copied
- [ ] Paste works correctly
- [ ] QR modal remains open after copy
- [ ] Tap "Share" button
- [ ] Native share sheet opens
- [ ] Can share via Messages, Email, etc.
- [ ] Address in share message is correct
- [ ] Cancel share sheet
- [ ] Returns to QR modal (no error)
- [ ] Tap back button in QR modal
- [ ] QR slides right and fades out
- [ ] Returns to receive sheet
- [ ] Receive sheet still open

### Gesture Dismissals

- [ ] Open receive sheet
- [ ] Swipe down on sheet
- [ ] Sheet follows finger
- [ ] Release after dragging > 100px
- [ ] Sheet slides down and closes
- [ ] Returns to Wallet Home
- [ ] Open receive sheet
- [ ] Swipe down < 100px
- [ ] Release
- [ ] Sheet springs back to open position
- [ ] Open QR modal
- [ ] Swipe right on QR
- [ ] QR follows finger
- [ ] Release after dragging > 100px
- [ ] QR slides right and closes
- [ ] Returns to receive sheet
- [ ] Open QR modal
- [ ] Swipe right < 100px
- [ ] Release
- [ ] QR springs back to center

### Backdrop Dismissals

- [ ] Open receive sheet
- [ ] Tap backdrop (area behind sheet)
- [ ] Sheet slides down and closes
- [ ] Returns to Wallet Home
- [ ] Open QR modal (normal mode)
- [ ] Backdrop not visible/tappable
- [ ] Can only close via back button or swipe

### Auto-Open Mode (from Asset Detail)

- [ ] Navigate to Asset Detail screen
- [ ] Tap "Receive" on asset detail
- [ ] Receive sheet opens (may not be visible)
- [ ] QR modal immediately slides in
- [ ] Correct address for selected asset
- [ ] Tap back button on QR
- [ ] QR slides right
- [ ] Receive sheet also closes
- [ ] Returns to Asset Detail screen
- [ ] Repeat with auto-open
- [ ] Swipe right on QR
- [ ] Both QR and sheet close
- [ ] Returns to Asset Detail

### Address Validation

- [ ] BTC address starts with tb1q (testnet) or bc1q (mainnet)
- [ ] UNIT address starts with tb1p (testnet) or bc1p (mainnet)
- [ ] BTC and UNIT addresses are different
- [ ] Addresses remain consistent across opens
- [ ] Can scan QR code with external wallet
- [ ] Scanned address matches displayed address

### Copy Functionality

- [ ] Copy BTC from sheet - address is SegWit
- [ ] Copy UNIT from sheet - address is Taproot
- [ ] Copy from QR modal - matches QR code
- [ ] Multiple copies work correctly
- [ ] Clipboard persists after closing sheet
- [ ] Can paste into external apps

### Share Functionality

- [ ] Share from QR modal
- [ ] Share sheet shows address as message
- [ ] Can share via Messages - works
- [ ] Can share via Email - works
- [ ] Can share via AirDrop - works (iOS)
- [ ] Cancel share - no error, stays on QR
- [ ] Share unavailable - no crash

### Animation Smoothness

- [ ] Sheet slides up smoothly (60fps)
- [ ] Sheet slides down smoothly
- [ ] QR slides in smoothly (horizontal)
- [ ] QR slides out smoothly
- [ ] No jank or stuttering
- [ ] Gestures feel responsive
- [ ] Spring-back animation smooth

### Edge Cases

- [ ] Open and close sheet rapidly
- [ ] No animation glitches
- [ ] State resets correctly
- [ ] Open QR, go back, open QR again
- [ ] Works correctly on second open
- [ ] Minimize app during receive flow
- [ ] Return to app - state preserved
- [ ] Rotate device (if rotation enabled)
- [ ] Layout adapts correctly
- [ ] Small screen (< 375px width)
- [ ] QR code scales down appropriately
- [ ] Large screen
- [ ] QR code has max size limit

---

## File Reference Index

### Screens
- `screens/wallet/ReceiveScreen.jsx` - Main receive bottom sheet
- `screens/wallet/ReceiveQRScreen.jsx` - Alternative navigation screen

### Components
- `components/receive/AddressRow.jsx` - Address row with copy and QR button
- `components/receive/QRModal.jsx` - QR code modal overlay

### Hooks
- `hooks/useReceiveScreenAnimations.js` - Animation and gesture management

### Pages
- `pages/WalletPage.js` - Parent container, manages receive sheet state

### Utilities
- `expo-clipboard` - Clipboard operations
- `react-native` (Share API) - Native share functionality
- `react-native-qrcode-svg` - QR code generation

---

## Notes

- Receive flow is **non-blocking** - user can still navigate elsewhere
- **No validation needed** - addresses are pre-generated and always valid
- **No error states** - copy and share operations don't fail
- **Gesture conflicts avoided** - QR pan responder only responds when QR is visible
- **Auto-open mode** useful for direct asset-specific receive links
- **Clipboard integration** is platform-agnostic (works on iOS and Android)
- **Share functionality** adapts to device capabilities
- **Animations use native driver** for optimal performance
- **Addresses are static** - generated once during wallet creation
- **BTC uses SegWit** for lower fees
- **UNIT uses Taproot** required for Rune token transfers
