# Ducat App – Architecture Standards & Refactoring Guide

**Current State:** v1 Pre-Refactor
**Goal:** Evolve toward a simple, elegant React Native codebase that's easy to maintain and scale.

---

## 📍 Where We Are Now (v1 Reality Check)

### Current Structure
```
app/
├── components/        23 files (but 9 are actually screens 😬)
├── screens/send/      6 files (✅ well-organized send flow)
├── pages/             2 files (orchestrators: WalletPage, OnboardingPage)
├── hooks/             21 files (✅ good custom hooks)
├── contexts/          15 files (⚠️ some very complex)
├── services/          12 files (✅ good separation)
├── navigation/        6 files
├── utils/             13 files
├── constants/         4 files
├── styles.js          2,490 lines ⚠️⚠️⚠️ BIGGEST ISSUE
├── Icon.jsx           1,367 lines ⚠️⚠️ SECOND BIGGEST ISSUE
└── App.js
```

### What's Working Well ✅
1. **Service layer** - Clean separation of business logic
2. **Custom hooks** - Good extraction pattern (useAuth, useWalletCalculations, etc.)
3. **Send flow** - `/screens/send/` is well-organized
4. **Context hierarchy** - Properly structured provider tree
5. **Constants & utils** - Good organization
6. **Testing** - 54+ test files, good coverage

### Critical Issues 🔴
1. **styles.js (2,490 lines)** - Monolithic stylesheet only partially adopted
2. **Icon.jsx (1,367 lines)** - All SVG icons in one massive file
3. **Screen/Component chaos** - Screens scattered across 3 directories
4. **5 files > 500 lines** - Need splitting
5. **Context complexity** - WalletDataContext has 33 hooks (!)

### File Size Reality
- **Largest file:** 2,490 lines (styles.js)
- **Files > 500 lines:** 5 files
- **Files > 300 lines:** 14 files
- **Files > 200 lines:** 29 files

---

## 🎯 Core Principles (Unchanged)

1. **Small pieces** - Files, functions, and components should be small and focused
2. **Separation of concerns** - UI in components, logic in hooks/services
3. **Composition > complexity** - Combine simple components vs one huge one
4. **Colocation > premature abstraction** - Keep related code together
5. **Metrics are signals** - Guidelines, not laws

---

## 📏 Standards (Adapted for Current State)

### File Size Standards

#### Current vs Target

| Type | Current Reality | Target (6 months) | Hard Limit |
|------|----------------|-------------------|------------|
| **Screens** | 10 files > 400 lines | ≤ 400 lines | 500 lines |
| **Components** | Mixed with screens | ≤ 300 lines | 400 lines |
| **Hooks** | Mostly good | ≤ 200 lines | 250 lines |
| **Services** | 1 file at 575 lines | ≤ 400 lines | 500 lines |
| **Contexts** | 1 file at 393 lines | ≤ 300 lines | 400 lines |
| **Utils** | Good | ≤ 100 lines | 150 lines |

#### Immediate Action Required (Hard Limits)
- 🚨 **Any file > 700 lines** - Must split NOW
- 🚨 **Any file > 500 lines** - Schedule refactor this sprint
- ⚠️ **Any file > 400 lines** - Plan refactor within 2 sprints

### Component Complexity Standards

#### Current State
- **WalletDataContext:** 33 hooks ⚠️
- **VaultScreen:** 17 hooks ⚠️
- **TransactionHistoryScreen:** 12 hooks ⚠️
- **WalletPage:** 10+ hooks ⚠️

#### Target Standards
- **Hooks per component:**
  - Ideal: 2–5 hooks
  - Acceptable: 5–8 hooks
  - Refactor: 8–12 hooks
  - **Hard limit: 15 hooks** (then MUST extract)

- **Props:**
  - Ideal: 3–8 props
  - Hard limit: 12 props

- **State variables:**
  - Ideal: ≤ 8 state vars
  - Hard limit: 12 state vars

### Function Complexity
- **Ideal:** 5–20 lines
- **Strong signal:** 30 lines
- **Hard limit:** 50 lines
- **Max params:** 5 (use config object for more)
- **Cyclomatic complexity:** ≤ 10
- **Nesting depth:** ≤ 3 levels

---

## 🗂️ Target Architecture (Phased Migration)

### Phase 1: Quick Wins (Current Sprint)

**Goal:** Fix the biggest messes without major restructuring.

#### 1.1 Consolidate Screen Locations
```
BEFORE (scattered):
components/
  - WalletScreen.jsx
  - VaultScreen.jsx
  - ReceiveScreen.jsx
  - TransactionHistoryScreen.jsx
  - SettingsScreen.jsx
  - WelcomeScreen.jsx
  - PinSetupScreen.jsx
  - LockScreen.jsx
  - SplashScreen.jsx
screens/send/
  - 6 send flow screens
pages/
  - WalletPage.js
  - OnboardingPage.js

AFTER (organized):
screens/
  ├── wallet/
  │   ├── WalletScreen.jsx
  │   ├── VaultScreen.jsx
  │   ├── ReceiveScreen.jsx
  │   └── TransactionHistoryScreen.jsx
  ├── send/
  │   └── (keep existing 6 screens)
  ├── settings/
  │   └── SettingsScreen.jsx
  ├── auth/
  │   ├── WelcomeScreen.jsx
  │   ├── PinSetupScreen.jsx
  │   └── LockScreen.jsx
  └── SplashScreen.jsx
pages/
  ├── WalletPage.js (orchestrator)
  └── OnboardingPage.js (orchestrator)
components/
  └── (only reusable UI components)
```

**Action Items:**
- [ ] Move 9 screen files from `components/` to `screens/`
- [ ] Create feature folders: `wallet/`, `settings/`, `auth/`
- [ ] Update all import paths
- [ ] Verify tests still pass

#### 1.2 Refactor Icon.jsx (1,367 lines)

**Options:**
1. **Quick win:** Split into icon category files
   ```
   components/icons/
   ├── index.js          (barrel export)
   ├── BitcoinIcons.jsx  (bitcoin, satoshi, etc.)
   ├── UIIcons.jsx       (chevron, check, close, etc.)
   ├── WalletIcons.jsx   (wallet, vault, etc.)
   └── ActionIcons.jsx   (send, receive, etc.)
   ```

2. **Better solution:** Use established library
   ```bash
   npm install react-native-vector-icons
   # or
   npm install @expo/vector-icons
   ```

**Decision:** Choose option 1 for now (less risk), migrate to library later.

**Action Items:**
- [ ] Analyze Icon.jsx and group by category
- [ ] Create `components/icons/` directory
- [ ] Split into 4-5 category files (each < 300 lines)
- [ ] Create barrel export in `components/icons/index.js`
- [ ] Update imports across app
- [ ] Delete old Icon.jsx

#### 1.3 Address styles.js (2,490 lines)

**Problem:** Monolithic stylesheet only used by 7 files, while 24 files use local styles.

**Solution:** Move to component-scoped styles progressively.

**Strategy:**
1. **Don't touch working components** - If a component has local styles and works, leave it
2. **New components** - Always use component-scoped styles
3. **When refactoring a component** - Move its styles from global to local
4. **Common styles** - Extract to theme/

**Action Items:**
- [ ] Create `theme/` directory structure:
  ```
  theme/
  ├── index.js          (main export)
  ├── colors.js         (already exists in utils/)
  ├── typography.js     (font sizes, weights)
  ├── spacing.js        (margins, padding values)
  ├── layout.js         (common layouts)
  └── components.js     (shared component styles)
  ```
- [ ] Extract reusable styles from styles.js to theme/
- [ ] Document styling approach in this file
- [ ] Gradually migrate components (not all at once)

### Phase 2: Structural Improvements (Next 2-3 Sprints)

#### 2.1 Split Large Files

**Priority Order:**

1. **ReviewScreen.jsx (741 lines)**
   ```
   Extract to:
   - hooks/useReviewScreenData.js (PSBT parsing logic)
   - components/review/TransactionSummary.jsx
   - components/review/InputOutputList.jsx
   - components/review/FeeBreakdown.jsx
   - screens/send/ReviewScreen.jsx (orchestrator, < 300 lines)
   ```

2. **VaultScreen.jsx (596 lines, 17 hooks)**
   ```
   Extract to:
   - hooks/useVaultWebView.js (WebView logic)
   - hooks/useVaultSigning.js (PSBT signing)
   - components/vault/VaultHeader.jsx
   - components/vault/VaultWebView.jsx
   - screens/wallet/VaultScreen.jsx (orchestrator, < 300 lines)
   ```

3. **transactionService.js (575 lines)**
   ```
   Split into:
   - services/transaction/
     ├── index.js (barrel export)
     ├── transactionCore.js (basic tx operations)
     ├── transactionBuilder.js (tx construction)
     ├── transactionValidator.js (validation logic)
     └── transactionUtils.js (helpers)
   ```

4. **TransactionHistoryScreen.jsx (480 lines)**
   ```
   Extract to:
   - hooks/useTransactionHistory.js (data fetching/filtering)
   - components/transaction/TransactionList.jsx
   - components/transaction/TransactionFilters.jsx
   - screens/wallet/TransactionHistoryScreen.jsx (< 300 lines)
   ```

5. **WalletPage.js (453 lines)**
   ```
   Extract to:
   - hooks/useWalletPage.js (orchestration logic)
   - components/wallet/WalletHeader.jsx
   - components/wallet/BalanceCard.jsx
   - pages/WalletPage.js (< 300 lines)
   ```

#### 2.2 Context Optimization

**WalletDataContext (393 lines, 33 hooks)** - Too complex!

**Analysis:**
- Merged 3 contexts: BalanceContext, TransactionHistoryContext, VaultDataContext
- Manages: balance, UTXOs, transaction history, vault data, pending transactions

**Options:**

**Option A: Keep merged but extract logic**
```
contexts/
├── WalletDataContext.js (< 200 lines, just state management)
└── hooks/
    ├── useBalanceData.js (balance fetching logic)
    ├── useTransactionHistory.js (history logic)
    └── useVaultData.js (vault logic)
```

**Option B: Re-split into domain contexts** (only if Option A still too complex)
```
contexts/
├── BalanceContext.js
├── TransactionHistoryContext.js
├── VaultDataContext.js
└── WalletDataProvider.js (wrapper that provides all three)
```

**Decision:** Try Option A first (less breaking changes).

**Action Items:**
- [ ] Extract data fetching logic from WalletDataContext to hooks
- [ ] Reduce WalletDataContext to < 250 lines
- [ ] Keep backwards compatibility exports
- [ ] Monitor performance (context splitting can help if needed)

### Phase 3: Feature-Based Organization (3-6 months out)

**Only do this when you feel the pain of current structure.**

#### 3.1 When to Create Features

Create a `features/` folder ONLY when:
- ✅ App has 3+ distinct major features
- ✅ Each feature has 10+ related files
- ✅ Features are truly independent
- ✅ Multiple developers working on different features

#### 3.2 Candidate Features (Future)

Based on current code:
```
features/
├── wallet/           # Main wallet functionality
│   ├── screens/      # WalletScreen, VaultScreen, ReceiveScreen
│   ├── components/   # Wallet-specific components
│   ├── hooks/        # useWalletCalculations, etc.
│   └── contexts/     # WalletDataContext
│
├── transactions/     # Transaction history & management
│   ├── screens/      # TransactionHistoryScreen
│   ├── components/   # Transaction list, filters
│   └── hooks/        # useTransactionHistory
│
├── send/             # Send flow (already well-organized!)
│   ├── screens/      # Existing 6 screens
│   └── hooks/        # Send-specific hooks
│
└── auth/             # Authentication & onboarding
    ├── screens/      # WelcomeScreen, PinSetupScreen, LockScreen
    ├── pages/        # OnboardingPage
    └── hooks/        # useAuth
```

**Don't do this yet.** Current structure is fine. Only migrate when:
- Screens folder has 20+ screens
- Clear feature boundaries are obvious
- Team is growing and needs better isolation

---

## 🎨 Styling Strategy (Immediate Decision Needed)

### Current Situation
- **styles.js (2,490 lines):** Global stylesheet, only 7 files use it
- **24 files:** Use local `StyleSheet.create()`
- **Inconsistent approach** causing confusion

### Recommended Approach

#### 1. Theme System (Foundation)
```javascript
// theme/index.js
export const theme = {
  colors: {
    // Already have in utils/colors.js - move here
    primary: '#F7931A',
    background: '#000000',
    // ... rest from colors.js
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 24, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    caption: { fontSize: 12, fontWeight: '400' },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
};
```

#### 2. Component-Scoped Styles (Default)
```javascript
// screens/wallet/WalletScreen.jsx
import { theme } from '../../theme';

const WalletScreen = () => {
  return <View style={styles.container}>...</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md, // Not magic number!
  },
});
```

#### 3. Shared Component Styles (When Needed)
```javascript
// theme/components.js
import { StyleSheet } from 'react-native';
import { theme } from './index';

export const sharedStyles = StyleSheet.create({
  // Only for truly shared patterns (buttons, cards, etc.)
  primaryButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
});
```

#### 4. Migration Rules

**For new components:**
- ✅ Always use component-scoped styles
- ✅ Import from `theme/` for colors, spacing, etc.
- ❌ Never use magic numbers (use theme values)
- ❌ Don't import from old `styles.js`

**For existing components:**
- ✅ If it works, leave it alone (for now)
- ✅ When refactoring, migrate to new pattern
- ✅ When touching a component, update its styles
- ⚠️ Don't do mass refactor of all styles at once

**Deprecation path for styles.js:**
- [ ] Create `theme/` directory
- [ ] Move `utils/colors.js` → `theme/colors.js`
- [ ] Create `theme/spacing.js`, `theme/typography.js`
- [ ] Document new pattern (above)
- [ ] Gradually migrate components during normal work
- [ ] After 6 months, remove unused parts of styles.js
- [ ] Eventually delete styles.js when no imports remain

---

## 🔍 Component Categories (For Our App)

### Screens
**Location:** `screens/[feature]/`

**Definition:** Full-page components that:
- Are routed to by navigation
- Orchestrate multiple components
- Handle data fetching via hooks
- Manage screen-level state

**Examples:**
- `screens/wallet/WalletScreen.jsx`
- `screens/send/AmountInputScreen.jsx`
- `screens/settings/SettingsScreen.jsx`

**Rules:**
- Max 400 lines (hard limit: 500)
- Business logic in hooks, not inline
- Mostly composition of smaller components

### Pages (Orchestrators)
**Location:** `pages/`

**Definition:** High-level orchestrators that:
- Wrap multiple screens
- Manage flow between screens
- Handle complex state coordination

**Examples:**
- `pages/WalletPage.js` (coordinates wallet experience)
- `pages/OnboardingPage.js` (multi-step onboarding)

**Rules:**
- Max 400 lines
- Minimal direct rendering
- Mostly renders screens/routes

### Components (Reusable UI)
**Location:** `components/`

**Definition:** Reusable UI pieces that:
- Are used across multiple screens
- Have no screen-specific logic
- Accept props for configuration

**Examples:**
- `components/Button.jsx`
- `components/TransactionItem.jsx`
- `components/Snackbar.jsx`

**Sub-organization (when > 20 components):**
```
components/
├── ui/              # Truly reusable (Button, Input, Card)
├── transaction/     # Transaction-related components
├── wallet/          # Wallet-related components
└── icons/           # Icon components
```

---

## 📦 Refactoring Patterns

### Pattern 1: Extract Display Components

**Before:**
```javascript
// VaultScreen.jsx - 596 lines
function VaultScreen() {
  // ... 17 hooks
  // ... 300 lines of logic

  return (
    <View>
      {/* 200 lines of JSX */}
    </View>
  );
}
```

**After:**
```javascript
// screens/wallet/VaultScreen.jsx - 200 lines
function VaultScreen() {
  const vaultData = useVaultScreen();

  return (
    <View>
      <VaultHeader {...vaultData.header} />
      <VaultWebView {...vaultData.webView} />
      <VaultActions {...vaultData.actions} />
    </View>
  );
}

// hooks/useVaultScreen.js - 250 lines
export function useVaultScreen() {
  // All the hooks and logic
  return { header, webView, actions };
}

// components/vault/VaultHeader.jsx - 80 lines
export function VaultHeader({ title, balance, onPress }) {
  return (
    <View style={styles.header}>
      {/* Display only */}
    </View>
  );
}
```

### Pattern 2: Extract Business Logic to Services

**Before:**
```javascript
// ReviewScreen.jsx
function ReviewScreen() {
  const parsePSBT = (psbt) => {
    // 100 lines of parsing logic
  };

  // ... use parsePSBT
}
```

**After:**
```javascript
// services/psbtService.js
export function parsePSBT(psbt) {
  // 100 lines of parsing logic
}

// screens/send/ReviewScreen.jsx
import { parsePSBT } from '../../services/psbtService';

function ReviewScreen() {
  const parsedData = parsePSBT(psbt);
}
```

### Pattern 3: Split Large Services

**Before:**
```javascript
// services/transactionService.js - 575 lines
export const transactionService = {
  createTransaction() { /* 100 lines */ },
  validateTransaction() { /* 80 lines */ },
  broadcastTransaction() { /* 50 lines */ },
  calculateFees() { /* 70 lines */ },
  // ... 10 more methods
};
```

**After:**
```javascript
// services/transaction/index.js
export { transactionBuilder } from './transactionBuilder';
export { transactionValidator } from './transactionValidator';
export { transactionBroadcaster } from './transactionBroadcaster';
export { feeCalculator } from './feeCalculator';

// services/transaction/transactionBuilder.js - 150 lines
export const transactionBuilder = {
  createTransaction() { /* ... */ },
  // Related methods
};

// Usage remains the same via barrel export:
import { transactionBuilder } from '../../services/transaction';
```

---

## ✅ Agent Checklist (Per Task / PR)

### File Size
- [ ] No UI file > 500 lines (target: 400)
- [ ] No hook > 200 lines (target: 150)
- [ ] No service > 500 lines (target: 400)
- [ ] No context > 400 lines (target: 300)
- [ ] No util file > 150 lines (target: 100)

### Component Complexity
- [ ] No component with > 12 props (ideal: ≤ 8)
- [ ] No component with > 12 state variables (ideal: ≤ 8)
- [ ] No component with > 15 hooks (ideal: ≤ 5)
- [ ] JSX nesting depth ≤ 6 (ideal: ≤ 4)

### Function Complexity
- [ ] No function > 50 lines (ideal: ≤ 20)
- [ ] Function params ≤ 5
- [ ] Cyclomatic complexity ≤ 10
- [ ] Nesting depth ≤ 3

### Code Quality
- [ ] No `console.log` in committed code
- [ ] No commented-out code
- [ ] PropTypes defined for components
- [ ] All imports are used

### Testing
- [ ] Tests exist for new complex logic
- [ ] Tests updated for refactored code
- [ ] All tests pass

### UX/UI
- [ ] Screens handle loading state
- [ ] Screens handle error state (with retry)
- [ ] Screens handle empty state
- [ ] Lists use `FlatList`/`SectionList`

### Architecture (New Standards)
- [ ] Screens are in `screens/` (not `components/`)
- [ ] Reusable components are in `components/`
- [ ] Logic is in hooks/services (not in components)
- [ ] Styles use theme values (no magic numbers)
- [ ] New code doesn't import from old `styles.js`

---

## 🎯 Priority Refactoring Roadmap

### Sprint 1 (Current) - Critical Fixes
**Goal:** Fix organizational chaos, no major code changes

1. [x] **Move screens from components/ to screens/** ✅ COMPLETED
   - Create feature folders: wallet/, send/, settings/, auth/
   - Move 9 screen files
   - Update imports
   - Update tests
   - **Est:** 2-3 hours

2. [x] **Split Icon.jsx (1,367 lines) into categories** ✅ COMPLETED
   - Create components/icons/ directory
   - Split into 4-5 category files
   - Create barrel export
   - Update imports
   - **Est:** 3-4 hours

3. [x] **Create theme/ directory** ✅ COMPLETED
   - Move utils/colors.js → theme/colors.js
   - Create spacing.js, typography.js
   - Update imports (28 files updated)
   - Document new styling approach
   - **Est:** 2 hours
   - **Actual:** ~2 hours

**Total effort:** 7-9 hours
**Impact:** Massive improvement in organization, easier to find things

**Sprint 1 Status: ✅ COMPLETE (All 3 tasks done!)**

---

## 🎨 Theme System Usage Guide

### Overview
The `theme/` directory is now the single source of truth for all design tokens. This replaces the previous approach where colors lived in `utils/colors.js`.

### Structure
```
theme/
├── index.js          Main export - use this in new code
├── colors.js         All color constants (moved from utils/colors.js)
├── spacing.js        Spacing, border radius, and shadow constants
└── typography.js     Font families, weights, and text style variants
```

### How to Use in Components

**Recommended approach for new components:**
```javascript
import { theme } from '../theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.BLACK,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.WHITE,
  },
});
```

**For existing components (backwards compatible):**
```javascript
// Still works - imports just COLORS
import { COLORS } from '../theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.BLACK,
  },
});
```

### Available Theme Values

**Colors:**
- `theme.colors.BLACK`, `WHITE`, `DARK_BG`, etc.
- All color constants from previous `utils/colors.js`

**Spacing:**
- `theme.spacing.xs` (4px) through `theme.spacing.xxxl` (64px)
- `theme.borderRadius.sm` through `theme.borderRadius.full`
- `theme.shadows.sm`, `md`, `lg`, `xl` (with elevation)

**Typography:**
- `theme.typography.h1` through `h6` (headings)
- `theme.typography.body`, `bodyLarge`, `bodySmall`
- `theme.typography.caption`, `label`, `button`, etc.
- `theme.fontWeights.regular`, `medium`, `bold`, etc.

### Migration Status
- ✅ Theme directory created
- ✅ All 28 source files updated to import from `theme/`
- ✅ Backwards compatible - existing code still works
- ⏳ Gradual migration: Update to new `theme` object when touching files
- ⏳ Eventually deprecate standalone imports (COLORS, etc.)

### What's Next
- As you work on components, migrate to full `theme` object usage
- Add common component styles to `theme/components.js` when patterns emerge
- No rush - existing code works fine, migrate gradually

---

### Sprint 2-3 - Large File Splits
**Goal:** Reduce complexity of largest files

4. [ ] **Refactor ReviewScreen.jsx (741 lines)**
   - Extract PSBT parsing to service
   - Extract display components
   - Create useReviewScreenData hook
   - Target: < 300 lines
   - **Est:** 6-8 hours

5. [ ] **Refactor VaultScreen.jsx (596 lines, 17 hooks)**
   - Extract WebView logic to hook
   - Extract signing logic to hook
   - Extract display components
   - Target: < 300 lines
   - **Est:** 6-8 hours

6. [ ] **Split transactionService.js (575 lines)**
   - Create services/transaction/ directory
   - Split into 4-5 focused service files
   - Maintain backwards compatibility
   - **Est:** 4-6 hours

**Total effort:** 16-22 hours
**Impact:** Easier to understand and maintain complex screens/services

### Sprint 4-5 - Context Optimization
**Goal:** Reduce context complexity

7. [ ] **Optimize WalletDataContext (393 lines, 33 hooks)**
   - Extract data fetching to custom hooks
   - Reduce to < 250 lines
   - Keep backwards compatibility
   - Monitor performance
   - **Est:** 6-8 hours

8. [ ] **Refactor remaining large files**
   - TransactionHistoryScreen (480 lines)
   - WalletPage (453 lines)
   - ReceiveScreen (420 lines)
   - WalletScreen (408 lines)
   - **Est:** 12-16 hours total

**Total effort:** 18-24 hours
**Impact:** Improved performance, easier context management

### Sprint 6+ - Style Migration (Ongoing)
**Goal:** Gradually migrate away from monolithic styles.js

9. [ ] **Migrate styles progressively**
   - Update components as you touch them
   - Extract common patterns to theme/components.js
   - Track progress: X/24 components migrated
   - Delete styles.js when all migrated
   - **Est:** 1-2 hours per component (spread over time)

**Total effort:** 24-48 hours (but spread over many sprints)
**Impact:** Consistent styling, better maintainability

### Future (3-6 months)
10. [ ] **Consider feature-based organization** (only if needed)
11. [ ] **Add TypeScript gradually** (start with new files)
12. [ ] **Standardize error handling** across services
13. [ ] **Add integration tests** for critical flows

---

## 📊 Progress Tracking

### Current Baseline (v1)
```
Files > 500 lines:     5 files
Files > 400 lines:     9 files
Files > 300 lines:     14 files
Screens in components/: 9 files
Styling approach:      Inconsistent
Biggest file:          2,490 lines (styles.js)
Context hooks max:     33 hooks (WalletDataContext)
```

### Target State (6 months)
```
Files > 500 lines:     0 files
Files > 400 lines:     0 files
Files > 300 lines:     < 5 files
Screens in components/: 0 files
Styling approach:      Component-scoped + theme
Biggest file:          < 400 lines
Context hooks max:     < 15 hooks
```

### Metrics to Track
- [ ] Number of files > 500 lines: **5 → 0**
- [ ] Number of files > 400 lines: **9 → 0**
- [ ] Screens in correct location: **8/17 → 17/17**
- [ ] Icons split into categories: **1 file → 5 files**
- [ ] Components using new theme: **0/47 → 47/47**
- [ ] Max hooks in a component: **33 → 15**

---

## 🚀 Quick Reference

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT STATE vs TARGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        Current     Target      Hard Limit
Screens                 400-741     ≤ 400       500 lines
Components              Mixed       ≤ 300       400 lines
Hooks                   Good        ≤ 200       250 lines
Services                300-575     ≤ 400       500 lines
Contexts                200-393     ≤ 300       400 lines
Utils                   Good        ≤ 100       150 lines

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT COMPLEXITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Props                   Ideal: 3–8   |  Strong: 10   |  Hard: 12
State variables         Ideal: ≤ 8   |  Strong: 10   |  Hard: 12
Hooks per component     Ideal: 2–5   |  Strong: 8    |  Hard: 15
JSX nesting depth       Ideal: ≤ 4   |  Strong: 5    |  Hard: 6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION COMPLEXITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lines                   Ideal: 5–20  |  Strong: 30   |  Hard: 50
Parameters              Ideal: ≤ 3   |  Strong: 5    |  Hard: 5
Cyclomatic complexity   Ideal: ≤ 5   |  Strong: 8    |  Hard: 10
Nesting depth           Ideal: ≤ 2   |  Strong: 3    |  Hard: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL ISSUES TO FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. styles.js (2,490 lines)           → Migrate to component-scoped
2. Icon.jsx (1,367 lines)            → Split into categories
3. Screens in components/ (9 files)  → Move to screens/
4. ReviewScreen (741 lines)          → Split into components
5. VaultScreen (596 lines, 17 hooks) → Extract logic to hooks
6. transactionService (575 lines)    → Split into domain services
7. WalletDataContext (33 hooks)      → Extract to custom hooks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PRACTICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Screens → screens/[feature]/
✓ Components → components/ (only reusable)
✓ Logic → hooks/services (not in components)
✓ Design → theme/ (no magic numbers/colors)
✓ Styles → component-scoped + theme
✓ Icons → components/icons/ (split by category)
✓ Every screen → loading + error + empty states
✓ No console.log in committed code
✓ Tests for hooks, utils, and critical flows
```

---

## 📝 Decision Log

### Decisions Made
1. **Keep root-level structure** (no src/ folder) - Already established
2. **Component-scoped styles + theme** - Migrate away from monolithic styles.js
3. **Split Icon.jsx into categories** - Don't adopt new library yet (lower risk)
4. **Move screens to screens/** - Clear separation from components
5. **Keep WalletDataContext merged** - Extract logic to hooks first
6. **No immediate TypeScript migration** - Focus on structure first

### Decisions Pending
1. **When to create features/ structure?** - Wait until 20+ screens or clear pain
2. **Split or keep WalletDataContext?** - Try extracting logic first, split only if still too complex
3. **Icon library adoption?** - Revisit after splitting Icon.jsx

---

**Last Updated:** 2025-01-14
**Next Review:** After Sprint 1 completion
**Maintainer:** Development Team
