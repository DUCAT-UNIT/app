/**
 * Design System Theme
 * Single source of truth for all design tokens
 *
 * Industry Standard: All magic numbers live here
 */

import { Platform, StatusBar, Dimensions } from 'react-native';

// =============================================================================
// LAYOUT TOKENS
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;
const isSmallDevice = SCREEN_WIDTH <= 375;

export const layout = {
  screen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  statusBar: STATUS_BAR_HEIGHT,
  padding: HORIZONTAL_PADDING,
  isSmall: isSmallDevice,
};

// =============================================================================
// COLOR TOKENS
// =============================================================================

export const colors = {
  // Background
  bg: {
    primary: '#111015',
    secondary: '#1D1C21',
    tertiary: '#28272C',
    white: '#FFFFFF',
    transparent: 'transparent',
  },

  // Text
  text: {
    primary: '#DDDDDD',
    secondary: '#8E8D90',
    tertiary: '#666666',
    inverse: '#111015',
    white: '#FFFFFF',
    black: '#000000',
  },

  // Brand
  brand: {
    primary: '#1858E4',    // Blue
    secondary: '#8B5CF6',  // Purple
    accent: '#59AA8A',     // Teal
  },

  // Semantic
  semantic: {
    success: '#59AA8A',
    warning: '#F5A623',
    error: '#D04C68',
    info: '#1858E4',
  },

  // Border
  border: {
    default: '#28272C',
    light: '#333333',
    focus: '#1858E4',
  },

  // Special
  special: {
    bitcoin: '#FFB800',
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
    errorBg: '#FFF5F7',
  },
};

// Legacy color names for backwards compatibility
export const COLORS = {
  BLACK: '#000000',
  DARK_BG: colors.bg.primary,
  VERY_DARK_GRAY: colors.bg.secondary,
  CARD_BG: colors.bg.secondary,
  DARK_CARD_BG: colors.bg.secondary,
  DARK_GRAY: '#333333',
  MID_DARK_GRAY: '#444444',
  MEDIUM_GRAY: '#666666',
  SECONDARY_TEXT: colors.text.secondary,
  BORDER_COLOR: colors.border.default,
  LIGHT_MEDIUM_GRAY: '#888888',
  LIGHT_GRAY: '#CCCCCC',
  VERY_LIGHT_GRAY: colors.text.primary,
  OFF_WHITE_GRAY: '#EEEEEE',
  OFF_WHITE: '#F5F5F5',
  PINK_WHITE: colors.special.errorBg,
  WHITE: '#FFFFFF',
  PURPLE: colors.brand.secondary,
  PRIMARY_BLUE: colors.brand.primary,
  BLUE: colors.brand.primary,
  TEAL: colors.brand.accent,
  LIGHT_GREEN: colors.semantic.success,
  GREEN: colors.semantic.success,
  SUCCESS_GREEN: colors.semantic.success,
  YELLOW: '#F5E4A2',
  WARNING_ORANGE: colors.semantic.warning,
  BITCOIN_ORANGE: colors.special.bitcoin,
  DANGER_RED: colors.semantic.error,
  BRIGHT_RED: colors.semantic.error,
  RED: colors.semantic.error,
  ERROR_BG: 'rgba(208, 76, 104, 0.1)',
  OVERLAY_START: 'rgba(20, 20, 20, 0.8)',
  OVERLAY_END: 'rgba(20, 20, 20, 1)',
};

// =============================================================================
// SPACING TOKENS
// =============================================================================

export const spacing = {
  0: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// =============================================================================
// BORDER RADIUS TOKENS
// =============================================================================

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

export const fonts = {
  regular: 'CabinetGrotesk-Regular',
  medium: 'CabinetGrotesk-Medium',
  bold: 'CabinetGrotesk-Bold',
  mono: Platform.OS === 'ios' ? 'Courier' : 'monospace',
};

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 32,
  display: 36,
  giant: 44,
  hero: 56,
};

export const fontWeights = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const lineHeights = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
};

// =============================================================================
// SHADOW TOKENS
// =============================================================================

export const shadows = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
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
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
};

// =============================================================================
// Z-INDEX TOKENS
// =============================================================================

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 1000,
  toast: 9999,
  max: 99999,
};

// =============================================================================
// ANIMATION TOKENS
// =============================================================================

export const animation = {
  fast: 150,
  normal: 300,
  slow: 500,
};

// =============================================================================
// COMPONENT SIZE TOKENS
// =============================================================================

export const sizes = {
  // Buttons
  buttonHeight: {
    sm: 36,
    md: 48,
    lg: 56,
  },

  // Icons
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
  },

  // Avatars
  avatar: {
    sm: 32,
    md: 40,
    lg: 54,
    xl: 72,
  },

  // Form inputs
  input: {
    height: 48,
    heightLarge: 56,
  },

  // Cards
  card: {
    height: 80,
    heightLarge: 100,
  },
};
