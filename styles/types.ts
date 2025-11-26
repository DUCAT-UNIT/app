/**
 * Style Type Definitions
 * Proper TypeScript interfaces for all style-related types
 */

import { ViewStyle, TextStyle, ImageStyle, StyleProp } from 'react-native';

// =============================================================================
// BASE STYLE TYPES
// =============================================================================

/**
 * Union type for all React Native style types
 */
export type AnyStyle = ViewStyle | TextStyle | ImageStyle;

/**
 * Generic style prop type
 */
export type StylePropType<T extends AnyStyle = AnyStyle> = StyleProp<T>;

/**
 * Named styles object (result of StyleSheet.create)
 */
export type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

// =============================================================================
// COMPONENT STYLE INTERFACES
// =============================================================================

/**
 * Button style variants
 */
export interface ButtonStyles {
  base: ViewStyle;
  primary: ViewStyle;
  secondary: ViewStyle;
  accent: ViewStyle;
  danger: ViewStyle;
  ghost: ViewStyle;
  outline: ViewStyle;
  disabled: ViewStyle;
  sm: ViewStyle;
  lg: ViewStyle;
  full: ViewStyle;
  text: TextStyle;
  textSecondary: TextStyle;
  textInverse: TextStyle;
}

/**
 * Card style variants
 */
export interface CardStyles {
  base: ViewStyle;
  elevated: ViewStyle;
  outlined: ViewStyle;
  selected: ViewStyle;
  warning: ViewStyle;
  asset: ViewStyle;
}

/**
 * Input style variants
 */
export interface InputStyles {
  base: ViewStyle & TextStyle;
  focused: ViewStyle;
  error: ViewStyle;
  light: ViewStyle & TextStyle;
  multiline: TextStyle;
  label: TextStyle;
  errorText: TextStyle;
}

/**
 * Modal style variants
 */
export interface ModalStyles {
  overlay: ViewStyle;
  content: ViewStyle;
  contentDark: ViewStyle;
  title: TextStyle;
  text: TextStyle;
  buttons: ViewStyle;
}

/**
 * Bottom sheet style variants
 */
export interface SheetStyles {
  backdrop: ViewStyle;
  container: ViewStyle;
  handle: ViewStyle;
  title: TextStyle;
}

/**
 * Keypad style variants
 */
export interface KeypadStyles {
  container: ViewStyle;
  row: ViewStyle;
  key: ViewStyle;
  keyText: TextStyle;
  dot: ViewStyle;
  dotFilled: ViewStyle;
  dots: ViewStyle;
}

/**
 * Icon style variants
 */
export interface IconStyles {
  container: ViewStyle;
  round: ViewStyle;
  roundBrand: ViewStyle;
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
  xl: ViewStyle;
}

/**
 * Avatar style variants
 */
export interface AvatarStyles {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
  xl: ViewStyle;
}

/**
 * Toast style variants
 */
export interface ToastStyles {
  container: ViewStyle;
  error: ViewStyle;
  success: ViewStyle;
  text: TextStyle;
  textLight: TextStyle;
}

// =============================================================================
// COMBINED COMPONENT STYLES
// =============================================================================

/**
 * All component styles combined
 */
export interface ComponentStylesMap {
  button: ButtonStyles;
  card: CardStyles;
  input: InputStyles;
  modal: ModalStyles;
  sheet: SheetStyles;
  keypad: KeypadStyles;
  icon: IconStyles;
  avatar: AvatarStyles;
  toast: ToastStyles;
}

// =============================================================================
// THEME TOKEN TYPES
// =============================================================================

/**
 * Layout tokens
 */
export interface LayoutTokens {
  screen: { width: number; height: number };
  statusBar: number;
  padding: number;
  isSmall: boolean;
}

/**
 * Color tokens structure
 */
export interface ColorTokens {
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    white: string;
    transparent: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
    white: string;
    black: string;
  };
  brand: {
    primary: string;
    secondary: string;
    accent: string;
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  border: {
    default: string;
    light: string;
    focus: string;
  };
  special: {
    bitcoin: string;
    overlay: string;
    overlayLight: string;
    errorBg: string;
  };
}

/**
 * Spacing tokens
 */
export interface SpacingTokens {
  0: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

/**
 * Border radius tokens
 */
export interface RadiiTokens {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  full: number;
}

/**
 * Font tokens
 */
export interface FontTokens {
  regular: string;
  medium: string;
  bold: string;
  mono: string;
}

/**
 * Font size tokens
 */
export interface FontSizeTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
  display: number;
  giant: number;
  hero: number;
}

/**
 * Font weight tokens
 */
export interface FontWeightTokens {
  light: '300';
  regular: '400';
  medium: '500';
  semibold: '600';
  bold: '700';
}

/**
 * Shadow token structure
 */
export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/**
 * Shadow tokens
 */
export interface ShadowTokens {
  none: ShadowStyle;
  sm: ShadowStyle;
  md: ShadowStyle;
  lg: ShadowStyle;
  xl: ShadowStyle;
}

/**
 * Z-index tokens
 */
export interface ZIndexTokens {
  base: number;
  dropdown: number;
  sticky: number;
  modal: number;
  toast: number;
  max: number;
}

/**
 * Animation tokens
 */
export interface AnimationTokens {
  fast: number;
  normal: number;
  slow: number;
}

/**
 * Component size tokens
 */
export interface SizeTokens {
  buttonHeight: {
    sm: number;
    md: number;
    lg: number;
  };
  icon: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  avatar: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  input: {
    height: number;
    heightLarge: number;
  };
  card: {
    height: number;
    heightLarge: number;
  };
}

// =============================================================================
// UTILITY STYLE TYPES
// =============================================================================

/**
 * Flex utility styles
 */
export interface FlexUtilityStyles {
  flex1: ViewStyle;
  flexGrow: ViewStyle;
  flexShrink: ViewStyle;
  flexNone: ViewStyle;
  row: ViewStyle;
  col: ViewStyle;
  rowReverse: ViewStyle;
  colReverse: ViewStyle;
  wrap: ViewStyle;
  nowrap: ViewStyle;
  justifyStart: ViewStyle;
  justifyEnd: ViewStyle;
  justifyCenter: ViewStyle;
  justifyBetween: ViewStyle;
  justifyAround: ViewStyle;
  justifyEvenly: ViewStyle;
  itemsStart: ViewStyle;
  itemsEnd: ViewStyle;
  itemsCenter: ViewStyle;
  itemsStretch: ViewStyle;
  selfStart: ViewStyle;
  selfEnd: ViewStyle;
  selfCenter: ViewStyle;
  selfStretch: ViewStyle;
  center: ViewStyle;
  rowCenter: ViewStyle;
  rowBetween: ViewStyle;
  rowEnd: ViewStyle;
  colCenter: ViewStyle;
}

/**
 * Spacing utility styles
 */
export interface SpacingUtilityStyles {
  p0: ViewStyle;
  p1: ViewStyle;
  p2: ViewStyle;
  p3: ViewStyle;
  p4: ViewStyle;
  p5: ViewStyle;
  p6: ViewStyle;
  px0: ViewStyle;
  px1: ViewStyle;
  px2: ViewStyle;
  px3: ViewStyle;
  px4: ViewStyle;
  px5: ViewStyle;
  py0: ViewStyle;
  py1: ViewStyle;
  py2: ViewStyle;
  py3: ViewStyle;
  py4: ViewStyle;
  py5: ViewStyle;
  m0: ViewStyle;
  m1: ViewStyle;
  m2: ViewStyle;
  m3: ViewStyle;
  m4: ViewStyle;
  m5: ViewStyle;
  mx0: ViewStyle;
  mx1: ViewStyle;
  mx2: ViewStyle;
  mx3: ViewStyle;
  mx4: ViewStyle;
  mxAuto: ViewStyle;
  my0: ViewStyle;
  my1: ViewStyle;
  my2: ViewStyle;
  my3: ViewStyle;
  my4: ViewStyle;
  gap1: ViewStyle;
  gap2: ViewStyle;
  gap3: ViewStyle;
  gap4: ViewStyle;
}

// =============================================================================
// SCREEN STYLE TYPES
// =============================================================================

/**
 * Generic screen styles record
 */
export type ScreenStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Type helper for creating strongly-typed style objects
 */
export type StylesOf<T extends Record<string, ViewStyle | TextStyle | ImageStyle>> = {
  [K in keyof T]: T[K];
};
