# State Management Guidelines

This document defines when to use Context API vs Zustand stores in the DUCAT Wallet.

## Overview

The app uses a **hybrid approach**:
- **Context API**: Complex, interdependent state that needs provider hierarchy
- **Zustand Stores**: Isolated, high-frequency state that benefits from fine-grained subscriptions

---

## When to Use Context API

### Use Context for:

1. **Authentication State** (`AuthContext`)
   - Session state that many components need
   - Tightly coupled with navigation (auth vs wallet flows)
   - Rarely changes during a session

2. **Wallet Data** (`WalletContext`, `WalletDataContext`)
   - Addresses, balances, transaction history
   - Multiple components need coordinated updates
   - Data fetching with shared loading states

3. **Complex Feature State** (`CashuContext`, `TransactionBuildContext`)
   - Multi-step operations with shared state
   - Operations that need cleanup on unmount
   - State that depends on other contexts

4. **UI Coordination** (`UIContext`, `ResponsiveContext`)
   - Modal/sheet visibility
   - Global UI state (toasts, loading indicators)
   - Device dimensions and breakpoints

### Context Pattern Example

```typescript
// contexts/ExampleContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

interface ExampleContextValue {
  data: SomeType | null;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  clearData: () => void;
}

const ExampleContext = createContext<ExampleContextValue | undefined>(undefined);

export function ExampleProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SomeType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await someService.getData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return (
    <ExampleContext.Provider value={{ data, loading, error, fetchData, clearData }}>
      {children}
    </ExampleContext.Provider>
  );
}

export function useExample() {
  const context = useContext(ExampleContext);
  if (!context) {
    throw new Error('useExample must be used within ExampleProvider');
  }
  return context;
}
```

---

## When to Use Zustand

### Use Zustand for:

1. **High-Frequency Updates** (`priceStore`)
   - BTC price updates every few seconds
   - Only subscribers to specific slices re-render
   - No provider nesting needed

2. **Form/Flow State** (`sendFlowStore`, `depositStore`)
   - Multi-screen flow state
   - Reset on completion
   - Independent of other app state

3. **Notifications** (`notificationStore`)
   - Toast messages
   - Transient UI state
   - Fire-and-forget updates

4. **Persisted Preferences** (`displayPreferencesStore`)
   - User settings
   - Currency preferences
   - Theme settings

5. **Isolated Feature State** (`tokenProcessingStore`)
   - State for a specific feature
   - Doesn't need other context data
   - Can be accessed from services

### Zustand Pattern Example

```typescript
// stores/exampleStore.ts
import { create } from 'zustand';

interface ExampleState {
  // State
  items: Item[];
  selectedId: string | null;
  loading: boolean;

  // Actions
  setItems: (items: Item[]) => void;
  selectItem: (id: string | null) => void;
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  reset: () => void;
}

const initialState = {
  items: [],
  selectedId: null,
  loading: false,
};

export const useExampleStore = create<ExampleState>((set, get) => ({
  ...initialState,

  setItems: (items) => set({ items }),

  selectItem: (id) => set({ selectedId: id }),

  addItem: (item) => set((state) => ({
    items: [...state.items, item],
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id),
  })),

  reset: () => set(initialState),
}));

// Selectors for fine-grained subscriptions
export const useSelectedItem = () =>
  useExampleStore((state) =>
    state.items.find((item) => item.id === state.selectedId)
  );

export const useItemCount = () =>
  useExampleStore((state) => state.items.length);
```

---

## Decision Tree

```
Is this state shared across many unrelated components?
├── NO → Consider local useState or Zustand
└── YES
    └── Does it need provider hierarchy / cleanup on unmount?
        ├── YES → Use Context API
        └── NO
            └── Does it update frequently (>1/sec)?
                ├── YES → Use Zustand (better performance)
                └── NO
                    └── Is it isolated from other app state?
                        ├── YES → Use Zustand
                        └── NO → Use Context API
```

---

## Quick Reference

| State Type | Pattern | Example |
|------------|---------|---------|
| Auth/session | Context | `AuthContext` |
| Wallet addresses | Context | `WalletContext` |
| Balance/history | Context | `WalletDataContext` |
| Cashu operations | Context | `CashuContext` |
| BTC price | Zustand | `priceStore` |
| Send flow | Zustand | `sendFlowStore` |
| Notifications | Zustand | `notificationStore` |
| User preferences | Zustand | `displayPreferencesStore` |
| Feature flags | Zustand | `featureStore` |

---

## Best Practices

### Context
- Split contexts by read frequency (e.g., `CashuBalanceContext` vs `CashuOperationsContext`)
- Memoize context values with `useMemo` if object contains callbacks
- Use `useCallback` for all functions passed to context

### Zustand
- Use selectors for fine-grained subscriptions
- Keep stores focused (single responsibility)
- Export typed selectors alongside the store
- Use `reset()` action for cleanup

### Both
- Keep state minimal (derive computed values)
- Document the purpose in the file header
- Write tests for complex state logic
