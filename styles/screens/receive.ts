/**
 * Receive Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';
import { button, card, sheet } from '../components';

const { isSmall, padding: HORIZONTAL_PADDING, screen: { width: SCREEN_WIDTH }, statusBar: STATUS_BAR_HEIGHT } = layout;

export const receive = StyleSheet.create({
  receiveButton: {
    backgroundColor: colors.brand.accent,
  },
  receiveAddressRow: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiveAddressInfo: {
    flex: 1,
    marginRight: spacing.lg,
  },
  receiveAddressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  receiveAddressLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  receiveAddress: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  receiveAddressTag: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  receiveAddressTagText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  receiveQrButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  receiveQrIcon: {
    width: 24,
    height: 24,
    tintColor: colors.text.primary,
  },

  // QR Modal
  qrModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.primary,
    zIndex: 99999,
  },
  qrModalNetworkBar: {
    backgroundColor: colors.bg.secondary,
    paddingVertical: isSmall ? 4 : 6,
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 0,
    marginTop: isSmall ? 20 : STATUS_BAR_HEIGHT,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalNetworkText: {
    color: colors.brand.secondary,
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: isSmall ? 8 : 16,
    paddingBottom: isSmall ? 8 : 16,
  },
  qrModalBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  qrModalBackArrow: {
    fontSize: 36,
    color: colors.text.primary,
    fontWeight: fontWeights.light,
  },
  qrModalBackIcon: {
    width: 24,
    height: 24,
    tintColor: colors.text.primary,
  },
  qrModalMenuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  qrModalMenuIcon: {
    fontSize: 24,
    color: colors.text.primary,
  },
  qrModalContent: {
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: SCREEN_WIDTH <= 400 ? 10 : 20,
    paddingBottom: SCREEN_WIDTH <= 400 ? 24 : 32,
    flexGrow: 1,
  },
  qrModalTitle: {
    fontSize: isSmall ? 20 : 28,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: isSmall ? 4 : 8,
    textAlign: 'center',
  },
  qrModalSubtitle: {
    fontSize: isSmall ? 12 : 15,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: SCREEN_WIDTH <= 400 ? 8 : 40,
    textAlign: 'center',
  },
  qrCodeContainer: {
    backgroundColor: colors.bg.white,
    padding: isSmall ? 10 : 20,
    borderRadius: radii.lg,
    marginBottom: isSmall ? 12 : 32,
  },
  qrAddressContainer: {
    width: '100%',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: isSmall ? 12 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isSmall ? 12 : 16,
  },
  qrAddressLeft: {
    flex: 1,
    marginRight: 12,
  },
  qrAddressLabelText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  qrAddressFullText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    lineHeight: 20,
  },
  qrCopyButton: {
    backgroundColor: colors.bg.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  qrCopyButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.bg.primary,
  },
  qrShareButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: isSmall ? 12 : 14,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrShareIcon: {
    fontSize: 20,
    color: colors.text.primary,
  },
  qrShareButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
});

