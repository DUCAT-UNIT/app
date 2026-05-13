/**
 * ConfirmationScreen Styles
 * Extracted from ConfirmationScreen.tsx for maintainability
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../theme';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

/**
 * Style types for type safety
 */
export interface ConfirmationStyles {
  container: ViewStyle;
  content: ViewStyle;
  checkmarkContainer: ViewStyle;
  checkmark: ViewStyle;
  heroLogoContainer: ViewStyle;
  heroLightningBadge: TextStyle;
  processingTitle: TextStyle;
  processingMessage: TextStyle;
  title: TextStyle;
  subtitle: TextStyle;
  iconContainer: ViewStyle;
  iconCircle: ViewStyle;
  linksContainer: ViewStyle;
  linkRow: ViewStyle;
  txId: TextStyle;
  divider: ViewStyle;
  explorerText: TextStyle;
  warningRow: ViewStyle;
  infoText: TextStyle;
  explorerButton: ViewStyle;
  explorerButtonText: TextStyle;
  urlContainer: ViewStyle;
  urlText: TextStyle;
  tapToCopyHint: TextStyle;
  buttonRow: ViewStyle;
  actionButton: ViewStyle;
  shareButton: ViewStyle;
  copyButton: ViewStyle;
  actionButtonText: TextStyle;
  footer: ViewStyle;
  doneButton: ViewStyle;
  doneButtonText: TextStyle;
  secondaryButton: ViewStyle;
  secondaryButtonText: TextStyle;
}

/**
 * Create responsive styles for ConfirmationScreen
 * @param s - Responsive spacing function
 * @param sf - Responsive font size function
 */
export function createConfirmationStyles(
  s: (value: number) => number,
  sf: (value: number, minValue?: number) => number
): ConfirmationStyles {
  return StyleSheet.create<ConfirmationStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(40),
    },
    checkmarkContainer: {
      marginBottom: s(24),
    },
    checkmark: {
      width: s(80),
      height: s(80),
      borderRadius: s(40),
      backgroundColor: COLORS.SUCCESS_GREEN + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: s(2),
      borderColor: COLORS.SUCCESS_GREEN,
    },
    heroLogoContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroLightningBadge: {
      position: 'absolute',
      bottom: s(-8),
      right: s(-8),
      fontSize: sf(32),
    },
    processingTitle: {
      fontSize: sf(18),
      fontWeight: '600',
      color: COLORS.VERY_LIGHT_GRAY,
      textAlign: 'center',
      marginBottom: s(8),
    },
    processingMessage: {
      fontSize: sf(14),
      color: COLORS.SECONDARY_TEXT,
      textAlign: 'center',
      lineHeight: sf(20, 16),
    },
    title: {
      fontSize: fontSizes.xxl,
      fontFamily: fonts.bold,
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    subtitle: {
      fontSize: sf(14),
      color: COLORS.SECONDARY_TEXT,
      textAlign: 'center',
      lineHeight: sf(20, 16),
    },
    // Non-turbo success screen (matching VaultActionSuccess design)
    iconContainer: {
      marginBottom: spacing.xl,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: radii.full,
      backgroundColor: 'rgba(89, 170, 138, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    linksContainer: {
      marginTop: spacing.xl,
      backgroundColor: colors.bg.secondary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignSelf: 'center',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
    },
    txId: {
      fontSize: fontSizes.md,
      fontFamily: fonts.mono,
      color: colors.text.secondary,
      marginLeft: spacing.sm,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.default,
    },
    explorerText: {
      fontSize: fontSizes.md,
      fontFamily: fonts.medium,
      color: colors.brand.primary,
      marginLeft: spacing.sm,
    },
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    infoText: {
      fontSize: fontSizes.xs,
      fontFamily: fonts.regular,
      color: colors.text.tertiary,
      marginLeft: spacing.xs,
    },
    // Legacy styles for turbo flow
    explorerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
      backgroundColor: COLORS.CARD_BG,
      paddingVertical: s(12),
      paddingHorizontal: s(16),
      borderRadius: s(10),
      borderWidth: 1,
      borderColor: COLORS.PRIMARY_BLUE + '30',
      marginTop: s(24),
    },
    explorerButtonText: {
      fontSize: sf(14),
      fontWeight: '500',
      color: COLORS.PRIMARY_BLUE,
    },
    urlContainer: {
      backgroundColor: COLORS.CARD_BG,
      borderRadius: s(12),
      padding: s(16),
      borderWidth: 1,
      borderColor: COLORS.BORDER_COLOR,
      width: '100%',
      gap: s(8),
    },
    urlText: {
      fontSize: sf(13),
      color: COLORS.VERY_LIGHT_GRAY,
      fontFamily: 'monospace',
      textAlign: 'center',
    },
    tapToCopyHint: {
      fontSize: sf(11, 9),
      color: COLORS.SECONDARY_TEXT,
      textAlign: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: s(12),
      marginTop: s(16),
      width: '100%',
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: s(10),
      paddingHorizontal: s(16),
      borderRadius: s(10),
      gap: s(6),
    },
    shareButton: {
      backgroundColor: COLORS.CARD_BG,
      borderWidth: 1,
      borderColor: COLORS.PRIMARY_BLUE + '30',
    },
    copyButton: {
      backgroundColor: COLORS.PRIMARY_BLUE,
    },
    actionButtonText: {
      fontSize: sf(14),
      fontWeight: '500',
      color: COLORS.VERY_LIGHT_GRAY,
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    doneButton: {
      backgroundColor: colors.brand.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    doneButtonText: {
      fontSize: fontSizes.md,
      fontFamily: fonts.bold,
      color: colors.text.white,
    },
    secondaryButton: {
      backgroundColor: COLORS.CARD_BG,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: COLORS.PRIMARY_BLUE + '40',
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: fontSizes.md,
      fontFamily: fonts.bold,
      color: colors.brand.primary,
    },
  });
}
