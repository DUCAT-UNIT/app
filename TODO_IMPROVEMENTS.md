# DUCAT Mobile Wallet - Top 150 Improvements

> **For detailed code metrics, coupling analysis, and architecture recommendations, see [CODEBASE_ANALYSIS.md](../CODEBASE_ANALYSIS.md)**

## Priority Legend
- 🔴 **CRITICAL** - Security vulnerabilities, data loss risks, crashes
- 🟠 **HIGH** - Major UX issues, missing core features, performance blockers
- 🟡 **MEDIUM** - Quality improvements, optimization opportunities
- 🟢 **LOW** - Nice-to-have enhancements, polish items
- 🏗️ **ARCHITECTURE** - Code structure, coupling, cohesion, file size

---

## Quick Stats

| Metric | Current | Target | Issue |
|--------|---------|--------|-------|
| Files >300 lines | 37 | 0 | God components |
| Max file size | 647 lines | 250 lines | SendInputScreen.tsx |
| Max imports/file | 39 | 15 | RootNavigator.tsx |
| Max conditions/file | 50 | 15 | psbtSigning.ts |
| Duplicate code | ~3,700 lines | 0 | Vault screens/hooks |
| Missing accessibility | 326+ | 0 | No a11y labels |
| `as any` in tests | 50+ | 0 | Type safety |
| console.log calls | 64 | 0 | Production code |

---

## 🔴 CRITICAL (1-15)

### 1. Add API Response Schema Validation
**File:** `services/transactionHistoryService.ts:114`
**Issue:** Direct type casting `as Transaction[]` without validation. Malformed API responses can crash the app.
**Fix:** Add Zod or Yup schema validation for all API responses.
```typescript
// Add: import { z } from 'zod';
const TransactionSchema = z.object({...});
const validated = TransactionSchema.array().parse(response);
```

### 2. Add Input Validation for Bitcoin Addresses Before API Calls
**Files:** `services/balanceService.ts:65-67`, `services/transactionHistoryService.ts:106`
**Issue:** Addresses passed to APIs without format validation, causing wasted network requests.
**Fix:** Validate address format using `validateBitcoinAddress()` before any API call.

### 3. Fix Race Condition in Cashu Send Token Operation
**File:** `services/cashu/operations/cashuSendToken.ts:35-100`
**Issue:** Multi-step operation (proof selection → blinding → swap) lacks atomicity. App crash between steps corrupts wallet state.
**Fix:** Implement transaction-like pattern with rollback capability or state recovery.

### 4. Add Atomic Guarantee to PSBT Signing
**File:** `services/vaultWallet/walletApi.ts:73-100`
**Issue:** Complex PSBT signing without atomic guarantee can leave vault in inconsistent state.
**Fix:** Add pre-sign state snapshot and rollback mechanism on failure.

### 5. Fix Memory Leak in Proof Change Listeners
**File:** `services/cashu/cashuProofManager.ts:16-17`
**Issue:** Global `proofChangeListeners` Set grows unbounded if listeners aren't unsubscribed.
**Fix:** Return cleanup function from subscription and track listener count with warnings.

### 6. Add Salt Corruption Recovery Path
**File:** `services/pinService.ts:344-349`
**Issue:** Corrupted salt state returns generic error with no recovery guidance.
**Fix:** Provide clear recovery instructions and link to seed phrase restore flow.

### 7. Fix Orphaned Interval in usePolling Hook
**File:** `hooks/usePolling.ts:30-56`
**Issue:** Intervals can become orphaned if component unmounts during interval update.
**Fix:** Use `useLayoutEffect` for cleanup timing or ref-based interval tracking.

### 8. Add Race Condition Protection to Pending Transactions Load
**File:** `hooks/usePendingTransactionsStorage.ts:25-35`
**Issue:** Multiple concurrent `loadPendingTransactions()` calls can cause state inconsistency.
**Fix:** Add loading flag mutex to prevent concurrent loads.

### 9. Add Confirmation Dialog for Vault Operations
**Files:** `screens/wallet/WalletScreen.tsx:199-230`
**Issue:** Vault operations (borrow, repay, withdraw, deposit) have financial implications but no confirmation.
**Fix:** Add Alert.alert confirmation with amount and action details before proceeding.

### 10. Improve Biometric Error Distinction
**File:** `services/biometricService.ts:141-157`
**Issue:** Generic error handling doesn't distinguish user cancellation from system errors.
**Fix:** Check for specific cancellation error codes before showing lockout message.

### 11. Add Timeout for Stuck Processing Screen
**File:** `screens/send/ProcessingScreen.tsx:42-100`
**Issue:** No timeout handling for stuck processing - user may wait indefinitely.
**Fix:** Add 60-second timeout with recovery options and transaction status check.

### 12. Fix Cache Clear Partial Success
**File:** `services/cacheService.ts:123-124`
**Issue:** Cache clear partial success leaves app in inconsistent state.
**Fix:** Add all-or-nothing semantics or recovery mechanism.

### 13. Add Error Boundary to Lock Screen Overlay
**File:** `navigation/RootNavigator.tsx:367-376`
**Issue:** LockScreen overlay not wrapped in ErrorBoundary - crash locks user out.
**Fix:** Wrap with ErrorBoundary that falls back to PIN entry on error.

### 14. Add Error Boundary to Biometric Setup Modal
**File:** `navigation/RootNavigator.tsx:391-395`
**Issue:** BiometricSetupModal not wrapped in ErrorBoundary.
**Fix:** Add ErrorBoundary wrapper with graceful fallback.

### 15. Fix Silent Cache Write Failures
**File:** `services/walletService.ts:112-119`
**Issue:** Non-blocking cache save swallows errors - next load is slow without warning.
**Fix:** Implement retry with backoff or notify user of degraded performance.

---

## 🟠 HIGH (16-45)

### 16. Implement RBF (Replace-By-Fee) Support
**Files:** `services/transaction/btcTransaction.ts`, `screens/send/ProcessingScreen.tsx`
**Issue:** Users cannot bump fees on slow-confirming transactions.
**Fix:** Add BIP 125 RBF signal to transactions and UI for fee bumping.

### 17. Add Address Book Functionality
**Files:** New `services/addressBookService.ts`, `screens/settings/AddressBookScreen.tsx`
**Issue:** Users must manually enter addresses every time - error-prone and slow.
**Fix:** Implement saved recipients with labels and address validation.

### 18. Add Transaction Labels/Notes
**Files:** `services/transactionHistoryService.ts`, `components/transaction/TransactionDetailsSheet.tsx`
**Issue:** No way to annotate transactions for personal records.
**Fix:** Add local storage for transaction notes keyed by txid.

### 19. Add Offline Support with Request Queue
**Files:** `utils/apiClient.ts`, new `services/offlineService.ts`
**Issue:** App has no offline handling - API calls fail silently on poor connections.
**Fix:** Implement network state detection, request queue, and sync-on-reconnect.

### 20. Add Feature Flag System
**Files:** New `services/featureFlagService.ts`, `navigation/RootNavigator.tsx`
**Issue:** No way to safely rollout new features or A/B test.
**Fix:** Implement remote feature flags with local override capability.

### 21. Add i18n/Localization Support
**Files:** New `services/i18n/index.ts`, `utils/messages.ts`
**Issue:** All 229+ UI strings hardcoded in English only.
**Fix:** Implement react-native-i18n or i18next with translation files.

### 22. Add Accessibility Labels to All Interactive Elements
**Files:** All screens and components (326+ elements)
**Issue:** Screen readers cannot identify interactive elements.
**Fix:** Add `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` to all buttons/touchables.

### 23. Improve Error Messages with Actionable Guidance
**Files:** `screens/wallet/WalletScreen.tsx:200-235`, `utils/messages.ts`
**Issue:** Error messages like "Health too low" don't explain what to do.
**Fix:** Rewrite all error messages with context and next steps.

### 24. Add Form Inline Validation with Error Display
**Files:** `screens/send/AddressInputScreen.tsx`, `screens/send/AmountInputScreen.tsx`
**Issue:** Form validation errors not clearly displayed inline.
**Fix:** Add error message Text components below inputs with red styling.

### 25. Add Navigation Tests
**Files:** `navigation/__tests__/*.test.tsx` (missing)
**Issue:** Zero test coverage for 13 navigation files including deep linking.
**Fix:** Create comprehensive navigation test suite.

### 26. Move Hardcoded Config to Environment Variables
**Files:** `constants/security.ts`, `services/turbo/turboLinkingConfig.ts:177`
**Issue:** Domain URLs, timeouts, and security constants hardcoded.
**Fix:** Create environment config system with dev/staging/prod values.

### 27. Add Custom Fee Rate Input
**File:** `components/common/FeeRateSelector.tsx:16-20`
**Issue:** Only 3 preset fee rates (1, 2, 5 sat/vB) - no custom option.
**Fix:** Add "Custom" option with numeric input for advanced users.

### 28. Add Transaction Export (CSV/JSON)
**Files:** New `services/exportService.ts`, `screens/wallet/TransactionHistoryScreen.tsx`
**Issue:** No way to export transaction history for tax or record keeping.
**Fix:** Implement CSV and JSON export with date range selection.

### 29. Increase Transaction Broadcast Retry Count
**File:** `services/transactionBroadcastService.ts:41`
**Issue:** Only 2 retries for critical transaction broadcast - too aggressive for mobile networks.
**Fix:** Increase to 5 retries with exponential backoff.

### 30. Add Circuit Breaker for Failing Endpoints
**File:** `utils/retry.ts`
**Issue:** Retries hammer failing endpoints without backing off.
**Fix:** Implement circuit breaker pattern to stop retrying after threshold.

### 31. Fix Performance: Use Set for Vault Transaction Lookup
**File:** `services/transactionHistoryService.ts:327-332`
**Issue:** O(n) array iteration for vault txid lookup.
**Fix:** Convert to Set for O(1) lookup.

### 32. Fix Aggressive Cache Clear (500+ Delete Calls)
**File:** `services/cacheService.ts:87-110`
**Issue:** Generates keys for 50 accounts × 5 versions = 250+ delete calls for non-existent keys.
**Fix:** Only delete keys that actually exist using key prefix scan.

### 33. Add Loading State to Confirmation Screen Token Generation
**File:** `screens/send/ConfirmationScreen.tsx:52-131`
**Issue:** No loading indicator while waiting for P2PK token generation.
**Fix:** Show spinner with status updates during generation.

### 34. Add Skeleton Loaders to Asset Detail Screen
**File:** `screens/wallet/AssetDetailScreen.tsx`
**Issue:** No skeleton while loading asset data - jarring UX.
**Fix:** Use existing AssetSkeleton component during data load.

### 35. Add Empty State for Transaction History
**Files:** `screens/wallet/TransactionHistoryScreen.tsx`, `components/assetDetail/AssetActivityList.tsx`
**Issue:** No clear empty state when user has no transactions.
**Fix:** Add friendly empty state with "No transactions yet" message.

### 36. Add Haptic Feedback to Slider Interactions
**Files:** `components/common/AmountSlider.tsx`, `components/common/UnitAmountSlider.tsx`
**Issue:** Sliders lack haptic feedback during interaction.
**Fix:** Add light impact feedback on value changes.

### 37. Fix Keyboard Type for Amount Inputs
**File:** `screens/send/AmountInputScreen.tsx`
**Issue:** TextInput may not use optimal keyboard type for numeric input.
**Fix:** Add `keyboardType="decimal-pad"` to amount inputs.

### 38. Add Return Key Handling for Form Navigation
**Files:** `screens/send/AddressInputScreen.tsx`, `screens/send/AmountInputScreen.tsx`
**Issue:** No `onSubmitEditing` handling - return key does nothing.
**Fix:** Connect return key to move focus or submit form.

### 39. Extract Inline Styles to StyleSheet
**Files:** `components/assetDetail/AssetActivityList.tsx:86-139`, `components/review/TransactionSummary.tsx:29-56`
**Issue:** Multiple inline styles instead of StyleSheet.create().
**Fix:** Move all styles to StyleSheet objects.

### 40. Add React.memo to Presentation Components
**Files:** `components/review/TransactionSummary.tsx`, `components/wallet/AssetCard.tsx`
**Issue:** Pure presentation components not memoized - unnecessary re-renders.
**Fix:** Wrap with React.memo and appropriate comparison function.

### 41. Memoize PanResponder in BottomSheet
**File:** `components/common/BottomSheet.tsx:78-111`
**Issue:** PanResponder recreated on every render.
**Fix:** Wrap with useMemo to prevent recreation.

### 42. Add useEffect Cleanup to BottomSheet Animation
**File:** `components/common/BottomSheet.tsx:47-56`
**Issue:** Animation state not cleaned up on unmount.
**Fix:** Add cleanup function to reset animation state.

### 43. Remove Dead Code: UIProvider
**File:** `contexts/UIContext.tsx:1-26`
**Issue:** UIProvider is empty pass-through after Zustand migration.
**Fix:** Remove or deprecate UIContext entirely.

### 44. Remove Empty StyleSheet Entries
**Files:** `components/assetDetail/AssetHeader.tsx:39`, `components/vaultDetail/VaultHeader.tsx:52,62`
**Issue:** Empty style objects like `backButton: {}` in StyleSheet.
**Fix:** Remove unused style entries.

### 45. Add hitSlop to All Small Touch Targets
**Files:** `screens/wallet/WalletScreen.tsx:265-290`, `components/wallet/WalletHeader.tsx:41-49`
**Issue:** Some buttons lack hitSlop - harder to tap on small screens.
**Fix:** Add `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` to small buttons.

---

## 🟡 MEDIUM (46-80)

### 46. Add P2PK-Specific Error Handling
**File:** `services/cashu/operations/cashuReceiveToken.ts:44-80`
**Issue:** Generic error for P2PK locked tokens - user doesn't understand issue.
**Fix:** Detect P2PK errors and show specific guidance about lock expiry.

### 47. Add Corrupted JSON Recovery for Persisted State
**File:** `hooks/usePersistedState.ts:53-69`
**Issue:** Corrupted data silently reverts to initial state without user warning.
**Fix:** Add specific error handling for JSON parse errors with recovery option.

### 48. Add Wallet Import Length Validation
**File:** `services/walletService.ts:61-76`
**Issue:** `importWallet()` doesn't validate word count after normalization.
**Fix:** Add explicit 12/24 word count validation.

### 49. Improve Error Response Handling in Vault API
**File:** `services/vaultWallet/walletApi.ts:31-33`
**Issue:** Error handling throws generic message without checking if `res.error` exists.
**Fix:** Add null checks for error responses.

### 50. Add Memoization to Balance Objects
**File:** `hooks/useBalanceData.ts:100+`
**Issue:** `getUnconfirmedBalance` calls not memoized - causes unnecessary re-renders.
**Fix:** Memoize balance computation with useMemo.

### 51. Add Listener Count Monitoring
**File:** `services/cashu/cashuProofManager.ts:23-40`
**Issue:** No visibility into listener subscription count.
**Fix:** Add debug logging for subscription count changes.

### 52. Audit All useEffect Hooks for Missing Cleanup
**Files:** All hooks and components with data fetching
**Issue:** Some useEffect hooks may not properly cancel requests on unmount.
**Fix:** Add AbortController/signal cleanup to all fetch operations.

### 53. Add Differentiated Timeout for POST Requests
**File:** `utils/apiClient.ts:10`
**Issue:** Same 10s timeout for GET and POST - POSTs may need longer.
**Fix:** Add separate timeout configuration for different request types.

### 54. Add Retry Strategy for Cache Writes
**File:** `services/walletService.ts:97-99,139-141`
**Issue:** Failed cache writes are logged but not retried.
**Fix:** Add exponential backoff retry for cache operations.

### 55. Split Large TransactionExecutionContext
**File:** `contexts/TransactionExecutionContext.tsx` (410 lines)
**Issue:** Single context handles signing, broadcasting, output extraction, pending tracking.
**Fix:** Extract into focused hooks: useTransactionSigning, useTransactionBroadcast, etc.

### 56. Split Large WalletDataContext
**File:** `contexts/WalletDataContext.tsx` (100+ lines)
**Issue:** Manages 4 data domains: balance, transactions, vault data, ecash tokens.
**Fix:** Split into domain-specific contexts.

### 57. Add JSDoc to Complex UTXO Extraction Logic
**File:** `contexts/TransactionExecutionContext.tsx:134-206`
**Issue:** Complex output extraction logic lacks documentation.
**Fix:** Add JSDoc explaining the algorithm and edge cases.

### 58. Add JSDoc to Price Chart Comparison Function
**File:** `components/charts/PriceChart.tsx:272`
**Issue:** `arePropsEqual` custom comparison lacks explanation.
**Fix:** Document why custom comparison is needed.

### 59. Add JSDoc to Asset Card Props
**File:** `components/wallet/AssetCard.tsx:51-120`
**Issue:** Complex interface with unclear `customAmountStyle` prop purpose.
**Fix:** Add JSDoc documentation for all props.

### 60. Standardize Error Handling Patterns
**File:** `contexts/TransactionExecutionContext.tsx:258-261,330,375-376`
**Issue:** Inconsistent error checking: some use `instanceof Error`, others use ternary.
**Fix:** Create standardized error handling utility.

### 61. Fix `as any` Usage in Tests
**Files:** `services/vault/__tests__/vault.test.ts`, `services/__tests__/backgroundTaskService.test.ts`
**Issue:** 50+ uses of `as any` in test files reduces type safety.
**Fix:** Create proper mock types instead of using `as any`.

### 62. Reduce `unknown` Type Usage
**File:** `contexts/WalletContext.tsx:12,64,88`
**Issue:** `[key: string]: unknown` index signature reduces type safety.
**Fix:** Explicitly type all properties.

### 63. Add Type Narrowing to Error Handlers
**File:** `stores/pendingTransactionsStore.ts:109,119,162,174`
**Issue:** Catch blocks use `unknown` without proper type narrowing.
**Fix:** Add error type checking before accessing properties.

### 64. Remove Console.log from Production Code
**Files:** Various (64 occurrences across 11 files)
**Issue:** Console statements in production code.
**Fix:** Replace with logger calls or remove.

### 65. Add PropTypes Validation for ArrayLike Parameter
**File:** `components/assetDetail/AssetActivityList.tsx:71`
**Issue:** `getItemLayout` doesn't validate if data is null before calculation.
**Fix:** Add null check before using data parameter.

### 66. Add Optional Chaining for Transaction Summary Props
**File:** `components/review/TransactionSummary.tsx:20-25`
**Issue:** No validation for `recipient` or `displayAmount` truthiness.
**Fix:** Add optional chaining or null checks.

### 67. Standardize Prop Naming in FeeRateSelector
**File:** `components/common/FeeRateSelector.tsx:52-80`
**Issue:** Inconsistent naming (selectedRate vs selected, onRateChange vs onChange).
**Fix:** Align with common React patterns (value, onChange).

### 68. Replace String Icon with Icon Component
**File:** `components/vaultDetail/VaultTabs.tsx:59`
**Issue:** Close icon uses string `✕` instead of Icon component.
**Fix:** Use consistent Icon component.

### 69. Add useState Initializer Function
**File:** `components/assetDetail/AssetActivityList.tsx:40`
**Issue:** Initial state not using function form.
**Fix:** Use `useState(() => 20)` for lazy initialization.

### 70. Fix Timer Cleanup in sendFlowStore
**File:** `stores/sendFlowStore.ts:64-93`
**Issue:** resetTimer not properly cleaned up on store reset.
**Fix:** Clear timer in reset function.

### 71. Reduce Module-Level State in notificationStore
**File:** `stores/notificationStore.ts:51-55`
**Issue:** Multiple module-level refs increase memory and complicate testing.
**Fix:** Move into store or use context.

### 72. Add Chart Calculation Memoization
**File:** `components/vaultDetail/vaultChart/VaultChartDrawer.tsx`
**Issue:** Complex chart calculations not memoized.
**Fix:** Memoize expensive path calculations.

### 73. Improve PIN Setup Error Messages
**File:** `screens/auth/PinSetupScreen.tsx:62`
**Issue:** PIN mismatch error lacks guidance text.
**Fix:** Add clear message: "PINs don't match. Please try again."

### 74. Add Password Strength Indicator
**File:** `screens/auth/PinSetupScreen.tsx`
**Issue:** No visual feedback for PIN strength.
**Fix:** Add strength indicator (avoid common patterns like 123456).

### 75. Add PIN Attempt Counter UI
**File:** `screens/auth/PinSetupScreen.tsx:76-94`
**Issue:** No visible attempt counter for user awareness.
**Fix:** Show "X attempts remaining" below PIN input.

### 76. Add Minimum Amount Indication
**File:** `screens/send/AmountInputScreen.tsx`
**Issue:** No indication of minimum amount required.
**Fix:** Show dust limit warning for small amounts.

### 77. Add Maximum Amount Indication
**File:** `screens/send/AmountInputScreen.tsx:86`
**Issue:** No clear feedback when exceeding available balance.
**Fix:** Show "Max available: X" with quick-fill button.

### 78. Add Disabled State Styling to Submit Buttons
**Files:** All form screens
**Issue:** Submit buttons not visually disabled when form is invalid.
**Fix:** Add opacity reduction and disabled prop when validation fails.

### 79. Add Loading Indicator to Vault Data Initialization
**File:** `screens/repay/RepayInputScreen.tsx`
**Issue:** No loading feedback while vault data initializes.
**Fix:** Show loading spinner until data is ready.

### 80. Add Minimum Deposit Amount Feedback
**File:** `screens/deposit/DepositInputScreen.tsx:50`
**Issue:** No feedback on minimum deposit requirement.
**Fix:** Show minimum deposit amount in UI.

---

## 🟢 LOW (81-100)

### 81. Add Animation Sequence Memoization
**File:** `components/ui/SkeletonLoader.tsx:26-39`
**Issue:** Animation config created in useEffect without memoization.
**Fix:** Memoize animation config outside component.

### 82. Add Deep Link Route State Mapping
**File:** `services/turbo/turboLinkingConfig.ts:227`
**Issue:** `getStateFromPath()` returns undefined for non-Turbo URLs.
**Fix:** Implement proper route state mapping for all navigation routes.

### 83. Add Malformed Deep Link Error Handling
**File:** `services/turbo/turboLinkingConfig.ts`
**Issue:** No error handling for malformed deep links.
**Fix:** Add try-catch and user-friendly error display.

### 84. Add Adaptive Retry Based on Response Headers
**File:** `utils/retry.ts`
**Issue:** Retry logic doesn't respect Retry-After headers.
**Fix:** Parse and respect Retry-After header values.

### 85. Add Environment-Based Retry Configuration
**File:** `utils/retry.ts:98-101`
**Issue:** 2 retries with 500-3000ms may be too conservative for mobile.
**Fix:** Make retry count configurable by environment (dev: 2, prod: 5).

### 86. Add Skeleton Loader to Vault Action Success Screen
**File:** `screens/vault/VaultActionSuccessScreen.tsx`
**Issue:** No loading skeleton while waiting for confirmation.
**Fix:** Add VaultSkeleton during loading state.

### 87. Add Dismiss Keyboard on Scroll
**Files:** All scrollable screens with inputs
**Issue:** Keyboard stays open when scrolling.
**Fix:** Add `keyboardShouldPersistTaps="handled"` and scroll dismiss.

### 88. Add Haptic Feedback to Form Submissions
**Files:** All form screens
**Issue:** Form submissions lack haptic confirmation.
**Fix:** Add `Haptics.notificationAsync(Success)` on successful submit.

### 89. Add Haptic Response to List Item Selection
**Files:** Transaction history screens
**Issue:** Tapping transaction items has no haptic feedback.
**Fix:** Add light impact feedback on selection.

### 90. Add "No Assets" Empty State
**File:** `screens/wallet/WalletScreen.tsx`
**Issue:** No empty state when all balances are zero.
**Fix:** Add friendly message with guidance to receive/buy.

### 91. Add Settings Section Empty States
**File:** `screens/settings/SettingsScreen.tsx`
**Issue:** Some settings sections could show empty states.
**Fix:** Add contextual empty state messages.

### 92. Ensure 48x48 Minimum Touch Targets
**Files:** `screens/wallet/WalletScreen.tsx:265-290`
**Issue:** Action buttons at `s(50)` barely meet minimum - may be smaller on small devices.
**Fix:** Add minHeight/minWidth constraints with hitSlop backup.

### 93. Add Copy and Share Button Padding
**File:** `screens/send/ConfirmationScreen.tsx:382-412`
**Issue:** Copy/share buttons may have inadequate touch area.
**Fix:** Add padding and hitSlop for comfortable tapping.

### 94. Add Multi-Signature Support (Future)
**Files:** New `services/multisigService.ts`
**Issue:** No M-of-N multisig support for shared custody.
**Fix:** Implement multisig address generation and signing flow.

### 95. Document JavaScript Memory Wiping Limitations in README
**File:** New `docs/SECURITY.md`
**Issue:** Critical security limitations only documented in code comments.
**Fix:** Create security documentation explaining limitations and mitigations.

### 96. Add DUMMY_CAPTCHA Replacement
**File:** `services/airdropService.ts:9`
**Issue:** Hardcoded `XXXX.DUMMY.TOKEN.XXXX` captcha token.
**Fix:** Replace with real captcha implementation or remove.

### 97. Add Sentry Stream Toggle
**File:** `utils/logger.ts:19`
**Issue:** `STREAM_TO_SENTRY = false` is hardcoded.
**Fix:** Make configurable via environment variable.

### 98. Add Error Recovery Suggestions
**Files:** All error messages in `utils/messages.ts`
**Issue:** Error messages lack recovery suggestions.
**Fix:** Add "Try X" or "Contact support" guidance to all errors.

### 99. Add Transaction Status Check Polling
**File:** `screens/send/ProcessingScreen.tsx`
**Issue:** No periodic check if transaction confirmed during processing.
**Fix:** Add background polling for transaction confirmation.

### 100. Add App Version in Error Reports
**File:** `utils/logger.ts`
**Issue:** Error reports may not include app version for debugging.
**Fix:** Ensure app version is included in all Sentry error context.

---

## 🏗️ ARCHITECTURE (101-150)

### File Size Violations (101-115)

#### 101. Split SendInputScreen.tsx (647 lines → 5 components)
**File:** `screens/send/SendInputScreen.tsx`
**Current:** 647 lines, 28 imports, 41 conditions
**Issue:** God component handling address, amount, QR, fees, turbo mode
**Fix:** Extract to:
- `components/send/AddressInputSection.tsx` (80 lines)
- `components/send/AmountInputSection.tsx` (100 lines)
- `components/send/FeeSection.tsx` (60 lines)
- `components/send/TurboModeToggle.tsx` (40 lines)
- `hooks/useSendInput.ts` (150 lines)

#### 102. Split TransactionExecutionContext.tsx (410 lines → 4 hooks)
**File:** `contexts/TransactionExecutionContext.tsx`
**Current:** 410 lines, 40 conditions
**Issue:** Single context handles signing, broadcasting, output extraction, pending tracking
**Fix:** Extract to:
- `hooks/useTransactionSigning.ts` (80 lines)
- `hooks/useTransactionBroadcast.ts` (100 lines)
- `hooks/useOutputExtraction.ts` (80 lines)
- `hooks/usePendingTransactionTracking.ts` (60 lines)

#### 103. Split WalletDataContext.tsx (438 lines → 4 contexts)
**File:** `contexts/WalletDataContext.tsx`
**Current:** 438 lines, 4 data domains
**Issue:** Manages balance, transactions, vault data, ecash tokens in one
**Fix:** Extract to:
- `contexts/BalanceContext.tsx` (80 lines)
- `contexts/TransactionHistoryContext.tsx` (100 lines)
- `contexts/VaultDataContext.tsx` (100 lines)
- `contexts/EcashContext.tsx` (80 lines)

#### 104. Split VaultHealthGauge.tsx (573 lines → 3 components)
**File:** `components/assetDetail/VaultHealthGauge.tsx`
**Current:** 573 lines, 49 conditions
**Issue:** SVG rendering + business logic + animations in one
**Fix:** Extract to:
- `components/vault/VaultHealthGauge.tsx` (150 lines) - UI only
- `hooks/useVaultHealthCalculations.ts` (100 lines)
- `components/vault/VaultGaugeSVG.tsx` (200 lines)

#### 105. Merge Duplicate PSBT Signing Files (1113 lines → 400 lines)
**Files:** `utils/wallet/psbtSigning.ts` (587), `services/vaultWallet/psbtSigning.ts` (526)
**Issue:** ~70% code duplication between files
**Fix:** Create unified `services/signing/psbtService.ts` with context parameter

#### 106. Split RootNavigator.tsx (454 lines → 3 navigators)
**File:** `navigation/RootNavigator.tsx`
**Current:** 454 lines, 39 imports
**Issue:** God navigator knowing too much
**Fix:** Extract to:
- `navigation/AuthNavigator.tsx` (100 lines)
- `navigation/MainNavigator.tsx` (150 lines)
- `navigation/ModalNavigator.tsx` (100 lines)

#### 107. Split ConfirmationScreen.tsx (525 lines → 4 components)
**File:** `screens/send/ConfirmationScreen.tsx`
**Current:** 525 lines
**Fix:** Extract to:
- `components/send/ConfirmationHeader.tsx`
- `components/send/TransactionDetails.tsx`
- `components/send/ConfirmationActions.tsx`
- `hooks/useConfirmation.ts`

#### 108. Split VaultActivityList.tsx (512 lines → 3 components)
**File:** `components/vaultDetail/VaultActivityList.tsx`
**Current:** 512 lines
**Fix:** Extract list, item, and sheet into separate components

#### 109. Split ImportWalletScreen.tsx (452 lines → 4 components)
**File:** `components/onboarding/ImportWalletScreen.tsx`
**Current:** 452 lines
**Fix:** Extract step components for multi-step flow

#### 110. Split Snackbar.tsx (453 lines → 3 components)
**File:** `components/Snackbar.tsx`
**Current:** 453 lines
**Fix:** Extract animation logic, queue logic, and UI into separate files

#### 111. Split settingsService.ts (396 lines → 5 services)
**File:** `services/settingsService.ts`
**Current:** 396 lines, 28 exports
**Fix:** Split by operation type:
- `services/settings/primitiveSettings.ts`
- `services/settings/objectSettings.ts`
- `services/settings/batchSettings.ts`
- `services/settings/securitySettings.ts`
- `services/settings/preferencesSettings.ts`

#### 112. Split AmountSlider.tsx (453 lines → 2 components)
**File:** `components/vaultAction/AmountSlider.tsx`
**Fix:** Separate gesture logic from UI rendering

#### 113. Split feeEstimationService.ts (484 lines → 3 services)
**File:** `services/feeEstimationService.ts`
**Current:** 20 functions, low cohesion
**Fix:** Split into:
- `services/fees/feeCalculator.ts`
- `services/fees/utxoEstimator.ts`
- `services/fees/transactionShapeService.ts`

#### 114. Split PinSetupScreen.tsx (432 lines → 3 components)
**File:** `screens/auth/PinSetupScreen.tsx`
**Fix:** Extract PIN input, confirmation, and error handling

#### 115. Split NavigationHandlersContext.tsx (440 lines)
**File:** `contexts/NavigationHandlersContext.tsx`
**Issue:** Handler soup with too many responsibilities
**Fix:** Split by navigation domain

---

### Code Duplication (116-125)

#### 116. Create Base Vault Action Hook
**Files:** `useBorrowVault.ts`, `useDepositVault.ts`, `useRepayVault.ts`, `useWithdrawVault.ts`
**Current:** 4 files, 16-17 imports each, ~90% similar
**Fix:** Create `useVaultAction` base hook with action-specific configuration
**Savings:** ~600 lines

#### 117. Create Generic VaultConfirmScreen
**Files:** `BorrowConfirmScreen.tsx`, `DepositConfirmScreen.tsx`, `RepayConfirmScreen.tsx`, `WithdrawConfirmScreen.tsx`
**Current:** 4 files, 424-429 lines each, ~85% similar
**Fix:** Create single `VaultConfirmScreen` with action prop
**Savings:** ~1,200 lines

#### 118. Create Generic VaultInputScreen
**Files:** `BorrowInputScreen.tsx`, `DepositInputScreen.tsx`, `RepayInputScreen.tsx`, `WithdrawInputScreen.tsx`
**Current:** 4 files, 322-357 lines each, ~80% similar
**Fix:** Create single `VaultInputScreen` with action configuration
**Savings:** ~1,000 lines

#### 119. Unify Recovery Services with Strategy Pattern
**Files:** `cashuMintQuoteRecovery.ts`, `cashuSwapRecovery.ts`, `cashuTurboRecovery.ts`, `cashuRecoverLockedChange.ts`
**Issue:** Similar recovery patterns duplicated
**Fix:** Create generic recovery service with operation strategies
**Savings:** ~400 lines

#### 120. Extract Common Chart Logic
**Files:** `VaultHealthChartView.tsx`, `FullscreenVaultChart.tsx`, `VaultChartDrawer.tsx`
**Issue:** Duplicated chart calculations and rendering
**Fix:** Create shared chart utilities and hooks

#### 121. Unify Transaction Details Sheets
**Files:** `TransactionDetailsSheet.tsx`, `VaultTransactionDetailsSheet.tsx`
**Issue:** Similar sheet patterns with duplicated logic
**Fix:** Create generic transaction details component

#### 122. Extract Common Form Validation
**Files:** All input screens
**Issue:** Duplicated validation patterns
**Fix:** Create `useFormValidation` hook with validators

#### 123. Unify Error Display Components
**Issue:** Multiple error display patterns across screens
**Fix:** Create standardized `ErrorDisplay` component

#### 124. Extract Common Loading States
**Issue:** Inconsistent loading patterns
**Fix:** Create `LoadingState` and `SkeletonState` standardized components

#### 125. Unify Button Styling
**Issue:** Multiple button variants with duplicated styles
**Fix:** Create comprehensive `Button` component with variants

---

### Store Complexity (126-130)

#### 126. Implement Zustand Slices for sendFlowStore
**File:** `stores/sendFlowStore.ts`
**Current:** 197 lines, 64 actions (1 action per 3 lines)
**Fix:** Split into slices:
- `addressSlice.ts`
- `amountSlice.ts`
- `feeSlice.ts`
- `turboSlice.ts`

#### 127. Create vaultBaseStore for Shared State
**Files:** `borrowStore.ts`, `depositStore.ts`, `repayStore.ts`, `withdrawStore.ts`
**Current:** 4 stores, 50-61 actions each
**Fix:** Extract shared state to `vaultBaseStore.ts`, use composition

#### 128. Extract Status Logic from pendingTransactionsStore
**File:** `stores/pendingTransactionsStore.ts`
**Current:** 397 lines, 55 actions
**Fix:** Extract status tracking to separate store

#### 129. Reduce Module-Level State in notificationStore
**File:** `stores/notificationStore.ts`
**Issue:** Multiple module-level refs (snackbarTimeout, lastSnackbar, dismissCooldown)
**Fix:** Move into store state or use context

#### 130. Add Store Reset Functions
**Issue:** Stores lack proper reset on logout
**Fix:** Add `reset()` action to all stores, call on logout

---

### Coupling Reduction (131-140)

#### 131. Reduce RootNavigator Imports (39 → 15)
**File:** `navigation/RootNavigator.tsx`
**Current:** 39 imports
**Fix:** Use lazy loading, extract navigators, reduce direct screen imports

#### 132. Reduce CashuContext Service Imports (16 → 5)
**File:** `contexts/CashuContext.tsx`
**Current:** 16 direct service imports
**Fix:** Create `CashuService` facade, inject via context

#### 133. Create API Facade for Transaction Services
**Issue:** Multiple services directly importing API client
**Fix:** Create `TransactionAPI` facade for all transaction-related endpoints

#### 134. Extract Theme Constants
**File:** `theme/colors.ts`, `theme/index.ts`
**Issue:** 90 imports from theme across codebase
**Fix:** Use CSS variables or create theme context for dynamic theming

#### 135. Create Logger Facade
**File:** `utils/logger.ts`
**Issue:** 88 imports - any change breaks everything
**Fix:** Create stable public interface, keep implementation private

#### 136. Reduce Screen-to-Store Coupling
**Issue:** Screens directly import multiple stores
**Fix:** Create screen-specific hooks that combine store logic

#### 137. Extract Navigation Types
**File:** `navigation/types.ts`
**Issue:** 18 exports used across codebase
**Fix:** Split into domain-specific type files

#### 138. Create Service Container
**Issue:** Services instantiated directly
**Fix:** Create service container for dependency injection in tests

#### 139. Extract Icon Components
**Issue:** 39 imports from icons across codebase
**Fix:** Create icon context or use tree-shaking friendly exports

#### 140. Reduce Hook Dependencies
**Issue:** Hooks import many other hooks
**Fix:** Use composition over direct imports

---

### Complexity Reduction (141-150)

#### 141. Reduce Cyclomatic Complexity in psbtSigning.ts (50 → 15)
**File:** `services/vaultWallet/psbtSigning.ts`
**Current:** 50 conditions in 526 lines
**Fix:** Extract conditional logic to strategy classes

#### 142. Reduce Nesting in apiClient.ts (29 spaces → 16)
**File:** `utils/apiClient.ts`
**Current:** 29 spaces max indent
**Fix:** Extract nested try/catch to helper functions

#### 143. Simplify VaultHealthGauge Conditions (49 → 15)
**File:** `components/assetDetail/VaultHealthGauge.tsx`
**Current:** 49 conditions
**Fix:** Use lookup tables instead of conditionals

#### 144. Reduce AmountInputScreen Complexity (41 → 15)
**File:** `screens/send/AmountInputScreen.tsx`
**Current:** 41 conditions
**Fix:** Extract validation and calculation logic to hooks

#### 145. Simplify QRCodeHandler (24 nesting → 12)
**File:** `hooks/useQRCodeHandler.ts`
**Current:** 24 spaces max indent (callback hell)
**Fix:** Use async/await, extract handlers

#### 146. Reduce TransactionHistoryData Complexity (36 → 15)
**File:** `hooks/useTransactionHistoryData.ts`
**Current:** 36 conditions
**Fix:** Split into focused hooks by transaction type

#### 147. Simplify ImportWalletScreen Flow (33 → 15)
**File:** `components/onboarding/ImportWalletScreen.tsx`
**Current:** 33 conditions
**Fix:** Use state machine for multi-step flow

#### 148. Reduce PinService Complexity (37 → 15)
**File:** `services/pinService.ts`
**Current:** 37 conditions
**Fix:** Extract hashing, validation, migration to separate files

#### 149. Simplify TransactionDetailsSheet (33 → 15)
**File:** `components/transaction/TransactionDetailsSheet.tsx`
**Current:** 33 conditions
**Fix:** Extract status rendering to separate components

#### 150. Add Comprehensive Error Boundary Strategy
**Issue:** Some modals/overlays not wrapped in error boundaries
**Fix:** Create hierarchy of error boundaries with fallback chain

---

## Summary

| Priority | Count | Focus Area |
|----------|-------|------------|
| 🔴 Critical | 15 | Security, crashes, data integrity |
| 🟠 High | 30 | Core features, major UX, performance |
| 🟡 Medium | 35 | Code quality, optimization, polish |
| 🟢 Low | 20 | Future enhancements, nice-to-haves |
| 🏗️ Architecture | 50 | File size, coupling, cohesion, duplication |

## Potential Code Reduction

| Category | Lines Saved |
|----------|-------------|
| Vault screen consolidation | 2,200 |
| Vault hook consolidation | 600 |
| PSBT signing merge | 700 |
| Recovery service unification | 400 |
| Store slicing | 300 |
| **Total** | **~4,200 lines (5.3%)** |

## Implementation Priority

### Week 1-2: Critical + Architecture P0
1. Items 1-15 (Critical security)
2. Items 101-105 (Largest file splits)
3. Items 116-118 (Major duplication)

### Week 3-4: High + Architecture P1
1. Items 16-30 (Features)
2. Items 106-115 (Remaining splits)
3. Items 126-130 (Store cleanup)

### Week 5-6: Medium + Architecture P2
1. Items 31-60 (Quality)
2. Items 131-140 (Coupling)
3. Items 141-150 (Complexity)

### Week 7-8: Low + Polish
1. Items 61-100 (Low priority)
2. Items 119-125 (Minor duplication)
3. Final code review

---

*Generated: January 2025*
*Based on comprehensive analysis of 820+ files, 79,701 lines of TypeScript/React Native code*
*DUCAT Mobile Wallet v1.x*
