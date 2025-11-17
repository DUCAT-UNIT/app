# Comprehensive Refactoring Plan

**Created:** 2025-11-17
**Status:** Planning Phase
**Estimated Timeline:** 6-8 weeks (phased approach)

---

## Executive Summary

This document outlines a systematic refactoring plan to address 89 identified code quality issues across the Ducat wallet codebase. The refactoring is organized into 6 phases, prioritized by impact and risk.

**Key Metrics:**
- Files requiring refactoring: 50+
- Lines of code to refactor: ~15,000+
- Oversized files: 22
- Dead code instances: 12
- Code duplication patterns: 30+

---

## Guiding Principles

1. **Incremental Changes**: Small, testable changes over big rewrites
2. **Maintain Functionality**: All tests must pass after each phase
3. **Zero Downtime**: Users should not experience any disruption
4. **Documentation First**: Update docs before code changes
5. **Test Coverage**: Maintain or improve test coverage throughout

---

## Phase 1: Foundation (Week 1-2)
**Goal:** Create reusable utilities and abstractions
**Risk Level:** Low
**Dependencies:** None

### 1.1 Create Missing Utility Modules

#### A. API Client Utility (`utils/apiClient.js`)
**Addresses:** Issues #35, #36, #37, #38, #82, #83

```javascript
// utils/apiClient.js
export class ApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = options.headers || {};
    this.retryConfig = options.retry || { maxRetries: 3, delay: 1000 };
  }

  async request(endpoint, options = {}) {
    // Unified fetch with retry logic
    // Response parsing
    // Error handling
  }

  async get(endpoint, params) { /* ... */ }
  async post(endpoint, data) { /* ... */ }
  async put(endpoint, data) { /* ... */ }
  async delete(endpoint) { /* ... */ }
}

export const createPaginatedRequest = (apiClient, endpoint) => {
  // Unified pagination logic
  return {
    fetchPage: async (page, limit) => { /* ... */ },
    fetchAll: async () => { /* ... */ }
  };
};
```

**Files to refactor after creation:**
- `services/vaultService.js` (lines 100-200)
- `services/transactionHistoryService.js` (lines 50-150)
- `services/airdropService.js` (lines 20-80)
- `services/balanceService.js` (lines 30-100)

**Testing:**
- Create `utils/__tests__/apiClient.test.js`
- Test retry logic, pagination, error handling
- Target: 90%+ coverage

---

#### B. Bitcoin Utilities Module (`utils/bitcoin/conversions.js`)
**Addresses:** Issues #54, #55, #56, #86

```javascript
// utils/bitcoin/conversions.js
export const satsToBTC = (sats) => {
  if (!sats || sats === 0) return '0';
  return (sats / 100000000).toFixed(8);
};

export const btcToSats = (btc) => {
  return Math.round(parseFloat(btc) * 100000000);
};

export const formatBTC = (sats, options = {}) => {
  const { showUnit = true, decimals = 8 } = options;
  const btc = satsToBTC(sats);
  return showUnit ? `${btc} BTC` : btc;
};

export const formatSats = (sats, options = {}) => {
  const { showUnit = true, abbreviated = false } = options;
  if (abbreviated && sats >= 1000000) {
    return `${(sats / 1000000).toFixed(2)}M sats`;
  }
  return showUnit ? `${sats.toLocaleString()} sats` : sats.toLocaleString();
};
```

**Files to refactor after creation:**
- `utils/formatters.js` (replace duplicated conversion logic)
- `components/BalanceDisplay.jsx`
- `screens/wallet/AssetDetailScreen.jsx`
- `screens/send/AmountInputScreen.jsx`
- All transaction-related components

**Testing:**
- Create `utils/bitcoin/__tests__/conversions.test.js`
- Test edge cases (0, negative, very large numbers)
- Target: 100% coverage

---

#### C. Formatting Utilities Module (`utils/formatters/index.js`)
**Addresses:** Issues #57, #58, #59, #60, #87

```javascript
// utils/formatters/addresses.js
export const truncateAddress = (address, start = 6, end = 4) => {
  if (!address || address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const truncateTxId = (txid, start = 8, end = 8) => {
  return truncateAddress(txid, start, end);
};

// utils/formatters/currency.js
export const formatFiat = (amount, currency = 'USD', locale = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatBalance = (balance, options = {}) => {
  if (balance === null || balance === undefined) return '—';
  // Unified null-safe formatting
};

// utils/formatters/index.js
export * from './addresses';
export * from './currency';
```

**Files to refactor after creation:**
- `utils/formatters.js` (consolidate logic)
- All screens displaying addresses/transactions
- All balance display components

**Testing:**
- Create comprehensive formatter tests
- Target: 100% coverage

---

#### D. Pagination Utility Hook (`utils/pagination.js`)
**Addresses:** Issues #36, #83

```javascript
// utils/pagination.js
export const usePagination = (fetchFunction, options = {}) => {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    // Unified pagination logic
  };

  const refresh = async () => {
    setPage(0);
    setData([]);
    setHasMore(true);
    await loadMore();
  };

  return { data, loadMore, refresh, loading, hasMore, error };
};
```

**Files to refactor after creation:**
- `services/vaultService.js`
- `services/transactionHistoryService.js`
- `hooks/useTransactionHistoryData.js`

---

#### E. Persisted State Hook (`hooks/usePersistedState.js`)
**Addresses:** Issues #43-48, #84

```javascript
// hooks/usePersistedState.js
export const usePersistedState = (key, defaultValue, options = {}) => {
  const { storage = AsyncStorage, serialize = JSON.stringify, deserialize = JSON.parse } = options;

  const [state, setState] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load from storage on mount
    const loadState = async () => {
      try {
        const value = await storage.getItem(key);
        if (value !== null) {
          setState(deserialize(value));
        }
      } catch (error) {
        logger.error(`Failed to load persisted state: ${key}`, error);
      } finally {
        setLoaded(true);
      }
    };
    loadState();
  }, [key]);

  useEffect(() => {
    // Save to storage on change
    if (!loaded) return;
    const saveState = async () => {
      try {
        await storage.setItem(key, serialize(state));
      } catch (error) {
        logger.error(`Failed to save persisted state: ${key}`, error);
      }
    };
    saveState();
  }, [state, key, loaded]);

  return [state, setState, loaded];
};
```

**Files to refactor after creation:**
- `hooks/useWalletCreation.js`
- `hooks/useWalletImport.js`
- `hooks/useSeedVerification.js`

---

#### F. Authenticated Toggle Hook (`hooks/useAuthenticatedToggle.js`)
**Addresses:** Issues #50, #51, #53, #88

```javascript
// hooks/useAuthenticatedToggle.js
export const useAuthenticatedToggle = (key, defaultValue = false, options = {}) => {
  const { requireAuth = true, onToggle } = options;
  const { authenticateUser } = useAuth();

  const [value, setValue, loaded] = usePersistedState(key, defaultValue, {
    storage: SecureStore,
    serialize: (v) => v.toString(),
    deserialize: (v) => v === 'true',
  });

  const toggle = async () => {
    if (requireAuth && !value) {
      // Enabling requires authentication
      const authenticated = await authenticateUser();
      if (!authenticated) return false;
    }

    const newValue = !value;
    setValue(newValue);

    if (onToggle) {
      await onToggle(newValue);
    }

    return true;
  };

  return [value, toggle, loaded];
};
```

**Files to refactor after creation:**
- `hooks/useAppSettings.js`
- `hooks/useAuthSettings.js`
- Settings-related components

---

#### G. Settings Service (`services/settingsService.js`)
**Addresses:** Issues #49, #52, #85

```javascript
// services/settingsService.js
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';

const SETTINGS_KEYS = {
  NOTIFICATIONS: 'notificationsEnabled',
  SHOW_ZERO_ASSETS: 'showZeroAssets',
  BIOMETRIC: 'biometricEnabled',
  // ... other settings
};

export const getSetting = async (key, defaultValue = null) => {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) return defaultValue;
    // Auto-parse booleans, numbers, JSON
    return parseSetting(value);
  } catch (error) {
    logger.error(`Failed to get setting: ${key}`, error);
    return defaultValue;
  }
};

export const setSetting = async (key, value) => {
  try {
    await SecureStore.setItemAsync(key, serializeSetting(value));
    return true;
  } catch (error) {
    logger.error(`Failed to set setting: ${key}`, error);
    return false;
  }
};

export const toggleSetting = async (key) => {
  const current = await getSetting(key, false);
  return await setSetting(key, !current);
};

export const getAllSettings = async () => {
  const settings = {};
  for (const [name, key] of Object.entries(SETTINGS_KEYS)) {
    settings[name] = await getSetting(key);
  }
  return settings;
};

export const SETTINGS_KEYS; // Export for use elsewhere
```

**Files to refactor after creation:**
- All hooks using SecureStore for settings
- Settings screens
- Context providers managing settings

---

### 1.2 Replace console.* with logger

**Addresses:** Issues #65-69

**Files to fix:**
1. `App.js` lines 43, 45
2. `PasskeyMigrationModal.jsx` line 43
3. `services/secureStorageService.js` lines 141, 183

**Changes:**
```javascript
// Before
console.log('message');
console.error('error');
console.warn('warning');

// After
logger.debug('message');
logger.error('error');
logger.warn('warning');
```

**Testing:**
- Verify logger captures all messages
- Check production builds don't log debug messages

---

### 1.3 Documentation Updates

**Create/Update:**
1. `docs/ARCHITECTURE.md` - Document new utilities
2. `docs/CODING_STANDARDS.md` - Update with new patterns
3. `docs/MIGRATION_GUIDE.md` - How to use new utilities

---

## Phase 2: Dead Code Removal (Week 2)
**Goal:** Remove unused code to reduce maintenance burden
**Risk Level:** Low
**Dependencies:** Phase 1 completion

### 2.1 Remove Unused Components

**Addresses:** Issue #23, #24

1. **Delete `components/Toast.jsx`**
   - Already replaced by ToastContainer
   - No imports found in codebase
   - Safe to remove

2. **Delete `screens/settings/PasskeyTestScreen.jsx`**
   - Marked as TEMPORARY
   - Development/testing only
   - Remove from navigation if registered

**Testing:**
- Full app test after removal
- Verify no broken imports

---

### 2.2 Remove Unused Service Functions

**Addresses:** Issues #25-32

**Functions to remove:**
1. `services/biometricService.js::checkBiometricLockout()` - Never imported
2. `services/biometricService.js::recordBiometricAttempt()` - Only internal
3. `services/passkeyService.js::getWalletCreationMethod()` - Exported but unused
4. `services/transactionCalculationService.js::fetchUtxosForAddress()` - Test-only
5. `services/transactionCalculationService.js::determineSourceAddress()` - Test-only
6. `services/transactionHistoryService.js::parseRuneTransfer()` - Test-only

**Process:**
1. Search for imports/usages
2. Move test-only functions to test files if needed
3. Remove unused exports
4. Update documentation

---

### 2.3 Clean Up Function Parameters

**Addresses:** Issues #32, #33

**Files to clean:**
- `pages/OnboardingPage.js` - Remove underscore-prefixed unused params
- `pages/WalletPage.js` - Remove underscore-prefixed unused params
- `hooks/useNotifications.js` - Remove unused notification callbacks

**Pattern:**
```javascript
// Before
function Component({ usedProp, _unusedProp }) {
  return <div>{usedProp}</div>;
}

// After
function Component({ usedProp }) {
  return <div>{usedProp}</div>;
}
```

---

### 2.4 Clean Up TODO/FIXME Comments

**Addresses:** Issues #70-77

**Process for each TODO:**
1. Evaluate if still relevant
2. Create GitHub issue if actionable
3. Remove comment and reference issue
4. Remove if no longer relevant

**Files to review:**
- `useNotifications.js:28`
- `OnboardingPage.js:78`
- `TransactionExecutionContext.js:106`
- `App.js:95`
- `airdropService.js:8`
- `useWalletCreation.js`
- `spacing.js`
- `secureStorageService.js`

---

## Phase 3: Code Duplication Elimination (Week 3-4)
**Goal:** DRY up codebase using Phase 1 utilities
**Risk Level:** Medium
**Dependencies:** Phase 1, 2 completion

### 3.1 Refactor API & Network Code

**Addresses:** Issues #35-38

**Use new `utils/apiClient.js`:**

1. **Refactor `services/vaultService.js`**
   ```javascript
   // Before: Custom fetch with retry (50+ lines)
   const response = await fetch(url, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(data)
   });
   // ... retry logic

   // After: Use ApiClient (5 lines)
   const client = new ApiClient(VAULT_API_URL);
   const response = await client.post('/endpoint', data);
   ```

2. **Refactor `services/transactionHistoryService.js`**
   - Replace pagination logic with `usePagination` hook
   - Replace fetch logic with `apiClient`

3. **Refactor `services/airdropService.js`**
   - Replace fetch with `apiClient.post()`

4. **Refactor `services/balanceService.js`**
   - Replace fetch with `apiClient.get()`

**Testing:**
- Integration tests for each service
- Verify retry behavior unchanged
- Verify pagination behavior unchanged

---

### 3.2 Refactor Bitcoin Formatting

**Addresses:** Issues #54-60

**Use new `utils/bitcoin/conversions.js` and `utils/formatters/`:**

**Files to refactor:**
1. `utils/formatters.js` - Remove duplicated logic, import from new modules
2. `components/BalanceDisplay.jsx` - Use `formatBTC()`
3. `screens/wallet/AssetDetailScreen.jsx` - Use formatting utilities
4. `screens/send/AmountInputScreen.jsx` - Use conversion utilities
5. All transaction components - Use `truncateTxId()`, `truncateAddress()`

**Pattern:**
```javascript
// Before (duplicated 6+ times)
const btc = (sats / 100000000).toFixed(8);

// After
import { formatBTC } from '../utils/bitcoin/conversions';
const btc = formatBTC(sats);
```

**Testing:**
- Visual regression tests for UI components
- Unit tests for all formatting functions

---

### 3.3 Refactor State Persistence

**Addresses:** Issues #43-48

**Use new `hooks/usePersistedState.js`:**

**Files to refactor:**
1. `hooks/useWalletCreation.js`
   ```javascript
   // Before: Manual AsyncStorage (30+ lines)
   useEffect(() => {
     const loadState = async () => {
       const saved = await AsyncStorage.getItem('key');
       if (saved) setState(JSON.parse(saved));
     };
     loadState();
   }, []);

   useEffect(() => {
     AsyncStorage.setItem('key', JSON.stringify(state));
   }, [state]);

   // After: usePersistedState (1 line)
   const [state, setState] = usePersistedState('key', defaultValue);
   ```

2. `hooks/useWalletImport.js` - Replace AsyncStorage logic
3. `hooks/useSeedVerification.js` - Replace AsyncStorage logic

**Testing:**
- Verify state persists across app restarts
- Test migration from old storage format

---

### 3.4 Refactor Settings Management

**Addresses:** Issues #49-53

**Use new `hooks/useAuthenticatedToggle.js` and `services/settingsService.js`:**

**Files to refactor:**
1. `hooks/useAppSettings.js`
   ```javascript
   // Before: Manual SecureStore + auth (50+ lines per setting)
   const [notifications, setNotifications] = useState(false);

   const toggleNotifications = async () => {
     const auth = await authenticateUser();
     if (!auth) return;
     const newValue = !notifications;
     await SecureStore.setItemAsync('notificationsEnabled', newValue.toString());
     setNotifications(newValue);
   };

   // After: useAuthenticatedToggle (2 lines)
   const [notifications, toggleNotifications] = useAuthenticatedToggle(
     'notificationsEnabled',
     false
   );
   ```

2. `hooks/useAuthSettings.js` - Replace with `useAuthenticatedToggle`

**Testing:**
- Verify authentication still required for toggles
- Test all settings persist correctly

---

### 3.5 Consolidate Error Handling

**Addresses:** Issues #39-42

**Create `utils/errorHandling.js`:**
```javascript
// utils/errorHandling.js
export const withErrorHandling = (fn, options = {}) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const { fallback, onError, silent = false } = options;

      if (!silent) {
        logger.error(`Error in ${fn.name}`, { error: error.message });
      }

      if (onError) {
        onError(error);
      }

      return fallback;
    }
  };
};

export const safeGet = (obj, path, defaultValue = null) => {
  try {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};
```

**Pattern:**
```javascript
// Before (duplicated 100+ times)
try {
  const result = await someOperation();
  return result;
} catch (error) {
  logger.error('Error', error);
  return null;
}

// After
const safeOperation = withErrorHandling(someOperation, { fallback: null });
const result = await safeOperation();
```

---

## Phase 4: File Size Reduction (Week 4-5)
**Goal:** Break oversized files into manageable pieces
**Risk Level:** Medium-High
**Dependencies:** Phase 1-3 completion

### 4.1 Split `services/passkeyService.js` (1,137 lines → 300 lines max)

**Addresses:** Issue #6

**New structure:**
```
services/passkey/
├── index.js                    # Main exports (50 lines)
├── passkeyCore.js              # Core passkey operations (250 lines)
├── passkeyEncryption.js        # Encryption/decryption (200 lines)
├── passkeyRecovery.js          # Recovery flows (200 lines)
├── passkeyStorage.js           # Storage operations (150 lines)
├── passkeyMigration.js         # Migration utilities (150 lines)
└── __tests__/
    ├── passkeyCore.test.js
    ├── passkeyEncryption.test.js
    └── passkeyRecovery.test.js
```

**Split strategy:**
1. `passkeyCore.js` - `isPasskeySupported()`, `createWalletWithPasskey()`, credential creation
2. `passkeyEncryption.js` - `deriveEncryptionKey()`, `encryptMnemonic()`, `decryptMnemonic()`
3. `passkeyRecovery.js` - `recoverWithPasskey()`, `unlockWithPasskey()`
4. `passkeyStorage.js` - `clearPasskeyData()`, storage key management
5. `passkeyMigration.js` - `addPasskeyToExistingWallet()`, `atomicPinChangeWithPasskey()`

**Testing:**
- All existing tests must pass
- Add integration tests for module interactions

---

### 4.2 Split `screens/wallet/AssetDetailScreen.jsx` (883 lines → 400 lines)

**Addresses:** Issue #7

**New structure:**
```
screens/wallet/AssetDetailScreen/
├── index.jsx                          # Main component (150 lines)
├── components/
│   ├── AssetHeader.jsx                # Balance, price info (100 lines)
│   ├── AssetActions.jsx               # Send/Receive buttons (80 lines)
│   ├── TransactionList.jsx            # Transaction history (150 lines)
│   ├── TransactionItem.jsx            # Individual transaction (100 lines)
│   └── AssetDetailsModal.jsx          # Details modal (100 lines)
└── hooks/
    ├── useAssetData.js                # Data fetching logic (100 lines)
    └── useAssetActions.js             # Action handlers (80 lines)
```

**Testing:**
- Visual regression tests
- Interaction tests for all actions

---

### 4.3 Split `pages/OnboardingPage.js` (641 lines → eliminate)

**Addresses:** Issue #3, #9

**Strategy: Eliminate pages layer entirely**

**New structure:**
```
App.js (or navigation stack) directly renders:
- screens/auth/WelcomeScreen.jsx
- screens/auth/PinSetupScreen.jsx
- screens/auth/LockScreen.jsx
```

**Migration:**
1. Move hook composition into appropriate screens
2. Move shared logic to context or hooks
3. Remove OnboardingPage.js entirely
4. Update navigation to render screens directly

**Testing:**
- Full authentication flow testing
- Ensure all onboarding paths work

---

### 4.4 Split `pages/WalletPage.js` (500 lines → eliminate)

**Addresses:** Issue #4, #11

**Strategy: Eliminate pages layer entirely**

**New structure:**
```
App.js (or navigation stack) directly renders:
- screens/wallet/WalletScreen.jsx
- screens/wallet/AssetDetailScreen.jsx
- screens/send/* screens
- screens/receive/* screens
```

**Migration:**
1. Move TabNav logic to navigation layer
2. Move shared state to contexts
3. Remove WalletPage.js
4. Update navigation

**Testing:**
- Full wallet flow testing
- Tab navigation testing

---

### 4.5 Split Large Style Files

**Addresses:** Issue #2, #8, #12, #13, #14, #17

**Current anti-pattern:**
```
styles/
├── common.js (650 lines)
├── auth.js (489 lines)
├── wallet.js (450 lines)
├── send.js (389 lines)
└── ...
```

**New pattern (component-scoped styles):**
```
screens/auth/WelcomeScreen/
├── index.jsx
└── styles.js                # Only WelcomeScreen styles

components/BalanceCard/
├── index.jsx
└── styles.js                # Only BalanceCard styles
```

**Migration process:**
1. Create component-scoped style files
2. Move relevant styles from global files
3. Remove unused global styles
4. Delete global style files when empty

**Testing:**
- Visual regression testing
- Verify no broken style references

---

### 4.6 Split Other Oversized Files

**Quick wins (lower priority):**

1. `PasskeyTestScreen.jsx` (546 lines) - **Delete** (marked TEMPORARY)
2. `SecurityIcons.jsx` (453 lines) - Split into individual icon components
3. `WelcomeScreen.jsx` (441 lines) - Extract sub-components
4. `NavigationIcons.jsx` (408 lines) - Split into individual icon components
5. `AmountInputScreen.jsx` (368 lines) - Extract input logic to hook
6. `runesTransaction.js` (358 lines) - Split into modules
7. `AirdropContext.js` (345 lines) - Split state/actions
8. `PendingTransactionsContext.js` (320 lines) - Split state/actions
9. `InputOutputList.jsx` (313 lines) - Extract list items

---

## Phase 5: Architectural Fixes (Week 5-6)
**Goal:** Fix architectural violations
**Risk Level:** High
**Dependencies:** Phase 1-4 completion

### 5.1 Eliminate Pages Layer

**Addresses:** Issue #1, #3, #4

**Current structure:**
```
pages/
├── OnboardingPage.js  # Orchestration layer (unnecessary)
└── WalletPage.js      # Orchestration layer (unnecessary)
```

**Target structure:**
```
App.js → Navigation → Screens (direct)
```

**Migration steps:**
1. Move all logic from pages to screens or contexts
2. Update App.js navigation to render screens directly
3. Delete `pages/` directory
4. Update all imports

**Testing:**
- Full app navigation testing
- Authentication flow testing
- State management testing

---

### 5.2 Consolidate Global Styles

**Addresses:** Issue #2

**Before:**
```
styles/
├── index.js (exports everything)
├── common.js
├── auth.js
├── wallet.js
├── send.js
├── receive.js
├── settings.js
├── transaction.js
└── spacing.js
```

**After:**
```
styles/
└── theme.js  # Only theme constants (colors, spacing, typography)

# All other styles moved to component-scoped files
```

**Migration:**
1. Phase 4.5 moves styles to components
2. Keep only theme constants in global styles
3. Delete empty global style files

---

### 5.3 Fix File Location Issues

**Addresses:** Issue #5

**Move:**
- `runestone-encoder.js` (root) → `utils/bitcoin/runestone-encoder.js`

**Rationale:**
- Bitcoin-specific utility
- Should be in utils directory
- Better discoverability

---

### 5.4 Establish Consistent Export Pattern

**Addresses:** Issue #80

**New standard:**
- **Components:** Named exports (for better tree-shaking)
- **Utilities:** Named exports
- **Services:** Named exports
- **Hooks:** Named exports
- **Contexts:** Named export for context, named export for provider
- **Screens:** Default export is acceptable (for lazy loading)

**Migration:**
```javascript
// Before (mixed)
export default function Component() { }
export { Component };

// After (consistent)
// For components/utils/services/hooks:
export function Component() { }

// For screens (lazy loading):
export default function Screen() { }
```

---

### 5.5 Consistent File Naming

**Addresses:** Issue #81

**Standard:**
- Components: PascalCase (e.g., `BalanceCard.jsx`)
- Screens: PascalCase (e.g., `WalletScreen.jsx`)
- Utilities: camelCase (e.g., `formatters.js`)
- Services: camelCase (e.g., `authService.js`)
- Hooks: camelCase (e.g., `useWallet.js`)
- Tests: Match source file (e.g., `BalanceCard.test.jsx`)

**Migration:**
- Audit all files
- Rename inconsistent files
- Update all imports

---

## Phase 6: Style Consolidation (Week 6-7)
**Goal:** Complete style refactoring
**Risk Level:** Medium
**Dependencies:** Phase 4, 5 completion

### 6.1 Component-Scoped Styles Migration

**Addresses:** Issues #2, #61-64, #78

**Pattern:**
```
components/MyComponent/
├── index.jsx          # Component logic
├── styles.js          # Component-specific styles
└── MyComponent.test.jsx
```

**Process for each component:**
1. Create `styles.js` in component directory
2. Move relevant styles from global files
3. Remove unused/duplicate styles
4. Update imports in component
5. Delete from global styles when all moved

**Priority order:**
1. Most-used components first (BalanceCard, TransactionItem, etc.)
2. Screen components
3. Utility components

---

### 6.2 Eliminate Style Duplication

**Addresses:** Issues #61-64

**Common patterns to consolidate:**

1. **Modal Overlay Styles** (duplicated 4+ times)
   ```javascript
   // Before: Duplicated in 4 files
   modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'center',
     alignItems: 'center',
   }

   // After: Single source in theme
   import { MODAL_STYLES } from '../theme';
   ```

2. **Button Styles** (duplicated across files)
   - Create `theme/buttonStyles.js`
   - Export standard button variants
   - Use throughout app

3. **Card Styles** (duplicated across files)
   - Create `theme/cardStyles.js`
   - Export standard card variants

---

### 6.3 Theme System

**Create comprehensive theme:**

```javascript
// theme/index.js
export const COLORS = { /* ... */ };
export const SPACING = { /* ... */ };
export const TYPOGRAPHY = { /* ... */ };
export const SHADOWS = { /* ... */ };
export const BORDER_RADIUS = { /* ... */ };

// theme/commonStyles.js
export const BUTTON_STYLES = {
  primary: { /* ... */ },
  secondary: { /* ... */ },
  danger: { /* ... */ },
};

export const CARD_STYLES = {
  default: { /* ... */ },
  elevated: { /* ... */ },
};

export const MODAL_STYLES = {
  overlay: { /* ... */ },
  container: { /* ... */ },
  content: { /* ... */ },
};

export const INPUT_STYLES = { /* ... */ };
```

**Usage:**
```javascript
import { BUTTON_STYLES, COLORS } from '../../theme';

const styles = StyleSheet.create({
  button: {
    ...BUTTON_STYLES.primary,
    marginTop: 20,
  }
});
```

---

## Phase 7: Documentation & Polish (Week 7-8)
**Goal:** Document changes and finalize
**Risk Level:** Low
**Dependencies:** All previous phases

### 7.1 Update Architecture Documentation

**Create/Update:**
1. `docs/ARCHITECTURE.md`
   - New directory structure
   - Component organization patterns
   - State management patterns
   - Utility usage guidelines

2. `docs/CODING_STANDARDS.md`
   - File naming conventions
   - Export patterns
   - Style organization
   - Testing requirements

3. `docs/COMPONENT_GUIDELINES.md`
   - When to split components
   - File size limits
   - Component structure
   - Style organization

4. `docs/UTILITY_GUIDE.md`
   - Available utilities
   - Usage examples
   - When to create new utilities

---

### 7.2 Create Migration Guides

**For developers:**
1. `docs/MIGRATION_GUIDE.md`
   - Old → New patterns
   - Import path changes
   - Breaking changes
   - Code examples

2. `docs/REFACTORING_SUMMARY.md`
   - What changed and why
   - Performance improvements
   - Bundle size impact
   - Before/after metrics

---

### 7.3 Update Tests

**Ensure:**
- All tests pass
- Test coverage maintained or improved
- New utilities have >90% coverage
- Integration tests for major flows

---

### 7.4 Performance Audit

**Measure:**
- Bundle size (before/after)
- Component render counts
- Memory usage
- App startup time

**Target improvements:**
- 10-20% bundle size reduction (from removing duplication)
- Faster component mounting (from smaller files)
- Better tree-shaking (from named exports)

---

### 7.5 Final Cleanup

**Review:**
- No console.* statements
- No TODO comments without issues
- No dead code
- No unused imports
- Consistent formatting

**Tools:**
- ESLint with strict rules
- Prettier for formatting
- Bundle analyzer
- Test coverage reporter

---

## Success Metrics

### Code Quality
- [ ] All files under 400 lines (screens) / 300 lines (others)
- [ ] Zero console.* usage (use logger)
- [ ] Zero dead code
- [ ] <5% code duplication (down from ~30%)
- [ ] All TODOs have GitHub issues

### Architecture
- [ ] Pages layer eliminated
- [ ] Global styles eliminated (except theme)
- [ ] All utilities in proper directories
- [ ] Consistent file naming

### Testing
- [ ] All tests passing
- [ ] >80% code coverage maintained
- [ ] New utilities >90% covered
- [ ] Integration tests for major flows

### Performance
- [ ] 10-20% bundle size reduction
- [ ] No regression in app performance
- [ ] Faster component mounting

### Documentation
- [ ] Architecture docs updated
- [ ] Coding standards documented
- [ ] Migration guide complete
- [ ] All new utilities documented

---

## Risk Mitigation

### High-Risk Changes
- Pages layer elimination (Phase 5)
- Large file splits (Phase 4)

**Mitigation:**
1. Create feature branch per phase
2. Extensive testing before merge
3. Incremental rollout
4. Easy rollback plan

### Medium-Risk Changes
- Code duplication elimination (Phase 3)
- Style consolidation (Phase 6)

**Mitigation:**
1. Maintain parallel implementations temporarily
2. Gradual migration
3. Visual regression testing

### Low-Risk Changes
- Dead code removal (Phase 2)
- Console.log replacement (Phase 1)
- Documentation (Phase 7)

**Mitigation:**
1. Standard testing process
2. Quick rollback if needed

---

## Timeline Summary

| Phase | Duration | Risk | Start | End |
|-------|----------|------|-------|-----|
| Phase 1: Foundation | 2 weeks | Low | Week 1 | Week 2 |
| Phase 2: Dead Code | 1 week | Low | Week 2 | Week 2 |
| Phase 3: Duplication | 2 weeks | Medium | Week 3 | Week 4 |
| Phase 4: File Size | 2 weeks | Medium-High | Week 4 | Week 5 |
| Phase 5: Architecture | 2 weeks | High | Week 5 | Week 6 |
| Phase 6: Styles | 1 week | Medium | Week 6 | Week 7 |
| Phase 7: Polish | 1 week | Low | Week 7 | Week 8 |

**Total: 8 weeks (2 months)**

---

## Execution Strategy

### Weekly Cadence
- **Monday:** Plan week's tasks
- **Tuesday-Thursday:** Implementation
- **Friday:** Testing, code review, merge
- **Weekend:** Buffer for complex issues

### Daily Process
1. Write tests first (TDD)
2. Implement changes
3. Run full test suite
4. Update documentation
5. Create PR with detailed description

### Review Process
1. Self-review checklist
2. Automated tests (CI)
3. Code review by team
4. Manual testing
5. Merge to main

---

## Appendix A: File Size Targets

| File Type | Max Lines | Current Largest | Target |
|-----------|-----------|-----------------|--------|
| Services | 300 | 1,137 (passkeyService) | 250 |
| Screens | 400-500 | 883 (AssetDetailScreen) | 350 |
| Components | 200 | 453 (SecurityIcons) | 150 |
| Hooks | 200 | 345 (AirdropContext) | 180 |
| Utilities | 300 | 650 (common styles) | ELIMINATE |

---

## Appendix B: Code Duplication Examples

### Before
```javascript
// In 6 different files:
const btc = (sats / 100000000).toFixed(8);

// In 5 different services:
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
if (!response.ok) {
  throw new Error('Request failed');
}
const json = await response.json();

// In 3 different hooks:
useEffect(() => {
  const load = async () => {
    const saved = await AsyncStorage.getItem(key);
    if (saved) setState(JSON.parse(saved));
  };
  load();
}, []);

useEffect(() => {
  AsyncStorage.setItem(key, JSON.stringify(state));
}, [state]);
```

### After
```javascript
// One place:
import { formatBTC } from '../utils/bitcoin/conversions';
const btc = formatBTC(sats);

// One place:
import { apiClient } from '../utils/apiClient';
const data = await apiClient.post(url, body);

// One place:
import { usePersistedState } from '../hooks/usePersistedState';
const [state, setState] = usePersistedState(key, defaultValue);
```

---

## Appendix C: Quick Reference - New Utilities

### API & Network
- `utils/apiClient.js` - Unified API client with retry
- `utils/pagination.js` - Reusable pagination hook

### Bitcoin
- `utils/bitcoin/conversions.js` - Sats/BTC conversion
- `utils/bitcoin/formatters.js` - Bitcoin formatting

### Formatting
- `utils/formatters/addresses.js` - Address truncation
- `utils/formatters/currency.js` - Fiat formatting

### State Management
- `hooks/usePersistedState.js` - AsyncStorage hook
- `hooks/useAuthenticatedToggle.js` - Secure toggle hook
- `services/settingsService.js` - Settings management

### Error Handling
- `utils/errorHandling.js` - Unified error handling

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize phases** based on team capacity
3. **Create GitHub project** with all tasks
4. **Assign owners** for each phase
5. **Set up automation** (CI/CD, linting, testing)
6. **Begin Phase 1** (Foundation)

---

**Document Status:** ✅ Complete
**Last Updated:** 2025-11-17
**Next Review:** Start of each phase
