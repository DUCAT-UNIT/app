# AuthContext + AppNavigationContext Merge Analysis

## Summary
Merging AuthContext and AppNavigationContext into a single AuthSessionContext.

**Reason for merge**: Both contexts manage the same `inactivityTimerRef` and `resetInactivityTimer`, creating duplicate logic and potential state inconsistencies.

---

## Current State Analysis

### AuthContext (106 lines)
**Responsibilities**:
- Auth state from `useAuth` hook (isAuthenticated, user, login, logout, etc.)
- Onboarding state (seedConfirmed, setSeedConfirmed, seedConfirmedRef)
- Wallet reset (resetWalletAndState)
- **Inactivity timer** (inactivityTimerRef, resetInactivityTimer)
- Amount input ref (amountInputRef)

**Exports**:
- `useAuth()` - Main hook
- `useOnboardingFlow()` - Backward compat hook
- `AuthProvider` - Provider component

**Props**:
- `onSeedConfirmed` - Callback when seed confirmed
- `resetWallet` - Callback to reset wallet

### AppNavigationContext (44 lines)
**Responsibilities**:
- Active tab state (activeTab, setActiveTab)
- **Inactivity timer** (inactivityTimerRef, resetInactivityTimer) - DUPLICATE!

**Exports**:
- `useAppNavigation()` - Main hook
- `AppNavigationProvider` - Provider component

**Props**:
- `_inactivityTimeout` - Configurable timeout (default 300000ms = 5min)

### PROBLEM: Duplicate Inactivity Timer
- AuthContext has `inactivityTimerRef` and `resetInactivityTimer`
- AppNavigationContext has `inactivityTimerRef` and `resetInactivityTimer`
- **Both are INDEPENDENT** - no shared state!
- This is a bug waiting to happen

---

## File Usage Analysis

### Files using `useAuth()` (AuthContext):
1. `/hooks/useAuth.js` - The actual auth hook
2. `/hooks/useNavigationState.js` - Determines which screens to show
3. `/hooks/useSettings.js` - Settings management
4. `/hooks/useAuthSettings.js` - Auth-specific settings
5. `/navigation/AuthStack.js` - Auth screen navigation
6. `/navigation/AppNavigator.js` - Main app navigator
7. `/navigation/RootNavigator.js` - Root navigation
8. `/pages/OnboardingPage.js` - Onboarding flow
9. `/pages/WalletPage.js` - Main wallet screen
10. `/contexts/SeedPhraseContext.js` - Seed phrase management
11. `/contexts/AirdropContext.js` - Airdrop flow
12. Tests

### Files using `useAppNavigation()` (AppNavigationContext):
1. **NONE in production code!** ⚠️
2. Only used in its own test file

### Files using both contexts:
- **NONE**

### Provider locations:
- `AuthProvider` - `/App.js` line 202 (outermost)
- `AppNavigationProvider` - **NOT IN PROVIDER TREE!** ⚠️

---

## KEY FINDING: AppNavigationContext is NOT USED!

**Critical discovery**: AppNavigationContext exists but is:
1. **NOT in the provider tree** (App.js doesn't include AppNavigationProvider)
2. **NOT imported anywhere** except its test file
3. **Dead code** - can be safely removed without any migration!

---

## Merge Strategy

### Option A: Delete AppNavigationContext (RECOMMENDED)
**Rationale**: It's dead code, not in provider tree, no consumers

**Steps**:
1. Delete `/contexts/AppNavigationContext.js`
2. Delete `/contexts/__tests__/AppNavigationContext.test.js`
3. Done!

**Risk**: ZERO - it's not used anywhere

### Option B: Merge into AuthContext
**Rationale**: If we want activeTab management in auth context

**Steps**:
1. Add `activeTab` and `setActiveTab` to AuthContext
2. Keep existing AuthContext functionality
3. Update exports to include activeTab
4. Delete AppNavigationContext

**Risk**: LOW - just adding two new state variables

---

## Recommended Action

**DELETE AppNavigationContext entirely** - it's unused dead code.

If we need tab navigation state later, we can add it to a proper navigation context or use React Navigation's built-in state management.

---

## Consumer Files (if we do merge)

### Would need updates:
- **NONE** - no production code uses AppNavigationContext

### Tests to update:
- Delete `/contexts/__tests__/AppNavigationContext.test.js`

---

## Breaking Changes

**NONE** - AppNavigationContext is not used in any production code.

---

## Testing Requirements

### If deleting (Option A):
1. Delete the context file
2. Delete the test file
3. Run full test suite - should still pass (1220 tests)
4. No manual testing needed - it's unused

### If merging (Option B):
1. Run full test suite
2. Verify auth flows still work
3. No other testing needed - no consumers to break

---

## Conclusion

**AppNavigationContext is dead code.**

The "duplicate inactivity timer" issue doesn't actually exist in practice because AppNavigationContext isn't even in the provider tree.

**Recommendation**: Delete AppNavigationContext (Option A) - safest and cleanest approach.
