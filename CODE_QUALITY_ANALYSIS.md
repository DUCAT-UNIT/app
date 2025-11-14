# React Native Bitcoin Wallet - Code Quality & Architecture Analysis

## Executive Summary

This is a sophisticated React Native Bitcoin wallet (~22K LOC) that manages BTC and Runes transactions on Mutinynet. The codebase demonstrates solid foundational patterns with excellent separation of concerns and context-based state management, but shows signs of complexity growth and some architectural inconsistencies that will impact long-term maintainability.

**Overall Assessment: GOOD with CONCERNS**

---

## 1. Code Organization & Structure

### Strengths

1. **Clear Feature-Based Organization**
   - Well-separated concerns: contexts, services, hooks, components, utils, navigation
   - 14+ specialized contexts for different domains (Auth, Wallet, Transaction, UI, etc.)
   - Services properly isolated from UI logic (19 service files)
   - 37+ custom hooks extracting component logic

2. **Modular Services Architecture**
   - Transaction service split into focused modules (btc, runes, utxo selection)
   - Clear separation: signing, broadcasting, history, balance services
   - Backward compatibility maintained with deprecation patterns
   - Good domain boundaries

3. **Comprehensive Test Coverage**
   - 98 test files across contexts, hooks, services, utils
   - Jest configured with 70% statement coverage threshold
   - Tests for critical paths (wallet operations, transactions, auth)

### Weaknesses

1. **Context Proliferation (Mild)**
   ```
   - 14 context files (2,152 LOC total)
   - PendingTransactionsContext: 292 LOC
   - TransactionExecutionContext: 270 LOC  
   - NavigationHandlersContext: 244 LOC
   - UIContext: 204 LOC
   ```
   **Issue**: Multiple contexts are approaching or exceeding 200-300 LOC limits, violating stated architectural standards (<300 LOC target)

2. **Hook File Size Variance**
   ```
   - useVaultWebView: 265 LOC (exceeds 200-line standard)
   - useAuth: 215 LOC
   - useWalletCreation: 192 LOC
   - useSeedVerification: 189 LOC
   - useSettingsNavigation: 177 LOC
   ```
   **Issue**: 5+ hooks exceed recommended sizes; high complexity in auth-related hooks

3. **Service File Organization**
   ```
   - transactionHistoryService: 285 LOC (exceeds 300-line domain standard)
   - vaultService: 212 LOC
   - transactionSigningService: 201 LOC
   - psbtService: 200 LOC
   ```
   **Issue**: Some services are complex; could benefit from further modularization

---

## 2. React Best Practices

### Strengths

1. **Excellent Hook Usage Patterns**
   - Consistent use of useCallback, useMemo for performance optimization
   - Proper cleanup in useEffect (setInterval/setTimeout clearing)
   - useContext patterns with proper error boundaries (`if (!context) throw new Error(...)`)
   - Custom hooks follow React naming conventions

2. **Proper Context Implementation**
   ```javascript
   export const useWallet = () => {
     const context = useContext(WalletContext);
     if (!context) {
       throw new Error('useWallet must be used within a WalletProvider');
     }
     return context;
   };
   ```
   - Guards prevent context usage errors
   - Proper memoization prevents unnecessary re-renders
   - Clear dependency arrays in useMemo/useCallback

3. **ErrorBoundary Component**
   - Implemented as class component (correct pattern)
   - Catches child errors with fallback UI
   - Dev-only error details display
   - Proper PropTypes documentation

### Weaknesses

1. **Excessive State in useAuth Hook**
   ```javascript
   const [isAuthenticated, setIsAuthenticated] = useState(false);
   const [isBiometricSupported, setIsBiometricSupported] = useState(false);
   const [biometricEnabled, setBiometricEnabled] = useState(false);
   const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
   const [showFaceIdButton, setShowFaceIdButton] = useState(true);
   const [settingUpPin, setSettingUpPin] = useState(false);
   const [changingPin, setChangingPin] = useState(false);
   const [showPinEntry, setShowPinEntry] = useState(false);
   const [pin, setPin] = useState('');
   const [confirmPin, setConfirmPin] = useState('');
   const [pinError, setPinError] = useState('');
   const [pinStep, setPinStep] = useState('enter');
   ```
   **Issue**: 12 state variables violates hard limit of 12; should use useReducer or split hook

2. **Deep Dependency Arrays**
   ```javascript
   const memoizedValue = useMemo(
     () => ({...}),
     [
       isAuthenticated, isBiometricSupported, biometricEnabled, showBiometricPrompt,
       showFaceIdButton, settingUpPin, changingPin, showPinEntry, pin, confirmPin,
       pinError, pinStep, authenticateUser, handlePinSetupComplete, 
       handlePinChangeComplete, handleLockScreenAuthenticated, loadBiometricPreference,
       lock, resetAuth, startPinChange
     ]
   );
   ```
   **Issue**: 20+ dependency array items creates fragile optimization

3. **Mixed Concerns in Contexts**
   - AuthContext combines authentication AND onboarding flow state
   - UIContext handles both display preferences AND notifications
   - TransactionBuildContext depends on SendFlowContext tightly

---

## 3. State Management Patterns

### Architecture

The app uses Context API with the following hierarchy:

```
App
├── AuthProvider (auth + onboarding state)
├── WalletProvider (wallet addresses, account switching)
├── UIProvider (display prefs + toasts + snackbars)
└── AppProviders (conditional)
    ├── PendingTransactionsProvider (UTXO tracking)
    ├── WalletDataProvider (balance + history + vault data)
    └── PriceProvider (price feeds)
```

### Strengths

1. **Clear Dependency Graph**
   - Data flows from top-level contexts down through providers
   - PendingTransactionsContext properly placed above WalletDataProvider (data dependency)
   - Separation between auth state and wallet state

2. **Memoization Discipline**
   - Context values consistently memoized
   - Prevents child re-renders from parent updates
   - useMemo used for computed values

3. **Backwards Compatibility**
   - Old hook names maintained alongside new namespaced exports
   - useBalance(), useTransactionHistory() proxy to useWalletData()
   - Smooth refactoring path

### Weaknesses

1. **Context Interdependencies (Risk)**
   - TransactionBuildContext → SendFlowContext → (form state)
   - TransactionExecutionContext → TransactionBuildContext → TransactionExecutionContext (circular reference risk)
   - PendingTransactionsContext used by both WalletDataProvider and TransactionExecutionContext
   
   **Issue**: Complex dependency chain makes reasoning about data flow difficult

2. **Mixed Data & Function Contexts**
   - NavigationHandlersContext stores both state refs AND functions
   - UIContext manages both UI preferences AND notifications
   - Makes it harder to test and reason about

3. **Callback Prop Drilling**
   ```javascript
   <PendingTransactionsProvider 
     currentAccount={currentAccount} 
     showToast={showToast}
   >
   ```
   **Issue**: Context depends on props from parent, creating implicit dependencies

---

## 4. Error Handling Consistency

### Strengths

1. **Centralized Error Parsing**
   ```javascript
   export function parseErrorMessage(error) {
     const errorPatterns = [
       { pattern: /insufficient funds|not enough/i, message: ERRORS.INSUFFICIENT_FUNDS },
       { pattern: /network request failed|fetch failed/i, message: ERRORS.NETWORK_FAILED },
       // ... more patterns
     ];
   }
   ```
   - Converts technical errors to user-friendly messages
   - Regex patterns handle multiple error formats
   - Fallback to generic errors

2. **Try-Catch Error Boundaries**
   - Services wrap operations in try-catch
   - Errors logged for debugging
   - Propagated up with context

3. **Toast Notifications**
   - showToast(message, 'error') consistently used
   - Error types properly categorized

### Weaknesses

1. **Inconsistent Error Handling Depth**
   - Some functions: basic try-catch with simple error pass-through
   - Others: detailed error parsing with logging
   - No standardized error handling decorator/wrapper

2. **Silent Error Suppression (FOUND)**
   ```javascript
   const loadBiometricPreference = useCallback(async () => {
     try {
       const biometricPref = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
       setBiometricEnabled(biometricPref === 'true');
     } catch (error) {}  // <-- SILENT SUPPRESSION
   }, []);
   ```
   **Issue**: Empty catch blocks hide failures; should log or handle explicitly

3. **Missing Validation**
   - Wallet addresses not validated before use
   - UTXO amounts not checked for negative values
   - Network responses not fully validated before state updates

4. **Error Context Limits**
   - ErrorParser doesn't distinguish between recoverable/permanent errors
   - No retry logic embedded in error handling
   - User doesn't know if they should retry or take different action

---

## 5. Code Duplication & Reusability

### Duplication Found

1. **Transaction Processing Pattern (3+ locations)**
   ```javascript
   // TransactionExecutionContext
   const tx = bitcoin.Transaction.fromHex(intent.signedTxHex);
   tx.outs.forEach((output, vout) => {
     const address = bitcoin.address.fromOutputScript(output.script, MUTINYNET_NETWORK);
     const value = Number(output.value);
     // ... extract change outputs
   });
   
   // Similar logic in transactionHistoryService.js, transactionService.js
   ```
   **Issue**: Output extraction pattern duplicated; should be extracted to utility

2. **UTXO Selection Logic**
   - BTC UTXO selection in btcTransaction.js
   - Runes UTXO selection in runesTransaction.js
   - Common filtering logic could be shared

3. **Toast/Snackbar Display** (2 notification systems)
   - UIContext maintains both showToast (legacy) and showSnackbar (new)
   - TransactionToast.jsx and Snackbar.jsx have overlapping patterns
   - Backward compatibility creates redundancy

### Extraction Opportunities

1. **Transaction Decoding**
   ```javascript
   // Extract to utils/transactionDecoding.js
   export function decodeTransactionOutputs(signedTxHex, walletAddresses, network) {
     const tx = bitcoin.Transaction.fromHex(signedTxHex);
     return tx.outs.map((output, vout) => ({
       address: bitcoin.address.fromOutputScript(output.script, network),
       value: Number(output.value),
       isChange: walletAddresses.includes(address),
       vout
     }));
   }
   ```

2. **Address Validation**
   - Used in multiple transaction contexts
   - Should be centralized utility

3. **Navigation Handlers**
   - PIN change flow handlers replicated across contexts
   - Could extract to custom hook: useNavigation.js

---

## 6. TypeScript/PropTypes Usage

### Current State

**No TypeScript**, relying on PropTypes and JSDoc comments.

### PropTypes Coverage

**Good**: Component-level PropTypes defined
```javascript
ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallbackMessage: PropTypes.string,
  onReset: PropTypes.func,
};
```

**Missing**: Service function prop validation
```javascript
// walletService.js - No JSDoc types defined
export const generateWallet = async (accountIndex = 0) => { ... }
```

### JSDoc Documentation

**Moderate**: Some functions documented, many missing details
```javascript
/**
 * Validate and import a wallet from mnemonic
 * @param {string} mnemonic - BIP39 mnemonic phrase (space-separated words)
 * @param {number} accountIndex - Account index for derivation (default: 0)
 * @returns {Promise<{addresses: {segwitAddress: string, taprootAddress: string}}>}
 */
```

### Recommendations

1. **TypeScript Migration Path** (NOT RECOMMENDED YET)
   - Current codebase is complex
   - Would require significant refactoring
   - PropTypes + JSDoc is functional for now

2. **Improved JSDoc Coverage**
   - All service exports need @param/@returns docs
   - Context types should be documented
   - Custom hook return types should be detailed

---

## 7. Documentation & Comments Quality

### Documentation Files

Comprehensive project documentation exists:
- README.md (Technical stack, architecture overview)
- ARCHITECTURE_STANDARDS.md (File size, complexity guidelines)
- TESTING.md (Test setup and patterns)
- QUICK_REFERENCE.md (Common tasks)
- SENTRY_SETUP.md (Error monitoring)

### Code Comments

**Strengths**:
- Function headers with purpose
- Complex logic explained (transaction parsing, UTXO selection)
- Warning comments for important patterns

**Weaknesses**:
1. **Inconsistent Comment Depth**
   - TransactionExecutionContext: Heavy debug logging (35+ console.logs)
   - Services: Minimal explanation of business logic
   - Utils: Rarely commented despite complexity

2. **Debug Logging in Production Code**
   ```javascript
   console.log('📡 Broadcasting transaction...');
   console.log('Intent inputs:', intent.inputs?.map(...) || 'none');
   console.log('✅ Broadcast successful, txid:', txid);
   // 35+ console.log statements in TransactionExecutionContext alone
   ```
   **Issue**: Should use debug utility or logger, not raw console.log

3. **Missing Edge Case Documentation**
   - Why certain UTXOs are excluded
   - Why specific error patterns are caught
   - Special handling for rune transactions not explained

---

## 8. Naming Conventions

### Strengths

1. **Consistent Naming Patterns**
   - Hooks: `use[Feature]` (useAuth, useWallet, usePolling)
   - Contexts: `[Feature]Context` + `use[Feature]()` hook
   - Services: `[Feature]Service` exports
   - Utils: lowercase functions (parseErrorMessage, formatBtc)

2. **Clear Intent in Names**
   - `createBtcIntent` vs `createUnitIntent` (explicit asset types)
   - `addPendingTransaction` vs `confirmTransaction` vs `invalidateTransaction`
   - Boolean predicates: `isAuthenticated`, `isBiometricSupported`

3. **Consistent Variable Naming**
   - `wallet`, `currentAccount` used uniformly
   - `sendIntent`, `broadcastedTxid` clear purpose
   - `showToast`, `showSnackbar` clear action

### Weaknesses

1. **Ambiguous Context Names**
   - `SendFlowContext` - unclear what "flow" contains (form state? navigation?)
   - `NavigationHandlersContext` - handlers for what? (Navigation state callbacks)
   - `AppNavigationContext` - vs NavigationHandlersContext? Different purposes?

2. **Abbreviated/Cryptic Names**
   - `vout` used (standard Bitcoin, but not immediately clear)
   - `psbt` not fully spelled out in service name
   - `_error` used for unused error variables (convention, not ideal)

3. **Inconsistent Function Naming**
   - `getUnconfirmedBalance` vs `fetchBalance` (get vs fetch distinction)
   - `resetWallet` vs `resetAuth` vs `resetOnboardingState`
   - Some functions use imperative (reset), others declarative (is*)

---

## 9. Technical Debt Indicators

### HIGH PRIORITY

1. **Excessive Debugging Console Statements**
   ```
   35+ console.log statements in TransactionExecutionContext
   Multiple console.logs in contexts and hooks
   ```
   **Action**: Implement proper logging utility with configurable levels

2. **Silent Error Suppression**
   ```javascript
   try { ... } catch (error) {}
   ```
   **Action**: At minimum, log errors; handle explicitly

3. **Dependencies on Prop Drilling**
   - Contexts require props from parents (currentAccount, showToast)
   - Creates implicit dependencies
   **Action**: Consider lifting these to global app state

### MEDIUM PRIORITY

1. **Complex Hook State Management**
   - useAuth: 12+ state variables
   - useVaultWebView: 265 LOC
   **Action**: Break into smaller hooks or use useReducer

2. **Overlapping Notification Systems**
   - Legacy toast + new snackbar in UIContext
   - Both TransactionToast and Snackbar components
   **Action**: Complete migration to snackbar, remove toast legacy code

3. **Circular Context Dependencies**
   - Transaction execution depends on multiple context chains
   - Hard to trace data flow
   **Action**: Create data flow diagram; simplify dependency graph

### LOW PRIORITY

1. **Incomplete Error Pattern Coverage**
   - parseErrorMessage doesn't cover all error types
   - Some errors fall through to generic message
   **Action**: Add more error patterns as they're discovered

2. **Missing Integration Tests**
   - Units tests exist, but no E2E test coverage
   - Transaction signing/broadcasting not tested end-to-end
   **Action**: Add Detox or similar for E2E tests

3. **Test Coverage Gaps**
   - NavigationHandlersContext excluded from coverage (integration dependency)
   - SeedPhraseContext excluded (animation mocking)
   **Action**: Add mocks for Animated API, include in coverage

---

## 10. Maintainability Concerns

### Critical Issues (Will Impact Development)

1. **Growth Beyond Initial Design**
   - Started as simple wallet, now includes:
     - Vault functionality (borrowed code)
     - Airdrop handling
     - Complex transaction chaining (pending UTXOs)
     - Multiple notification systems
   **Impact**: Future devs struggle to understand scope

2. **Complex Transaction State Machine**
   - Transaction goes through: pending → submitted → success/error
   - State tracked in multiple places (TransactionExecutionContext, PendingTransactionsContext, UIContext)
   - Hard to debug when states get out of sync
   **Impact**: Bugs in transaction confirmation flow are likely

3. **Implicit State Dependencies**
   - TransactionExecutionContext needs PendingTransactionsContext
   - Which needs currentAccount from props
   - Which comes from WalletContext
   - Creating deep implicit chains
   **Impact**: Hard to refactor, easy to introduce regressions

### Medium Severity Issues

1. **Mixed Abstraction Levels**
   - Some components access raw bitcoin.js APIs
   - Others delegate to services
   - Inconsistent pattern
   **Impact**: Hard to swap implementations, test complex components

2. **Navigation State Complexity**
   - RootNavigator uses `useNavigationState()` hook
   - NavigationHandlersContext stores navigation callbacks
   - AppNavigationContext manages navigation state
   - Three separate navigation management systems
   **Impact**: Hard to add new navigation patterns

3. **Service Layer Inconsistency**
   - Some services are pure functions (walletService)
   - Others have side effects (backgroundTaskService)
   - No consistent interface
   **Impact**: Unpredictable behavior, hard to mock in tests

---

## 11. Performance Considerations

### Strengths

1. **Memoization Strategy**
   - Context values memoized with useMemo
   - useCallback on event handlers
   - Should prevent unnecessary re-renders

2. **Polling Interval Optimization**
   ```javascript
   const POLL_INTERVAL = 10000;        // 10s for balance/vault
   const HISTORY_POLL_INTERVAL = 30000; // 30s for history
   ```
   - Different frequencies for different data
   - Prevents excessive network requests

3. **Lazy Data Fetching**
   - Balance/history/vault data fetched on demand
   - Not all data loaded at startup

### Concerns

1. **Large Dependency Arrays**
   - Memoized values with 10+ dependencies may invalidate frequently
   - Deep equality checks on large objects

2. **Console Logging Overhead**
   - 35+ console.logs in production code
   - Each console.log call has CPU cost
   - Should be removed for production builds

3. **String Interpolation in Logging**
   ```javascript
   console.log(`Output ${vout}: ${address} = ${value} sats`);
   ```
   - Creates unnecessary string objects
   - Should use logger with log levels

---

## 12. Security Considerations (Not Vulnerabilities)

### Strengths

1. **Secure Key Storage**
   - Mnemonic stored in expo-secure-store (OS keychain)
   - Keys not logged or exposed
   - Proper cleanup after derivation

2. **Screenshot Blocking**
   - expo-screen-capture used for privacy mode
   - Prevents sensitive data capture

3. **Biometric Integration**
   - LocalAuthentication for Face/Touch ID
   - PIN fallback mechanism

### Areas for Review

1. **Error Messages Leak Info**
   - Network requests logged with full URLs/responses
   - Transaction data logged with amounts/addresses
   - Could leak information in crash logs

2. **No Secrets Management**
   - API endpoints hardcoded
   - Network configuration in code
   - No environment variable separation

3. **Test Data in Production**
   ```javascript
   // App.js
   const environment = __DEV__ ? 'development' : 'production';
   enabled: true, // TEMPORARILY enabled in dev to test
   ```
   - Sentry enabled in dev
   - Mutinynet testnet hardcoded
   - No production/testnet switch

---

## Summary: Architecture Strengths & Weaknesses

### Architectural Strengths

✅ **Clear Feature Separation** - Services, hooks, contexts properly organized
✅ **Solid Context API Usage** - Good memoization, proper error boundaries
✅ **Comprehensive Services** - Well-isolated business logic from UI
✅ **Custom Hooks** - Good extraction of component logic
✅ **Test Infrastructure** - Jest configured, 70% coverage threshold
✅ **Documentation** - Architecture standards defined

### Architectural Weaknesses

❌ **Context Proliferation** - 14 contexts, some exceeding size limits
❌ **Complex State Management** - useAuth hook has 12+ state variables
❌ **Implicit Dependencies** - Contexts depend on parent props
❌ **Code Duplication** - Transaction parsing duplicated in 3+ places
❌ **Mixed Concerns** - Some contexts mix unrelated functionality
❌ **Debug Logging** - 35+ console.logs in production code
❌ **Navigation Complexity** - 3 separate navigation management systems
❌ **Silent Error Handling** - Empty catch blocks hide failures

---

## Recommendations (Priority Order)

### Immediate (Week 1-2)

1. **Implement Logging Utility**
   ```javascript
   // utils/logger.js
   const logger = {
     debug: __DEV__ ? console.log : () => {},
     info: console.info,
     warn: console.warn,
     error: console.error,
   };
   ```
   - Remove 35+ console.log statements
   - Replace with logger.debug calls
   - Production builds won't include debug logs

2. **Extract Transaction Output Decoder**
   - Create utils/transactionDecoding.js
   - Remove duplication from TransactionExecutionContext, services
   - Test separately

3. **Remove Silent Error Handlers**
   - Find all `catch (error) {}` blocks
   - Replace with `catch (error) { logger.warn(...) }`
   - Let error surface vs hiding

### Short Term (Week 3-4)

4. **Refactor useAuth Hook**
   - Split into useAuthState (7 state vars) + useAuthCallbacks
   - OR use useReducer for PIN state management
   - Reduce from 12 to 6 state variables

5. **Consolidate Notification Systems**
   - Deprecate legacy toast system
   - Migrate all components to snackbar
   - Remove duplicate Toast/Snackbar components

6. **Add Integration Tests**
   - Test transaction signing/broadcasting flow
   - Test wallet creation and switching
   - Use Detox for E2E

### Medium Term (Month 2)

7. **Simplify Navigation State**
   - Consolidate NavigationHandlersContext + AppNavigationContext
   - Remove useNavigationState hook coupling
   - Create single NavigationContext

8. **Extract Common Patterns**
   - useTransactionFlow (build + execute combined)
   - useDataPolling (balance + history + vault polling)
   - useSecureStorage (wraps SecureStore with error handling)

9. **Improve Error Handling**
   - Implement error boundary for each major feature
   - Add proper error recovery UI
   - Distinguish recoverable vs permanent errors

### Long Term (Month 3+)

10. **Consider TypeScript Migration**
    - Current codebase is stable enough
    - Add strict types to critical paths first
    - Gradual migration over time

11. **Document Component Props**
    - Add storybook or similar
    - Document all component APIs
    - Create component library guide

12. **Extract Feature Modules**
    - If app grows: wallet, send, vault, settings modules
    - Each with own contexts, services, screens
    - Clear module boundaries

---

## Code Quality Metrics Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Total LOC (source) | 21,702 | Reasonable for this feature set |
| Test Files | 98 | Excellent coverage |
| Components | 30 | Moderate |
| Hooks | 37 | Good extraction |
| Services | 19 | Well-organized |
| Contexts | 14 | Acceptable (some oversized) |
| Largest Hook | 265 LOC | Exceeds standard |
| Largest Context | 292 LOC | Exceeds standard |
| Largest Service | 285 LOC | At limit |
| PropTypes Coverage | ~70% | Adequate |
| Documentation Files | 7 | Excellent |
| Console.logs | 35+ | Should be removed |

---

## Conclusion

This is a **well-structured, security-conscious Bitcoin wallet** with good separation of concerns and solid React patterns. The codebase is generally maintainable and has comprehensive test coverage.

However, it's at an inflection point where **complexity is starting to exceed what one hook/context can handle** without additional refactoring. The addition of vault functionality, airdrop handling, and complex transaction chaining has pushed some components beyond recommended size limits.

**Recommendation**: Address the immediate items (logging, error handling, code duplication) in the next sprint. Schedule the medium-term refactoring for the following sprint. These improvements will significantly reduce maintenance burden and make the codebase easier for new team members to understand.

The codebase is production-ready but would benefit from cleanup before scaling features further.

