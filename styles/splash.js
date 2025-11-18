import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import { STATUS_BAR_HEIGHT, HORIZONTAL_PADDING, SCREEN_WIDTH } from './constants';

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
