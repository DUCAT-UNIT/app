import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import { STATUS_BAR_HEIGHT, HORIZONTAL_PADDING, SCREEN_WIDTH } from './constants';

export const walletStyles = StyleSheet.create({
  walletInfo: {
    width: '100%',
    backgroundColor: COLORS.DARK_BG,
    padding: HORIZONTAL_PADDING,
    marginHorizontal: 0,
    borderRadius: 16,
    marginTop: 4,
  },
  walletTitle: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
    flex: 1,
  },
  totalBalanceSection: {
    marginBottom: 32,
  },
  totalBalanceLabel: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 8,
  },
  balanceContainer: {
    minHeight: 44,
    justifyContent: 'center',
  },
  totalBalanceAmount: {
    fontSize: 36,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
  },
  totalBalanceAmountSmall: {
    fontSize: 28,
    fontFamily: 'CabinetGrotesk-Bold',
  },
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
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 16,
    marginBottom: SCREEN_WIDTH <= 375 ? 4 : 12,
    height: 96,
    justifyContent: 'center',
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  btcIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  ducatIcon: {
    borderRadius: 20,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
    marginBottom: 6,
  },
  assetAmount: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  assetAmountIcon: {
    width: 12,
    height: 12,
    marginRight: 0,
  },
  assetSubtext: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
  },
  assetValue: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
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
  assetValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 16,
    height: 16,
    marginRight: 3,
  },
  walletContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: 0,
    backgroundColor: COLORS.DARK_BG,
  },
  // Mutinynet banner - Full Width
  mutinynetBanner: {
    backgroundColor: COLORS.CARD_BG,
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
    color: COLORS.PURPLE,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  priceChipsContainer: {
    flexDirection: 'row',
    marginBottom: 0,
    width: '100%',
  },
  priceChip: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
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
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '500',
    marginRight: 8,
  },
  priceChipValue: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
  },
  // Xverse-style header
  xverseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  xverseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  xverseAccountName: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
  },
  xverseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  // Xverse-style balance section
  xverseBalanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  xverseBalanceLeft: {
    flex: 1,
  },
  xverseBalanceLabel: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 4,
  },
  xverseBalanceAmount: {
    fontSize: SCREEN_WIDTH <= 375 ? 36 : 44,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
  },
  // Removed duplicates - using balanceWithIcon and balanceIcon at lines 909-918
  balanceDivider: {
    height: 1,
    backgroundColor: COLORS.BORDER_COLOR,
    marginHorizontal: 20,
    marginVertical: 16,
    opacity: 0.3,
  },
  portfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  portfolioIcon: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  portfolioText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '500',
  },
  // Xverse-style action buttons
  xverseActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 8,
    gap: 16,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  xverseActionButton: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.VERY_LIGHT_GRAY,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xverseActionIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.VERY_LIGHT_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xverseActionIconText: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.BLACK,
    fontWeight: '600',
  },
  xverseActionIconImage: {
    width: 20,
    height: 20,
    tintColor: COLORS.BLACK,
  },
  xverseActionLabel: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.BLACK,
    fontWeight: '600',
  },
  runesContainer: {
    backgroundColor: COLORS.CARD_BG,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.TEAL,
  },
  runesLabel: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.TEAL,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  runeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY_BLUE,
  },
  runeName: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
    flex: 1,
  },
  runeAmount: {
    fontSize: 16,
    color: COLORS.TEAL,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  assetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.DARK_BG,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  assetOptionLogo: {
    width: 44,
    height: 44,
    marginRight: 16,
    borderRadius: 22,
  },
  assetOptionInfo: {
    flex: 1,
  },
  assetOptionTitle: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 3,
  },
  assetOptionSubtitle: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
  },
  assetOptionArrow: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  assetOptionValue: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
  },
  // Disabled asset option styles
  assetOptionDisabled: {
    opacity: 0.4,
  },
  assetOptionTitleDisabled: {
    color: COLORS.SECONDARY_TEXT,
  },
  assetOptionSubtitleDisabled: {
    color: COLORS.SECONDARY_TEXT,
  },
  assetOptionValueDisabled: {
    color: COLORS.SECONDARY_TEXT,
  },
});
