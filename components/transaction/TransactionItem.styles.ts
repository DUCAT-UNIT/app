/**
 * TransactionItem Styles
 */

import { StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

export default StyleSheet.create({
  vaultLogo: {
    marginRight: 10,
  },
  assetLogo: {
    marginRight: 10,
  },
  assetLogoContainer: {
    marginRight: 10,
    position: 'relative',
    width: 40,
    height: 40,
  },
  lightningBadge: {
    position: 'absolute',
    bottom: -4,
    right: -3,
    fontSize: 16,
    lineHeight: 16,
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
