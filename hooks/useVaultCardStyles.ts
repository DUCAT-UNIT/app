/**
 * useVaultCardStyles Hook
 * Returns VaultCard styles with explicit responsive scaling using s() and sf()
 */

import { useResponsive } from './useResponsive';
import { vault, wallet } from '../styles/screens';
import { VaultCardStyles } from '../components/wallet/VaultCard';

export function useVaultCardStyles(): VaultCardStyles {
  const { s, sf } = useResponsive();

  return {
    vaultCard: {
      ...vault.vaultCard,
      paddingLeft: s(12),
      paddingRight: s(12),
      paddingVertical: s(12),
      height: s(80),
      margin: 0,
    },
    vaultIconContainer: {
      ...vault.vaultIconContainer,
      width: s(40),
      height: s(40),
    },
    vaultStatusIndicator: {
      ...vault.vaultStatusIndicator,
      position: 'absolute',
      top: s(5),
      right: s(5),
    },
    vaultContentWrapper: {
      ...vault.vaultContentWrapper,
      flex: 1,
    },
    vaultHeader: vault.vaultHeader,
    vaultHeaderLeft: vault.vaultHeaderLeft,
    assetInfo: wallet.assetInfo,
    vaultAssetName: {
      ...vault.vaultAssetName,
      fontSize: sf(14),
    },
    assetValue: {
      ...wallet.assetValue,
      fontSize: sf(14),
    },
    vaultDetailsContainer: {
      ...vault.vaultDetailsContainer,
      marginTop: s(6),
    },
    vaultDetailRow: vault.vaultDetailRow,
    vaultLabel: {
      ...vault.vaultLabel,
      fontSize: sf(12),
    },
    vaultValueContainer: vault.vaultValueContainer,
    assetAmountIcon: {
      ...wallet.assetAmountIcon,
      width: s(12),
      height: s(12),
    },
    assetAmount: {
      ...wallet.assetAmount,
      fontSize: sf(14),
    },
    vaultOverlay: vault.vaultOverlay,
    emptyVaultContent: {
      flex: 1,
      minWidth: 0,
      gap: s(2),
    },
    emptyVaultSubtitle: {
      ...vault.vaultLabel,
      fontSize: sf(12),
    },
    createVaultButton: {
      ...vault.createVaultButton,
      minWidth: s(124),
      alignItems: 'center',
    },
    createVaultButtonText: {
      ...vault.createVaultButtonText,
      fontSize: sf(14),
    },
  };
}
