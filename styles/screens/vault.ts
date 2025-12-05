/**
 * Vault Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';
import { button, card } from '../components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH } } = layout;

export const vault = StyleSheet.create({
  vaultCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingLeft: 1,
    paddingRight: spacing.lg,
    paddingVertical: 12,
    marginBottom: isSmall ? 4 : 10,
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
  },
  vaultContentWrapper: {
    flex: 1,
  },
  vaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  vaultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vaultIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    position: 'relative',
    alignSelf: 'center',
  },
  vaultStatusIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.semantic.success,
    borderWidth: 3,
    borderColor: colors.bg.secondary,
  },
  vaultInfo: {
    flex: 1,
  },
  vaultTitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  vaultHealth: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  vaultAssetName: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    paddingTop: 4,
    marginBottom: 0,
  },
  vaultDetailsContainer: {
    marginLeft: 0,
    marginTop: 6,
    marginBottom: 0,
  },
  vaultDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  vaultValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vaultLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  vaultValue: {
    fontSize: 14,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginLeft: 4,
  },
  vaultValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createVaultButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  createVaultButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.white,
  },
  vaultProgressBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: spacing.lg,
  },
  vaultProgressFill: {
    backgroundColor: colors.semantic.success,
    height: '100%',
  },
  vaultProgressLocked: {
    backgroundColor: colors.semantic.success,
    opacity: 0.3,
    height: '100%',
  },
  vaultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: colors.semantic.success,
  },
  vaultDotLocked: {
    opacity: 0.3,
  },
  vaultFooterValue: {
    fontSize: 14,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginLeft: 4,
  },
  vaultFooterLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
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
    fontFamily: fonts.bold,
    fontWeight: fontWeights.semibold,
  },
});

