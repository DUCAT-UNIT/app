# Full Codebase Code Review — Ducat Wallet

You are performing a **thorough, security-focused code review** of the Ducat Wallet — a non-custodial Bitcoin/Runes mobile wallet built with React Native (Expo SDK 54). This is a financial application handling real cryptocurrency operations on Mutinynet testnet, with plans to move to mainnet. Treat every finding as if this were a mainnet production app.

## Project Context

- **Stack**: React Native (Expo SDK 54), TypeScript strict mode, React Navigation v7, Zustand + React Context
- **Domain**: Non-custodial Bitcoin wallet — BTC (SegWit + Taproot), UNIT (Runes token), Cashu e-cash, vault operations (deposit/borrow/repay/withdraw), WebAuthn passkey backup
- **Network**: Mutinynet testnet (not mainnet yet)
- **Repo root**: `/Users/lucasrodriguez/Desktop/Ducat/mobile-app/app`
- **Branch**: `e2e/auth-tests`
- **Scale**: ~512 source files, 202 unit tests, 61 E2E tests (Maestro), 89 hooks, 92 services, 12 context providers, 18 Zustand stores

## Architecture Overview

```
App.tsx (entry, provider hierarchy, crypto init)
├── contexts/ (12 providers: Auth, Wallet, WalletData, Cashu, UI, TransactionBuild, TransactionExecution, PendingTransactions, Responsive, NavigationHandlers, SeedPhrase, Airdrop)
├── stores/ (18 Zustand stores: price, send flow, vault ops, notifications, display, turbo, pending tx)
├── navigation/ (RootNavigator → AuthStack | MainTabs, plus SendNavigator, VaultCreateNavigator, Borrow/Deposit/Repay/Withdraw navigators)
├── screens/ (98 files: auth, wallet, send, vault, vaultCreation, borrow, deposit, repay, withdraw, settings, cashu)
├── components/ (120 files: wallet, assetDetail, vaultDetail, review, transaction, onboarding, common, icons, ecash, scanner)
├── hooks/ (89 files: wallet, auth, cashu, vault, transaction, turbo, settings, UI)
├── services/ (92 files across: root, cashu/, cashu/crypto/, cashu/mintClient/, cashu/operations/, cashu/p2pk/, passkey/, signing/, transaction/, turbo/, vault/, vaultWallet/)
├── utils/ (29 files: bitcoin, formatters, wallet/crypto, API, retry, error parsing)
├── types/ (11 type definition files)
├── styles/ + theme/ (21 files)
└── e2e/maestro/ (61 test flows + 16 helpers)
```

## Review Scope — Read ALL of These

### CRITICAL PRIORITY (Security & Crypto) — Read every line

1. **Crypto & Key Management**
   - `services/walletService.ts` — HD wallet (BIP32/39/84/86), key derivation, address generation
   - `utils/wallet/keyDerivation.ts` — Key derivation utilities
   - `utils/wallet/cryptoHelpers.ts` — Crypto helper functions
   - `utils/wallet/messageSigning.ts` — Message signing
   - `services/signing/psbtService.ts` — Unified PSBT signing (consolidated from former `utils/wallet/psbtSigning.ts` + vault signing)
   - `services/transactionSigningService.ts` — Transaction signing
   - `services/psbtService.ts` — PSBT construction (NOTE: distinct from `services/signing/psbtService.ts` — review for overlap)
   - `crypto-polyfill.js` — Crypto polyfills (must be first import in App.tsx)

2. **Transaction Building & Broadcasting**
   - `services/transaction/btcTransaction.ts` — BTC transaction construction
   - `services/transaction/runesTransaction.ts` — Runes transaction construction
   - `services/transaction/runesPsbtBuilder.ts` — Runes PSBT builder
   - `services/transaction/utxoSelection.ts` — UTXO selection (coin selection algorithm)
   - `services/transaction/runesUtxoSelection.ts` — Runes-specific UTXO selection
   - `services/transactionBroadcastService.ts` — TX broadcast
   - `services/transactionCalculationService.ts` — Fee and amount calculations
   - `services/feeEstimationService.ts` — Fee estimation
   - `services/feeEstimationTypes.ts` — Fee types

3. **Cashu E-Cash (entire subsystem)**
   - `services/cashu/cashuWalletService.ts` — Cashu wallet core
   - `services/cashu/cashuBalanceService.ts` — Balance tracking
   - `services/cashu/cashuProofManager.ts` — Proof management (THIS IS MONEY)
   - `services/cashu/cashuLockedTokensService.ts` — Locked tokens
   - `services/cashu/cashuMintClient.ts` — Mint client
   - `services/cashu/cashuMintQuoteRecovery.ts` — Quote recovery
   - `services/cashu/cashuSwapRecovery.ts` — Swap recovery
   - `services/cashu/cashuTokenOperations.ts` — Token ops
   - `services/cashu/cashuTurboRecovery.ts` — Turbo recovery
   - `services/cashu/tokenStatusService.ts` — Token status tracking
   - `services/cashu/crypto/cryptoBlinding.ts` — Blinding operations
   - `services/cashu/crypto/cryptoProofs.ts` — Proof verification
   - `services/cashu/crypto/cryptoSecrets.ts` — Secret generation
   - `services/cashu/crypto/cryptoTokens.ts` — Token crypto
   - `services/cashu/mintClient/meltQuotes.ts` — Melt (spend) quotes
   - `services/cashu/mintClient/mintConfig.ts` — Mint configuration
   - `services/cashu/mintClient/mintInfo.ts` — Mint info
   - `services/cashu/mintClient/mintQuotes.ts` — Mint (receive) quotes
   - `services/cashu/mintClient/mintSwap.ts` — Token swaps
   - `services/cashu/operations/cashuMeltOperations.ts` — Melt (spend) flow
   - `services/cashu/operations/cashuMintOperations.ts` — Mint (receive) flow
   - `services/cashu/operations/cashuReceiveP2PK.ts` — P2PK receive
   - `services/cashu/operations/cashuReceiveToken.ts` — Token receive
   - `services/cashu/operations/cashuRecoverLockedChange.ts` — Locked change recovery
   - `services/cashu/operations/cashuSendP2PK.ts` — P2PK send
   - `services/cashu/operations/cashuSendToken.ts` — Token send
   - `services/cashu/p2pk/p2pkKeyManager.ts` — P2PK key management
   - `services/cashu/p2pk/p2pkSecrets.ts` — P2PK secret generation
   - `services/cashu/p2pk/p2pkSigning.ts` — P2PK signing
   - `services/cashu/p2pk/p2pkVerification.ts` — P2PK verification

4. **Authentication & Security**
   - `contexts/AuthContext.tsx` — Auth state machine (PIN, biometrics, lock/unlock)
   - `services/pinHashing.ts` — PIN hashing (PBKDF2)
   - `services/pinLockout.ts` — Lockout policy
   - `services/pinService.ts` — PIN operations
   - `services/biometricService.ts` — Biometric auth
   - `services/secureStorageService.ts` — SecureStore wrapper
   - `hooks/useAuth.ts` — Auth hook
   - `hooks/useAuthSettings.ts` — Auth settings
   - `hooks/useAuthenticatedToggle.ts` — Authenticated action guard
   - `constants/security.ts` — Security constants

5. **Passkey / WebAuthn Backup**
   - `services/passkey/core.ts` — Passkey core operations
   - `services/passkey/creation.ts` — Passkey creation flow
   - `services/passkey/credentialCreation.ts` — Credential creation
   - `services/passkey/encryption.ts` — Seed encryption for passkey backup
   - `services/passkey/passkeyStorage.ts` — Passkey storage
   - `services/passkey/pinChange.ts` — PIN change via passkey
   - `services/passkey/storage.ts` — Storage abstraction
   - `services/passkey/unlock.ts` — Passkey unlock flow
   - `hooks/usePasskeyCreation.ts` — Passkey creation hook
   - `hooks/usePasskeyRestore.ts` — Passkey restore hook

6. **Vault Operations (DeFi-like)**
   - `services/vaultService.ts` — Vault state management
   - `services/vaultOperationsService.ts` — Vault operation orchestration
   - `services/vaultWalletService.ts` — Vault wallet integration
   - `services/vault/open.ts` — Vault creation
   - `services/vault/deposit.ts` — Vault deposit
   - `services/vault/borrow.ts` — Vault borrow
   - `services/vault/repay.ts` — Vault repay
   - `services/vault/withdraw.ts` — Vault withdraw
   - `services/vault/utils.ts` — Vault utilities
   - `services/vaultWallet/walletApi.ts` — Vault wallet API
   - `services/vaultWallet/psbtBinaryUtils.ts` — PSBT binary utils
   - `services/oracleService.ts` — Price oracle

7. **Turbo (P2PK Token Processing)**
   - `services/turbo/turboLinkingConfig.ts` — Turbo linking config
   - `services/turbo/turboTokenStorage.ts` — Token storage
   - `hooks/useTurboConvert.ts` — Turbo convert
   - `hooks/useTurboMintCompletion.ts` — Turbo mint completion
   - `hooks/useTurboReview.ts` — Turbo review
   - `hooks/useTurboSnackbarQueue.ts` — Turbo notifications
   - `hooks/useTurboTokenProcessor.ts` — Token processing pipeline

### HIGH PRIORITY (State Management & Data Flow)

8. **Context Providers (all 12)**
   - `contexts/WalletContext.tsx` — Wallet state (keys, addresses, balances)
   - `contexts/WalletDataContext.tsx` — Wallet data (transactions, UTXOs)
   - `contexts/CashuContext.tsx` — Cashu e-cash state
   - `contexts/TransactionBuildContext.tsx` — Transaction building pipeline
   - `contexts/TransactionExecutionContext.tsx` — Transaction execution pipeline
   - `contexts/PendingTransactionsContext.tsx` — Pending TX tracking
   - `contexts/UIContext.tsx` — UI state (modals, sheets, snackbars)
   - `contexts/AirdropContext.tsx` — Airdrop flow state
   - `contexts/SeedPhraseContext.tsx` — Seed phrase handling (sensitive!)
   - `contexts/ResponsiveContext.tsx` — Responsive sizing
   - `contexts/NavigationHandlersContext.tsx` — Navigation handlers

9. **Zustand Stores (all 18)**
   - `stores/sendFlowStore.ts` — Send flow state
   - `stores/vaultCreationStore.ts` — Vault creation
   - `stores/borrowStore.ts` — Borrow state
   - `stores/depositStore.ts` — Deposit state
   - `stores/repayStore.ts` — Repay state
   - `stores/withdrawStore.ts` — Withdraw state
   - `stores/priceStore.ts` — Price data
   - `stores/pendingTransactionsStore.ts` — Pending TX
   - `stores/pendingVaultTransactionStore.ts` — Pending vault TX
   - `stores/notificationStore.ts` — Notifications
   - `stores/displayPreferencesStore.ts` — Display prefs
   - `stores/tokenProcessingStore.ts` — Token processing
   - `stores/turboProcessingStore.ts` — Turbo processing
   - `stores/ecashThresholdSheetStore.ts` — Ecash threshold
   - `stores/vault/createVaultStore.ts` — Vault creation store

10. **Navigation (all)**
    - `navigation/RootNavigator.tsx` — Root auth/main switch
    - `navigation/AppNavigator.tsx` — App navigator
    - `navigation/AppNavigatorContent.tsx` — Navigator content
    - `navigation/AppProvidersWrapper.tsx` — Provider wrapper
    - `navigation/AuthStack.tsx` — Auth flow
    - `navigation/MainTabs.tsx` — Main tab bar
    - `navigation/SendNavigator.tsx` — Send flow
    - `navigation/VaultCreateNavigator.tsx` — Vault creation
    - `navigation/BorrowNavigator.tsx` — Borrow
    - `navigation/DepositNavigator.tsx` — Deposit
    - `navigation/RepayNavigator.tsx` — Repay
    - `navigation/WithdrawNavigator.tsx` — Withdraw
    - `navigation/WalletStackNavigator.tsx` — Wallet stack
    - `navigation/types.ts` — Navigation types

### MEDIUM PRIORITY (UI & UX)

11. **Key Screens** — check for proper loading states, error handling, data display
    - `screens/wallet/WalletScreen.tsx` — Main wallet
    - `screens/wallet/AssetDetailScreen.tsx` — Asset details
    - `screens/wallet/ReceiveQRScreen.tsx` — Receive QR
    - `screens/wallet/TransactionHistoryScreen.tsx` — TX history
    - `screens/wallet/VaultDetailScreen.tsx` — Vault details
    - `screens/send/AddressInputScreen.tsx` — Send address input
    - `screens/send/AmountInputScreen.tsx` — Send amount input
    - `screens/send/ReviewScreen.tsx` — Send review
    - `screens/send/ProcessingScreen.tsx` — Send processing
    - `screens/send/ConfirmationScreen.tsx` — Send confirmation
    - `screens/auth/LockScreen.tsx` — Lock screen
    - `screens/auth/PinSetupScreen.tsx` — PIN setup
    - `screens/auth/WelcomeScreen.tsx` — Welcome/onboarding
    - `screens/settings/SecurityScreen.tsx` — Security settings
    - `screens/settings/SettingsScreen.tsx` — Main settings

12. **Key Components**
    - `components/wallet/AssetCard.tsx` — Asset display card
    - `components/wallet/VaultCard.tsx` — Vault display card
    - `components/wallet/WalletHeader.tsx` — Wallet header
    - `components/wallet/WalletActions.tsx` — Wallet action buttons
    - `components/wallet/TotalBalanceSection.tsx` — Balance display
    - `components/common/BottomSheet.tsx` — Bottom sheet (has E2E bypass)
    - `components/scanner/QRScanner.tsx` — QR scanner
    - `components/onboarding/ImportWalletScreen.tsx` — Wallet import
    - `components/ConfirmationModal.tsx` — Confirmation modal
    - `components/PasskeyPinInput.tsx` — Passkey PIN input
    - `components/PasskeyMigrationModal.tsx` — Passkey migration

13. **API & Network**
    - `utils/api.ts` — API utilities
    - `utils/apiClient.ts` — API client
    - `services/airdropService.ts` — Airdrop
    - `services/balanceService.ts` — Balance fetching
    - `services/transactionHistoryService.ts` — TX history
    - `services/urlShortener.ts` — URL shortener
    - `services/sentryService.ts` — Error reporting (check for PII leaks!)
    - `services/guardianService.ts` — Guardian service
    - `services/icloudStorage.ts` — iCloud storage

### LOWER PRIORITY (Utilities & Config)

14. **Utilities**
    - `utils/bitcoin.ts` — Bitcoin helpers
    - `utils/bitcoin/conversions.ts` — Unit conversions
    - `utils/runesHelper.ts` — Runes helpers
    - `utils/runestoneEncoder.js` — Runestone encoding (plain JS!)
    - `utils/formatters/amounts.ts` — Amount formatting
    - `utils/formatters/addresses.ts` — Address formatting
    - `utils/formatters/dates.ts` — Date formatting
    - `utils/sendHelpers.ts` — Send flow helpers
    - `utils/errorParser.ts` — Error parsing
    - `utils/retry.ts` — Retry logic
    - `utils/pagination.ts` — Pagination
    - `utils/airdropLock.ts` — Airdrop lock
    - `utils/pendingTransactionsUtils.ts` — Pending TX utils
    - `utils/vaultUtils.ts` — Vault utils
    - `utils/vaultHealthColor.ts` — Vault health
    - `utils/onboardingHelpers.ts` — Onboarding helpers
    - `utils/logger.ts` — Logger
    - `utils/constants.ts` — Constants

15. **Types** — Review for completeness and correctness
    - `types/wallet.d.ts`
    - `types/transaction.d.ts`
    - `types/cashu.d.ts`
    - `types/crypto.d.ts`
    - `types/components.d.ts`
    - `types/notification.d.ts`
    - `types/global.d.ts`
    - `types/assets.d.ts`

16. **App Entry & Config**
    - `App.tsx` — Provider hierarchy, ECC init, crypto polyfill order
    - `app.json` — Expo config
    - `jest.config.js` — Test config
    - `jest.setup.js` — Test mocks
    - `metro.config.js` — Metro bundler
    - `babel.config.js` — Babel
    - `tsconfig.json` — TypeScript

---

## What to Look For

### Security (HIGHEST PRIORITY)

- [ ] **Private key exposure**: Are seed phrases, private keys, or mnemonics ever logged, stored in plaintext, or leaked to state/props that render?
- [ ] **Seed phrase in memory**: Is the seed phrase held in React state/context longer than necessary? Is it cleared after use?
- [ ] **SecureStore usage**: Is all sensitive data (keys, PINs, seeds) stored via SecureStore, not AsyncStorage?
- [ ] **PIN hashing**: Is PBKDF2 used with sufficient iterations? Is the salt unique per device?
- [ ] **Passkey encryption**: How is the seed encrypted before passkey backup? Is the encryption algorithm sound?
- [ ] **Transaction signing**: Are PSBTs validated before signing? Can a malicious PSBT drain funds?
- [ ] **UTXO selection**: Can the coin selection leak value (dust attacks, change address issues)?
- [ ] **Address validation**: Are Bitcoin addresses validated before sending? Type checking (SegWit vs Taproot)?
- [ ] **Cashu proof management**: Are proofs stored securely? Can double-spend happen client-side? Is proof verification sound?
- [ ] **P2PK operations**: Are P2PK secrets generated with sufficient entropy? Is signing/verification correct?
- [ ] **API calls**: Are there any endpoints that leak wallet data? Is HTTPS enforced?
- [ ] **Sentry/logging**: Does error reporting include PII, addresses, amounts, or keys?
- [ ] **E2E bypasses**: Verify ALL `__DEV__` and `EXPO_PUBLIC_E2E_BYPASS` guards are properly scoped — none should activate in production
- [ ] **`console.log` leaks**: Despite `no-console` lint rule, check for any logger calls that might include sensitive data
- [ ] **Clipboard handling**: Is clipboard data cleared after pasting seed phrases or addresses?
- [ ] **Deep link handling**: Can malicious deep links trigger unauthorized actions?

### Architecture & Code Quality

- [ ] **Duplicate services**: Why do both `services/psbtService.ts` AND `services/signing/psbtService.ts` exist? Same for vault services
- [ ] **Dead code**: Check for deprecated screens (e.g., `RepayInputScreen.tsx` vs `RepayInputScreenNew.tsx`) — are old versions still referenced?
- [ ] **Provider hierarchy**: Is the context nesting in `App.tsx` correct? Are there circular dependencies between providers?
- [ ] **State management overlap**: Zustand vs Context — are there cases where both manage the same state?
- [ ] **Memory leaks**: Are effects properly cleaned up? Are subscriptions/intervals cleared?
- [ ] **Race conditions**: In async operations (transaction building, broadcasting, cashu operations), are there race conditions?
- [ ] **Error boundaries**: Is `ErrorBoundary` wrapping the right components? Are crypto errors caught before they crash the app?
- [ ] **Navigation guards**: Can users navigate to screens in invalid states (e.g., send screen without a wallet)?

### Bitcoin-Specific

- [ ] **BIP32/39/84/86 compliance**: Are derivation paths correct? Is address generation standard?
- [ ] **Fee calculation**: Are fees calculated correctly? Can zero-fee or negative-fee transactions be created?
- [ ] **Change address handling**: Is change always sent to a controlled address? Can change be lost?
- [ ] **Dust limit enforcement**: Are outputs checked against dust limits?
- [ ] **Runes encoding**: Is the runestone encoder (`runestoneEncoder.js` — plain JS!) correct?
- [ ] **Transaction malleability**: Are there any malleability issues with the transaction building pipeline?
- [ ] **RBF support**: Is Replace-By-Fee handled correctly for pending transactions?

### Cashu-Specific

- [ ] **Proof storage**: Are Cashu proofs stored durably before being spent? (crash recovery)
- [ ] **Double-spend prevention**: Are spent proofs tracked and prevented from reuse?
- [ ] **Mint trust**: Is the mint URL hardcoded or configurable? Can a malicious mint be injected?
- [ ] **Blinding factor security**: Are blinding factors generated with cryptographic randomness?
- [ ] **Token serialization**: Are Cashu tokens serialized/deserialized correctly per spec?
- [ ] **Recovery mechanisms**: Do mint quote recovery and swap recovery work correctly on app restart?

### Vault-Specific

- [ ] **Vault health calculation**: Is the health factor calculated correctly?
- [ ] **Liquidation thresholds**: Are liquidation checks correct?
- [ ] **Oracle integration**: How is the price oracle used? Can stale prices cause bad vault operations?
- [ ] **PSBT validation for vault ops**: Are vault PSBTs validated end-to-end?

### Testing

- [ ] **Test coverage gaps**: Are there critical paths without tests? (check coverage report)
- [ ] **Mock accuracy**: Do mocks in `jest.setup.js` accurately represent native module behavior?
- [ ] **E2E coverage**: Are the 61 E2E tests covering all critical user journeys?
- [ ] **Test isolation**: With `resetMocks: false`, are tests properly isolated?

---

## Output Format

For each finding, use this format:

```
### [SEVERITY] Finding Title
**File**: `path/to/file.ts:line_number`
**Category**: Security | Architecture | Bug | Performance | Code Quality
**Description**: What the issue is
**Impact**: What could go wrong
**Recommendation**: How to fix it
```

Severity levels:
- **CRITICAL**: Security vulnerabilities, fund loss risks, key exposure
- **HIGH**: Bugs that affect functionality, data integrity issues
- **MEDIUM**: Code quality, architecture concerns, maintainability
- **LOW**: Style, naming, minor improvements
- **INFO**: Observations, questions, suggestions

---

## Deliverables

1. **Executive Summary**: 5-10 sentence overview of codebase health
2. **Critical Findings**: All CRITICAL and HIGH severity findings with file paths and line numbers
3. **Security Audit**: Dedicated section covering all crypto, auth, and key management
4. **Architecture Review**: State management, navigation, provider hierarchy, service layer
5. **Code Quality Report**: Duplications, dead code, inconsistencies, patterns
6. **Testing Assessment**: Coverage gaps, mock quality, E2E completeness
7. **Recommendations**: Prioritized list of improvements ranked by risk/impact

Start by reading `App.tsx`, then `CLAUDE.md`, then systematically work through the CRITICAL PRIORITY files. Use parallel reads where possible. Be thorough — this is a crypto wallet where bugs can mean lost funds.
