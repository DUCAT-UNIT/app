/**
 * TurboHistoryScreen Styles
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  placeholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.MID_GRAY,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  tokenCard: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  amountText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.BRAND_PURPLE,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.MID_GRAY,
  },
  deleteButton: {
    padding: 4,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipientText: {
    fontSize: 13,
    color: COLORS.LIGHT_GRAY,
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  txidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  txidText: {
    fontSize: 12,
    color: COLORS.MID_GRAY,
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.DARK_BACKGROUND,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.BRAND_PURPLE,
  },
});
