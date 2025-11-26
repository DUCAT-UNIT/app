# TypeScript Migration Plan for Ducat App

## Executive Summary

This document outlines a comprehensive plan to migrate the Ducat React Native application from JavaScript to TypeScript. The codebase consists of **~368 JavaScript files** across multiple domains including contexts, hooks, services, screens, and utilities.

## Current State Analysis

### Codebase Breakdown
- **Total JS Files**: 368 (excluding tests)
- **Test Files**: 143 test suites (2,620 tests)
- **Key Directories**:
  - `hooks/`: 67 files
  - `services/`: 21 files + subdirectories (cashu, transaction, passkey, turbo)
  - `utils/`: 17 files
  - `contexts/`: 16 files
  - `screens/`: ~15 files
  - `components/`: Small number of shared components
  - `navigation/`: 7 files

### Technology Stack
- **Framework**: React Native (0.81.5) with Expo (~54.0.20)
- **Build System**: Babel with babel-preset-expo
- **Testing**: Jest (30.2.0) with React Testing Library
- **Linting**: ESLint with React/React Native plugins
- **Formatting**: Prettier

### Key Dependencies Requiring Type Definitions
- Bitcoin libraries: bitcoinjs-lib, bip32, bip39, @noble/secp256k1
- React Native: react-navigation, async-storage, gesture-handler, etc.
- Expo modules: expo-crypto, expo-secure-store, expo-camera, etc.
- Sentry error tracking
- Cashu ecash protocol (custom implementation)

## Migration Strategy

### Approach: **Incremental Migration**

We recommend an incremental, bottom-up migration strategy:
1. Start with type definitions and interfaces
2. Migrate utilities and pure functions
3. Migrate services layer
4. Migrate contexts and hooks
5. Migrate screens and components
6. Finally migrate tests

### Benefits of Incremental Approach
- ✅ Application remains functional throughout migration
- ✅ Can ship features while migrating
- ✅ Team can learn TypeScript gradually
- ✅ Reduces risk of breaking changes
- ✅ Easier to review and test changes

## Phase 1: Project Setup & Configuration

### 1.1 Install TypeScript Dependencies
```bash
npm install --save-dev typescript @types/react @types/react-native
npm install --save-dev @types/jest @testing-library/jest-native
npm install --save-dev @tsconfig/react-native
```

### 1.2 Additional Type Definitions
```bash
npm install --save-dev @types/node
npm install --save-dev @types/react-test-renderer
```

### 1.3 Create TypeScript Configuration

**File: `tsconfig.json`**
```json
{
  "extends": "@tsconfig/react-native/tsconfig.json",
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "lib": ["esnext"],
    "jsx": "react-native",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "allowJs": true,
    "checkJs": false,
    "baseUrl": ".",
    "paths": {
      "*": ["node_modules/*", "src/types/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx"
  ],
  "exclude": [
    "node_modules",
    "babel.config.js",
    "metro.config.js",
    "jest.config.js"
  ]
}
```

### 1.4 Update Build Configuration

**Update `babel.config.js`:**
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      '@babel/preset-typescript'
    ],
  };
};
```

**Install Babel TypeScript preset:**
```bash
npm install --save-dev @babel/preset-typescript
```

### 1.5 Update Jest Configuration

**File: `jest.config.js` (or add to package.json)**
```javascript
module.exports = {
  preset: 'jest-expo',
  transform: {
    '^.+\\.tsx?$': 'babel-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  testMatch: [
    '**/__tests__/**/*.ts?(x)',
    '**/?(*.)+(spec|test).ts?(x)',
    '**/__tests__/**/*.js?(x)',
    '**/?(*.)+(spec|test).js?(x)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    '**/*.{ts,tsx,js,jsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/vendor/**',
  ],
};
```

### 1.6 Update ESLint Configuration

**Install TypeScript ESLint:**
```bash
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Update `.eslintrc.js`:**
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error'],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': ['warn'],
      },
    },
  ],
};
```

### 1.7 Update Scripts in package.json

```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch"
  }
}
```

## Phase 2: Create Type Definitions

### 2.1 Core Type Definitions

**File: `types/index.ts`**

Define all core types used throughout the application:

```typescript
// Wallet Types
export interface Wallet {
  mnemonic: string;
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
  accounts?: WalletAccount[];
}

export interface WalletAccount {
  index: number;
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
  label?: string;
}

// Transaction Types
export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  vin: TransactionInput[];
  vout: TransactionOutput[];
  size: number;
  weight: number;
  fee: number;
  status: TransactionStatus;
  vaultTransaction?: boolean;
  timestamp?: number;
}

export interface TransactionInput {
  txid: string;
  vout: number;
  prevout: TransactionOutput;
  scriptsig: string;
  scriptsig_asm: string;
  witness?: string[];
  is_coinbase: boolean;
  sequence: number;
}

export interface TransactionOutput {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface TransactionStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

// UTXO Types
export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: TransactionStatus;
  runeAmount?: number;
}

// Balance Types
export interface BalanceData {
  segwitBalance: number;
  taprootBalance: number;
  runesBalance: RuneBalance[];
  unconfirmedSegwitBalance: number;
  unconfirmedTaprootBalance: number;
  unconfirmedRunesBalance: Record<string, number>;
}

export interface RuneBalance {
  rune: string;
  amount: bigint;
  symbol: string;
  divisibility: number;
}

// Cashu Types
export interface CashuProof {
  amount: number;
  secret: string;
  C: string;
  id: string;
}

export interface CashuToken {
  token: Array<{
    mint: string;
    proofs: CashuProof[];
  }>;
  memo?: string;
}

export interface P2PKSecret {
  nonce: string;
  data: string;
  tags: Array<[string, string]>;
}

export interface LockedToken {
  id: string;
  token: string;
  amount: number;
  timestamp: number;
  pubkey: string;
  recipientPubkey?: string;
  type: 'sent' | 'received';
  claimed?: boolean;
  partiallySpent?: boolean;
}

// Settings Types
export interface AppSettings {
  pinEnabled: boolean;
  biometricsEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  advancedMode: boolean;
  notificationsEnabled: boolean;
  ecashThreshold: number;
  autoConvertEnabled: boolean;
  testnet: boolean;
}

// Navigation Types
export type RootStackParamList = {
  Home: undefined;
  Send: undefined;
  Receive: undefined;
  Settings: undefined;
  History: undefined;
  // ... add all routes
};

// API Response Types
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// Error Types
export interface AppError {
  message: string;
  code?: string;
  stack?: string;
}
```

### 2.2 Bitcoin/Crypto Types

**File: `types/bitcoin.ts`**

```typescript
import { Psbt, Transaction as BitcoinTransaction } from 'bitcoinjs-lib';

export interface PsbtInput {
  witnessUtxo?: {
    script: Buffer;
    value: number;
  };
  tapInternalKey?: Buffer;
  tapMerkleRoot?: Buffer;
  nonWitnessUtxo?: Buffer;
  redeemScript?: Buffer;
  witnessScript?: Buffer;
}

export interface SignedPsbt {
  psbt: Psbt;
  hex: string;
  txid: string;
}

export interface TransactionIntent {
  recipientAddress: string;
  amount: number;
  assetType: 'BTC' | 'UNIT';
  feeRate?: number;
  memo?: string;
}

// Add more as needed
```

### 2.3 React/Context Types

**File: `types/contexts.ts`**

```typescript
import { ReactNode } from 'react';
import { Wallet, Transaction, BalanceData, AppSettings } from './index';

export interface WalletContextValue {
  wallet: Wallet | null;
  setWallet: (wallet: Wallet | null) => void;
  clearWallet: () => Promise<void>;
  loadWallet: () => Promise<void>;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isPinSetup: boolean;
  isBiometricsSetup: boolean;
  authenticate: () => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  // ... add all methods
}

export interface ProviderProps {
  children: ReactNode;
}

// Add more context types as needed
```

## Phase 3: Migration Order & Priorities

### Priority 1: Foundation (Week 1-2)
1. **Type Definitions** (`types/` directory)
   - Core types
   - Bitcoin types
   - API types
   - Context types

2. **Utils** (17 files)
   - `utils/constants.ts`
   - `utils/logger.ts`
   - `utils/retry.ts`
   - `utils/api.ts`
   - `utils/apiClient.ts`
   - `utils/errorParser.ts`
   - `utils/formatters/` (4 files)
   - `utils/bitcoin/` (2 files)
   - `utils/wallet/` (5 files)

### Priority 2: Services Layer (Week 3-4)
3. **Core Services** (21+ files)
   - `services/sentryService.ts`
   - `services/cacheService.ts`
   - `services/pinHashing.ts`
   - `services/pinLockout.ts`
   - `services/settingsService.ts`
   - `services/settingsHelpers.ts`
   - `services/walletService.ts`
   - `services/balanceService.ts`
   - `services/vaultService.ts`
   - `services/airdropService.ts`
   - `services/urlShortener.ts`

4. **Transaction Services** (6 files)
   - `services/transaction/utxoSelection.ts`
   - `services/transaction/runesUtxoSelection.ts`
   - `services/transaction/btcTransaction.ts`
   - `services/transaction/runesTransaction.ts`
   - `services/transaction/runesPsbtBuilder.ts`
   - `services/psbtService.ts`
   - `services/transactionSigningService.ts`
   - `services/transactionBroadcastService.ts`
   - `services/transactionCalculationService.ts`
   - `services/transactionHistoryService.ts`

5. **Cashu Services** (23 files)
   - `services/cashu/crypto/` (5 files)
   - `services/cashu/p2pk/` (5 files)
   - `services/cashu/mintClient/` (6 files)
   - `services/cashu/operations/` (7 files)
   - Core cashu files (6 files)

6. **Other Services**
   - `services/passkey/` (9 files)
   - `services/turbo/` (3 files)
   - `services/backgroundTaskService.ts`

### Priority 3: State Management (Week 5-6)
7. **Contexts** (16 files)
   - `contexts/WalletContext.tsx`
   - `contexts/AuthContext.tsx`
   - `contexts/WalletDataContext.tsx`
   - `contexts/CashuContext.tsx`
   - `contexts/UIContext.tsx`
   - `contexts/NavigationHandlersContext.tsx`
   - `contexts/PriceContext.tsx`
   - `contexts/NotificationContext.tsx`
   - `contexts/VaultContext.tsx`
   - `contexts/AirdropContext.tsx`
   - `contexts/PendingTransactionsContext.tsx`
   - `contexts/SendFlowContext.tsx`
   - `contexts/TransactionBuildContext.tsx`
   - `contexts/TransactionExecutionContext.tsx`
   - `contexts/DisplayPreferencesContext.tsx`

### Priority 4: Hooks (Week 7-8)
8. **Hooks** (67 files) - Group by domain:
   - **Wallet hooks** (~12 files): useWallet*, useBalance*, etc.
   - **Cashu hooks** (~8 files): useCashu*, useEcash*, etc.
   - **Transaction hooks** (~10 files): useTransaction*, useSend*, etc.
   - **UI/Navigation hooks** (~15 files): useNavigation*, useSheet*, useToast, etc.
   - **Settings hooks** (~5 files): useSettings*, useAuth*, etc.
   - **Utility hooks** (~10 files): usePolling, useRetry, etc.
   - **Vault/Turbo hooks** (~7 files): useVault*, useTurbo*, etc.

### Priority 5: UI Layer (Week 9-10)
9. **Navigation** (7 files)
   - Navigation configuration
   - Route types
   - Navigation utilities

10. **Screens** (~15 files)
    - Main screens
    - Modal screens
    - Sheet screens

11. **Components** (Small number)
    - Shared UI components
    - Wallet components
    - Form components

### Priority 6: Tests (Week 11-12)
12. **Test Files** (143 test suites)
    - Update test utilities
    - Migrate test files to `.test.ts` or `.test.tsx`
    - Add type assertions
    - Update mocks

## Phase 4: Migration Guidelines & Best Practices

### 4.1 File Naming Convention
- React components: `.tsx`
- Non-React TypeScript: `.ts`
- Keep test files matching: `.test.ts` or `.test.tsx`

### 4.2 Import/Export Patterns

**Before (JS):**
```javascript
export function calculateFee(utxos, feeRate) {
  // ...
}
```

**After (TS):**
```typescript
export function calculateFee(utxos: UTXO[], feeRate: number): number {
  // ...
}
```

### 4.3 React Component Migration

**Before (JS):**
```javascript
export function WalletCard({ wallet, onPress }) {
  return (
    // ...
  );
}
```

**After (TS):**
```typescript
interface WalletCardProps {
  wallet: Wallet;
  onPress: () => void;
}

export function WalletCard({ wallet, onPress }: WalletCardProps) {
  return (
    // ...
  );
}
```

### 4.4 Context Migration

**Before (JS):**
```javascript
const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  // ...
}
```

**After (TS):**
```typescript
interface WalletContextValue {
  wallet: Wallet | null;
  setWallet: (wallet: Wallet | null) => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: ProviderProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  // ...
}
```

### 4.5 Hook Migration

**Before (JS):**
```javascript
export function useBalance() {
  const [balance, setBalance] = useState(0);
  // ...
}
```

**After (TS):**
```typescript
interface UseBalanceReturn {
  balance: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useBalance(): UseBalanceReturn {
  const [balance, setBalance] = useState<number>(0);
  // ...
}
```

### 4.6 Async Function Migration

```typescript
export async function fetchBalance(address: string): Promise<number> {
  const response = await fetch(`/api/balance/${address}`);
  const data: { balance: number } = await response.json();
  return data.balance;
}
```

### 4.7 Event Handler Types

```typescript
import { GestureResponderEvent } from 'react-native';

interface ButtonProps {
  onPress: (event: GestureResponderEvent) => void;
  title: string;
}
```

### 4.8 BigInt Support

For UNIT rune amounts, ensure proper BigInt typing:

```typescript
export interface RuneBalance {
  rune: string;
  amount: bigint; // Not number!
  symbol: string;
}

// Serialization helpers
export function serializeRuneBalance(balance: RuneBalance): string {
  return JSON.stringify({
    ...balance,
    amount: balance.amount.toString(),
  });
}
```

### 4.9 Handling Third-Party Libraries Without Types

For libraries without official types:

**Create `types/declarations.d.ts`:**
```typescript
declare module 'react-native-confetti-cannon' {
  import { Component } from 'react';
  export default class ConfettiCannon extends Component<any> {}
}

declare module 'react-native-icloudstore' {
  export function setItem(key: string, value: string): Promise<void>;
  export function getItem(key: string): Promise<string | null>;
}
```

## Phase 5: Migration Execution

### 5.1 Per-File Migration Process

For each file:

1. **Rename** `.js` → `.ts` or `.tsx`
2. **Add type imports** at the top
3. **Type function parameters** and return types
4. **Type state variables** in hooks/components
5. **Type props** for components
6. **Add explicit return types** for functions
7. **Fix type errors** reported by TypeScript
8. **Update imports** in files that import this file
9. **Run tests** to ensure functionality
10. **Commit** with descriptive message

### 5.2 Type Error Resolution Strategy

When encountering type errors:

1. **Start with `any`** if needed, then gradually narrow
2. **Use type guards** for runtime checks
3. **Add type assertions** only when necessary (with `as`)
4. **Prefer interfaces** over types for objects
5. **Use union types** for multiple possible types
6. **Use `unknown`** instead of `any` when possible

### 5.3 Testing Strategy

For each migrated file:
- ✅ Existing tests should still pass
- ✅ Add type assertions in tests
- ✅ Test edge cases with different types
- ✅ Verify no runtime regressions

### 5.4 Code Review Checklist

For each PR:
- [ ] All type errors resolved
- [ ] No `any` types (or justified with comment)
- [ ] Exported types have proper JSDoc
- [ ] Tests pass
- [ ] No breaking API changes
- [ ] Imports updated correctly

## Phase 6: Advanced TypeScript Features

### 6.1 Discriminated Unions

For transaction types:

```typescript
type AssetType = 'BTC' | 'UNIT' | 'ECASH';

interface BaseTransaction {
  txid: string;
  timestamp: number;
  amount: number;
}

interface BTCTransaction extends BaseTransaction {
  assetType: 'BTC';
  fee: number;
  size: number;
}

interface UNITTransaction extends BaseTransaction {
  assetType: 'UNIT';
  runeAmount: bigint;
}

interface ECASHTransaction extends BaseTransaction {
  assetType: 'ECASH';
  tokenData: LockedToken;
  claimed: boolean;
}

type TransactionUnion = BTCTransaction | UNITTransaction | ECASHTransaction;

function processTransaction(tx: TransactionUnion) {
  switch (tx.assetType) {
    case 'BTC':
      // TypeScript knows tx is BTCTransaction here
      console.log(tx.fee);
      break;
    case 'UNIT':
      // TypeScript knows tx is UNITTransaction here
      console.log(tx.runeAmount);
      break;
    case 'ECASH':
      // TypeScript knows tx is ECASHTransaction here
      console.log(tx.claimed);
      break;
  }
}
```

### 6.2 Utility Types

```typescript
// Make all properties optional
type PartialWallet = Partial<Wallet>;

// Pick specific properties
type WalletAddresses = Pick<Wallet, 'segwitAddress' | 'taprootAddress'>;

// Omit specific properties
type WalletWithoutMnemonic = Omit<Wallet, 'mnemonic'>;

// Make properties readonly
type ReadonlyWallet = Readonly<Wallet>;

// Extract from union
type AssetType = 'BTC' | 'UNIT' | 'ECASH';
type NonEcashAsset = Exclude<AssetType, 'ECASH'>; // 'BTC' | 'UNIT'
```

### 6.3 Generic Types

For reusable hooks:

```typescript
interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: () => Promise<void>;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>
): UseAsyncReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async () => {
    setLoading(true);
    try {
      const result = await asyncFunction();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
}
```

## Phase 7: Potential Challenges & Solutions

### 7.1 Challenge: Bitcoin Library Types

**Problem**: Some Bitcoin libraries have incomplete types.

**Solution**:
- Create custom type definitions in `types/bitcoin.d.ts`
- Contribute types back to DefinitelyTyped
- Wrap libraries with typed interfaces

### 7.2 Challenge: BigInt JSON Serialization

**Problem**: BigInt values can't be directly serialized to JSON.

**Solution**:
```typescript
// Create serialization helpers
export const BigIntJSON = {
  stringify: (obj: any): string => {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value
    );
  },
  parse: (str: string): any => {
    return JSON.parse(str, (key, value) => {
      if (typeof value === 'string' && /^\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1));
      }
      return value;
    });
  },
};
```

### 7.3 Challenge: React Native Component Types

**Problem**: React Native components have complex prop types.

**Solution**:
```typescript
import { ViewProps, TextProps, TouchableOpacityProps } from 'react-native';

interface CustomButtonProps extends TouchableOpacityProps {
  title: string;
  variant: 'primary' | 'secondary';
}
```

### 7.4 Challenge: Context Type Safety

**Problem**: Context might be undefined.

**Solution**:
```typescript
const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
```

### 7.5 Challenge: Test Type Safety

**Problem**: Test mocks need proper typing.

**Solution**:
```typescript
import { jest } from '@jest/globals';

const mockWallet: Wallet = {
  mnemonic: 'test mnemonic',
  segwitAddress: 'bc1qtest',
  taprootAddress: 'bc1ptest',
  segwitPubkey: 'testpubkey',
  taprootPubkey: 'testpubkey',
};

const mockUseWallet = jest.fn<() => WalletContextValue>(() => ({
  wallet: mockWallet,
  setWallet: jest.fn(),
  clearWallet: jest.fn(),
  loadWallet: jest.fn(),
}));
```

## Phase 8: Post-Migration Tasks

### 8.1 Enable Strict Mode Gradually

After initial migration, gradually enable stricter rules:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 8.2 Documentation

- Update README with TypeScript setup instructions
- Document common type patterns
- Create type reference documentation
- Add TypeScript to contributor guidelines

### 8.3 CI/CD Integration

Update CI pipeline to:
```yaml
- name: Type Check
  run: npm run type-check

- name: Lint
  run: npm run lint

- name: Test
  run: npm test
```

### 8.4 Performance Monitoring

After migration:
- Monitor bundle size changes
- Check build time differences
- Verify no runtime performance regressions

## Timeline Estimate

### Conservative Timeline (Full Team)
- **Phase 1**: Setup & Configuration - 1 week
- **Phase 2**: Type Definitions - 1 week
- **Phase 3-5**: Migration - 10 weeks
- **Phase 6**: Advanced Features - 1 week
- **Phase 7**: Testing & Bug Fixes - 2 weeks
- **Phase 8**: Post-Migration - 1 week

**Total**: ~16 weeks (4 months)

### Aggressive Timeline (Dedicated Developer)
- **Phase 1-2**: Setup & Types - 1 week
- **Phase 3-5**: Migration - 6 weeks
- **Phase 6-8**: Finalization - 1 week

**Total**: ~8 weeks (2 months)

## Success Criteria

- ✅ 100% of JavaScript files migrated to TypeScript
- ✅ Zero TypeScript errors with strict mode enabled
- ✅ All 2,620+ tests passing
- ✅ No runtime regressions
- ✅ Build succeeds on all platforms (iOS, Android, Web)
- ✅ Documentation updated
- ✅ Team trained on TypeScript patterns

## Benefits After Migration

1. **Type Safety**: Catch errors at compile time
2. **Better IDE Support**: Improved autocomplete and refactoring
3. **Self-Documenting Code**: Types serve as inline documentation
4. **Easier Refactoring**: Confident large-scale changes
5. **Better Onboarding**: New developers understand code faster
6. **Reduced Bugs**: Fewer runtime type errors
7. **Better Integration**: Easier to integrate typed libraries

## Risks & Mitigation

### Risk 1: Development Slowdown
- **Mitigation**: Allow `any` types initially, refine later
- **Mitigation**: Pair experienced TypeScript developers with team

### Risk 2: Breaking Changes
- **Mitigation**: Thorough testing at each step
- **Mitigation**: Feature flags for risky changes
- **Mitigation**: Incremental rollout

### Risk 3: Third-Party Library Issues
- **Mitigation**: Create custom type definitions
- **Mitigation**: Use `@ts-ignore` with comments explaining why
- **Mitigation**: Contribute types upstream

### Risk 4: Team Resistance
- **Mitigation**: Provide TypeScript training
- **Mitigation**: Start with easy files to build confidence
- **Mitigation**: Show benefits early (better IDE support, fewer bugs)

## Conclusion

Migrating to TypeScript is a significant but worthwhile investment for the Ducat application. The incremental approach allows for continuous development while gradually improving type safety. With proper planning and execution, the migration can be completed in 2-4 months depending on team size and dedication.

The benefits of improved code quality, developer experience, and reduced bugs will compound over time, making this migration a sound technical decision for the long-term health of the project.
