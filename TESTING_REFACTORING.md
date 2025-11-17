# Testing Refactoring Changes

**Purpose:** Verify that all refactoring changes work correctly without breaking existing functionality.

---

## Quick Test Commands

### 1. Run Full Test Suite
```bash
npm test
```

### 2. Run Specific Test Files
```bash
# Test formatters (Bitcoin conversions)
npm test -- utils/__tests__/formatters.test.js

# Test services
npm test -- services/__tests__/

# Test hooks
npm test -- hooks/__tests__/
```

### 3. Check for Import Errors
```bash
# Check if all imports resolve correctly
npm run lint
```

### 4. Build the App
```bash
# Check for build errors
npm start
```

---

## Manual Testing Checklist

### Phase 1 & 2: Dead Code & Console Logging

- [ ] **App starts without errors**
  - Run `npm start` and launch on device/simulator
  - No crash on startup
  - No console errors in terminal

- [ ] **Logger works correctly**
  - Check terminal for logs using new logger format
  - Verify no `console.log/error/warn` in production code

### Phase 3.1: Bitcoin Conversions

- [ ] **Balance display works**
  - Navigate to wallet screen
  - Check that BTC balances display correctly
  - Verify amounts match what was showing before

- [ ] **Asset detail screen works**
  - Tap on any asset
  - Verify balance formatting is correct
  - Check transaction amounts display properly

### Phase 3.2: API Services

- [ ] **Vault service works**
  - Check vault data loads correctly
  - Verify vault history displays
  - Test vault operations (if applicable)

- [ ] **Airdrop works**
  - Test requesting testnet coins
  - Verify airdrop completes successfully

- [ ] **Balance fetching works**
  - Pull to refresh on wallet screen
  - Verify balances update correctly
  - Check both SegWit and Taproot balances

### Phase 3.3: Persisted State Hooks

- [ ] **Wallet creation persists**
  - Start creating a new wallet
  - Close app mid-creation
  - Reopen app - should resume where you left off
  - Verify seed phrase is still there

- [ ] **Wallet import persists**
  - Start importing a wallet
  - Enter a few seed words
  - Close app
  - Reopen - verify entered words are still there

- [ ] **Seed verification persists**
  - Start seed verification
  - Select some words
  - Close app
  - Reopen - verify selections are preserved

---

## Automated Test Coverage

### Files with Tests

**Utilities:**
- ✅ `utils/formatters.js` → `utils/__tests__/formatters.test.js`
- ✅ `utils/bitcoin/conversions.js` → covered by formatters tests
- ✅ `utils/apiClient.js` → `utils/__tests__/apiClient.test.js` (if exists)

**Services:**
- ✅ `services/vaultService.js` → `services/__tests__/vaultService.test.js` (if exists)
- ✅ `services/balanceService.js` → `services/__tests__/balanceService.test.js` (if exists)
- ✅ `services/airdropService.js` → `services/__tests__/airdropService.test.js` (if exists)

**Hooks:**
- ✅ `hooks/usePersistedState.js` → `hooks/__tests__/usePersistedState.test.js`
- ✅ `hooks/useWalletCreation.js` → `hooks/__tests__/useWalletCreation.test.js` (if exists)
- ✅ `hooks/useWalletImport.js` → `hooks/__tests__/useWalletImport.test.js` (if exists)

---

## Expected Test Results

### What Should Pass
- ✅ All existing tests should continue to pass
- ✅ No new test failures introduced
- ✅ Import statements resolve correctly
- ✅ Type checking passes (if using TypeScript)

### What Might Fail (Expected)
- ⚠️ Tests that explicitly check file line numbers (update them)
- ⚠️ Tests that mock `AsyncStorage` in refactored hooks (need updates)
- ⚠️ Snapshot tests (update snapshots with `npm test -- -u`)

---

## Common Issues & Fixes

### Issue: "formatBalance is not a function"
**Fix:** Already resolved - added to `utils/formatters/index.js`

### Issue: "Cannot find module 'usePersistedState'"
**Fix:** Check import path - should be `'./usePersistedState'` not `'../hooks/usePersistedState'`

### Issue: Test failures in refactored hooks
**Fix:** Update mocks to use `usePersistedObject` instead of `AsyncStorage` directly

### Issue: App doesn't start
**Likely cause:** Import path error
**Fix:** Check terminal for specific error, fix import

---

## Verification Steps

### Step 1: Run Tests
```bash
npm test 2>&1 | tee test-results.txt
```

### Step 2: Check Coverage
```bash
npm test -- --coverage
```

### Step 3: Build Check
```bash
npm start
# Wait for bundling to complete
# Check for any errors in terminal
```

### Step 4: Device Test
1. Launch app on device/simulator
2. Test critical flows:
   - Create wallet
   - Import wallet
   - Check balances
   - View transactions
   - Request airdrop

---

## Rollback Plan (if needed)

If tests fail or app breaks:

```bash
# Rollback all changes
git stash

# Or rollback specific files
git checkout HEAD -- <file-path>

# Or create a new branch and revert
git checkout -b rollback-refactoring
git revert <commit-hash>
```

---

## Success Criteria

✅ **All tests pass** - No new failures
✅ **App builds** - No compilation errors
✅ **App runs** - Launches successfully
✅ **Core flows work** - Wallet creation/import/balance display
✅ **No console errors** - Clean terminal output
✅ **State persists** - AsyncStorage functionality intact

---

## Next Steps After Testing

If all tests pass:
1. ✅ Commit changes
2. ✅ Update documentation
3. ✅ Continue with Phase 4

If tests fail:
1. ❌ Identify failing tests
2. ❌ Fix issues
3. ❌ Re-run tests
4. ❌ Repeat until all pass

---

**Ready to test!** 🧪
