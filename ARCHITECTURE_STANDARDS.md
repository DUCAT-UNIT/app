# React Native Architecture Standards

**Status:** Aspirational Target State
**Purpose:** Define what excellent React Native architecture looks like

This document describes the ideal state. For current refactoring plans, see `REFACTORING_PLAN.md`.

---

## Core Principles

1. **Small pieces** - Files, functions, and components should be small and focused
2. **Separation of concerns** - UI in components, logic in hooks/services, data in services/store
3. **Composition > complexity** - Prefer combining simple components instead of making one huge one
4. **Colocation > premature abstraction** - Keep related code together; only separate when you feel the pain
5. **Metrics are signals** - Numbers below are guidelines. Break them with good reason and documentation

---

## File Size Standards

### Components
- **Atoms** (buttons, inputs, text): **≤ 150 lines**
  - State: 0-2 pieces
  - Props: ≤ 8
  - No business logic
  - No hooks (except useTheme, useStyles)

- **Molecules** (form fields, cards, list items): **≤ 250 lines**
  - State: 2-5 pieces
  - Props: ≤ 10
  - Hooks: ≤ 3

- **Organisms** (headers, complex sections): **≤ 350 lines**
  - State: ≤ 8
  - Props: ≤ 12
  - If using 3+ hooks, extract to custom hook
  - If JSX nesting > 4 levels, extract child components

- **Screens**: **≤ 400 lines** (hard limit: 500)
  - Mostly composition of smaller components
  - Business logic in hooks, not inline
  - Must handle: loading, error, empty states
  - Wrapped in error boundary

### Logic Files
- **Custom hooks**: **≤ 200 lines**
  - Single responsibility
  - Return ≤ 8 values (group related values in objects)
  - Maximum 3-4 other hooks called within

- **Services**: **≤ 300 lines** per domain
  - Group by domain (auth, users, transactions)
  - Each service has single responsibility

- **Utilities**: **≤ 100 lines** per file
  - Pure functions only
  - Max 5 functions per file

### State Management
- **Contexts**: **≤ 300 lines**
  - Single domain responsibility
  - Extract data fetching to hooks
  - Use for truly global state only

---

## Component Complexity Standards

### Props
- **Ideal:** 3-8 props
- **Warning:** 10 props
- **Hard limit:** 12 props
- If 5+ related props, use single object prop

### State Variables
- **Ideal:** ≤ 8 state variables
- **Hard limit:** 12 state variables
- If 4+ related states, consider `useReducer`

### Hooks per Component
- **Ideal:** 2-5 hooks
- **Warning:** 6 hooks
- **Hard limit:** 8 hooks
- If 5+ hooks, extract business logic to custom hook

### JSX Nesting Depth
- **Ideal:** ≤ 4 levels
- **Hard limit:** 6 levels
- If deeper, extract child components

---

## Function Complexity Standards

### Function Size
- **Ideal:** 5-20 lines
- **Warning:** 30 lines
- **Hard limit:** 50 lines

### Parameters
- **Ideal:** ≤ 3 parameters
- **Hard limit:** 5 parameters
- If more, use config object

### Other Metrics
- **Cyclomatic complexity:** ≤ 10
- **Nesting depth:** ≤ 3 levels (prefer early returns)

---

## Folder Structure

### Start Simple (< 20 screens)
```
app/
├── components/           # ALL components initially
├── screens/              # ALL screens, flat
├── hooks/                # ALL hooks
├── services/             # ALL services
├── contexts/             # Global state contexts
├── navigation/           # Navigation config
├── utils/                # Pure functions
├── theme/                # Design tokens
├── constants/            # App constants
├── types/                # TypeScript types (if using TS)
└── assets/               # Images, fonts, etc.
```

### Organize by Feature (20+ screens or 3+ developers)
```
app/
├── components/           # Shared/reusable UI only
│   ├── ui/              # Truly reusable (Button, Input, Card)
│   ├── icons/           # Icon components
│   └── ...
│
├── screens/              # Feature-organized screens
│   ├── auth/
│   │   ├── LoginScreen.jsx
│   │   ├── SignupScreen.jsx
│   │   └── PinSetupScreen.jsx
│   ├── wallet/
│   │   ├── WalletScreen.jsx
│   │   ├── ReceiveScreen.jsx
│   │   └── TransactionHistoryScreen.jsx
│   └── send/
│       ├── AmountInputScreen.jsx
│       ├── ReviewScreen.jsx
│       └── ConfirmationScreen.jsx
│
├── hooks/                # Shared hooks only
├── services/             # All services
├── contexts/             # Global contexts
├── navigation/
├── utils/
├── theme/
└── constants/
```

### Advanced: Feature Modules (50+ screens, 5+ developers)
```
app/
├── features/
│   ├── auth/
│   │   ├── components/   # Feature-specific components
│   │   ├── screens/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   ├── wallet/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── hooks/
│   │   ├── contexts/
│   │   └── services/
│   └── transactions/
│       └── ...
│
├── components/           # Truly shared components
├── hooks/                # Truly shared hooks
├── services/             # Truly shared services
├── navigation/
├── theme/
└── utils/
```

**Rule:** Only create structure when you feel the pain of NOT having it.

---

## Styling Strategy

### Theme System
```javascript
// theme/index.js
export const theme = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    success: '#34C759',
    error: '#FF3B30',
    warning: '#FF9500',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
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
    h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
    h2: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
    body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
  },
};
```

### Component-Scoped Styles (Default Approach)
```javascript
// screens/WalletScreen.jsx
import { StyleSheet } from 'react-native';
import { theme } from '../theme';

function WalletScreen() {
  return <View style={styles.container}>...</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
});
```

### Shared Component Styles (When Needed)
```javascript
// theme/components.js
import { StyleSheet } from 'react-native';
import { theme } from './index';

export const sharedStyles = StyleSheet.create({
  primaryButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
  },
});
```

### Styling Rules
- ✅ **Always use theme values** - No magic numbers for colors, spacing, etc.
- ✅ **Component-scoped by default** - Styles live with the component
- ✅ **Share only true patterns** - Buttons, cards, inputs that are identical
- ❌ **No inline styles** - Except for truly dynamic values
- ❌ **No global monolithic stylesheets** - They become unmaintainable

---

## Import Organization

### Import Order
```javascript
// 1. React / React Native
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 2. Third-party libraries
import { useNavigation } from '@react-navigation/native';

// 3. Types (if TypeScript)
import type { User } from '../types';

// 4. Hooks
import { useAuth } from '../hooks/useAuth';

// 5. Components
import { Button } from '../components/ui';

// 6. Services/Utils
import { formatCurrency } from '../utils/formatters';

// 7. Theme/Constants
import { theme } from '../theme';

// 8. Local styles (if separate file)
import { styles } from './styles';
```

### Import Limits
- **Ideal:** 5-15 imports per file
- **Warning:** 20+ imports (file is likely doing too much)

### Barrel Exports
Use index files to simplify imports:

```javascript
// components/ui/index.js
export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';

// Usage
import { Button, Input, Card } from '../components/ui';
```

---

## State Management Strategy

### Local State (useState)
**Use for:**
- Form inputs
- UI toggles (modals, dropdowns, tabs)
- Component-specific state

```javascript
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
}
```

### Custom Hooks (Extracted Logic)
**Use for:**
- Data fetching with loading/error states
- Reusable business logic
- Complex local state

```javascript
function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser).catch(setError).finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}
```

### Global State (Context/Zustand/Redux)
**Use ONLY for:**
- Authentication status and user data
- Theme/appearance preferences
- Data truly needed across multiple screens
- WebSocket/real-time connections

**Rule:** If only 1-2 screens need it, don't make it global.

```javascript
// contexts/AuthContext.js
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (email, password) => {
    const user = await authService.login(email, password);
    setUser(user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## Error Handling

### Error Boundaries
Every screen should be wrapped in an error boundary:

```javascript
// components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// navigation/RootNavigator.jsx
function Screen() {
  return (
    <ErrorBoundary>
      <YourScreen />
    </ErrorBoundary>
  );
}
```

### Required UI States
Every data-fetching screen must handle:

```javascript
function UserListScreen() {
  const { data, loading, error, retry } = useUsers();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView onRetry={retry} message={error.message} />;
  if (!data?.length) return <EmptyState message="No users found" />;

  return <FlatList data={data} renderItem={...} />;
}
```

**Required states:**
1. ✅ Loading state (skeleton or spinner)
2. ✅ Error state (message + retry button)
3. ✅ Empty state (helpful message with CTA)
4. ✅ Success state (the actual data)

---

## Performance Best Practices

### Lists
- ✅ **Always use `FlatList` or `SectionList`** for lists > 10 items
- ✅ **Use stable `keyExtractor`** (IDs, not indexes)
- ✅ **Use `getItemLayout`** for fixed-size items
- ✅ **Implement pagination** for lists > 50 items
- ❌ **Never use `ScrollView` with `.map()`** for long lists

```javascript
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  renderItem={({ item }) => <ItemComponent item={item} />}
/>
```

### Images
- ✅ Optimize image sizes (don't ship 4MB images for thumbnails)
- ✅ Use WebP format when possible
- ✅ Implement lazy loading for images
- ✅ Configure image caching

### Memoization
**Use when appropriate (don't over-optimize):**
- `React.memo` - For expensive components that re-render often
- `useMemo` - For expensive calculations (not simple operations)
- `useCallback` - For callbacks passed to memoized children

**Don't memoize:**
- Simple primitive calculations
- Every component "just because"
- Props that change on every render

```javascript
// ✅ Good use of memoization
const expensiveCalculation = useMemo(() => {
  return complexCalculation(data);
}, [data]);

// ❌ Bad - over-optimization
const sum = useMemo(() => a + b, [a, b]); // Just do a + b directly
```

---

## Testing Standards

### What to Test

**Priority 1 (Must have):**
- ✅ **Utils/helpers:** All pure functions (aim for 100% coverage)
- ✅ **Custom hooks:** Data fetching, business logic (≥ 80% coverage)
- ✅ **Critical flows:** Auth, payments, checkout (integration tests)

**Priority 2 (Should have):**
- ✅ **Complex components:** Organisms with significant logic
- ✅ **Services:** API clients, storage helpers
- ✅ **Validators/formatters:** Input validation, data transformation

**Priority 3 (Nice to have):**
- ✅ **Simple components:** Atoms and molecules
- ✅ **Screens:** Basic rendering tests

### Test Structure
```javascript
// hooks/__tests__/useAuth.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../useAuth';

describe('useAuth', () => {
  it('should login successfully with valid credentials', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('user@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeDefined();
  });

  it('should handle login failure', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('invalid@example.com', 'wrong');
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeDefined();
  });
});
```

---

## TypeScript Guidelines

### Type Safety
- ✅ **No `any` types** (use `unknown` if truly unknown)
- ✅ **Define interfaces for:**
  - Component props (every component)
  - API responses
  - Service methods
  - Store state
- ✅ **Use type inference** where obvious (don't over-annotate)
- ✅ **Prefer `type` over `interface`** for simple types

### Example Type Structure
```typescript
// types/user.ts
export type User = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
};

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

// components/UserCard.tsx
type UserCardProps = {
  user: User;
  onPress?: () => void;
  showAvatar?: boolean;
};

export function UserCard({
  user,
  onPress,
  showAvatar = true
}: UserCardProps) {
  // Implementation
}
```

---

## Code Quality Checklist

### Before Committing
- [ ] All new code has tests (or justification why not)
- [ ] All tests pass
- [ ] No `console.log` statements (use proper logging)
- [ ] No commented-out code (use git history)
- [ ] No `any` types in TypeScript
- [ ] PropTypes/types defined for components
- [ ] Imports organized and all used
- [ ] No linter warnings

### Before PR
- [ ] All acceptance criteria met
- [ ] Code follows these standards
- [ ] Performance tested (no unnecessary re-renders)
- [ ] Accessibility considered
- [ ] Error handling implemented
- [ ] Loading/error/empty states handled
- [ ] Code reviewed by yourself first

---

## Common Patterns

### Data Fetching Hook Pattern
```javascript
// hooks/useUser.js
export function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getUser(userId);
      setUser(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, error, retry: fetchUser };
}
```

### Form Hook Pattern
```javascript
// hooks/useForm.js
export function useForm(initialValues, onSubmit) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setErrors(err.errors || {});
    } finally {
      setIsSubmitting(false);
    }
  };

  return { values, errors, isSubmitting, handleChange, handleSubmit };
}
```

### Service Pattern
```javascript
// services/userService.js
import { apiClient } from './api/client';

export const userService = {
  async getUser(userId) {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },

  async updateUser(userId, data) {
    const response = await apiClient.put(`/users/${userId}`, data);
    return response.data;
  },

  async deleteUser(userId) {
    await apiClient.delete(`/users/${userId}`);
  },
};
```

---

## Component Splitting Strategies

### When to Split a Component

**Split when ANY of these are true:**
- File > 400 lines
- Function > 50 lines
- Props > 12
- State variables > 12
- Hooks > 8
- JSX nesting > 5 levels deep
- Component has multiple distinct responsibilities

### How to Split

**Strategy 1: Extract Display Components**
```javascript
// Before: 500 lines
function UserProfile() {
  // 100 lines of logic
  // 400 lines of JSX
}

// After: 3 files, each ~150 lines
function UserProfile() {
  const data = useUserProfile();
  return (
    <>
      <UserHeader {...data.header} />
      <UserStats {...data.stats} />
      <UserPosts posts={data.posts} />
    </>
  );
}
```

**Strategy 2: Extract Business Logic to Hooks**
```javascript
// Before: Logic in component
function OrderScreen() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  // ... 100 lines of logic
}

// After: Logic in hook
function OrderScreen() {
  const { order, loading, error } = useOrder(orderId);
  // Clean, focused component
}
```

**Strategy 3: Extract Business Logic to Services**
```javascript
// Before: Calculation in component
function PriceCalculator() {
  const calculatePrice = () => {
    // 50 lines of complex calculation
  };
}

// After: Calculation in service
import { priceService } from '../services/priceService';

function PriceCalculator() {
  const price = priceService.calculatePrice(items);
}
```

---

## Quick Reference Card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE SIZE LIMITS (Lines of Code)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Atoms                   ≤ 150 lines  |  Warning: 150  |  Hard: 200
Molecules               ≤ 250 lines  |  Warning: 250  |  Hard: 350
Organisms               ≤ 350 lines  |  Warning: 350  |  Hard: 500
Screens                 ≤ 400 lines  |  Warning: 400  |  Hard: 500
Hooks                   ≤ 200 lines  |  Warning: 200  |  Hard: 250
Services                ≤ 300 lines  |  Warning: 300  |  Hard: 400
Contexts                ≤ 300 lines  |  Warning: 300  |  Hard: 400
Utils                   ≤ 100 lines  |  Warning: 100  |  Hard: 150

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT COMPLEXITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Props                   Ideal: 3–8   |  Warning: 10   |  Hard: 12
State variables         Ideal: ≤ 8   |  Warning: 10   |  Hard: 12
Hooks per component     Ideal: 2–5   |  Warning: 6    |  Hard: 8
JSX nesting depth       Ideal: ≤ 4   |  Warning: 5    |  Hard: 6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION COMPLEXITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lines                   Ideal: 5–20  |  Warning: 30   |  Hard: 50
Parameters              Ideal: ≤ 3   |  Warning: 5    |  Hard: 5
Cyclomatic complexity   Ideal: ≤ 5   |  Warning: 8    |  Hard: 10
Nesting depth           Ideal: ≤ 2   |  Warning: 3    |  Hard: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PRACTICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Logic → hooks/services (not in components)
✓ UI → components (properly sized and scoped)
✓ Design → theme/ (no magic numbers/colors)
✓ Styles → component-scoped + theme
✓ State → local first, global only when truly needed
✓ Every screen → loading + error + empty states
✓ Every screen → error boundary wrapper
✓ Lists → FlatList/SectionList (never ScrollView + map)
✓ Tests → hooks, utils, and critical flows
✓ No console.log in committed code
✓ No any types in TypeScript
✓ All imports used and organized
```

---

## Summary

This architecture prioritizes:
- **Clarity** over cleverness
- **Simplicity** over premature optimization
- **Consistency** over individual preference
- **Testability** over quick hacks
- **Maintainability** over initial speed

**Remember:** These are aspirational guidelines. Break them when you have good reason, but document why.

For your current state and refactoring plan, see **`REFACTORING_PLAN.md`**.

---

**Last Updated:** 2025-01-14
**Status:** Aspirational Target
**Review Cycle:** Every 6 months
