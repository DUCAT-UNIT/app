import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import { STATUS_BAR_HEIGHT, HORIZONTAL_PADDING, SCREEN_WIDTH } from './constants';

export const historyStyles = StyleSheet.create({
  // Transaction History styles
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
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    marginTop: 16,
  },
  historyEmptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  historyEmptyText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  historyTxRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  historyLogoImage: {
    width: 40,
    height: 40,
  },
  historyTxTopRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
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
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
    marginBottom: 4,
  },
  historyTxAmountSent: {
    color: COLORS.DANGER_RED,
  },
  historyTxAmountReceived: {
    color: COLORS.TEAL,
  },
  historyTxAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  historyTxDate: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  historyTxRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 120,
  },
});
