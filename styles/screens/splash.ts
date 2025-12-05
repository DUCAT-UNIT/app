/**
 * Splash Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';

export const splash = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 152,
    height: 152,
    marginBottom: 20,
  },
  splashTitle: {
    fontSize: 36,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: 4,
    letterSpacing: 4,
  },
  splashSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.light,
    color: colors.brand.secondary,
    letterSpacing: 0,
  },
});
