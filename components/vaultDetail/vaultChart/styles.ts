/**
 * VaultHealthChart Styles
 * StyleSheet definitions for the vault health chart component
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../../theme';

export const chartStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
    minHeight: 200,
    marginHorizontal: -16,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  chartWrapper: {
    position: 'relative',
    width: '100%',
  },
  healthChip: {
    position: 'absolute',
    top: -10,
    right: -10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  healthChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
  },
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
    minWidth: 60,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  timeframeTextActive: {
    color: '#fff',
  },
});
