# Performance & UI Optimization Plan

**Created:** 2025-11-18
**Status:** Active Implementation Plan
**Goal:** Make the app 2-3x snappier with premium UI polish

---

## 🎯 Executive Summary

This plan improves app performance and UX through:
1. **Perceived performance** (skeleton loaders, animations)
2. **Actual performance** (FlatList optimization, memoization)
3. **Premium polish** (micro-interactions, shadows, haptics)
4. **Architecture compliance** (all changes follow ARCHITECTURE_STANDARDS.md)

**Expected Impact:**
- 2x faster perceived load times
- 60% smoother scrolling
- Premium native app feel
- Zero architecture violations

---

## 📋 Architecture Compliance Checklist

All implementations must follow these principles:

### File Size Limits
- ✅ Components (atoms): ≤ 150 lines
- ✅ Components (molecules): ≤ 250 lines
- ✅ Components (organisms): ≤ 350 lines
- ✅ Screens: ≤ 400 lines (hard: 500)
- ✅ Custom hooks: ≤ 200 lines
- ✅ Services: ≤ 300 lines
- ✅ Utilities: ≤ 100 lines

### Complexity Limits
- ✅ Props per component: ≤ 12 (ideal: 3-8)
- ✅ State variables: ≤ 12 (ideal: ≤ 8)
- ✅ Hooks per component: ≤ 8 (ideal: 2-5)
- ✅ JSX nesting: ≤ 6 levels (ideal: ≤ 4)
- ✅ Function parameters: ≤ 5 (ideal: ≤ 3)
- ✅ Function size: ≤ 50 lines (ideal: 5-20)

### Organization
- ✅ Extract logic to custom hooks (not inline)
- ✅ Compose with small components (not monoliths)
- ✅ Pure functions in utils/ (no side effects)
- ✅ Business logic in services/ (not components)

---

## 📅 Implementation Timeline

### Phase 1: Quick Wins (Week 1)
**Goal:** Immediate user-facing improvements
**Time:** 6 hours
**Impact:** 2x perceived speed

#### Day 1-2: Skeleton Loaders (2 hours)
- [ ] Create `components/ui/SkeletonLoader.jsx` (< 100 lines)
- [ ] Create `components/ui/SkeletonCard.jsx` (< 100 lines)
- [ ] Add to WalletScreen while loading
- [ ] Add to AssetDetailScreen while loading
- [ ] Add to TransactionHistoryScreen while loading

**Files Created:**
```
components/
  ui/
    SkeletonLoader.jsx      # 80 lines (atom component)
    SkeletonCard.jsx        # 90 lines (molecule component)
```

**Success Metrics:**
- Users see content structure immediately
- No more blank white screens
- Feels 2x faster to load

---

#### Day 3: FlatList Optimization (1 hour)
- [ ] Update `screens/wallet/TransactionHistoryScreen.jsx`
  - Add `removeClippedSubviews={true}`
  - Add `maxToRenderPerBatch={10}`
  - Add `windowSize={5}`
  - Add `initialNumToRender={10}`
- [ ] Update `components/assetDetail/AssetActivityList.jsx`
  - Same optimizations
- [ ] Add `getItemLayout` if item heights are consistent

**Files Modified:**
```
screens/wallet/TransactionHistoryScreen.jsx  # +5 lines
components/assetDetail/AssetActivityList.jsx # +5 lines
```

**Success Metrics:**
- 60fps scrolling on 100+ transactions
- Smooth on low-end devices

---

#### Day 4: Pull-to-Refresh (1 hour)
- [ ] Create `hooks/useRefreshControl.js` (< 100 lines)
- [ ] Add to WalletScreen
- [ ] Add haptic feedback on pull
- [ ] Add success haptic on complete

**Files Created:**
```
hooks/useRefreshControl.js  # 75 lines (custom hook)
```

**Files Modified:**
```
screens/wallet/WalletScreen.jsx  # +10 lines
```

**Success Metrics:**
- Natural pull gesture works
- Haptic feedback on pull & complete
- Loading indicator shows

---

#### Day 5: Button Micro-interactions (2 hours)
- [ ] Create `components/ui/PressableButton.jsx` (< 150 lines)
- [ ] Create `components/ui/ScaleButton.jsx` (< 100 lines)
- [ ] Replace TouchableOpacity in high-traffic areas
  - Send button
  - Receive button
  - Asset cards
  - Action buttons

**Files Created:**
```
components/
  ui/
    PressableButton.jsx     # 120 lines (atom component)
    ScaleButton.jsx         # 85 lines (atom component)
```

**Success Metrics:**
- Every tap feels responsive
- Scale animation on press (0.95x)
- Haptic feedback on important actions

---

### Phase 2: Visual Polish (Week 2)
**Goal:** Premium UI feel
**Time:** 7 hours
**Impact:** Professional polish

#### Day 1-2: Fade-in Transitions (2 hours)
- [ ] Create `components/ui/FadeInView.jsx` (< 100 lines)
- [ ] Create `hooks/useStaggeredAnimation.js` (< 150 lines)
- [ ] Add to wallet cards (staggered)
- [ ] Add to transaction items
- [ ] Add to settings screens

**Files Created:**
```
components/ui/FadeInView.jsx         # 80 lines (atom)
hooks/useStaggeredAnimation.js       # 120 lines (hook)
```

**Success Metrics:**
- Smooth entrance animations
- Staggered reveals feel premium
- 300ms duration, 100ms stagger

---

#### Day 3: Enhanced Theme (1 hour)
- [ ] Update `theme/colors.js`
  - Improve contrast ratios
  - Add semantic color names
  - Add gradient definitions
- [ ] Update `theme/spacing.js`
  - Add shadow presets (small, medium, large)
  - Add elevation system

**Files Modified:**
```
theme/colors.js    # +15 lines (new colors)
theme/spacing.js   # +25 lines (shadows)
```

**Success Metrics:**
- WCAG AAA contrast compliance
- Consistent shadow system
- Better dark mode aesthetics

---

#### Day 4: Card Shadows & Depth (1 hour)
- [ ] Update `components/wallet/AssetCard.jsx`
  - Add subtle shadow
  - Add border highlight
- [ ] Update `components/wallet/VaultCard.jsx`
  - Add depth with shadow
- [ ] Update modal backgrounds
  - Add elevation shadow

**Files Modified:**
```
components/wallet/AssetCard.jsx   # +8 lines
components/wallet/VaultCard.jsx   # +8 lines
styles/wallet.js                  # +15 lines
```

**Success Metrics:**
- Cards have subtle depth
- Visual hierarchy clear
- Modern iOS/Android feel

---

#### Day 5: Loading State Components (3 hours)
- [ ] Create `components/ui/LoadingSpinner.jsx` (< 100 lines)
- [ ] Create `components/ui/EmptyState.jsx` (< 150 lines)
- [ ] Create `components/ui/ErrorState.jsx` (< 150 lines)
- [ ] Replace all ActivityIndicator instances
- [ ] Add illustrations to empty states

**Files Created:**
```
components/ui/
  LoadingSpinner.jsx  # 85 lines (atom)
  EmptyState.jsx      # 130 lines (molecule)
  ErrorState.jsx      # 140 lines (molecule)
```

**Success Metrics:**
- Consistent loading states
- Friendly empty states with CTAs
- Actionable error messages

---

### Phase 3: Advanced Optimizations (Week 3)
**Goal:** Performance at scale
**Time:** 13 hours
**Impact:** Future-proof performance

#### Day 1-2: React Native New Architecture (4 hours)
- [ ] Install expo-build-properties
- [ ] Enable new architecture in app.json
- [ ] Test on iOS
- [ ] Test on Android
- [ ] Fix any breaking changes

**Files Modified:**
```
app.json           # +10 lines
package.json       # +1 dependency
```

**Success Metrics:**
- 30-50% faster renders
- Smoother animations (120fps capable)
- No regressions

---

#### Day 3: Memoization Audit (3 hours)
- [ ] Audit all list components for React.memo
- [ ] Add useMemo to expensive calculations
- [ ] Add useCallback to event handlers
- [ ] Create `utils/memoization.js` helpers

**Files Created:**
```
utils/memoization.js  # 90 lines (pure functions)
```

**Files Modified:**
```
components/transaction/TransactionItem.jsx  # Wrap with React.memo
components/wallet/AssetCard.jsx             # Wrap with React.memo
hooks/useFormattedBalances.js               # Add useMemo
hooks/useWalletCalculations.js              # Add useMemo
```

**Success Metrics:**
- 40% fewer re-renders
- Faster list scrolling
- Lower CPU usage

---

#### Day 4-5: Advanced Animations (4 hours)
- [ ] Install react-native-reanimated
- [ ] Create `components/ui/AnimatedButton.jsx` (< 150 lines)
- [ ] Create `hooks/useSpringAnimation.js` (< 150 lines)
- [ ] Replace critical Animated.* with Reanimated
- [ ] Add spring physics to interactions

**Files Created:**
```
components/ui/AnimatedButton.jsx    # 130 lines (molecule)
hooks/useSpringAnimation.js         # 140 lines (hook)
```

**Success Metrics:**
- 60fps guaranteed on animations
- Spring physics feel natural
- Butter-smooth interactions

---

#### Day 6: Code Splitting (2 hours)
- [ ] Lazy load AssetDetailScreen
- [ ] Lazy load SettingsScreens
- [ ] Add loading fallbacks
- [ ] Test bundle size reduction

**Files Modified:**
```
navigation/RootNavigator.js  # +15 lines (React.lazy)
```

**Success Metrics:**
- 15% smaller initial bundle
- Faster app startup
- On-demand feature loading

---

## 🔧 Implementation Guidelines

### Creating New Components

**Template for Atom Component:**
```javascript
/**
 * ComponentName
 * Brief description of purpose
 *
 * Architecture: Atom component (< 150 lines)
 * Props: ≤ 8
 * State: 0-2
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../theme';

const ComponentName = ({ prop1, prop2, style }) => {
  // No business logic
  // No side effects
  // Pure presentation

  return (
    <View style={[styles.container, style]}>
      {/* JSX */}
    </View>
  );
};

ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
  style: PropTypes.object,
};

ComponentName.defaultProps = {
  prop2: 0,
};

const styles = StyleSheet.create({
  container: {
    // Styles
  },
});

export default React.memo(ComponentName);
```

**Template for Custom Hook:**
```javascript
/**
 * useHookName
 * Brief description of purpose
 *
 * Architecture: Custom hook (< 200 lines)
 * Returns: ≤ 8 values
 * Complexity: Single responsibility
 */

import { useState, useCallback, useMemo } from 'react';

export const useHookName = (param1, param2) => {
  // State (≤ 8 variables)
  const [state, setState] = useState(null);

  // Memoized values
  const computed = useMemo(() => {
    // Expensive calculation
    return result;
  }, [dependencies]);

  // Callbacks
  const handleAction = useCallback(() => {
    // Logic
  }, [dependencies]);

  // Return ≤ 8 values
  return {
    state,
    computed,
    handleAction,
  };
};
```

---

## 📏 Quality Gates

Before merging any optimization:

### Code Quality
- [ ] All files under size limits
- [ ] No more than 12 props per component
- [ ] No more than 8 hooks per component
- [ ] JSX nesting ≤ 6 levels
- [ ] Functions ≤ 50 lines

### Performance
- [ ] No new console warnings
- [ ] FlatList renders at 60fps
- [ ] Animations use useNativeDriver
- [ ] No memory leaks (test with Flipper)

### Testing
- [ ] All existing tests pass
- [ ] New components have basic tests
- [ ] No accessibility regressions

### Documentation
- [ ] JSDoc comments on public APIs
- [ ] PropTypes defined
- [ ] README updated if needed

---

## 📊 Success Metrics

### Quantitative
- [ ] App startup: < 2 seconds (currently ~3s)
- [ ] Screen transitions: < 300ms
- [ ] List scrolling: 60fps sustained
- [ ] Bundle size: < 15MB (currently ~17MB)

### Qualitative
- [ ] "Feels instant" - skeleton loaders work
- [ ] "Feels smooth" - 60fps animations
- [ ] "Feels premium" - haptics & micro-interactions
- [ ] "Looks professional" - consistent shadows & depth

---

## 🚨 Risk Mitigation

### Breaking Changes
- Test each phase on device before merging
- Keep feature flags for new architecture
- Rollback plan: git revert

### Performance Regressions
- Measure before/after with Flipper
- Profile with React DevTools
- Monitor bundle size

### Architecture Violations
- Run linter before each commit
- Code review checklist
- Automated file size checks

---

## 📝 Progress Tracking

### Phase 1: Quick Wins (Week 1)
- [ ] Day 1-2: Skeleton Loaders
- [ ] Day 3: FlatList Optimization
- [ ] Day 4: Pull-to-Refresh
- [ ] Day 5: Button Micro-interactions

### Phase 2: Visual Polish (Week 2)
- [ ] Day 1-2: Fade-in Transitions
- [ ] Day 3: Enhanced Theme
- [ ] Day 4: Card Shadows & Depth
- [ ] Day 5: Loading State Components

### Phase 3: Advanced Optimizations (Week 3)
- [ ] Day 1-2: React Native New Architecture
- [ ] Day 3: Memoization Audit
- [ ] Day 4-5: Advanced Animations
- [ ] Day 6: Code Splitting

---

## 🎓 Learning Resources

### Performance
- [React Native Performance](https://reactnative.dev/docs/performance)
- [Flipper Performance Plugin](https://fbflipper.com/docs/features/react-native/)

### Animations
- [Reanimated Docs](https://docs.swmansion.com/react-native-reanimated/)
- [React Native Animations Guide](https://reactnative.dev/docs/animations)

### Architecture
- See `ARCHITECTURE_STANDARDS.md` in this repo
- [React Patterns](https://reactpatterns.com/)

---

## ✅ Definition of Done

An optimization is complete when:
1. Code is merged to main branch
2. All tests pass
3. Performance metrics improved
4. No architecture violations
5. Documented in this file
6. Tested on physical device (iOS + Android)

---

## 📞 Support

Questions about this plan?
- Check `ARCHITECTURE_STANDARDS.md` first
- Review existing patterns in codebase
- Ask in team chat before implementing

---

**Last Updated:** 2025-11-18
**Next Review:** After Phase 1 completion
