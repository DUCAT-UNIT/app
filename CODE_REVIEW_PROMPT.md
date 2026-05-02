# Full App Code Review Prompt

Use this prompt with Claude Code (or any LLM with codebase access) to perform a comprehensive review of the Ducat Wallet app.

---

## Prompt

You are reviewing **Ducat Wallet**, a non-custodial Bitcoin/Runes mobile wallet built with React Native (Expo SDK 54). The app supports BTC (SegWit + Taproot), UNIT (Runes token), Cashu e-cash (Turbo UNIT), vault operations, liquidation, push notifications, and PostHog analytics. It runs on Mutinynet testnet.

Read `CLAUDE.md` first for architecture context, then perform a comprehensive code review covering every area below. For each finding, provide the file path, line number, severity (critical/high/medium/low), and a concrete fix.

### 1. Security Audit

**Crypto & Key Management:**
- Review `services/walletService.ts` — HD wallet creation, key derivation, mnemonic handling
- Review `utils/wallet/keyDerivation.ts`, `cryptoHelpers.ts`, `messageSigning.ts`, `psbtSigning.ts`
- Review `services/passkey/` — encryption flow, key derivation (HKDF), AES-256-GCM usage
- Review `services/pinHashing.ts`, `services/pinLockout.ts` — PBKDF2 params, timing attack resistance
- Review `services/secureStorageService.ts` — what goes in SecureStore vs AsyncStorage
- Check: Are seed phrases ever logged, stored in state, or passed as navigation params?
- Check: Is `crypto-polyfill.js` correctly shimming all crypto primitives?

**Transaction Security:**
- Review `services/transaction/btcTransaction.ts` — PSBT construction, input validation
- Review `services/transaction/utxoSelection.ts` — dust limit handling, fee calculation edge cases
- Review `services/signing/psbtService.ts` — signing context validation and external-spend limits
- Review `services/vaultWallet/signingContext.ts` — PSBT template verification
- Check: Can a malicious PSBT be injected via deep link or navigation params?
- Check: Are all transaction amounts validated before signing?

**Cashu/E-cash Security:**
- Review `services/cashu/p2pk/` — P2PK secret generation, signing, verification
- Review `services/cashu/operations/` — token send/receive, proof management
- Check: Can proofs be double-spent within the app?
- Check: Are P2PK secrets generated with sufficient entropy?

**Authentication:**
- Review `contexts/AuthContext.tsx`, `hooks/useAuth.ts` — auth state machine
- Review `screens/auth/LockScreen.tsx`, `PinSetupScreen.tsx`
- Check: Can auth be bypassed via navigation manipulation?
- Check: Are E2E bypasses properly guarded by `__DEV__`?

**Data Exposure:**
- Search for any `console.log` calls (should use `logger` instead)
- Check: Do navigation params contain sensitive data (seeds, keys, PINs)?
- Check: Is analytics properly hashing addresses and truncating txids?
- Review `services/analyticsService.ts` — privacy guards

### 2. Architecture & Design

**State Management:**
- Review context provider hierarchy in `App.tsx` and `navigation/AppProvidersWrapper.tsx`
- Check for prop drilling that should use context
- Check for context values that should be Zustand stores (or vice versa)
- Review `contexts/WalletDataContext.tsx` — coordinator pattern correctness
- Check: Do any contexts create unnecessary re-renders?

**Data Flow:**
- Trace the polling cycle: `WalletDataCoordinator` → `usePolling` → 4 sub-contexts
- Check: Are `useMemo` return values on all context hooks to prevent re-render cascades?
- Check: Do background fetches skip `setState` when data hasn't changed?
- Review the amount units convention — are cents/display-units consistently used? (See CLAUDE.md)

**Navigation:**
- Review `navigation/RootNavigator.tsx` — auth flow switching
- Review stack navigator configurations — are modals/screens properly typed?
- Check: Can the user navigate to authenticated screens without auth?

**Error Handling:**
- Review `components/ErrorBoundary.tsx`, `components/withErrorBoundary.tsx`
- Check: Do all async operations have try/catch?
- Check: Are errors surfaced to the user via snackbar/toast?
- Check: Are network errors handled gracefully (offline state)?

### 3. Performance

**Rendering:**
- Identify components that re-render unnecessarily on the 10s poll cycle
- Check: Are FlatList items wrapped in `React.memo`?
- Check: Are expensive computations in `useMemo`?
- Check: Do inline object/array literals in JSX cause unnecessary re-renders?
- Review `components/assetDetail/AssetActivityList.tsx` — list performance

**Memory:**
- Check for memory leaks: uncleared intervals, uncancelled subscriptions, stale refs
- Review `useEffect` cleanup functions — are all listeners removed?
- Check: Do any hooks hold references to large datasets that should be paginated?

**Network:**
- Check: Are API responses cached appropriately?
- Check: Is the polling interval (10s) appropriate for all data types?
- Check: Are failed requests retried with backoff?

### 4. Code Quality

**TypeScript:**
- Run `npx tsc --noEmit` — are there any errors?
- Check for `any` types that should be properly typed
- Check for `as unknown as X` casts that indicate type design issues
- Review exported interfaces — are they minimal and well-named?

**Testing:**
- Run `jest --coverage` — what's the coverage?
- Identify critical paths with no test coverage
- Review test quality — are tests testing behavior or implementation details?
- Check: Do E2E tests cover the happy path for all major flows?

**Code Hygiene:**
- Files over 300 lines — which ones need splitting?
- Dead code — unused exports, unreachable branches, commented-out code
- Duplicate logic — same pattern repeated in multiple places
- Check: Are all TODO/FIXME/HACK comments addressed?

### 5. Bitcoin/Protocol Correctness

- Review Runes encoding in `utils/runestoneEncoder.js` — is LEB128 correct?
- Review fee estimation in `services/feeEstimationService.ts` — is it conservative enough?
- Check: Does the MAX send fix correctly handle all edge cases (single UTXO, multiple UTXOs, dust)?
- Check: Is the `collateral_ratio` multiplier-vs-percentage heuristic (`< 10`) reliable?
- Review vault operation flows — are all Guardian WebSocket messages properly handled?

### 6. Production Readiness

- List all `__DEV__` guards and E2E bypasses — are they safe for production?
- Check: Is `isE2E` properly scoped (only true in test builds)?
- Check: Are there any hardcoded test values (addresses, keys, amounts)?
- Review `app.json` / `app.config.ts` — are production settings correct?
- Check: Is screenshot prevention enabled on all sensitive screens?
- Check: Are push notification permissions requested at the right time?

### Output Format

For each finding:
```
[SEVERITY] file_path:line_number
Description of the issue.
Recommended fix: ...
```

Group findings by section. End with a summary: total findings by severity, overall assessment (1-10), and top 3 priorities.
