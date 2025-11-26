/**
 * Color constants
 */

export const COLORS = {
  // Blacks and very dark colors
  BLACK: '#000000',
  DARK_BG: '#111015',
  VERY_DARK_GRAY: '#1D1C21',
  CARD_BG: '#1D1C21',
  DARK_CARD_BG: '#1D1C21',

  // Grays
  DARK_GRAY: '#333333',
  MID_DARK_GRAY: '#444444',
  MID_GRAY: '#888888',
  MEDIUM_GRAY: '#666666',
  SECONDARY_TEXT: '#8E8D90',
  BORDER_COLOR: '#28272C',
  LIGHT_MEDIUM_GRAY: '#888888',
  LIGHT_GRAY: '#CCCCCC',
  VERY_LIGHT_GRAY: '#DDDDDD',
  OFF_WHITE_GRAY: '#EEEEEE',

  // Whites
  OFF_WHITE: '#F5F5F5',
  PINK_WHITE: '#FFF5F7',
  WHITE: '#FFFFFF',

  // Brand colors
  PURPLE: '#8B5CF6',
  BRAND_PURPLE: '#8B5CF6',
  PRIMARY_BLUE: '#1858E4',
  BLUE: '#1858E4',

  // Success/info colors
  TEAL: '#59AA8A',
  LIGHT_GREEN: '#59AA8A',
  GREEN: '#59AA8A',
  SUCCESS_GREEN: '#59AA8A',

  // Warning/accent colors
  YELLOW: '#F5E4A2',
  WARNING_ORANGE: '#F5A623',
  BITCOIN_ORANGE: '#FFB800',

  // Error/danger colors
  DANGER_RED: '#D04C68',
  BRIGHT_RED: '#D04C68',
  RED: '#D04C68',
  ERROR_BG: 'rgba(208, 76, 104, 0.1)',

  // Overlay colors
  OVERLAY_START: 'rgba(20, 20, 20, 0.8)',
  OVERLAY_END: 'rgba(20, 20, 20, 1)',

  // Text colors (semantic aliases)
  TEXT_PRIMARY: '#DDDDDD',
  TEXT_SECONDARY: '#8E8D90',
  TEXT_TERTIARY: '#666666',
  TEXT_INVERSE: '#111015',
  TEXT_WHITE: '#FFFFFF',
  TEXT_BLACK: '#000000',

  // Background colors (semantic aliases)
  BG_PRIMARY: '#111015',
  BG_SECONDARY: '#1D1C21',
  BG_TERTIARY: '#28272C',
  BG_WHITE: '#FFFFFF',
  DARK_BACKGROUND: '#111015',

  // Semantic status colors
  INFO: '#1858E4',
  SUCCESS: '#59AA8A',
  WARNING: '#F5A623',
  ERROR: '#D04C68',

  // Transparent
  TRANSPARENT: 'transparent',
} as const;

// Type for color keys
export type ColorKey = keyof typeof COLORS;
