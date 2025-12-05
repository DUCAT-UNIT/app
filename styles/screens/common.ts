/**
 * Common/Shared Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';
import { button, modal, sheet, toast } from '../components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH }, statusBar: STATUS_BAR_HEIGHT } = layout;

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
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
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

