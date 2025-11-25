/**
 * Screen Styles
 * Backwards-compatible named styles for all screens
 * These compose from utilities and components
 *
 * This file maintains the existing API:
 * import styles from '../styles';
 * style={styles.lockScreen}
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from './theme';
import { button, card, input, modal, sheet, keypad, toast } from './components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH }, statusBar: STATUS_BAR_HEIGHT } = layout;

// =============================================================================
// COMMON / SHARED STYLES
// =============================================================================

export const common = StyleSheet.create({
  // Containers
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: HORIZONTAL_PADDING,
    paddingTop: HORIZONTAL_PADDING,
  },

  // Titles & Text
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 0,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.bold,
    color: COLORS.DARK_GRAY,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.brand.secondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  stepIndicator: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  warning: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.semantic.error,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 18,
  },
  warningText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.semantic.error,
    backgroundColor: colors.special.errorBg,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.semantic.error,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },

  // Intro screens
  introIconContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  introIcon: {
    fontSize: 60,
    color: colors.brand.primary,
  },
  introTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  introText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  // Info boxes
  infoBox: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: COLORS.DARK_GRAY,
    marginBottom: 12,
  },
  infoItem: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    lineHeight: 28,
    textAlign: 'center',
  },
  infoText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Buttons
  button: {
    ...button.primary,
    marginTop: spacing.sm,
    width: '100%',
  },
  buttonText: {
    ...button.text,
  },
  secondaryButton: {
    backgroundColor: COLORS.MEDIUM_GRAY,
    marginTop: spacing.sm,
  },
  resetButton: {
    backgroundColor: colors.semantic.error,
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    ...button.disabled,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 20,
    fontFamily: fonts.regular,
  },
  headerIconImage: {
    width: 24,
    height: 24,
    tintColor: colors.text.primary,
  },

  // Loading
  loadingContainer: {
    height: 44,
    justifyContent: 'center',
  },
  switchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.special.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    borderRadius: radii.lg,
  },
  switchingText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginTop: 12,
  },

  // Modals
  modalOverlay: {
    ...modal.overlay,
  },
  modalContent: {
    ...modal.content,
    overflow: 'hidden',
  },
  modalTitle: {
    ...modal.title,
  },
  modalLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.MEDIUM_GRAY,
    marginRight: spacing.md,
  },
  modalButtonConfirm: {
    backgroundColor: colors.brand.primary,
  },
  modalButtonText: {
    ...button.textSecondary,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Bottom Sheet
  bottomSheetBackdrop: {
    ...sheet.backdrop,
  },
  bottomSheet: {
    ...sheet.container,
  },
  bottomSheetHandle: {
    ...sheet.handle,
  },
  bottomSheetTitle: {
    ...sheet.title,
  },
  bottomSheetBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  bottomSheetBackArrow: {
    fontSize: 24,
    fontFamily: fonts.regular,
    color: colors.brand.primary,
    marginRight: 4,
  },
  bottomSheetBackText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.brand.primary,
  },

  // Copy
  copyHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.brand.primary,
    fontStyle: 'italic',
  },
  copyButton: {
    padding: 4,
  },
  copyIconButton: {
    padding: 4,
  },
  copyIcon: {
    fontSize: 20,
    fontFamily: fonts.regular,
  },

  // Misc
  logoImage: {
    width: 40,
    height: 40,
  },
  dangerOption: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: colors.semantic.error,
  },

  // Toast
  toastContainer: {
    ...toast.container,
  },
  toastContainerError: {
    ...toast.error,
  },
  toastText: {
    ...toast.text,
    color: colors.text.inverse,
  },

  // Confirmation modal
  confirmationModal: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 400,
  },
  confirmationModalIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmationModalTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  confirmationModalText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmationModalButtons: {
    gap: 12,
  },
  confirmationModalButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  confirmationModalButtonPrimary: {
    backgroundColor: colors.brand.primary,
  },
  confirmationModalButtonDestructive: {
    backgroundColor: colors.semantic.error,
  },
  confirmationModalButtonCancel: {
    backgroundColor: COLORS.OFF_WHITE,
  },
  confirmationModalButtonText: {
    ...button.textSecondary,
  },
  confirmationModalButtonTextCancel: {
    ...button.textSecondary,
    color: COLORS.DARK_GRAY,
  },

  // Success Screen
  successCloseButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
    padding: 12,
  },
  successCloseText: {
    fontSize: 28,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    fontWeight: fontWeights.light,
  },
  successCheckmarkContainer: {
    marginBottom: spacing.lg,
    marginTop: 12,
  },
  successCheckmark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheckmarkText: {
    fontSize: 40,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.semantic.success,
  },
  successTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  successTxid: {
    fontSize: fontSizes.xs,
    color: colors.brand.primary,
    fontFamily: fonts.mono,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Toggles
  addressToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleButtonLeft: {
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
  },
  toggleButtonRight: {
    borderTopRightRadius: radii.md,
    borderBottomRightRadius: radii.md,
  },
  toggleButtonActive: {
    backgroundColor: colors.brand.primary,
  },
  toggleText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  toggleTextActive: {
    color: colors.text.primary,
  },

  // Choices
  choicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  choiceButton: {
    width: '48%',
    backgroundColor: colors.bg.secondary,
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  choiceButtonSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  choiceText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  choiceTextSelected: {
    color: colors.text.primary,
    fontWeight: fontWeights.bold,
  },

  // Address type selector
  addressTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  addressTypeButton: {
    width: '48%',
    backgroundColor: colors.bg.secondary,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  addressTypeButtonSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  addressTypeText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  addressTypeTextSelected: {
    color: colors.text.primary,
  },
  addressTypeSubtext: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },

  // Account
  topAddAccountButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountText: {
    fontSize: 20,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  accountInput: {
    backgroundColor: colors.bg.white,
    color: colors.text.inverse,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    marginBottom: spacing.lg,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
  },
});

// =============================================================================
// AUTH STYLES
// =============================================================================

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

// =============================================================================
// WALLET STYLES
// =============================================================================

export const wallet = StyleSheet.create({
  walletContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: 0,
    backgroundColor: colors.bg.primary,
  },
  walletInfo: {
    width: '100%',
    backgroundColor: colors.bg.primary,
    padding: HORIZONTAL_PADDING,
    marginHorizontal: 0,
    borderRadius: radii.lg,
    marginTop: 4,
  },
  walletTitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    flex: 1,
  },

  // Balance
  totalBalanceSection: {
    marginBottom: 32,
  },
  totalBalanceLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  balanceContainer: {
    minHeight: 44,
    justifyContent: 'center',
  },
  totalBalanceAmount: {
    fontSize: 36,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  totalBalanceAmountSmall: {
    fontSize: 28,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
  },
  balanceWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIcon: {
    width: 24,
    height: 24,
    marginRight: 4,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    opacity: 0.3,
  },

  // Assets
  assetsContainer: {
    minHeight: 144,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  assetsScrollContainer: {
    flex: 1,
  },
  assetsScrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 0,
  },
  assetCard: {
    ...card.asset,
    marginBottom: isSmall ? 4 : 10,
  },
  assetCardLast: {
    marginBottom: 0,
  },
  assetCardPlaceholder: {
    opacity: 0,
    height: 72,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  assetAmount: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },
  assetAmountIcon: {
    width: 12,
    height: 12,
    marginRight: 0,
  },
  assetSubtext: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  assetValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  assetValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 16,
    height: 16,
    marginRight: 3,
  },

  // Icons
  btcIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
    overflow: 'hidden',
  },
  ducatIcon: {
    borderRadius: 20,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },

  // Mutinynet banner
  mutinynetBanner: {
    backgroundColor: colors.bg.secondary,
    paddingVertical: 8,
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 0,
    marginTop: STATUS_BAR_HEIGHT + 10,
    marginBottom: HORIZONTAL_PADDING,
    marginLeft: 0,
    marginRight: 0,
    alignItems: 'center',
  },
  mutinynetBannerText: {
    color: colors.brand.secondary,
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
  },

  // Price chips
  priceChipsContainer: {
    flexDirection: 'row',
    marginBottom: 0,
    width: '100%',
  },
  priceChip: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceChipBTC: {
    flex: 2,
    marginRight: 8,
  },
  priceChipUnit: {
    flex: 1,
  },
  priceChipIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  priceChipName: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.text.primary,
    marginRight: 8,
  },
  priceChipValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },

  // Xverse header
  xverseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  xverseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  xverseAccountName: {
    fontSize: 20,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  xverseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // Xverse balance
  xverseBalanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  xverseBalanceLeft: {
    flex: 1,
  },
  xverseBalanceLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  xverseBalanceAmount: {
    fontSize: isSmall ? 36 : 44,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  portfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    gap: 8,
  },
  portfolioIcon: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
  },
  portfolioText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.text.primary,
  },

  // Xverse actions
  xverseActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 20,
    gap: 12,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  xverseActionButton: {
    flex: 1,
    height: 56,
    backgroundColor: colors.text.primary,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xverseActionIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xverseActionIconText: {
    fontSize: 24,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.inverse,
  },
  xverseActionIconImage: {
    width: 20,
    height: 20,
    tintColor: colors.text.inverse,
  },
  xverseActionLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.inverse,
  },

  // Runes
  runesContainer: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.brand.accent,
  },
  runesLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.brand.accent,
    marginBottom: 12,
    textAlign: 'center',
  },
  runeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.primary,
  },
  runeName: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  runeAmount: {
    fontSize: fontSizes.md,
    color: colors.brand.accent,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.mono,
  },

  // Asset options
  assetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: radii.lg,
    marginBottom: 12,
  },
  assetOptionLogo: {
    width: 44,
    height: 44,
    marginRight: spacing.lg,
    borderRadius: 22,
  },
  assetOptionInfo: {
    flex: 1,
  },
  assetOptionTitle: {
    fontSize: 20,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 3,
  },
  assetOptionSubtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  assetOptionArrow: {
    fontSize: 24,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  assetOptionValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  assetOptionDisabled: {
    opacity: 0.4,
  },
  assetOptionTitleDisabled: {
    color: colors.text.secondary,
  },
  assetOptionSubtitleDisabled: {
    color: colors.text.secondary,
  },
  assetOptionValueDisabled: {
    color: colors.text.secondary,
  },
});

// =============================================================================
// SEND STYLES
// =============================================================================

export const send = StyleSheet.create({
  sendButton: {
    backgroundColor: colors.brand.primary,
    marginRight: spacing.lg,
  },

  // Intent modal
  intentModal: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xxl,
    padding: 0,
    width: '90%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  intentContent: {
    padding: 20,
  },
  intentInput: {
    ...input.light,
    marginBottom: 20,
  },

  // Review section
  reviewSection: {
    marginBottom: 20,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  reviewSectionTotal: {
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.primary,
    paddingTop: 12,
  },
  reviewLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  reviewLabelTotal: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 20,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 3,
  },
  reviewValueTotal: {
    fontSize: 24,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
  },
  reviewSubtext: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.text.secondary,
  },
  reviewAddressSmall: {
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    fontFamily: fonts.mono,
    marginTop: 3,
  },
  reviewTitle: {
    fontSize: 20,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 32,
    textAlign: 'center',
  },
  reviewAmountLarge: {
    fontSize: 44,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  reviewAmountSats: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  reviewTotal: {
    fontSize: 20,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
    textAlign: 'center',
    marginBottom: 32,
  },

  // Amount input
  amountInputContainer: {
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: 0,
    width: '100%',
    flex: 1,
    justifyContent: 'space-between',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  amountAssetSymbol: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    minWidth: 100,
  },
  amountInputLarge: {
    fontSize: 56,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    flex: 1,
  },
  amountInputLabel: {
    fontSize: 20,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.secondary,
    marginBottom: 40,
  },
  amountAssetSymbolRight: {
    width: 32,
    height: 32,
    marginLeft: 8,
    marginBottom: 8,
  },
  amountUsdValue: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: 8,
    marginBottom: 40,
  },
  amountContinueButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: 60,
    borderRadius: radii.lg,
    width: '100%',
  },
  amountContinueButtonDisabled: {
    backgroundColor: COLORS.DARK_GRAY,
  },
  amountContinueButtonText: {
    ...button.text,
    fontSize: 20,
  },
  amountBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  amountBalanceLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },

  // Max button
  maxButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.brand.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  maxButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.brand.primary,
  },

  // Balance footer
  sendBalanceFooter: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'column',
    gap: 16,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  sendBalanceFooterRow: {
    flexDirection: 'column',
  },
  sendBalanceFooterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sendBalanceFooterLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  sendBalanceFooterAmount: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },
  sendBalanceFooterUsd: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },

  // Address input
  addressInputTitle: {
    fontSize: 20,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  addressInputTitleLeft: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    marginBottom: 4,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  addressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
    width: '100%',
  },
  addressInput: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    color: colors.text.primary,
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    textAlign: 'left',
  },
  addressError: {
    color: colors.semantic.error,
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    textAlign: 'left',
    marginBottom: 4,
  },
  addressContinueButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 0,
    width: '100%',
  },
  addressContinueButtonDisabled: {
    backgroundColor: COLORS.DARK_GRAY,
    opacity: 0.5,
  },
  addressSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  addressLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  addressContainer: {
    minHeight: 36,
  },
  addressText: {
    fontSize: fontSizes.xs,
    color: colors.text.primary,
    fontFamily: fonts.mono,
    marginBottom: 4,
  },

  // Paste button
  pasteButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteButtonText: {
    ...button.text,
  },

  // Send to header
  sendToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 12,
  },
  sendToLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendToLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },
  sendToAddress: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.text.primary,
  },
  addressTypeTag: {
    backgroundColor: COLORS.DARK_GRAY,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
});

// =============================================================================
// RECEIVE STYLES
// =============================================================================

export const receive = StyleSheet.create({
  receiveButton: {
    backgroundColor: colors.brand.accent,
  },
  receiveAddressRow: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiveAddressInfo: {
    flex: 1,
    marginRight: spacing.lg,
  },
  receiveAddressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  receiveAddressLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  receiveAddress: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  receiveAddressTag: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  receiveAddressTagText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  receiveQrButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  receiveQrIcon: {
    width: 24,
    height: 24,
    tintColor: colors.text.primary,
  },

  // QR Modal
  qrModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.primary,
    zIndex: 99999,
  },
  qrModalNetworkBar: {
    backgroundColor: colors.bg.secondary,
    paddingVertical: isSmall ? 4 : 6,
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 0,
    marginTop: isSmall ? 20 : STATUS_BAR_HEIGHT,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalNetworkText: {
    color: colors.brand.secondary,
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: isSmall ? 8 : 16,
    paddingBottom: isSmall ? 8 : 16,
  },
  qrModalBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  qrModalBackArrow: {
    fontSize: 36,
    color: colors.text.primary,
    fontWeight: fontWeights.light,
  },
  qrModalBackIcon: {
    width: 24,
    height: 24,
    tintColor: colors.text.primary,
  },
  qrModalMenuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  qrModalMenuIcon: {
    fontSize: 24,
    color: colors.text.primary,
  },
  qrModalContent: {
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: SCREEN_WIDTH <= 400 ? 10 : 20,
    paddingBottom: SCREEN_WIDTH <= 400 ? 24 : 32,
    flexGrow: 1,
  },
  qrModalTitle: {
    fontSize: isSmall ? 20 : 28,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: isSmall ? 4 : 8,
    textAlign: 'center',
  },
  qrModalSubtitle: {
    fontSize: isSmall ? 12 : 15,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: SCREEN_WIDTH <= 400 ? 8 : 40,
    textAlign: 'center',
  },
  qrCodeContainer: {
    backgroundColor: colors.bg.white,
    padding: isSmall ? 10 : 20,
    borderRadius: radii.lg,
    marginBottom: isSmall ? 12 : 32,
  },
  qrAddressContainer: {
    width: '100%',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: isSmall ? 12 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isSmall ? 12 : 16,
  },
  qrAddressLeft: {
    flex: 1,
    marginRight: 12,
  },
  qrAddressLabelText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  qrAddressFullText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    lineHeight: 20,
  },
  qrCopyButton: {
    backgroundColor: colors.bg.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  qrCopyButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.bg.primary,
  },
  qrShareButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: isSmall ? 12 : 14,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrShareIcon: {
    fontSize: 20,
    color: colors.text.primary,
  },
  qrShareButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
});

// =============================================================================
// VAULT STYLES
// =============================================================================

export const vault = StyleSheet.create({
  vaultCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingLeft: 1,
    paddingRight: spacing.lg,
    paddingVertical: 12,
    marginBottom: isSmall ? 4 : 10,
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
  },
  vaultContentWrapper: {
    flex: 1,
  },
  vaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  vaultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vaultIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    position: 'relative',
    alignSelf: 'center',
  },
  vaultStatusIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.semantic.success,
    borderWidth: 3,
    borderColor: colors.bg.secondary,
  },
  vaultInfo: {
    flex: 1,
  },
  vaultTitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  vaultHealth: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  vaultAssetName: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    paddingTop: 4,
    marginBottom: 0,
  },
  vaultDetailsContainer: {
    marginLeft: 0,
    marginTop: 6,
    marginBottom: 0,
  },
  vaultDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  vaultValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vaultLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  vaultValue: {
    fontSize: 14,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginLeft: 4,
  },
  vaultValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createVaultButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  createVaultButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.white,
  },
  vaultProgressBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: spacing.lg,
  },
  vaultProgressFill: {
    backgroundColor: colors.semantic.success,
    height: '100%',
  },
  vaultProgressLocked: {
    backgroundColor: colors.semantic.success,
    opacity: 0.3,
    height: '100%',
  },
  vaultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vaultFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vaultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.semantic.success,
  },
  vaultDotLocked: {
    opacity: 0.3,
  },
  vaultFooterValue: {
    fontSize: 14,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginLeft: 4,
  },
  vaultFooterLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  vaultAmountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 4,
    minWidth: 85,
    justifyContent: 'center',
  },
  vaultAmountChipIcon: {
    marginRight: 8,
  },
  vaultAmountChipText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.semibold,
  },
});

// =============================================================================
// SETTINGS STYLES
// =============================================================================

export const settings = StyleSheet.create({
  settingsButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.MEDIUM_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  settingsIcon: {
    fontSize: 20,
    fontFamily: fonts.regular,
  },
  settingsModal: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xxl,
    padding: 0,
    width: '85%',
    maxWidth: 400,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isSmall ? 8 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  settingsTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  closeButton: {
    fontSize: 24,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.light,
    color: colors.text.secondary,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmall ? 8 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  settingsOptionIcon: {
    fontSize: 24,
    fontFamily: fonts.regular,
    marginRight: isSmall ? 8 : 16,
    width: 32,
  },
  settingsOptionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
  },
  settingsOptionArrow: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: COLORS.LIGHT_GRAY,
  },
  settingsToggle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.lg,
    backgroundColor: COLORS.DARK_GRAY,
  },
  settingsToggleOn: {
    color: colors.text.primary,
    backgroundColor: colors.brand.primary,
  },
  settingsDivider: {
    height: 8,
    backgroundColor: COLORS.OFF_WHITE,
  },
});

// =============================================================================
// HISTORY STYLES
// =============================================================================

export const history = StyleSheet.create({
  historySheet: {
    maxHeight: '70%',
    paddingBottom: 20,
  },
  historyHandleArea: {
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  historyScrollView: {
    flex: 1,
    width: '100%',
  },
  historyLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  historyLoadingText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  historyEmptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  historyEmptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },
  historyTxRow: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  historyLogoImage: {
    width: 40,
    height: 40,
  },
  historyTxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTxBottomRow: {
    flexDirection: 'row',
  },
  historyTxColumn1: {
    flex: 1,
  },
  historyTxRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3,
    justifyContent: 'space-between',
  },
  historyTxColumn2: {},
  historyTxColumn3: {
    alignItems: 'flex-end',
  },
  historyTxAmount: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    marginBottom: 4,
  },
  historyTxAmountSent: {
    color: colors.semantic.error,
  },
  historyTxAmountReceived: {
    color: colors.brand.accent,
  },
  historyTxAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  historyTxDate: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  historyTxRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 120,
  },
});

// =============================================================================
// SPLASH STYLES
// =============================================================================

export const splash = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 152,
    height: 152,
    marginBottom: 20,
  },
  splashTitle: {
    fontSize: 36,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: 4,
    letterSpacing: 4,
  },
  splashSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.light,
    color: colors.brand.secondary,
    letterSpacing: 0,
  },
});
