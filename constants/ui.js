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
};

/**
 * Toast notification durations
 */
export const TOAST = {
  SHORT: 2000, // 2 seconds
  NORMAL: 3000, // 3 seconds
  LONG: 5000, // 5 seconds
};

/**
 * Polling intervals (in milliseconds)
 */
export const POLLING = {
  BALANCE_REFRESH: 10 * 1000, // 10 seconds
  PRICE_REFRESH: 60 * 1000, // 1 minute
  TRANSACTION_STATUS: 5 * 1000, // 5 seconds (when pending)
};

/**
 * Debounce delays (in milliseconds)
 */
export const DEBOUNCE = {
  SEARCH: 300,
  INPUT: 500,
  SCROLL: 150,
};

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
};

/**
 * Border radius values
 */
export const RADIUS = {
  SM: 4,
  MD: 8,
  LG: 12,
  XL: 16,
  ROUND: 9999, // Fully rounded
};

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
};

/**
 * Icon sizes
 */
export const ICON_SIZE = {
  XS: 12,
  SM: 16,
  MD: 24,
  LG: 32,
  XL: 48,
};
