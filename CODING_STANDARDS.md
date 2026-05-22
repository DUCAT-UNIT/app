# Coding Standards

This document defines coding standards and patterns for the DUCAT Wallet codebase.

## Async/Await Patterns

### Prefer async/await over .then()/.catch()

```typescript
// Good: async/await with try/catch
const fetchData = async () => {
  try {
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    logger.error('Failed to fetch data', { error });
    throw error;
  }
};

// Avoid: .then()/.catch() chains
const fetchData = () => {
  return someAsyncOperation()
    .then((result) => result)
    .catch((error) => {
      logger.error('Failed to fetch data', { error });
      throw error;
    });
};
```

### useEffect with async operations

```typescript
// Good: define async function inside useEffect
useEffect(() => {
  const fetchData = async () => {
    await someAsyncOperation();
    doSomethingAfter();
  };
  fetchData();
}, [dependency]);

// Avoid: .then() in useEffect
useEffect(() => {
  someAsyncOperation().then(() => {
    doSomethingAfter();
  });
}, [dependency]);
```

### Fire-and-forget operations

For operations where you don't need the result, use void operator:

```typescript
// Good: explicit fire-and-forget
void someAsyncOperation();

// Or with error handling
void someAsyncOperation().catch((error) => {
  logger.warn('Non-critical operation failed', { error });
});
```

---

## Logging Standards

### Log Levels

| Level   | Use Case                                            | Example                                             |
| ------- | --------------------------------------------------- | --------------------------------------------------- |
| `error` | Failures that need attention                        | `logger.error('Failed to save wallet', { error })`  |
| `warn`  | Recoverable issues, degraded functionality          | `logger.warn('Cache miss, fetching from network')`  |
| `info`  | Significant events (entry/exit points, completions) | `logger.info('Transaction broadcast successfully')` |
| `debug` | Detailed diagnostic information                     | `logger.debug('Processing proof', { proofId })`     |

### Guidelines

```typescript
// Good: info for significant events
logger.info('Wallet created successfully', { accountIndex });
logger.info('Transaction broadcast', { txid });

// Good: debug for details
logger.debug('Processing UTXO', { txid, vout, value });
logger.debug('Selected proofs for swap', { count: proofs.length });

// Avoid: info for every detail (too verbose)
logger.info('Starting to process proof');
logger.info('Proof processed');
logger.info('Moving to next proof');
```

### Prefixes

Use consistent prefixes for related log messages:

```typescript
// Good: consistent prefix
logger.debug('[WalletService] Loading wallet');
logger.debug('[WalletService] Deriving addresses');
logger.debug('[WalletService] Wallet loaded');

// Avoid: inconsistent prefixes
logger.debug('[WALLET] Loading wallet');
logger.debug('Deriving addresses');
logger.debug('[wallet-service] Wallet loaded');
```

---

## Error Handling

See `services/ERROR_HANDLING.md` for detailed error handling patterns.

### Quick Reference

| Operation Type  | Pattern               | Example                        |
| --------------- | --------------------- | ------------------------------ |
| Critical writes | Throw errors          | `saveMnemonic()`               |
| Optional reads  | Return null/defaults  | `getCachedAddresses()`         |
| Status checks   | Return result objects | `authenticateWithBiometrics()` |

---

## TypeScript

### Function Return Types

Always specify return types for exported functions:

```typescript
// Good: explicit return type
export const calculateFee = (size: number, rate: number): number => {
  return size * rate;
};

// Avoid: inferred return type
export const calculateFee = (size: number, rate: number) => {
  return size * rate;
};
```

### Interface vs Type

- Use `interface` for objects that might be extended
- Use `type` for unions, intersections, and primitives

```typescript
// Good: interface for extendable objects
interface WalletAddresses {
  segwitAddress: string;
  taprootAddress: string;
}

// Good: type for unions
type AssetType = 'BTC' | 'UNIT';

// Good: type for computed types
type WalletWithBalance = WalletAddresses & { balance: number };
```

---

## Component Patterns

### Props Interface Naming

Name props interfaces as `ComponentNameProps`:

```typescript
// Good
interface AssetCardProps {
  asset: Asset;
  onPress: () => void;
}

export function AssetCard({ asset, onPress }: AssetCardProps) { ... }
```

### Memoization

Use `React.memo` for components that:

- Receive stable props
- Are rendered in lists
- Have expensive render logic

```typescript
// Good: memoize list items
export const TransactionItem = React.memo(function TransactionItem({
  transaction,
  onPress,
}: TransactionItemProps) {
  return ( ... );
});
```

---

## File Organization

### Service Files

```typescript
/**
 * ServiceName
 * Brief description of what this service does
 */

import { ... } from '...';

// Types
interface SomeType { ... }

// Constants
const SOME_CONSTANT = 'value';

// Main exports
export const doSomething = async (): Promise<Result> => { ... };
export const doSomethingElse = async (): Promise<Result> => { ... };
```

### Hook Files

```typescript
/**
 * useHookName
 * Brief description of what this hook does
 */

import { ... } from '...';

// Types
interface HookResult { ... }

// Hook implementation
export function useHookName(): HookResult {
  // State
  const [state, setState] = useState();

  // Callbacks
  const handleAction = useCallback(() => { ... }, []);

  // Effects
  useEffect(() => { ... }, []);

  // Return
  return { state, handleAction };
}
```
