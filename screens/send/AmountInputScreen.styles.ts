/**
 * AmountInputScreen Styles
 * Strike-inspired clean, minimal design
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Amount Section - centered
  amountSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  amountInput: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    minWidth: 60,
  },
  assetSymbol: {
    fontSize: 24,
    fontWeight: '500',
    color: COLORS.MEDIUM_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  usdValue: {
    fontSize: 18,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  // Balance Button - tappable pill
  balanceButton: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  // Turbo Info Card
  turboInfoContainer: {
    backgroundColor: COLORS.PRIMARY_BLUE + '15',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '25',
  },
  turboInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  turboInfoText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
  balanceButtonError: {
    backgroundColor: 'rgba(208, 76, 104, 0.15)',
  },
  balanceButtonText: {
    fontSize: 14,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  balanceButtonTextError: {
    color: COLORS.DANGER_RED,
  },
  // Button Container
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.DARK_BG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
  },
  reviewButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonDisabled: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    opacity: 0.5,
  },
  reviewButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
    marginTop: 16,
    textAlign: 'center',
  },
});
