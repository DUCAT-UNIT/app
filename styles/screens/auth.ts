/**
 * Authentication Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';
import { button, keypad, input } from '../components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH }, statusBar: STATUS_BAR_HEIGHT } = layout;

export const auth = StyleSheet.create({
  // Welcome
  welcomeContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 0,
    paddingBottom: HORIZONTAL_PADDING,
    backgroundColor: colors.bg.primary,
  },
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  welcomeButtons: {
    width: '100%',
    paddingBottom: HORIZONTAL_PADDING + 20,
  },
  welcomeLogo: {
    width: 120,
    height: 120,
  },
  welcomeTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  welcomeTagline: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    color: colors.text.primary,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  passkeyButton: {
    backgroundColor: colors.brand.secondary,
    marginTop: 8,
  },

  // Seed phrase
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: isSmall ? 6 : 8,
  },
  seedBox: {
    width: '48%',
    backgroundColor: colors.bg.secondary,
    padding: isSmall ? 12 : 16,
    borderRadius: radii.md,
    marginBottom: isSmall ? 8 : 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedNumber: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
    marginRight: 8,
    minWidth: 20,
  },
  seedWord: {
    fontSize: isSmall ? 14 : 16,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  verifyBox: {
    marginBottom: 8,
  },
  verifyLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
    marginBottom: 4,
  },
  seedInput: {
    ...input.base,
    borderColor: colors.brand.primary,
    marginBottom: spacing.lg,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  seedWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginBottom: spacing.lg,
    width: '100%',
  },
  seedWordContainer: {
    width: '47%',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedWordNumber: {
    color: colors.text.primary,
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    width: 20,
    textAlign: 'right',
    marginRight: 8,
  },
  seedWordInput: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    color: colors.text.primary,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
  },
  seedPhraseTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  seedPhraseWarning: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.semantic.error,
    backgroundColor: colors.special.errorBg,
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Lock screen
  lockScreen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  lockTitle: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.text.primary,
    marginBottom: 32,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  lockPinError: {
    color: colors.semantic.error,
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  lockPinDots: {
    ...keypad.dots,
  },
  lockPinDot: {
    ...keypad.dot,
  },
  lockPinDotFilled: {
    ...keypad.dotFilled,
  },
  lockKeypad: {
    ...keypad.container,
    marginBottom: 40,
  },
  lockKeypadRow: {
    ...keypad.row,
    gap: 32,
  },
  lockKey: {
    ...keypad.key,
  },
  lockKeyText: {
    ...keypad.keyText,
  },
  lockKeyIcon: {
    width: 24,
    height: 24,
    tintColor: colors.text.white,
  },
  lockKeyCancelText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    fontWeight: fontWeights.light,
  },
  lockKeyDelete: {
    fontSize: 28,
    fontFamily: fonts.regular,
    color: colors.text.primary,
    fontWeight: fontWeights.light,
  },
  lockCancelButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    padding: 12,
    zIndex: 10,
  },
  lockCancelButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  lockIconArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  lockPasswordIcon: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockPasswordText: {
    fontSize: 32,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    letterSpacing: 8,
    marginBottom: 8,
  },
  lockPadlock: {
    fontSize: 40,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    position: 'absolute',
    right: -25,
    top: -5,
  },
  faceIdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 20,
    marginHorizontal: HORIZONTAL_PADDING,
  },
  faceIdText: {
    fontSize: 20,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.medium,
    color: colors.brand.primary,
    marginRight: 8,
  },
  faceIdArrow: {
    fontSize: 20,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
  },

  // PIN setup
  pinButton: {
    backgroundColor: COLORS.MEDIUM_GRAY,
    marginTop: spacing.lg,
  },
  pinContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  pinTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  pinSubtext: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  pinError: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.semantic.error,
    marginBottom: 20,
    textAlign: 'center',
  },
  pinDotsContainer: {
    flexDirection: 'row',
    marginBottom: 50,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border.default,
    marginHorizontal: 8,
  },
  pinDotFilled: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  pinKeypad: {
    width: '100%',
    maxWidth: 300,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pinKey: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinKeyText: {
    fontSize: 28,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  pinCancelButton: {
    marginTop: 20,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pinCancelText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Locked state
  lockedContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: HORIZONTAL_PADDING,
    paddingTop: HORIZONTAL_PADDING,
  },
  lockIconContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 40,
  },
  lockIcon: {
    fontSize: 80,
    fontFamily: fonts.regular,
    marginBottom: 20,
  },
  lockedText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  lockedSubtext: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  unlockButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 32,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
  },
  unlockButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },

  // Biometric prompt
  biometricPromptModal: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xxl,
    padding: 32,
    width: '85%',
    maxWidth: 400,
  },
  biometricPromptTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  biometricPromptText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 24,
  },
  biometricPromptButtons: {
    gap: 12,
  },
  biometricPromptButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  biometricPromptButtonYes: {
    backgroundColor: colors.brand.primary,
  },
  biometricPromptButtonNo: {
    backgroundColor: COLORS.OFF_WHITE,
  },
  biometricPromptButtonText: {
    ...button.textSecondary,
  },
  biometricPromptButtonTextNo: {
    ...button.textSecondary,
    color: COLORS.DARK_GRAY,
  },
});

