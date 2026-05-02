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

/**
 * Individual exports for backwards compatibility
 * Prefer using the main `theme` object above in new code
 */
export { COLORS } from './colors';
export { SPACING, BORDER_RADIUS } from './spacing';
