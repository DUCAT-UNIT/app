# TypeScript Migration Plan - 4 Parallel Streams

## Current State
- **140 TypeScript errors** remaining
- **7 navigation files** still in JavaScript
- **42 `as any` casts** to eliminate
- Foundation types (types/, theme/, constants/, styles/) are complete with 0 errors

---

## Stream 1: Navigation Layer Migration

**Scope:** Convert all navigation files from JavaScript to TypeScript

**Files (7 total):**
```
navigation/types.js          → navigation/types.ts
navigation/RootNavigator.js  → navigation/RootNavigator.tsx
navigation/AppNavigator.js   → navigation/AppNavigator.tsx
navigation/AuthStack.js      → navigation/AuthStack.tsx
navigation/MainTabs.js       → navigation/MainTabs.tsx
navigation/WalletStackNavigator.js → navigation/WalletStackNavigator.tsx
navigation/SendNavigator.js  → navigation/SendNavigator.tsx
```

**Tasks:**
1. Convert `navigation/types.js` to TypeScript, integrate with `types/index.d.ts` RootStackParamList
2. Add proper typing to all navigator components using `@react-navigation/native-stack`
3. Type all screen props with `NativeStackScreenProps<RootStackParamList, 'ScreenName'>`
4. Remove any implicit `any` from navigation params

**Validation:** `npx tsc --noEmit` shows 0 errors in `navigation/`

---

## Stream 2: Pages & Core Screens (High Error Count)

**Scope:** Fix type errors in the highest-error files

**Files (6 files, 78 errors):**
```
pages/WalletPage.tsx           - 21 errors
pages/OnboardingPage.tsx       - 17 errors
screens/wallet/WalletScreen.tsx    - 13 errors
screens/wallet/AssetDetailScreen.tsx - 12 errors
screens/wallet/ReceiveScreen.tsx   - 8 errors
screens/send/AmountInputScreen.tsx - 8 errors
```

**Common Error Patterns to Fix:**
- `Toast` type mismatch (`id: number` vs `id: string`)
- `SnackbarParams` missing `message` property
- `WalletAddresses` vs `Wallet` type confusion
- `AssetType` null vs undefined handling
- Function signature mismatches in callbacks

**Tasks:**
1. Align `NotificationContext` Toast/Snackbar types with `types/components.d.ts`
2. Fix `WalletAddresses` type usage in pages
3. Ensure all callback props have correct signatures
4. Fix nullable type handling (`null` vs `undefined`)

**Validation:** Error count in these files drops to 0

---

## Stream 3: Send Flow & Transaction Screens

**Scope:** Fix type errors in send/transaction flow

**Files (10 files, 34 errors):**
```
screens/send/TurboProcessingScreen.tsx  - 7 errors
screens/send/ConfirmationScreen.tsx     - 7 errors
screens/send/ReviewScreen.tsx           - 5 errors
screens/send/ProcessingScreen.tsx       - 5 errors
screens/settings/TurboHistoryScreen.tsx - 7 errors
screens/wallet/TransactionHistoryScreen.tsx - 2 errors
screens/send/TurboClaimingScreen.tsx    - 1 error
screens/send/TurboLoadingScreen.tsx     - 1 error
screens/send/AssetSelectorScreen.tsx    - 1 error
screens/settings/TurboQRCodeScreen.tsx  - 1 error
```

**Tasks:**
1. Fix `TransactionBuildContext` type exports
2. Align `SendFlowContext` AssetType with shared type
3. Fix RuneBalance type mismatches
4. Correct `SendIntent` interface usage
5. Fix callback signature mismatches

**Validation:** Error count in send/transaction screens drops to 0

---

## Stream 4: Settings, Cashu & Cleanup

**Scope:** Fix remaining screens + eliminate `as any` casts

**Files (5 screens, 6 errors):**
```
screens/wallet/VaultScreen.tsx      - 2 errors
screens/cashu/CashuSendScreen.tsx   - 2 errors
screens/cashu/CashuReceiveScreen.tsx - 2 errors
screens/settings/AdvancedScreen.tsx - 1 error
screens/settings/AboutScreen.tsx    - 1 error
```

**Plus `as any` elimination (42 casts in these files):**
```
services/turbo/turboTokenStorage.ts     - 11 casts
services/turbo/turboLinkingConfig.ts    - 11 casts
services/cashu/operations/cashuReceiveP2PK.ts - 6 casts
contexts/NotificationContext.tsx        - 4 casts
hooks/useTransactionBuilder.ts          - 3 casts
services/passkey/* (various)            - 4 casts
Other                                   - 3 casts
```

**Tasks:**
1. Fix remaining screen type errors
2. Replace `as any` with proper types in turbo services
3. Replace `as any` with proper types in cashu operations
4. Fix NotificationContext internal types
5. Clean up passkey service types

**Validation:**
- 0 errors in settings/cashu screens
- `as any` count reduced from 42 to <10 (some may be unavoidable with external libs)

---

## Execution Order

All streams can run **in parallel** since they touch different files.

**Dependencies:**
- Stream 2 depends on Stream 1's `navigation/types.ts` being done first (for screen prop types)
- Stream 3 & 4 can start immediately

**Estimated Scope:**
| Stream | Files | Errors | Complexity |
|--------|-------|--------|------------|
| 1 | 7 | 0 (new) | Medium |
| 2 | 6 | 78 | High |
| 3 | 10 | 34 | Medium |
| 4 | 5 + services | 6 + 42 casts | Medium |

---

## Success Criteria

- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] 0 JavaScript files in `navigation/`
- [ ] `as any` count < 10
- [ ] No `@ts-ignore` in production code (tests excluded)
- [ ] All screens properly typed with navigation props
