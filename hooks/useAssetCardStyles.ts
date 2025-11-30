/**
 * useAssetCardStyles Hook
 * Returns AssetCard styles with explicit responsive scaling using s() and sf()
 */

import { useResponsive } from './useResponsive';
import { AssetCardStyles } from '../components/wallet/AssetCard';
import { wallet } from '../styles/screens';

export function useAssetCardStyles(): AssetCardStyles {
  const { s, sf } = useResponsive();

  return {
    assetCard: {
      backgroundColor: '#1D1C21',
      borderRadius: s(12),
      paddingLeft: s(12),
      paddingRight: s(12),
      paddingVertical: s(12),
      height: s(72),
      justifyContent: 'center' as const,
      marginBottom: s(8),
    },
    assetCardLast: wallet.assetCardLast,
    assetRow: {
      ...wallet.assetRow,
    },
    assetLeft: {
      ...wallet.assetLeft,
    },
    btcIcon: {
      width: s(40),
      height: s(40),
      borderRadius: s(20),
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: s(9),
      overflow: 'hidden' as const,
    },
    ducatIcon: {
      width: s(40),
      height: s(40),
      borderRadius: s(20),
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: s(9),
      overflow: 'hidden' as const,
    },
    assetInfo: wallet.assetInfo,
    assetName: {
      ...wallet.assetName,
      fontSize: sf(14),
    },
    balanceWithIcon: wallet.balanceWithIcon,
    assetAmountIcon: {
      ...wallet.assetAmountIcon,
      width: s(12),
      height: s(12),
    },
    assetAmount: {
      ...wallet.assetAmount,
      fontSize: sf(14),
    },
    assetValue: {
      ...wallet.assetValue,
      fontSize: sf(14),
    },
    assetValueWithIcon: wallet.assetValueWithIcon,
    assetIcon: wallet.assetIcon,
  };
}
