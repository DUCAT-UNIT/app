/**
 * Wallet Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';
import { card } from '../components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH }, statusBar: STATUS_BAR_HEIGHT } = layout;

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
    marginRight: spacing.xs, // 4px
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

