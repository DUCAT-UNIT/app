import { StyleSheet, Platform, StatusBar, Dimensions } from 'react-native';
import { COLORS } from '../theme';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get safe area top inset - accounts for notch/status bar on different devices
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

// Responsive horizontal padding based on screen width
// Small devices (< 375): 16px
// Medium devices (375-414): 20px
// Large devices (> 414): 24px
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

// Helper function to get Cabinet Grotesk font based on weight
const _getCabinetFont = (weight) => {
  if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
    return 'CabinetGrotesk-Bold';
  } else if (weight === '500' || weight === '600') {
    return 'CabinetGrotesk-Medium';
  }
  return 'CabinetGrotesk-Regular';
};

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
