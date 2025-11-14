/**
 * Typography constants
 * Font sizes, weights, and line heights for consistent text styling
 */

/**
 * Font families
 * Add custom fonts here when available
 */
export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  // Add custom fonts later, e.g.:
  // regular: 'Inter-Regular',
  // medium: 'Inter-Medium',
  // bold: 'Inter-Bold',
};

/**
 * Font weights
 * Use these for consistent font weight throughout the app
 */
export const FONT_WEIGHTS = {
  light: '300',
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

/**
 * Typography variants
 * Pre-configured text styles for common use cases
 */
export const TYPOGRAPHY = {
  // Headings
  h1: {
    fontSize: 32,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 28,
  },
  h5: {
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 24,
  },
  h6: {
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 22,
  },

  // Body text
  body: {
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 24,
  },
  bodyLarge: {
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 28,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 20,
  },

  // Caption/label text
  caption: {
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 16,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 20,
  },

  // Button text
  button: {
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 24,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 20,
  },

  // Special use cases
  code: {
    fontSize: 14,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 20,
    fontFamily: 'Courier', // Monospace font
  },
};
