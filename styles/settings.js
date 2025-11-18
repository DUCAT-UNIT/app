import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import { STATUS_BAR_HEIGHT, HORIZONTAL_PADDING, SCREEN_WIDTH } from './constants';

export const settingsStyles = StyleSheet.create({
  settingsButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.MEDIUM_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  settingsIcon: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  settingsModal: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    padding: 0,
    width: '85%',
    maxWidth: 400,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SCREEN_WIDTH <= 375 ? 8 : 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  settingsTitle: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  closeButton: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '300',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SCREEN_WIDTH <= 375 ? 8 : 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  settingsOptionIcon: {
    fontSize: 24,
    fontFamily: 'CabinetGrotesk-Regular',
    marginRight: SCREEN_WIDTH <= 375 ? 8 : 16,
    width: 32,
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  settingsOptionArrow: {
    fontSize: 20,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.LIGHT_GRAY,
  },
  settingsToggle: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.DARK_GRAY,
  },
  settingsToggleOn: {
    color: COLORS.VERY_LIGHT_GRAY,
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  settingsDivider: {
    height: 8,
    backgroundColor: COLORS.OFF_WHITE,
  },
});
