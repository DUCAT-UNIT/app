/**
 * Ducat Design System
 * Industry-standard style architecture
 *
 * USAGE:
 *
 * 1. Default import (backwards compatible):
 *    import styles from '../styles';
 *    <View style={styles.lockScreen} />
 *
 * 2. Utilities (atomic styles, like Tailwind):
 *    import { u } from '../styles';
 *    <View style={[u.flex1, u.bgPrimary, u.p4]} />
 *
 * 3. Components (pre-built patterns):
 *    import { c } from '../styles';
 *    <TouchableOpacity style={c.button.primary} />
 *
 * 4. Theme tokens:
 *    import { colors, spacing, fonts } from '../styles';
 *    backgroundColor: colors.brand.primary
 *
 * 5. Feature-specific named exports:
 *    import { commonStyles, authStyles, walletStyles } from '../styles';
 *
 * 6. Type exports:
 *    import type { ButtonStyles, CardStyles } from '../styles';
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  AnyStyle,
  StylePropType,
  NamedStyles,
  ButtonStyles,
  CardStyles,
  InputStyles,
  ModalStyles,
  SheetStyles,
  KeypadStyles,
  IconStyles,
  AvatarStyles,
  ToastStyles,
  ComponentStylesMap,
  LayoutTokens,
  ColorTokens,
  SpacingTokens,
  RadiiTokens,
  FontTokens,
  FontSizeTokens,
  FontWeightTokens,
  ShadowStyle,
  ShadowTokens,
  ZIndexTokens,
  AnimationTokens,
  SizeTokens,
  FlexUtilityStyles,
  SpacingUtilityStyles,
  ScreenStyles,
  StylesOf,
} from './types';

// =============================================================================
// THEME TOKENS
// =============================================================================

export {
  layout,
  colors,
  COLORS,
  spacing,
  radii,
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,
  shadows,
  zIndex,
  animation,
  sizes,
} from './theme';

// =============================================================================
// ATOMIC UTILITIES
// =============================================================================

export { u, default as utilities } from './utilities';

// =============================================================================
// COMPONENT PATTERNS
// =============================================================================

export {
  c,
  button,
  card,
  input,
  modal,
  sheet,
  keypad,
  icon,
  avatar,
  toast,
} from './components';

// =============================================================================
// BACKWARDS COMPATIBLE DEFAULT EXPORT
// =============================================================================

import {
  common,
  auth,
  wallet,
  send,
  receive,
  vault,
  settings,
  history,
  splash,
} from './screens';

// Combine all styles into a single object for backwards compatibility
// This allows: import styles from '../styles'; style={styles.button}
const styles = {
  ...common,
  ...auth,
  ...wallet,
  ...send,
  ...receive,
  ...vault,
  ...settings,
  ...history,
  ...splash,
};

export default styles;
