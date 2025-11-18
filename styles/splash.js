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

export const splashStyles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
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
    fontFamily: 'CabinetGrotesk-Bold',
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 4,
    letterSpacing: 4,
  },
  splashSubtitle: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    fontWeight: '300',
    color: COLORS.PURPLE,
    letterSpacing: 0,
  },
});
