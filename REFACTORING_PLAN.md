# 🚀 Ducat Wallet Refactoring & Improvement Plan

**Timeline**: 3 days (12 hours/day = 36 hours total)
**Start Date**: 2025-11-11
**Target Completion**: 2025-11-14

---

## 📋 Day 1: Security + Foundation (12 hours)

### Phase 1.1: Security Fixes (6 hours)

**Priority: CRITICAL**

- [ ] **Upgrade PIN Security** (2 hours)
  - Replace SHA256 with PBKDF2 (using expo-crypto)
  - Use 100,000+ iterations
  - Add migration for existing users (re-hash on next login)
  - Location: `services/authService.js`

- [ ] **Minimize Mnemonic Exposure** (2 hours)
  - Audit all mnemonic usage in `transactionService.js`, `walletService.js`
  - Reduce mnemonic lifetime to <100ms per operation
  - Clear derived keys after use
  - Add memory cleanup verification

- [ ] **Hardware-Backed Key Storage Investigation** (1 hour)
  - Research iOS Secure Enclave / Android KeyStore integration
  - Document findings for future implementation

- [ ] **Screen Capture Prevention Audit** (1 hour)
  - Verify `expo-screen-capture` on all sensitive screens
  - Add to PIN entry, seed phrase display, private key views

### Phase 1.2: Development Standards (3 hours)

- [ ] **Add ESLint + Prettier** (1.5 hours)

  ```bash
  npm install --save-dev eslint prettier eslint-config-prettier
  npm install --save-dev @react-native-community/eslint-config
  ```

  - Create `.eslintrc.js` with React Native config
  - Create `.prettierrc` with team standards
  - Add pre-commit hook (husky) to auto-format
  - Run on entire codebase: `npx prettier --write "**/*.{js,jsx}"`

- [ ] **Set Up Error Monitoring with Sentry** (1 hour)

  ```bash
  npm install @sentry/react-native
  ```

  - Create Sentry account
  - Add Sentry initialization to `App.js`
  - Add breadcrumbs for transaction flow
  - Test error reporting

- [ ] **Create Constants File Structure** (0.5 hours)
  ```
  /constants
    ├── bitcoin.js      # Dust limit, fee rates, network params
    ├── security.js     # PIN rules, lockout times
    ├── ui.js           # Animation durations, sizes
    └── index.js        # Export all
  ```

  - Extract all magic numbers
  - Add JSDoc comments explaining values
  - Update imports across codebase

### Phase 1.3: Documentation (3 hours)

- [ ] **Create Architecture Documentation** (2 hours)
  - Add `docs/ARCHITECTURE.md` explaining:
    - Context hierarchy diagram
    - Transaction flow diagram
    - State management patterns
    - Security model
  - Add `docs/SECURITY.md` with:
    - Threat model
    - Security assumptions
    - Known limitations

- [ ] **Add README to `/app/app`** (1 hour)
  - Project structure
  - Getting started
  - Environment setup
  - Testing instructions

---

## 📋 Day 2: Testing + Refactoring (12 hours)

### Phase 2.1: Set Up Testing Framework (1 hour)

**Priority: CRITICAL**

```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
npm install --save-dev @testing-library/react-hooks
```

- [ ] Create `jest.config.js`
- [ ] Set up test file structure: `__tests__/` directories
- [ ] Add npm scripts: `"test": "jest"`, `"test:watch": "jest --watch"`
- [ ] Configure coverage thresholds (start with 50%, increase to 80%)

### Phase 2.2: Test Services (5 hours)

**Critical Order:**

1. [ ] **Test `walletService.js`** (1 hour)
   - `createWallet()` - generates valid BIP39 mnemonic
   - `importWallet()` - validates and imports mnemonic
   - Address derivation (BIP44, BIP84, BIP86)
   - Edge cases: invalid mnemonics, wrong word count

2. [ ] **Test `transactionService.js`** (2 hours)
   - UTXO selection algorithm
   - PSBT creation for BTC sends
   - PSBT creation for Runes sends
   - Fee calculation
   - Change output creation
   - Dust handling
   - Edge cases: insufficient funds, dust amounts, empty UTXOs

3. [ ] **Test `authService.js`** (1 hour)
   - PIN hashing (with new PBKDF2)
   - PIN verification
   - Biometric authentication
   - Rate limiting
   - Lockout mechanism
   - SecureStore mocking

4. [ ] **Test `balanceService.js`** (1 hour)
   - Balance fetching
   - UTXO fetching
   - Runes balance calculation
   - Error handling for API failures

### Phase 2.3: Test Utilities (1 hour)

- [ ] **Test `errorParser.js`**
  - Pattern matching for all error types
  - Fallback messages

- [ ] **Test `validation.js`**
  - Address validation (BTC, Taproot, Runes)
  - Amount validation
  - Edge cases

- [ ] **Test `bitcoinUtils.js`**
  - Format conversions (sats ↔ BTC)
  - Address generation
  - Network parameter handling

### Phase 2.4: Refactor Transaction Service (3 hours)

**Current Issues:**

- `createUnitIntent`: 227 lines
- `signIntent`: 202 lines

- [ ] **Extract UTXO Selection** (1 hour)

  ```javascript
  // Create new file: services/utxoSelectionService.js
  export function selectUTXOsForAmount(utxos, targetAmount, feeRate) {}
  export function selectUTXOsForRunes(utxos, runeName, amount) {}
  ```

- [ ] **Extract PSBT Builders** (1 hour)

  ```javascript
  // Create new file: services/psbtBuilderService.js
  export function buildBtcPSBT(params) {}
  export function buildRunesPSBT(params) {}
  ```

- [ ] **Simplify Transaction Service** (1 hour)
  ```javascript
  // transactionService.js becomes orchestration only
  export async function createBtcIntent(params) {
    const utxos = await selectUTXOsForAmount(...);
    const psbt = await buildBtcPSBT(utxos, ...);
    return psbt;
  }
  ```

### Phase 2.5: Code Quality Cleanup (2 hours)

- [ ] **Remove Console Logs** (1 hour)
  - Replace all 29 `console.log/warn/error` with Sentry logging
  - Add debug utility:
    ```javascript
    // utils/logger.js
    export const logger = {
      debug: __DEV__ ? console.log : Sentry.addBreadcrumb,
      error: Sentry.captureException,
      info: Sentry.captureMessage,
    };
    ```

- [ ] **Add JSDoc to Critical Functions** (1 hour)
  - Document all service functions
  - Document complex algorithms
  - Document security assumptions

---

## 📋 Day 3: Architecture + Production Hardening (12 hours)

### Phase 3.1: Context Consolidation (4 hours)

**Goal**: Consolidate 17 contexts → ~10 contexts

- [ ] **Merge Transaction Contexts** (2 hours)
  - Merge `SendFlowContext`, `TransactionBuildContext`, `TransactionExecutionContext`
  - Create new `contexts/TransactionContext.js`
  - Update all consumers
  - Test thoroughly

- [ ] **Merge Navigation Contexts** (1 hour)
  - Merge `AppNavigationContext` and `NavigationHandlersContext`
  - Create `contexts/NavigationContext.js`

- [ ] **Merge Vault Contexts** (1 hour)
  - Merge `VaultContext` and `VaultDataContext`

### Phase 3.2: Break Up NavigationHandlersContext (2 hours)

- [ ] Create feature-specific navigation hooks:
  ```javascript
  // hooks/useOnboardingNavigation.js
  // hooks/useTransactionNavigation.js
  // hooks/useSettingsNavigation.js
  ```
- [ ] Remove NavigationHandlersContext entirely
- [ ] Update all consumers

### Phase 3.3: Simplify RootNavigator (1 hour)

- [ ] Extract conditional logic to helper functions:
  ```javascript
  const isWalletNotSetup = () => !wallet || !seedConfirmed;
  const isInAuthFlow = () => settingUpPin && !changingPin;
  const requiresAuth = () => showPinEntry || (!isAuthenticated && wallet && seedConfirmed);
  const shouldShowAuth = isWalletNotSetup() || isInAuthFlow() || requiresAuth();
  ```

### Phase 3.4: Production Security (3 hours)

- [ ] **Add SSL Certificate Pinning** (1 hour)

  ```bash
  npm install react-native-ssl-pinning
  ```

  - Pin certificates for all API endpoints
  - Test with expired cert

- [ ] **Add Jailbreak/Root Detection** (1 hour)

  ```bash
  npm install jail-monkey
  ```

  - Block app on rooted devices
  - Warn users about security risks

- [ ] **Add React ErrorBoundary** (1 hour)
  ```javascript
  // components/ErrorBoundary.js
  class ErrorBoundary extends React.Component {
    componentDidCatch(error, errorInfo) {
      Sentry.captureException(error, { extra: errorInfo });
    }
  }
  ```

  - Wrap app root in ErrorBoundary
  - Show user-friendly error UI

### Phase 3.5: Final Testing & QA (2 hours)

- [ ] **Security Audit** (1 hour)
  - Test all security features
  - Verify mnemonic never logged
  - Test PIN lockout mechanism
  - Verify biometric fallback

- [ ] **End-to-End Testing** (1 hour)
  - Full onboarding flow (create wallet)
  - Full onboarding flow (import wallet)
  - Send BTC transaction
  - Send Runes transaction
  - Transaction history
  - Settings changes

---

## 📊 Success Metrics

### Day 1 Exit Criteria

- ✅ PBKDF2 PIN hashing implemented
- ✅ Mnemonic exposure reduced to <100ms
- ✅ Sentry integrated and receiving errors
- ✅ ESLint/Prettier configured, codebase formatted
- ✅ All magic numbers extracted to constants
- ✅ Architecture docs created

### Day 2 Exit Criteria

- ✅ Jest configured and working
- ✅ Test coverage ≥50% overall
- ✅ Test coverage ≥80% for services
- ✅ Transaction service split into 3+ smaller services
- ✅ Console.logs replaced with Sentry
- ✅ JSDoc on critical functions

### Day 3 Exit Criteria

- ✅ Context count reduced to ≤10
- ✅ NavigationHandlersContext eliminated
- ✅ RootNavigator simplified
- ✅ SSL pinning implemented
- ✅ Jailbreak/root detection active
- ✅ ErrorBoundary added
- ✅ All security features tested
- ✅ Full E2E testing complete

---

## 🎯 Critical Path (Must Complete)

1. ✅ Security fixes (PIN hashing, mnemonic exposure)
2. ✅ Test coverage for services
3. ✅ Context consolidation
4. ✅ SSL pinning
5. ✅ Error monitoring

---

## 🚀 Quick Reference Commands

### Run Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
npm run format
```

### Build

```bash
npm run build:testnet
npm run build:mainnet
```

---

## 📝 Notes

- Current on testnet (Mutinynet) - reduces real-world risk
- No mainnet until all security items complete
- TypeScript migration deferred (post-launch)
- Hardware-backed storage deferred (post-launch)

---

## 🔗 Key Files to Modify

### Day 1

- `services/authService.js` - PIN hashing upgrade
- `services/transactionService.js` - Mnemonic audit
- `services/walletService.js` - Mnemonic audit
- `.eslintrc.js` - NEW
- `.prettierrc` - NEW
- `constants/` - NEW directory
- `App.js` - Sentry integration
- `docs/ARCHITECTURE.md` - NEW
- `docs/SECURITY.md` - NEW

### Day 2

- `jest.config.js` - NEW
- `__tests__/services/` - NEW directory
- `services/utxoSelectionService.js` - NEW
- `services/psbtBuilderService.js` - NEW
- `services/transactionService.js` - Refactor
- `utils/logger.js` - NEW

### Day 3

- `contexts/TransactionContext.js` - NEW (consolidated)
- `contexts/NavigationContext.js` - NEW (consolidated)
- DELETE: `contexts/TransactionBuildContext.js`
- DELETE: `contexts/TransactionExecutionContext.js`
- DELETE: `contexts/NavigationHandlersContext.js`
- `hooks/useOnboardingNavigation.js` - NEW
- `hooks/useTransactionNavigation.js` - NEW
- `hooks/useSettingsNavigation.js` - NEW
- `navigation/RootNavigator.js` - Simplify
- `components/ErrorBoundary.js` - NEW

---

**Last Updated**: 2025-11-11
**Status**: Ready to start Phase 1.1
