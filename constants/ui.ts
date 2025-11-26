/**
 * UI-related constants
 */

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION = {
  FAST: 150,
  NORMAL: 250,
  SLOW: 500,
  SPRING_CONFIG: {
    friction: 8,
    tension: 40,
  },
} as const;

/**
 * Toast notification durations
 */
export const TOAST = {
  SHORT: 2000, // 2 seconds
  NORMAL: 3000, // 3 seconds
  LONG: 5000, // 5 seconds
} as const;

/**
 * Polling intervals (in milliseconds)
 */
export const POLLING = {
  BALANCE_REFRESH: 10 * 1000, // 10 seconds
  PRICE_REFRESH: 60 * 1000, // 1 minute
  TRANSACTION_STATUS: 5 * 1000, // 5 seconds (when pending)
} as const;

/**
 * Debounce delays (in milliseconds)
 */
export const DEBOUNCE = {
  SEARCH: 300,
  INPUT: 500,
  SCROLL: 150,
} as const;

/**
 * Screen dimensions and spacing
 */
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
} as const;

/**
 * Border radius values
 */
export const RADIUS = {
  SM: 4,
  MD: 8,
  LG: 12,
  XL: 16,
  ROUND: 9999, // Fully rounded
} as const;

/**
 * Z-index layers
 */
export const Z_INDEX = {
  BACKGROUND: -1,
  BASE: 0,
  CARD: 1,
  DROPDOWN: 10,
  OVERLAY: 100,
  MODAL: 1000,
  TOAST: 2000,
  TOOLTIP: 3000,
} as const;

/**
 * Icon sizes
 */
export const ICON_SIZE = {
  XS: 12,
  SM: 16,
  MD: 24,
  LG: 32,
  XL: 48,
} as const;

// Type exports for use in other files
export type AnimationConfig = typeof ANIMATION;
export type ToastConfig = typeof TOAST;
export type PollingConfig = typeof POLLING;
export type DebounceConfig = typeof DEBOUNCE;
export type SpacingConfig = typeof SPACING;
export type RadiusConfig = typeof RADIUS;
export type ZIndexConfig = typeof Z_INDEX;
export type IconSizeConfig = typeof ICON_SIZE;
