# State Management Guide

## Decision Tree

When adding new state, choose the right tool:

### Use **Zustand** when:
- State is consumed by 5+ components across different screens
- State needs persistence across app restarts (AsyncStorage)
- State updates frequently and only some consumers need re-renders (selectors)
- State is independent of the React tree (accessible outside components via `getState()`)
- Examples: `priceStore`, `notificationStore`, `sendFlowStore`, `displayPreferencesStore`

### Use **React Context** when:
- State requires provider hierarchy (initialization depends on parent providers)
- State is session-scoped (resets on logout/app close)
- State has complex initialization logic that depends on other contexts
- State involves subscriptions to external services (WebSocket, polling)
- Examples: `AuthContext`, `WalletContext`, `CashuContext`, `BalanceContext`

### Use **Local useState** when:
- State is used by a single component only
- State is ephemeral (form inputs, UI toggles, animation values)
- State doesn't need to survive component unmount
- Examples: modal visibility, text input values, loading spinners

## Naming Conventions

| Pattern | Example | Use Case |
|---------|---------|----------|
| `use{Name}Store` | `usePriceStore` | Zustand store hook |
| `use{Name}` | `useBalance` | Context consumer hook |
| `{Name}Provider` | `WalletProvider` | Context provider component |
| `{name}Store.ts` | `priceStore.ts` | Zustand store file |
| `{Name}Context.tsx` | `AuthContext.tsx` | Context file |

## Current Architecture

### Contexts (session state, provider hierarchy)
- `AuthContext` — authentication + onboarding state
- `WalletContext` — wallet addresses + account switching
- `BalanceContext` — BTC/UNIT balances + UTXOs
- `TransactionHistoryContext` — transaction history
- `VaultContext` — vault data + transactions
- `EcashTokensContext` — ecash token state + subscriptions
- `CashuContext` — cashu operations + balance
- `ResponsiveContext` — screen dimensions
- `WalletDataContext` — coordinator (wraps Balance/History/Vault/Ecash)

### Zustand Stores (cross-component, persistent)
- `priceStore` — BTC price (AsyncStorage, 10s polling)
- `notificationStore` — snackbars/toasts
- `sendFlowStore` — send transaction UI state machine
- `pendingTransactionsStore` — pending TX tracking (AsyncStorage)
- `pendingVaultTransactionStore` — pending vault TX (AsyncStorage)
- `displayPreferencesStore` — UI preferences (AsyncStorage)
- `vaultCreationStore` — vault creation form (AsyncStorage)
- `liquidationFlowStore` — liquidation UI state
- `remoteConfigStore` — server config + announcements (AsyncStorage)
- `borrowStore/depositStore/repayStore/withdrawStore` — vault operation state
- `turboProcessingStore/tokenProcessingStore` — progress tracking
- `ecashThresholdSheetStore` — low balance modal

## Anti-Patterns to Avoid

1. **Don't use Context for frequently-updating state** — causes cascade re-renders. Use Zustand with selectors instead.
2. **Don't persist transient UI state** — form amounts, slider positions, and step states should reset on app restart.
3. **Don't use Zustand for provider-dependent state** — if state requires AuthContext to initialize, keep it in a context.
4. **Don't mix state management** — a piece of state should live in ONE place. Don't sync between Context and Zustand.
5. **Don't use `useRef` for state that affects rendering** — refs don't trigger re-renders. Use state or store.
