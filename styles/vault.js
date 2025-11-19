import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import { STATUS_BAR_HEIGHT, HORIZONTAL_PADDING, SCREEN_WIDTH } from './constants';

export const vaultStyles = StyleSheet.create({
  vaultCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 12,
    marginBottom: SCREEN_WIDTH <= 375 ? 4 : 12,
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
  },
  vaultContentWrapper: {
    flex: 1,
  },
  vaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  vaultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vaultIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
    alignSelf: 'center',
  },
  vaultStatusIndicator: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#59AA8A',
  },
  vaultInfo: {
    flex: 1,
  },
  vaultTitle: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
  },
  vaultHealth: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  vaultDetailsContainer: {
    marginLeft: 0,
    marginTop: 4,
    marginBottom: 0,
  },
  vaultDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  vaultValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createVaultButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createVaultButtonText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: '#FFFFFF',
    fontWeight: '600',
  },
  vaultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  vaultLabel: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  vaultValue: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    marginLeft: 4,
  },
  vaultValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaultProgressBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 16,
  },
  vaultProgressFill: {
    backgroundColor: '#59AA8A',
    height: '100%',
  },
  vaultProgressLocked: {
    backgroundColor: '#59AA8A',
    opacity: 0.3,
    height: '100%',
  },
  vaultFooter: {
    flexDirection: 'row',
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
    backgroundColor: '#59AA8A',
  },
  vaultDotLocked: {
    opacity: 0.3,
  },
  vaultFooterValue: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    marginLeft: 4,
  },
  vaultFooterLabel: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  vaultAssetName: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
    paddingTop: 4,
    marginBottom: 0,
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
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: '600',
  },
});
