/**
 * TransactionItem Styles
 * Note: These are static styles. For responsive scaling,
 * components should use useResponsive() hook with inline styles.
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

export default StyleSheet.create({
  vaultLogo: {
    // marginRight handled inline with s()
  },
  assetLogo: {
    // marginRight handled inline with s()
  },
  assetLogoContainer: {
    position: 'relative',
    // width, height, marginRight handled inline with s()
  },
  lightningBadge: {
    position: 'absolute',
    // bottom, right, fontSize handled inline with s()/sf()
  },
  txContentContainer: {
    flex: 1,
  },
  actionText: {
    color: '#DDDDDD',
  },
  vaultConfirmedChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    marginLeft: 0,
  },
  vaultConfirmedText: {
    color: COLORS.GREEN,
  },
  confirmedChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    marginLeft: 0,
  },
  confirmedChipText: {
    color: COLORS.GREEN,
  },
  pendingChip: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    marginLeft: 0,
  },
  pendingChipText: {
    color: COLORS.YELLOW,
  },
  claimedChip: {
    backgroundColor: 'transparent',
    marginLeft: 0,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  claimedChipText: {
    color: COLORS.PRIMARY_BLUE,
  },
  partialChip: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    marginLeft: 0,
  },
  partialChipText: {
    color: COLORS.WARNING_ORANGE,
  },
});
