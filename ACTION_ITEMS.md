# Code Quality & Architecture - Action Items

## Quick Reference: What to Fix First

### 1. Remove Debug Logging (2 hour task)
**Location**: `/app/contexts/TransactionExecutionContext.js`
**Issue**: 35+ console.log statements polluting production logs
**Action**:
```bash
# Create logger utility
cat > /app/utils/logger.js << 'LOGGER'
export const logger = {
  debug: __DEV__ ? console.log : () => {},
  info: console.info,
  warn: console.warn,
  error: console.error,
};
LOGGER

# Then replace all console.log with logger.debug
sed -i 's/console\.log(/logger.debug(/g' /app/contexts/TransactionExecutionContext.js
```

### 2. Fix Silent Error Handlers (1 hour task)
**Location**: Multiple files
**Issue**: `try { ... } catch (error) {}` blocks hide failures
**Files to check**:
- `/app/hooks/useAuth.js` - line 47
- Other empty catch blocks

**Fix**:
```javascript
// BEFORE
catch (error) {}

// AFTER
catch (error) { 
  logger.warn('Error loading preference:', error.message);
}
```

### 3. Extract Transaction Output Decoder (3 hour task)
**Duplication**: Found in 3+ places
**Create**: `/app/utils/transactionDecoding.js`
```javascript
export function decodeTransactionOutputs(signedTxHex, walletAddresses, network) {
  const tx = bitcoin.Transaction.fromHex(signedTxHex);
  const outputs = [];
  
  tx.outs.forEach((output, vout) => {
    try {
      const address = bitcoin.address.fromOutputScript(output.script, network);
      const value = Number(output.value);
      const isChange = walletAddresses.includes(address);
      
      outputs.push({ address, value, vout, isChange });
    } catch (_error) {
      // OP_RETURN or non-standard, skip
    }
  });
  
  return outputs;
}
```

**Then replace in**:
- `/app/contexts/TransactionExecutionContext.js` (lines 74-150)
- `/app/services/transactionHistoryService.js`
- Any other locations using this pattern

### 4. Refactor useAuth Hook (4 hour task)
**Issue**: 12 state variables (hard limit violation)
**Solution**: Split into two hooks

```javascript
// useAuthState.js - manage auth state only
export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  
  return useMemo(
    () => ({ isAuthenticated, setIsAuthenticated, isBiometricSupported, setBiometricEnabled, biometricEnabled }),
    [isAuthenticated, isBiometricSupported, biometricEnabled]
  );
}

// useAuthCallbacks.js - manage PIN setup flow
export function useAuthCallbacks({ isAuthenticated, onSeedConfirmed }) {
  const [settingUpPin, setSettingUpPin] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinStep, setPinStep] = useState('enter');
  
  // ... callbacks
}

// useAuth.js - combines both (for backwards compatibility)
export function useAuth({ onSeedConfirmed }) {
  const authState = useAuthState();
  const callbacks = useAuthCallbacks({ isAuthenticated: authState.isAuthenticated, onSeedConfirmed });
  
  return useMemo(
    () => ({ ...authState, ...callbacks }),
    [authState, callbacks]
  );
}
```

### 5. Consolidate Notification Systems (2 hour task)
**Issue**: Legacy toast + new snackbar coexist
**Action**:
1. Remove `TransactionToast.jsx` component
2. Update UIContext to use snackbar only
3. Change all `showToast()` calls to `showSnackbar()`
4. Remove toast from ToastContainer.jsx

---

## Medium-Term Refactoring (Weeks 3-4)

### 6. Simplify Navigation State (3-4 hour task)
**Current State**:
- RootNavigator uses `useNavigationState()`
- NavigationHandlersContext stores callbacks
- AppNavigationContext manages state
- Three separate systems = confusion

**Solution**: Create single NavigationContext
```javascript
// contexts/NavigationContext.js
const NavigationContext = createContext();

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used within NavigationProvider');
  return context;
};

export const NavigationProvider = ({ children }) => {
  // Auth state
  const { isAuthenticated, settingUpPin } = useAuth();
  const { wallet } = useWallet();
  
  // Navigation state
  const shouldShowAuth = !isAuthenticated || settingUpPin;
  const shouldShowPinOverlay = settingUpPin;
  
  // Navigation handlers
  const handlePinSetupComplete = useCallback(() => { ... }, []);
  const handlePinChangeComplete = useCallback(() => { ... }, []);
  
  const value = useMemo(
    () => ({
      shouldShowAuth,
      shouldShowPinOverlay,
      handlePinSetupComplete,
      handlePinChangeComplete,
    }),
    [shouldShowAuth, shouldShowPinOverlay, handlePinSetupComplete, handlePinChangeComplete]
  );
  
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
```

### 7. Extract Custom Hooks (2-3 hours each)
Create focused hooks for common patterns:

```javascript
// hooks/useTransactionFlow.js
export function useTransactionFlow() {
  const sendFlow = useSendFlow();
  const transactionBuild = useTransactionBuild();
  const transactionExecution = useTransactionExecution();
  
  return useMemo(
    () => ({
      recipient: sendFlow.sendRecipient,
      amount: sendFlow.sendAmount,
      intent: transactionBuild.sendIntent,
      broadcastedTxid: transactionExecution.broadcastedTxid,
      createIntent: sendFlow.assetType === 'BTC' 
        ? transactionBuild.createBtcIntent 
        : transactionBuild.createUnitIntent,
      broadcast: transactionExecution.broadcastIntent,
    }),
    [sendFlow, transactionBuild, transactionExecution]
  );
}

// hooks/useDataPolling.js
export function useDataPolling() {
  const { fetchBalance } = useBalance();
  const { fetchTransactionHistory } = useTransactionHistory();
  const { fetchVault } = useVaultData();
  
  usePolling({
    onPoll: useCallback(() => {
      fetchBalance();
      fetchTransactionHistory();
      fetchVault();
    }, [fetchBalance, fetchTransactionHistory, fetchVault]),
    interval: 10000,
  });
}
```

---

## Long-Term Improvements (Month 2+)

### 8. Add TypeScript (Week 1 of migration)
Don't do all at once. Prioritize:
1. Service layer types
2. Context types
3. Custom hook return types
4. Components last (lowest priority)

Start with:
```bash
npm install -D typescript @types/react-native @types/react
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "jsx": "react-native",
    "strict": false,
    "moduleResolution": "node"
  }
}
```

### 9. Add E2E Tests with Detox
```bash
npm install -D detox detox-cli

# Create tests/e2e/wallet.e2e.js
describe('Wallet Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  it('should create new wallet', async () => {
    await element(by.text('Create Wallet')).tap();
    // ... test steps
  });
  
  it('should send BTC transaction', async () => {
    // ... test steps
  });
});
```

### 10. Create Component Library Documentation
```bash
npm install -D storybook
npx storybook init
```

Create stories for reusable components:
- Toast/Snackbar patterns
- Modal components
- Form inputs
- Navigation patterns

---

## Testing Checklist

After each refactoring, verify:

```bash
# Run tests
npm test

# Check coverage
npm test -- --coverage

# Lint
npm run lint

# Type check (if added TypeScript)
npx tsc --noEmit

# Manual testing
- [ ] Create new wallet
- [ ] Import wallet
- [ ] Switch accounts
- [ ] Send BTC transaction
- [ ] Send UNIT transaction
- [ ] View transaction history
- [ ] Change PIN
- [ ] Lock/unlock with biometric
- [ ] Test error scenarios (insufficient funds, network errors)
```

---

## Metrics to Track

After implementing these changes, measure:

1. **Code Metrics**
   - Largest hook should be < 150 LOC
   - Largest context should be < 200 LOC
   - Zero console.log in production
   - Zero empty catch blocks

2. **Test Metrics**
   - Maintain 70%+ coverage
   - Add 20+ new tests for refactored code
   - Add E2E tests for critical flows

3. **Build Metrics**
   - Bundle size (check after removing debug logging)
   - Build time
   - Performance profiling

---

## Priority Matrix

```
High Priority, High Effort:
  - Refactor useAuth Hook
  - Simplify Navigation State
  - Add E2E Tests

High Priority, Low Effort:
  - Remove Debug Logging ✓ START HERE
  - Fix Silent Error Handlers ✓
  - Extract Transaction Decoder ✓
  - Consolidate Notifications ✓

Low Priority, High Effort:
  - TypeScript Migration
  - Component Storybook

Low Priority, Low Effort:
  - Improve JSDoc coverage
  - Create architecture diagrams
```

---

## Estimated Timeline

- **Week 1**: Items 1-3 (8 hours) - Quick wins
- **Week 2**: Items 4-5 (6 hours) - Medium complexity
- **Week 3-4**: Items 6-7 (8-10 hours) - Major refactoring
- **Month 2+**: Items 8-10 - Long-term improvements

**Total**: ~30-40 hours of development effort to significantly improve code quality

