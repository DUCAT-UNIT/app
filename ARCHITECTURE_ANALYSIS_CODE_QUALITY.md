# COMPREHENSIVE ARCHITECTURE ANALYSIS - DUCAT APP

## EXECUTIVE SUMMARY

The Ducat wallet app has **significant code quality and architectural issues** despite being well-structured in some areas. The codebase shows signs of organic growth with accumulated technical debt. Key concerns include:

- **Context over-usage**: 14 contexts with multiple doing similar things
- **Component bloat**: 7 screens over 800 lines, poor separation of concerns
- **Hook complexity**: 36 custom hooks, some >280 lines, mixing UI + business logic
- **Service consolidation opportunity**: Transaction services scattered across multiple files
- **Code duplication**: Repetitive patterns in balance/data fetching
- **Prop drilling**: Still present despite context proliferation

---

## 1. FILE SIZES & CODE BLOAT

### Critical Files (>500 lines)

| File | Lines | Issues |
|------|-------|--------|
| `styles.js` | 2,494 | **MASSIVE** - All global styles in one file. Should be split by feature |
| `passkeyService.js` | 1,106 | **TOO LARGE** - Mix of WebAuthn, crypto, iCloud, encryption logic |
| `AssetDetailScreen.jsx` | 892 | **GOD COMPONENT** - Does price fetching, caching, transaction history, animations |
| `OnboardingPage.js` | 639 | **GOD PAGE** - Manages multiple onboarding flows and state |
| `PasskeyTestScreen.jsx` | 546 | **TEST CODE** - Should not be in production |
| `WalletPage.js` | 500 | **ORCHESTRATOR** - Too many responsibilities |

### Large Files (>200 lines)

**Contexts (8 over 200 lines):**
- `AirdropContext.js` (345)
- `PendingTransactionsContext.js` (320)
- `TransactionExecutionContext.js` (274)
- `NavigationHandlersContext.js` (272)
- `TransactionBuildContext.js` (245)
- `WalletDataContext.js` (202)
- `UIContext.js` (205)
- `AuthContext.js` (106)

**Services (10 over 200 lines):**
- Most transaction logic split poorly across multiple files
- `passkeyService.js` needs breaking apart

**Hooks (15 over 150 lines):**
- `useVaultWebView.js` (285) - WebView message handling, too much logic
- `useAuth.js` (258) - 60 useState calls hidden inside
- `useWalletCreation.js` (192)
- `useSeedVerification.js` (189)
- `useReceiveScreenAnimations.js` (180)
- `useWalletImport.js` (177)
- `useSettingsNavigation.js` (177)
- Multiple others >150 lines

### Issue: Single Responsibility Violation

**`styles.js` - 2,494 LINES**
```javascript
// Every screen's styles are here - impossible to maintain
const styles = StyleSheet.create({
  container: { ... },
  splashContainer: { ... },
  splashLogo: { ... },
  // ... 600+ more style definitions
  transactionItemContainer: { ... },
  reviewScreenHeader: { ... },
  // mixing all feature styles together
});
```

**Should be:**
```
styles/
  ├── splash.js
  ├── wallet.js
  ├── send.js
  ├── receive.js
  ├── settings.js
  └── common.js
```

---

## 2. PROP DRILLING PROBLEMS

### Problem: Multiple Prop-Heavy Components

**`ReceiveScreen.jsx` - 11 props, 5 are callback handlers**
```javascript
function ReceiveScreen({
  styles,           // Styles object
  showReceiveSheet, // Boolean
  onClose,          // Handler
  segwitAddress,    // Data
  taprootAddress,   // Data
  showToast,        // Handler (from UIContext - could use directly)
  autoOpenQR,       // Boolean
  preSelectedAddress,  // Data
  preSelectedType,  // Data
  dismissQRClosesSheet, // Boolean
})
```

**Issue:** `showToast` is passed as prop but available via `useToastContext()`. This is prop drilling even though context exists.

**`ReviewScreen.jsx` - Uses custom hook to avoid prop drilling:**
```javascript
const {
  sendIntent,
  btcPrice,
  isDetailsExpanded,
  runeUtxoBalance,
  psbtInputs,
  outputs,
  // ... 10+ more from hook
} = useReviewScreenData();
```

**Better approach:** Components use contexts directly OR have a single data hook. Current code does both inconsistently.

### Problem: WalletPage Component

**500+ lines orchestrating multiple screens:**
```javascript
export default function WalletPage({ route }) {
  // Consuming 8+ contexts
  const { activeTab, setActiveTab, ... } = useVault();
  const { resetInactivityTimer } = useOnboardingFlow();
  const { settingsHandlers, ... } = useNavigationHandlers();
  const { wallet } = useWallet();
  const { vaultData } = useVaultData();
  const { intentStep, sendAssetType, ... } = useSendFlow();
  const { broadcastedTxid } = useTransactionExecution();
  const { toasts, showToast, snackbar, ... } = useToastContext();
  
  // Then manages render logic for 5 different screens
  // This is a coordinator that should delegate more
}
```

---

## 3. CONTEXT ISSUES - CONSOLIDATION OPPORTUNITY

### All 14 Contexts

| Context | Size | Purpose | Issue |
|---------|------|---------|-------|
| `AuthContext` | 106 | Auth + Onboarding | Mixed concerns |
| `WalletContext` | 101 | Wallet addresses | Essential, OK |
| `WalletDataContext` | 202 | Balance + History + Vault | **MONOLITH** |
| `PendingTransactionsContext` | 320 | Pending tx tracking | **BLOATED** - Complex logic |
| `UIContext` | 205 | Display prefs + Toast + Snackbar | **3 CONCERNS** |
| `SendFlowContext` | 68 | Send flow state | OK |
| `TransactionBuildContext` | 245 | PSBT building | **TOO HEAVY** |
| `TransactionExecutionContext` | 274 | Signing + Broadcasting | **TOO HEAVY** |
| `PriceContext` | ? | BTC prices | Essential |
| `VaultContext` | 128 | Vault credentials | **Mixing logic** |
| `AirdropContext` | 345 | Airdrop claims | **ISOLATED** - never used? |
| `NavigationHandlersContext` | 272 | Navigation + Settings | **KITCHEN SINK** |
| `AppNavigationContext` | ? | Navigation state | Unknown |
| `SeedPhraseContext` | ? | Seed management | ? |

### Key Problems

**1. WalletDataContext is a God Object**
```javascript
// Provides ALL wallet data through one context
const value = useMemo(() => ({
  // Balance data
  segwitBalance,
  taprootBalance,
  runesBalance,
  unconfirmedSegwitBalance,
  unconfirmedTaprootBalance,
  unconfirmedRunesBalance,
  loadingBalance,
  refreshing,
  balanceError,
  utxos,
  loadingUtxos,
  fetchBalance,
  onRefresh,
  fetchUtxos,
  resetBalances,
  
  // Transaction history data
  transactionHistory,
  loadingTransactionHistory,
  historyError,
  fetchTransactionHistory,
  resetTransactionHistory,
  
  // Vault data
  vaultData,
  loadingVault,
  vaultError,
  fetchVault,
  resetVaultData,
}), [/* 30+ deps */]);
```

**Impact:** Every component using any of these re-renders when ANY change, even if they only need one piece.

**2. UIContext Mixing 3 Concerns**
```javascript
// Display preferences (just boolean flags)
displayPreferences: {
  showTotalInBTC,
  setShowTotalInBTC,
  showBTCInBTC,
  setShowBTCInBTC,
  showUnitInUnit,
  setShowUnitInUnit,
}

// Toast notifications (legacy)
showToast,
toasts,
dismissToast,

// Snackbar (new, better)
showSnackbar,
snackbar,
dismissSnackbar,
```

Should be 2 contexts:
- `DisplayPreferencesContext` - for display toggles
- `NotificationContext` - for toasts/snackbars

**3. NavigationHandlersContext is Kitchen Sink**

272 lines combining:
- Auth state changes
- Settings handlers
- Account switching
- Passkey migration
- PIN management
- Logging out
- Wallet deletion

This should be split:
- `AccountContext` - account switching
- `SettingsContext` - settings modals
- `PasskeyContext` - passkey management

**4. Context Over-usage**

Some components use 6+ contexts:
```javascript
const { wallet } = useWallet();
const { balance, history, vault } = useWalletData();
const { btcPrice } = usePrice();
const { displayPreferences } = useUI();
const { showToast } = useToastContext();
// Already 5 contexts, then add SendFlow, TransactionBuild, etc.
```

Each context subscription = potential re-render.

---

## 4. COMPONENT ARCHITECTURE ISSUES

### Problem: Multiple Responsibilities

**`AssetDetailScreen.jsx` - 892 lines**

Does 5 things:
1. Fetches price data (with cache management)
2. Displays transaction history
3. Shows price chart
4. Manages tab selection
5. Handles animations

```javascript
// Example: Price fetching mixed with rendering logic
const fetchPriceData = useCallback(async () => {
  // Complex API call logic
  // Cache management
  // Error handling
  setPriceLoading(true);
  // ... 50+ lines of fetching logic
}, [timeframe, /* 10 deps */]);

useEffect(() => {
  fetchPriceData();
}, [/* heavily dependent */]);

// Then in render:
return (
  <ScrollView>
    <View style={localStyles.tabsContainer}>
      {/* Tab switching UI */}
    </View>
    <PriceChart
      data={priceData}
      direction={priceDirection}
      loading={priceLoading}
    />
    {/* Transaction history below */}
  </ScrollView>
);
```

**Should be:**
- `AssetDetailScreen.jsx` - orchestration only
- `usePriceData.js` - price fetching hook
- `PriceHistoryView.jsx` - chart display
- `AssetTransactionHistory.jsx` - transaction list

### Problem: Business Logic in Components

**`AmountInputScreen.jsx` - Handles validation logic**
```javascript
const handleAmountChange = (text) => {
  let processed = text;
  // Locale-specific decimal handling
  if (processed.endsWith(',') && !processed.includes('.')) {
    processed = processed.slice(0, -1) + '.';
  }
  const cleaned = processed.replace(/,/g, '');
  if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
    setSendAmount(cleaned);
  }
};

const handleMaxPress = async () => {
  // MAX button logic with service call
  setIsCalculatingMax(true);
  const maxSendable = await calculateMaxSendableBTC({
    sourceAddress,
    btcBalance,
  });
  setSendAmount(String(maxSendable));
};
```

Should extract to:
- `useAmountValidation.js` hook
- `useMaxCalculation.js` hook

### Problem: Complex Components Without Abstraction

**`WalletScreen.jsx` - Prop forwarding nightmare**

Should use composition instead:
```javascript
// Current: 30+ props
<AssetCard
  balance={segwitBalance}
  isLoading={loadingBalance}
  onPress={onAssetPress}
  assetType="BTC"
  showTotalInBTC={showTotalInBTC}
  // ... 20 more props
/>

// Better: Encapsulate in custom component
<BtcAssetCard
  onPress={() => onAssetPress('BTC')}
/>
```

---

## 5. CODE DUPLICATION

### Repeated Balance Calculation Patterns

**In multiple hooks and components:**

```javascript
// AssetDetailScreen.jsx
const balance = assetType === 'BTC' ? segwitBalance : unitAmount;
const fiatValue = assetType === 'BTC' ? balance * btcPrice : balance * 1;

// AmountInputScreen.jsx
const btcBalance = (segwitBalance || 0) + (taprootBalance || 0);
const unitBalance = runesBalance && runesBalance.length > 0 
  ? parseFloat(runesBalance[0][1]) 
  : 0;
const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;

// WalletScreen.jsx (via hook)
const totalBalanceBTC = segwitBalance + taprootBalance + (unitBalance * unitValueInBTC);
```

All doing same calculation differently. Should have:
```javascript
// useAssetBalance.js - SINGLE source of truth
export function useAssetBalance(assetType) {
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  
  return useMemo(() => {
    if (assetType === 'btc') {
      return segwitBalance + taprootBalance;
    } else {
      return runesBalance?.[0]?.[1] ? parseFloat(runesBalance[0][1]) : 0;
    }
  }, [segwitBalance, taprootBalance, runesBalance]);
}
```

### Repeated Address Validation

```javascript
// AddressInputScreen.jsx
const isTaproot = text.startsWith('tb1p') || text.startsWith('bc1p');

// ReceiveScreen.jsx (implicitly checking)
// Same logic repeated

// Should use:
// utils/addressValidation.js
export function isTaprootAddress(address) {
  return address.startsWith('tb1p') || address.startsWith('bc1p');
}
```

### Repeated Transaction State Management

`PendingTransactionsContext` and `TransactionExecutionContext` both manage transaction state:
- Building intent
- Signing
- Broadcasting
- Tracking status

Large overlapping responsibilities.

---

## 6. SEPARATION OF CONCERNS ISSUES

### Business Logic in Contexts

**`TransactionBuildContext` - 245 lines mixing concerns:**

```javascript
// Should be service, not context
const createBtcIntent = useCallback(async () => {
  // Complex transaction building logic (belongs in service)
  const unconfirmedUtxos = getUnconfirmedUTXOs('segwit', sendIntent);
  const intent = await TransactionService.createBtcIntent(
    sendRecipient,
    sendAmount,
    wallet.segwitAddress,
    currentAccount,
    unconfirmedUtxos,
    spentUtxos
  );
  
  // Complex UTXO locking logic (belongs in service)
  if (intent.inputs && intent.inputs.length > 0) {
    await markUtxosAsSpent(intent.inputs.map(i => ({ txid: i.txid, vout: i.vout })));
  }
  
  setSendIntent(intent);
  setIntentStep('reviewing');
}, [/* 10 deps */]);
```

This context should just store state. Logic should be in:
- `transactionBuildService.js`
- Called via hooks
- Context stores results

### Presentation Logic in Services

**`passkeyService.js` - 1,106 lines**

Does:
- WebAuthn API calls (business logic)
- Crypto operations (business logic)
- iCloud storage (persistence)
- State management logic (for UI flow)

Should be split:
- `passkeyService.js` - WebAuthn + crypto
- `passkeyStorage.js` - iCloud persistence
- `usePasskeyFlow.js` - UI flow state

### Tight Coupling Examples

**VaultContext depends on address derivation:**
```javascript
await withMnemonic(async (mnemonic) => {
  const addresses = deriveAddressesFromMnemonic(mnemonic, currentAccount);
  setVaultCredentials({...});
});
```

Wallet address logic should be in one place, not duplicated.

---

## 7. HOOK ISSUES

### Hooks Too Complex (>150 lines)

| Hook | Lines | Problem |
|------|-------|---------|
| `useVaultWebView.js` | 285 | WebView message handling, too complex |
| `useAuth.js` | 258 | 60+ useState calls, mixed concerns |
| `useWalletCreation.js` | 192 | Passkey + PIN + seed handling |
| `useSeedVerification.js` | 189 | Complex state machine |
| `useReceiveScreenAnimations.js` | 180 | Animation logic OK but could be lighter |
| `useWalletImport.js` | 177 | Import flow too complex |

### Hook: `useAuth.js` - Example of Too Much

```javascript
// 60+ useState statements mixed together
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [isBiometricSupported, setIsBiometricSupported] = useState(false);
const [biometricEnabled, setBiometricEnabled] = useState(false);
const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
const [showFaceIdButton, setShowFaceIdButton] = useState(true);
// ... 20 more state vars
const [isPasskeySupported, setIsPasskeySupported] = useState(false);
const [passkeyEnabled, setPasskeyEnabled] = useState(false);
const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
const [settingUpPin, setSettingUpPin] = useState(false);
const [changingPin, setChangingPin] = useState(false);
// ... continue for 258 lines
```

**Should split into:**
- `useBiometricAuth.js` - biometric state
- `usePasskeyAuth.js` - passkey state
- `usePinAuth.js` - PIN state
- `useAuthFlow.js` - orchestrate above

### Effect Dependency Hell

Many hooks have exhaustive dependency arrays:
```javascript
const pollAllData = useCallback(() => {
  // ...
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [wallet, balance.fetchBalance, vault.fetchVault, history.fetchTransactionHistory]);
```

The `eslint-disable` indicates design problem.

### Hooks That Should Be Services

**`useTransactionPolling.js` - 89 lines**
```javascript
// Polling logic should be service, not hook
const poll = useCallback(async () => {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    setPendingTransactions(data);
  } catch (error) {
    // handle error
  }
}, []);

useInterval(poll, 5000);
```

Should be:
```javascript
// transactionPollingService.js
export class TransactionPoller {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
  }
  
  start() {
    this.interval = setInterval(() => this.poll(), 5000);
  }
  
  async poll() {
    // polling logic
  }
}

// In component:
const [poller] = useState(() => new TransactionPoller(setPendingTransactions));
useEffect(() => {
  poller.start();
  return () => poller.stop();
}, []);
```

---

## 8. STATE MANAGEMENT ISSUES

### Unnecessary State

**In multiple places:**
```javascript
// AssetDetailScreen - could be computed
const [selectedTab, setSelectedTab] = useState('ACTIVITY');
const [selectedTimeframe, setSelectedTimeframe] = useState('1M');

// Instead of fetching on change:
useEffect(() => {
  if (selectedTimeframe === '1M') {
    fetchPriceData();
  }
}, [selectedTimeframe]);

// Just compute from params/derived state
// No need to store in component state
```

### Derived State That Should Be Computed

**PendingTransactionsContext:**
```javascript
// Currently stored:
const [pendingTransactions, setPendingTransactions] = useState({});

// Derived state computed every render:
const getUnconfirmedUTXOs = useCallback((addressType = 'all', excludeFromIntent = null) => {
  const utxos = [];
  // Complex filtering logic
  for (const txid in pendingTransactions) {
    if (pendingTransactions[txid].status === 'pending') {
      // process UTXO
    }
  }
  return utxos;
}, [pendingTransactions]);
```

This should be memoized separately or computed as selector.

### State Synchronization Issues

**Between contexts:**
- `WalletContext` has wallet addresses
- `VaultContext` also derives and stores addresses
- `NavigationHandlersContext` accesses wallet from context

Leads to sync problems when account changes.

---

## 9. SPECIFIC REFACTORING RECOMMENDATIONS

### Priority 1: Split WalletDataContext

Current monolith (202 lines, 30+ exported values) should become:
```
useBalance.js (hook-based, minimal context)
useTransactionHistory.js (hook-based)
useVaultData.js (hook-based)
```

Each context provider owns one concern:
```javascript
<BalanceProvider>
  <TransactionHistoryProvider>
    <VaultDataProvider>
      <YourApp />
    </VaultDataProvider>
  </TransactionHistoryProvider>
</BalanceProvider>
```

### Priority 2: Extract styles.js

Split 2,494-line file by feature:
```
styles/
├── common.js (shared colors, fonts, spacing)
├── splash.js (OnboardingPage, WelcomeScreen)
├── wallet.js (WalletScreen, AssetCard, VaultCard)
├── send.js (send flow screens)
├── receive.js (ReceiveScreen, AddressRow)
├── settings.js (SettingsScreen)
└── animations.js (reusable animated styles)
```

### Priority 3: Consolidate Transaction Services

Currently scattered:
- `services/transactionService.js` (deprecated re-export)
- `services/transaction/btcTransaction.js` (174 lines)
- `services/transaction/runesTransaction.js` (358 lines)
- `services/transaction/utxoSelection.js` (142 lines)
- `services/transactionCalculationService.js` (103 lines)
- `services/transactionSigningService.js` (201 lines)
- `services/transactionBroadcastService.js` (37 lines)

Consolidate with clear responsibilities:
```
transactionService/
├── index.js (public API)
├── builder.js (buildBtcIntent, buildUnitIntent)
├── signer.js (signPsbt, signInputs)
├── broadcaster.js (broadcastTransaction)
└── utxoSelection.js (kept as is)
```

### Priority 4: Break Apart useAuth.js

258 lines managing 7 different auth concerns.

```
useAuthState.js - basic auth state
useBiometricAuth.js - Face ID/Touch ID
usePasskeyAuth.js - WebAuthn flow
usePinAuth.js - PIN setup/change
useAuthFlow.js - orchestrate above
```

### Priority 5: Fix NavigationHandlersContext

272-line kitchen sink should become:
- `AccountSwitcherContext.js`
- `SettingsContext.js` 
- `PasskeyMigrationContext.js`
- Keep NavigationHandlersContext as orchestrator only

### Priority 6: Fix Component Props

```javascript
// Before: Prop drilling
<ReceiveScreen
  styles={styles}
  showReceiveSheet={show}
  onClose={close}
  segwitAddress={addr1}
  taprootAddress={addr2}
  showToast={toast}
  autoOpenQR={auto}
  preSelectedAddress={pre}
  preSelectedType={type}
  dismissQRClosesSheet={dismiss}
/>

// After: Use contexts, fewer props
<ReceiveScreen
  showReceiveSheet={show}
  onClose={close}
  autoOpenQR={auto}
/>
// Component uses:
const { toastContext } = useUI();
const addresses = useWallet().wallet;
// No showToast prop needed
```

---

## 10. UNUSED/QUESTIONABLE CODE

### AirdropContext - 345 lines

Used where? Not found in any screen. Either:
1. Delete it
2. Activate and integrate
3. Mark as deprecated

### PasskeyTestScreen - 546 lines

This is test code in production. Remove or move to tests directory.

### Deprecated transactionService.js

Just re-exports. Consider removing once migration complete:
```javascript
// services/transactionService.js
export * from './transaction'; // Just re-exports
```

### Unused Context Hooks

Check if all 14 contexts are actually used:
```javascript
export const useAppNavigation = () => { /* unused? */ }
```

---

## 11. SUMMARY TABLE

| Issue | Severity | Effort | Impact |
|-------|----------|--------|--------|
| Split WalletDataContext | HIGH | MEDIUM | Reduce unnecessary re-renders |
| Split styles.js | HIGH | MEDIUM | Improve maintainability |
| Extract useAuth logic | HIGH | HIGH | Reduce hook complexity |
| Consolidate transactions | MEDIUM | HIGH | Single source of truth |
| Fix prop drilling | MEDIUM | MEDIUM | Cleaner components |
| Split NavigationHandlers | MEDIUM | MEDIUM | Better separation |
| Remove AirdropContext | LOW | LOW | Clean up |
| Remove PasskeyTestScreen | LOW | LOW | Production cleanliness |
| Memoize derived state | MEDIUM | MEDIUM | Performance |
| Add selector pattern | MEDIUM | MEDIUM | Reduce re-renders |

---

## CONCLUSION

This codebase is **functionally complete but architecturally fragile**. The main issues are:

1. **Context explosion**: Too many contexts doing overlapping things
2. **Giant files**: styles.js (2.5K), passkeyService.js (1.1K), AssetDetailScreen (892)
3. **Hook overload**: 36 hooks, many >150 lines, mixing UI + logic
4. **Inconsistent patterns**: Some components use contexts, others get data via props
5. **Duplication**: Same logic (balance calc, address validation) repeated in many places

**Biggest wins:**
1. Split WalletDataContext (prevents re-render storms)
2. Break apart styles.js (improves maintainability)
3. Simplify useAuth hook (reduces complexity)
4. Consolidate transaction services (single source of truth)

These changes would significantly improve code quality without breaking functionality.
