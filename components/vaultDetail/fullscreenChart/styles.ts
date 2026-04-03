/**
 * FullscreenChart Styles
 * StyleSheet definitions for fullscreen vault chart with activity list
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../../theme';

export const fullscreenStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  healthChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Chart section (top 60%)
  chartSection: {
    height: '60%',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  chartWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrubberLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 2,
    borderRadius: 1,
  },
  scrubberDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrubberDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  scrubberLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: COLORS.DARK_BG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
  },
  scrubberLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrubberDateLabel: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  scrubberDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
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
  // Timeframe buttons
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
    minWidth: 50,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '600',
  },
  timeframeTextActive: {
    color: COLORS.WHITE,
  },
  // Activity section (bottom half)
  activitySection: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: COLORS.VERY_DARK_GRAY,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
  },
  activityList: {
    paddingBottom: 16,
  },
  emptyActivity: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyActivityText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
  },
  // Transaction item styles
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txContent: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  txDate: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  txAmounts: {
    flexDirection: 'row',
    gap: 12,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Legacy styles (kept for compatibility, can be removed later)
  portraitContainer: {
    flex: 1,
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
  chartContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
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
});
