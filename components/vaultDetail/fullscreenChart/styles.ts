/**
 * FullscreenChart Styles
 * StyleSheet definitions for fullscreen vault chart
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../../theme';
import { DRAWER_WIDTH, LEFT_MARGIN, RIGHT_MARGIN, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT } from './constants';

export const fullscreenStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotatedContainer: {
    width: LANDSCAPE_WIDTH,
    height: LANDSCAPE_HEIGHT,
    transform: [{ rotate: '90deg' }],
    backgroundColor: COLORS.DARK_BG,
  },
  topRightControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  healthChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  healthChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
  },
  chartWrapper: {
    width: '100%',
    position: 'relative',
  },
  // Native animated scrubber styles
  animatedScrubberLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
  },
  animatedScrubberDotOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedScrubberDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  timeframeButtons: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingLeft: LEFT_MARGIN,
    paddingRight: RIGHT_MARGIN,
  },
  timeframeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    minWidth: 70,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  timeframeTextActive: {
    color: COLORS.WHITE,
  },
  // Drawer styles
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    paddingTop: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 50,
  },
  drawerRight: {
    right: 0,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.DARK_GRAY,
    shadowOffset: { width: -2, height: 0 },
  },
  drawerLeft: {
    left: LEFT_MARGIN,
    borderRightWidth: 1,
    borderRightColor: COLORS.DARK_GRAY,
    shadowOffset: { width: 2, height: 0 },
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.DARK_GRAY,
  },
  drawerHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  drawerHealthChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  drawerHealthChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.DARK_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTransactions: {
    flex: 1,
  },
  drawerEmptyText: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    marginTop: 32,
  },
  drawerTxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  drawerTxIcon: {
    marginRight: 8,
  },
  drawerTxContent: {
    flex: 1,
  },
  drawerTxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  drawerTxAction: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  drawerTxAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  drawerTxAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  drawerTxDate: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
});
