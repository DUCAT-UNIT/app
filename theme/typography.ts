/**
 * Typography constants
 * Font sizes, weights, and line heights for consistent text styling
 */

/**
 * Font families - CabinetGrotesk
 */
export const FONTS = {
  regular: 'CabinetGrotesk-Regular',
  medium: 'CabinetGrotesk-Medium',
  bold: 'CabinetGrotesk-Bold',
};

/**
 * Font weights
 */
export const FONT_WEIGHTS = {
  light: '300',
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

/**
 * Typography variants - pre-configured text styles
 */
export const TYPOGRAPHY = {
  // Headings
  h1: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },
  h2: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },
  h3: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },
  h4: {
    fontSize: 20,
    fontFamily: FONTS.medium,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  h5: {
    fontSize: 18,
    fontFamily: FONTS.medium,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  h6: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    fontWeight: FONT_WEIGHTS.semiBold,
  },

  // Body text
  body: {
    fontSize: 16,
    fontFamily: FONTS.regular,
  },
  bodyMedium: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  bodySmall: {
    fontSize: 14,
    fontFamily: FONTS.regular,
  },

  // Caption/label text
  caption: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  captionBold: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },
  label: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },

  // Button text
  button: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },
  buttonMedium: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
};
