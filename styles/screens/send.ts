/**
 * Send Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';
import { button, input } from '../components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH } } = layout;

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

