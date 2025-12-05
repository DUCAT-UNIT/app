/**
 * Settings Screen Styles
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radii, fonts, fontSizes, fontWeights, layout, COLORS } from '../theme';

const { isSmall, padding: HORIZONTAL_PADDING } = layout;

export const settings = StyleSheet.create({
  settingsButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.MEDIUM_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  settingsIcon: {
    fontSize: 20,
    fontFamily: fonts.regular,
  },
  settingsModal: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xxl,
    padding: 0,
    width: '85%',
    maxWidth: 400,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isSmall ? 8 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  settingsTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },
  closeButton: {
    fontSize: 24,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.light,
    color: colors.text.secondary,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmall ? 8 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  settingsOptionIcon: {
    fontSize: 24,
    fontFamily: fonts.regular,
    marginRight: isSmall ? 8 : 16,
    width: 32,
  },
  settingsOptionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.primary,
  },
  settingsOptionArrow: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: COLORS.LIGHT_GRAY,
  },
  settingsToggle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.lg,
    backgroundColor: COLORS.DARK_GRAY,
  },
  settingsToggleOn: {
    color: colors.text.primary,
    backgroundColor: colors.brand.primary,
  },
  settingsDivider: {
    height: 8,
    backgroundColor: COLORS.OFF_WHITE,
  },
});

