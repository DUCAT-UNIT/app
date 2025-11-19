# Performance & UX Improvements

## Focus Areas (based on user feedback)
1. PIN input/lock screen responsiveness
2. Wallet import/creation flow
3. Micro-interactions throughout app

## Phase 1: PIN Screen Improvements (HIGH PRIORITY)

### Issues
- No haptic feedback on keypad taps
- No visual feedback on button press
- PIN dots don't animate
- No loading state during verification
- Feels sluggish and unresponsive

### Solutions
1. **Haptic Feedback**
   - Light haptic on every keypad tap
   - Success haptic on correct PIN
   - Error haptic on incorrect PIN
   - Gentle haptic when PIN dot fills

2. **Visual Feedback**
   - Scale animation on keypad button press (0.92x)
   - Opacity change (0.7) on press
   - Spring animation on release
   - All animations use useNativeDriver for 60fps

3. **PIN Dot Animations**
   - Scale + fade in when digit added (spring animation)
   - Shake animation on error
   - Success pulse on correct PIN
   - Smooth transition between states

4. **Loading States**
   - Show subtle spinner on last digit
   - Disable keypad during verification
   - Smooth transition to success/error

### Files to modify
- `screens/auth/LockScreen.jsx`
- `screens/auth/PinSetupScreen.jsx`

## Phase 2: Wallet Import/Creation Flow

### Issues
- Feels slow during mnemonic generation
- No feedback during async operations
- No progress indication

### Solutions
1. **Progress Indicators**
   - Show animated loader during wallet creation
   - Progress steps for multi-step flows
   - Smooth transitions between steps

2. **Optimistic Updates**
   - Show UI immediately, verify in background
   - Smoother perceived performance

### Files to modify
- `hooks/useWalletCreation.js`
- `hooks/useWalletImport.js`

## Phase 3: Micro-interactions Throughout App

### Solutions
1. **Button Press Feedback**
   - All buttons get scale + haptic
   - Smooth spring animations
   - Proper activeOpacity values

2. **Card Interactions**
   - Asset cards scale slightly on press
   - Smooth navigation transitions
   - Haptic on card tap

3. **List Interactions**
   - Transaction items highlight on press
   - Smooth press states
   - Subtle animations

### Files to modify
- All TouchableOpacity → use consistent pattern
- Add haptic utility wrapper

## Implementation Strategy

### Step 1: Create Reusable Components
- `TouchableScale.jsx` - Button with scale animation
- `AnimatedPinDot.jsx` - Animated PIN dot
- `useHaptics.js` - Haptic feedback hook

### Step 2: Update PIN Screens
- Replace TouchableOpacity with TouchableScale
- Add haptic feedback to all interactions
- Animate PIN dots
- Add loading states

### Step 3: Polish Wallet Flows
- Add progress indicators
- Optimize async operations
- Better error states

### Step 4: Add Micro-interactions
- Update all high-traffic buttons
- Add haptics consistently
- Smooth transitions

## Performance Targets
- PIN keypad: < 16ms tap-to-feedback (60fps)
- Animations: All use useNativeDriver
- Haptics: < 50ms latency
- No jank during PIN entry
