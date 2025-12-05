/**
 * History Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';
import { card } from '../components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH } } = layout;

export const history = StyleSheet.create({
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
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  historyEmptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  historyEmptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },
  historyTxRow: {
    flexDirection: 'row',
    paddingTop: 20,
    paddingBottom: spacing.lg,
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  historyLogoImage: {
    width: 40,
    height: 40,
  },
  historyTxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    marginBottom: 4,
  },
  historyTxAmountSent: {
    color: colors.semantic.error,
  },
  historyTxAmountReceived: {
    color: colors.brand.accent,
  },
  historyTxAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  historyTxDate: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  historyTxRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 120,
  },
});

