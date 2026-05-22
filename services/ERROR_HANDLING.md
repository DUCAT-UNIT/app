# Error Handling Guidelines

This document defines the standardized error handling patterns for the DUCAT Wallet services.

## Core Principles

1. **Fail-fast for critical operations** - Security and transaction operations should throw errors
2. **Graceful degradation for reads** - Cache reads and optional data can return defaults
3. **Structured results for status operations** - Auth and lockout operations return result objects

---

## Pattern 1: Throw Errors (Critical Operations)

**Use for:** Security operations, transactions, writes, wallet operations

```typescript
// Example: Critical operation that must succeed
export const saveMnemonic = async (mnemonic: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
  } catch (error: unknown) {
    logger.error('Failed to save mnemonic', { error });
    throw new Error('Failed to save wallet securely');
  }
};
```

**Services using this pattern:**

- `walletService.ts` - All wallet operations
- `transactionBroadcastService.ts` - Transaction broadcasting
- `cashuMintOperations.ts` - Mint operations
- `cashuMeltOperations.ts` - Melt operations
- `cashuSendToken.ts` - Token sending
- `pinLockout.ts` - Save operations (security-critical)

---

## Pattern 2: Return null/defaults (Read Operations)

**Use for:** Cache reads, optional data fetching, non-critical lookups

```typescript
// Example: Optional data that can be missing
export const getCachedPrice = async (): Promise<number | null> => {
  try {
    const cached = await AsyncStorage.getItem('btc_price');
    return cached ? parseFloat(cached) : null;
  } catch (error: unknown) {
    logger.warn('Failed to read cached price', { error });
    return null;
  }
};

// Example: Collection that can be empty
export const loadProofs = async (): Promise<CashuProof[]> => {
  try {
    const stored = await AsyncStorage.getItem(PROOF_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error: unknown) {
    logger.warn('Failed to load proofs', { error });
    return [];
  }
};
```

**Services using this pattern:**

- `balanceService.ts` - `fetchBtcPrice()` returns null on failure
- `cashuProofManager.ts` - `loadProofs()` returns empty array
- `secureStorageService.ts` - Get operations return null
- `cacheService.ts` - All cache reads

---

## Pattern 3: Result Objects (Status Operations)

**Use for:** Authentication, lockout checks, operations with multiple outcomes

```typescript
// Example: Operation with success/failure states
export interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: 'CANCELLED' | 'FAILED' | 'NOT_AVAILABLE';
}

export const authenticateWithBiometrics = async (): Promise<AuthResult> => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate',
    });
    return {
      success: result.success,
      error: result.success ? undefined : 'Authentication failed',
      errorCode: result.success ? undefined : 'FAILED',
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: 'Biometric authentication not available',
      errorCode: 'NOT_AVAILABLE',
    };
  }
};
```

**Services using this pattern:**

- `biometricService.ts` - Authentication results
- `pinLockout.ts` - Lockout status checks

---

## Decision Tree

```
Is this a security-critical or write operation?
├── YES → Pattern 1: Throw errors
└── NO
    └── Is this a status/auth operation with multiple outcomes?
        ├── YES → Pattern 3: Return result object
        └── NO → Pattern 2: Return null/defaults
```

---

## Error Message Guidelines

1. **User-facing errors**: Use messages from `utils/messages.ts`
2. **Log errors**: Always include context (operation name, relevant IDs)
3. **Error wrapping**: Wrap low-level errors with meaningful context

```typescript
// Good: Contextual error
throw new Error(`Failed to broadcast transaction: ${originalError.message}`);

// Bad: Generic error
throw new Error('Something went wrong');
```

---

## Logging Standards

```typescript
// Critical failures (will throw)
logger.error('Failed to save mnemonic', { error, operation: 'saveMnemonic' });

// Recoverable failures (returns default)
logger.warn('Failed to load cached price, will fetch', { error });

// Diagnostic detail
logger.debug('Attempting to load proofs', { accountId });
```
