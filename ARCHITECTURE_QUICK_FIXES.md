# QUICK REFERENCE: Top 10 Code Quality Issues

## Issue #1: styles.js is 2,494 lines (MASSIVE)
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/styles.js`

**Problem:** Every screen's styles mixed together. Impossible to maintain.

**Quick Fix:**
```bash
# Create styles directory structure
mkdir -p styles
touch styles/{common,splash,wallet,send,receive,settings,animations}.js

# Move styles by feature (e.g., splash styles to styles/splash.js)
# Update imports throughout app
```

**Estimated Effort:** 4 hours
**Impact:** Major - ease of maintenance

---

## Issue #2: WalletDataContext exports 30+ values (GOD OBJECT)
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/contexts/WalletDataContext.js` (202 lines)

**Problem:** Any change causes all consumers to re-render.

**Quick Fix:**
```javascript
// Split into three separate hooks:
export const useBalance = () => { /* balance state only */ };
export const useTransactionHistory = () => { /* history state only */ };
export const useVaultData = () => { /* vault state only */ };

// Keep WalletDataContext but have it compose above three
```

**Estimated Effort:** 3 hours
**Impact:** Major - prevents re-render storms

---

## Issue #3: useAuth.js is 258 lines with 60+ useState calls
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/hooks/useAuth.js`

**Problem:** Mixing 7 different auth concerns (biometric, passkey, PIN, etc.)

**Quick Fix:**
```javascript
// Split into:
// - useBiometricAuth.js (biometric state)
// - usePasskeyAuth.js (passkey state)
// - usePinAuth.js (PIN state)
// - useAuthFlow.js (orchestrate above)

// Then useAuth becomes:
export function useAuth() {
  const biometric = useBiometricAuth();
  const passkey = usePasskeyAuth();
  const pin = usePinAuth();
  
  return useMemo(() => ({ biometric, passkey, pin, ... }), [/* deps */]);
}
```

**Estimated Effort:** 5 hours
**Impact:** Major - reduces complexity

---

## Issue #4: AssetDetailScreen is 892 lines (GOD COMPONENT)
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/screens/wallet/AssetDetailScreen.jsx`

**Quick Fix - Extract price fetching:**
```javascript
// Move price logic to hook
// hooks/usePriceData.js
export function usePriceData(assetType, timeframe) {
  const [priceData, setPriceData] = useState(null);
  // fetching logic here
  return { priceData, loading, error };
}

// Then in AssetDetailScreen:
const { priceData } = usePriceData(assetType, selectedTimeframe);
// Much simpler component
```

**Estimated Effort:** 3 hours
**Impact:** Medium - improves readability

---

## Issue #5: passkeyService.js is 1,106 lines (MONOLITH)
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/services/passkeyService.js`

**Problem:** WebAuthn + crypto + iCloud storage + state management all mixed

**Quick Fix:**
```
passkeyService/
├── index.js (public API only)
├── webauthn.js (Passkey.createCredential, etc)
├── crypto.js (encryption key derivation, encrypt/decrypt)
├── icloud.js (iCloud storage)
└── utils.js (shared utilities)
```

**Estimated Effort:** 4 hours
**Impact:** Medium - improves maintainability

---

## Issue #6: NavigationHandlersContext is 272 lines (KITCHEN SINK)
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/contexts/NavigationHandlersContext.js`

**Problem:** Combines auth, settings, account switching, passkey migration

**Quick Fix:**
```javascript
// Extract:
// - AccountSwitcherContext.js
// - SettingsContext.js
// - PasskeyMigrationContext.js

// NavigationHandlersContext becomes thin wrapper orchestrating above
```

**Estimated Effort:** 3 hours
**Impact:** Medium - better separation

---

## Issue #7: ReceiveScreen has 11 props (PROP DRILLING)
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/screens/wallet/ReceiveScreen.jsx`

**Problem:** Passing `showToast` as prop when `useToastContext()` exists

**Quick Fix:**
```javascript
// Before:
function ReceiveScreen({ showToast, segwitAddress, ... }) {
  Clipboard.setString(address);
  showToast(`Address copied`);
}

// After:
function ReceiveScreen({ segwitAddress, ... }) {
  const { showToast } = useToastContext();
  Clipboard.setString(address);
  showToast(`Address copied`);
}
```

**Estimated Effort:** 1 hour
**Impact:** Low - but improves consistency

---

## Issue #8: Repeated balance calculation logic (CODE DUPLICATION)
**Locations:** 
- `AssetDetailScreen.jsx` line 82
- `AmountInputScreen.jsx` line 39-42
- `WalletScreen.jsx` (via hook)

**Problem:** Same logic repeated 3+ times, different implementations

**Quick Fix:**
```javascript
// Create: hooks/useAssetBalance.js
export function useAssetBalance(assetType) {
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  
  return useMemo(() => {
    if (assetType === 'btc') {
      return segwitBalance + taprootBalance;
    }
    return runesBalance?.[0]?.[1] ? parseFloat(runesBalance[0][1]) : 0;
  }, [segwitBalance, taprootBalance, runesBalance]);
}

// Use everywhere:
const btcBalance = useAssetBalance('btc');
const unitBalance = useAssetBalance('unit');
```

**Estimated Effort:** 1 hour
**Impact:** Medium - single source of truth

---

## Issue #9: UIContext mixes 3 concerns (MIXED CONCERNS)
**Location:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/contexts/UIContext.js`

**Problem:** Display preferences + toast + snackbar in one context

**Quick Fix:**
```javascript
// Split into:
// - DisplayPreferencesContext.js (showTotalInBTC, etc)
// - NotificationContext.js (showToast, showSnackbar)

// Update App.js:
// Before:
<UIProvider>

// After:
<DisplayPreferencesProvider>
  <NotificationProvider>
```

**Estimated Effort:** 2 hours
**Impact:** Medium - prevents unnecessary re-renders

---

## Issue #10: 36 hooks, many >150 lines (HOOK EXPLOSION)
**Locations:** `/Users/lucasrodriguez/Desktop/Ducat/app/app/hooks/`

**Problem:** Complex hooks mixing UI + business logic

**Examples:**
- `useVaultWebView.js` (285) - WebView message handling
- `useWalletCreation.js` (192) - Creation flow
- `useSeedVerification.js` (189) - Seed verification

**Quick Fix Strategy:**
1. Extract business logic to services
2. Keep hooks for state management only
3. Hooks should be <100 lines when possible

**Estimated Effort:** 8 hours (ongoing)
**Impact:** Major - reduces complexity

---

## IMPLEMENTATION PRIORITY

### Week 1 (Quick wins - low risk)
1. Fix prop drilling in ReceiveScreen (1 hour)
2. Extract balance calculation utility (1 hour)
3. Remove PasskeyTestScreen from production (15 min)

### Week 2 (High impact - medium risk)
4. Split WalletDataContext (3 hours)
5. Extract styles.js (4 hours)
6. Split UIContext (2 hours)

### Week 3 (Complex refactoring - higher risk)
7. Break apart useAuth.js (5 hours)
8. Split NavigationHandlersContext (3 hours)
9. Consolidate transaction services (5 hours)

### Week 4+ (Large refactoring)
10. Extract passkeyService modules (4 hours)
11. Simplify large components (8+ hours)
12. Consolidate 36 hooks (ongoing)

---

## TESTING APPROACH

After each refactor:
```bash
# 1. Run lint
npm run lint

# 2. Run unit tests
npm test

# 3. Manual smoke tests:
#    - Can authenticate?
#    - Can send BTC?
#    - Can receive BTC?
#    - Can open vault?
#    - Settings still work?
#    - Can switch accounts?
```

---

## SUCCESS METRICS

- Reduce average file size from 300 lines to <150
- Reduce average hook size from 110 lines to <80
- Eliminate eslint-disable comments for hook deps
- Components have max 5 context subscriptions
- No more than 2 useState per component
