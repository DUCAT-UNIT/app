/**
 * Theme System
 * Central export for all theme-related constants
 *
 * Usage:
 * import { theme } from '../theme';
 *
 * Then use like:
 * backgroundColor: theme.colors.BLACK
 * padding: theme.spacing.md
 * fontSize: theme.typography.body.fontSize
 */

import { COLORS } from './colors';
import { SPACING, BORDER_RADIUS, SHADOWS } from './spacing';
import { FONTS, FONT_WEIGHTS, TYPOGRAPHY } from './typography';

/**
 * Main theme object
 * This is the recommended import for new components
 */
export const theme = {
  colors: COLORS,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  shadows: SHADOWS,
  fonts: FONTS,
  fontWeights: FONT_WEIGHTS,
  typography: TYPOGRAPHY,
};

/**
 * Individual exports for backwards compatibility
 * Prefer using the main `theme` object above in new code
 */
export { COLORS } from './colors';
export { SPACING, BORDER_RADIUS, SHADOWS } from './spacing';
export { FONTS, FONT_WEIGHTS, TYPOGRAPHY } from './typography';

/**
 * Default export
 */
export default theme;
