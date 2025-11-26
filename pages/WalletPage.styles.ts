/**
 * WalletPage Styles
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  contentArea: {
    flex: 1,
    overflow: 'hidden',
  },
  vaultContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1,
    flexDirection: 'column',
  },
  screenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 2,
    flexDirection: 'column',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 10,
  },
  rightEdgeSwipeArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 30,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
});
