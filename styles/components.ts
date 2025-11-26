/**
 * Component Style Patterns
 * Pre-built, reusable component styles
 *
 * Usage:
 * import { c } from '../styles';
 * <TouchableOpacity style={c.button.primary} />
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, shadows, layout, sizes } from './theme';

// =============================================================================
// BUTTONS
// =============================================================================

export const button = StyleSheet.create({
  // Base
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Variants
  primary: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: colors.bg.tertiary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accent: {
    backgroundColor: colors.brand.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: {
    backgroundColor: colors.semantic.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.brand.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // States
  disabled: {
    backgroundColor: colors.bg.tertiary,
    opacity: 0.5,
  },

  // Sizes
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  full: {
    width: '100%',
  },

  // Text
  text: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  textSecondary: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  textInverse: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.text.inverse,
    textAlign: 'center',
  },
});

// =============================================================================
// CARDS
// =============================================================================

export const card = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  elevated: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.md,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  selected: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  warning: {
    backgroundColor: colors.special.errorBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  asset: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
    height: sizes.card.height,
    justifyContent: 'center',
  },
});

// =============================================================================
// INPUTS
// =============================================================================

export const input = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.secondary,
    color: colors.text.primary,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
  },
  focused: {
    borderColor: colors.border.focus,
  },
  error: {
    borderColor: colors.semantic.error,
  },
  light: {
    backgroundColor: colors.bg.white,
    color: colors.text.inverse,
    borderColor: colors.brand.primary,
  },
  multiline: {
    textAlignVertical: 'top',
    minHeight: 100,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.semantic.error,
    marginTop: spacing.xs,
  },
});

// =============================================================================
// MODALS & SHEETS
// =============================================================================

export const modal = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.special.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400,
  },
  contentDark: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  buttons: {
    gap: spacing.md,
  },
});

export const sheet = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.special.overlayLight,
    zIndex: 999,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    zIndex: 1000,
    minHeight: '50%',
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.sm,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});

// =============================================================================
// PIN KEYPAD
// =============================================================================

export const keypad = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 352,
    paddingHorizontal: layout.padding,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xl,
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  keyText: {
    fontFamily: fonts.regular,
    fontSize: 32,
    color: colors.text.primary,
    fontWeight: fontWeights.light,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.bg.tertiary,
  },
  dotFilled: {
    backgroundColor: colors.bg.white,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 50,
    gap: spacing.md,
    paddingHorizontal: layout.padding,
  },
});

// =============================================================================
// ICONS
// =============================================================================

export const icon = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    borderRadius: radii.full,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBrand: {
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { width: sizes.icon.sm, height: sizes.icon.sm },
  md: { width: sizes.icon.md, height: sizes.icon.md },
  lg: { width: sizes.icon.lg, height: sizes.icon.lg },
  xl: { width: sizes.icon.xl, height: sizes.icon.xl },
});

// =============================================================================
// AVATARS
// =============================================================================

export const avatar = StyleSheet.create({
  sm: {
    width: sizes.avatar.sm,
    height: sizes.avatar.sm,
    borderRadius: sizes.avatar.sm / 2,
  },
  md: {
    width: sizes.avatar.md,
    height: sizes.avatar.md,
    borderRadius: sizes.avatar.md / 2,
  },
  lg: {
    width: sizes.avatar.lg,
    height: sizes.avatar.lg,
    borderRadius: sizes.avatar.lg / 2,
  },
  xl: {
    width: sizes.avatar.xl,
    height: sizes.avatar.xl,
    borderRadius: sizes.avatar.xl / 2,
  },
});

// =============================================================================
// TOAST
// =============================================================================

export const toast = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.bg.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    zIndex: 99999,
  },
  error: {
    backgroundColor: colors.semantic.error,
  },
  success: {
    backgroundColor: colors.semantic.success,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.inverse,
    textAlign: 'center',
  },
  textLight: {
    color: colors.text.white,
  },
});

// =============================================================================
// COMBINED EXPORT
// =============================================================================

export const c = {
  button,
  card,
  input,
  modal,
  sheet,
  keypad,
  icon,
  avatar,
  toast,
};

export default c;
