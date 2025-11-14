# Cleanup TODO

This document tracks remaining cleanup tasks for the Ducat app codebase.

## ✅ Completed

1. **Persist PIN lockout to secure storage** (Commit: 91495e5)
   - PIN lockout state now persists across app restarts
   - Failed attempts and lockout time stored in secure storage
   - Prevents bypassing lockout by restarting app

2. **Fix cancel button in wallet creation flow** (Commit: 3797d7c)
   - Cancel buttons now properly return to welcome screen
   - Consistent behavior with import wallet flow

3. **Improve vault WebView reliability** (Commit: f5af20c)
   - Added credential validation
   - Implemented handshake protocol
   - Added automatic retry logic

4. **Make vault messages descriptive** (Commit: ba61195)
   - User-facing messages clearly explain what's happening
   - Better transparency during loading

## 🔄 In Progress / Recommended

### 1. Replace console.log with logger utility

**Status**: Partially started
**Priority**: Medium
**Effort**: ~2-3 hours

The app has a centralized `logger` utility (`utils/logger.js`) that routes logs to Sentry in production and console in development. Many files still use `console.log/warn/error` directly.

**Files to update** (20+ files):
```
./contexts/TransactionBuildContext.js
./contexts/VaultContext.js
./contexts/TransactionExecutionContext.js
./contexts/PendingTransactionsContext.js
./contexts/UIContext.js
./screens/wallet/VaultScreen.jsx
./screens/send/AddressInputScreen.jsx
./screens/send/ProcessingScreen.jsx
./screens/send/AssetSelectorScreen.jsx
./screens/send/AmountInputScreen.jsx
./components/Snackbar.jsx
./hooks/useVaultWebView.js
./hooks/useVaultMessages.js
./hooks/usePendingTransactionsStorage.js
./pages/WalletPage.js
./services/vaultService.js
./services/transaction/utxoSelection.js
./services/transaction/runesTransaction.js
```

**Example replacement**:
```javascript
// Before
console.log('🏦 Injecting wallet credentials');
console.error('❌ Failed to connect');

// After
import { logger } from '../utils/logger';
logger.debug('Injecting wallet credentials');
logger.error('Failed to connect vault');
```

**Benefits**:
- Production logs go to Sentry for debugging
- Dev logs stay in console
- Consistent logging format
- Better error tracking

**Note**: Vault-related console.logs are particularly valuable for debugging during development. Consider keeping them as `logger.debug()` calls.

---

### 2. Consolidate notification systems

**Status**: Not started
**Priority**: Medium
**Effort**: ~3-4 hours

Currently have both Toast and Snackbar systems in UIContext, which can be confusing.

**Current state**:
- `Toast` - Simple notifications (legacy)
- `TransactionToast` - Transaction-specific
- `Snackbar` - New system for transaction states with actions

**Files involved**:
```
./components/Toast.jsx (737 B)
./components/ToastContainer.jsx (1 KiB)
./components/TransactionToast.jsx (5 KiB)
./components/Snackbar.jsx (5 KiB)
./contexts/UIContext.js (manages both)
```

**Recommendation**:
Keep Snackbar as the primary system and migrate Toast usage:

1. **Snackbar** for important actions:
   - Transaction states (pending, submitted, success, error)
   - Actions with clickable links
   - Persistent notifications that need user acknowledgment

2. **Toast** (simplified) for ephemeral messages:
   - "Copied to clipboard"
   - "Settings saved"
   - Brief confirmations

**Steps**:
1. Audit all `showToast` calls
2. Migrate transaction-related toasts to Snackbar
3. Keep simple toasts for non-critical feedback
4. Update UIContext to clarify the distinction
5. Add documentation comments

---

### 3. Add tests for PIN lockout persistence

**Status**: Not started
**Priority**: High (security feature)
**Effort**: ~1-2 hours

The PIN lockout persistence needs test coverage to ensure it works correctly.

**Test cases needed**:
```javascript
describe('PIN lockout persistence', () => {
  it('should persist failed attempts to secure storage');
  it('should persist lockout expiry time');
  it('should load lockout state on app restart');
  it('should clear lockout state after successful PIN');
  it('should auto-clear expired lockouts');
  it('should prevent bypassing lockout by restarting app');
});
```

---

### 4. Document vault credential injection flow

**Status**: Not started
**Priority**: Low
**Effort**: ~30 minutes

The vault credential injection has been significantly improved but needs documentation.

**Create**: `docs/VAULT_CREDENTIAL_FLOW.md`

**Content**:
- Handshake protocol diagram
- Retry logic flowchart
- Error handling scenarios
- WebView integration guide

---

## 📊 Code Quality Metrics

### Console.log Usage
```bash
# Count console statements in production code (excluding tests/mocks)
find . -type f \( -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/coverage/*" \
  -not -path "*/__tests__/*" \
  | xargs grep -c "console\." 2>/dev/null \
  | awk -F: '{sum+=$2} END {print sum}'
# Result: ~200+ console statements
```

### Notification Systems
- Toast system: 3 files, ~7 KB
- Snackbar system: 1 file, 5 KB
- Context management: UIContext handles both

---

## 🎯 Recommended Priority Order

1. **High Priority**:
   - ✅ Persist PIN lockout *(completed)*
   - Add tests for PIN lockout

2. **Medium Priority**:
   - Replace console.logs in critical paths (vault, auth, transactions)
   - Consolidate notification systems

3. **Low Priority**:
   - Replace remaining console.logs in UI components
   - Add vault documentation

---

## Notes

- The logger utility is already set up and working well
- Sentry integration is configured
- Most console.logs are for development debugging (vault, transactions)
- Consider a gradual migration rather than all-at-once

