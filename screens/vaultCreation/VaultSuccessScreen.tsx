/**
 * VaultSuccessScreen - Vault creation success confirmation
 * Uses shared VaultActionSuccess component for consistency
 */

import React, { useCallback } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { usePrice } from '../../stores/priceStore';

import type { VaultCreateStackParamList } from '../../navigation/types';
import type { StackScreenProps } from '@react-navigation/stack';

type VaultSuccessScreenProps = StackScreenProps<VaultCreateStackParamList, 'VaultSuccess'>;

export default function VaultSuccessScreen({ navigation, route }: VaultSuccessScreenProps) {
  const { txid: storeTxid, btcAmount, unitAmount, reset } = useVaultCreation();
  const { btcPrice } = usePrice();

  const txid = route.params?.txid || storeTxid || '';

  // Calculate USD value of deposited BTC
  const btcUsdValue = btcPrice ? btcAmount * btcPrice : btcAmount * 100000;

  // Handle done - reset state and go back to wallet
  const handleDone = useCallback(() => {
    reset();
    // Navigate back to main screen
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }, [reset, navigation]);

  return (
    <VaultActionSuccess
      actionType="create"
      amount={btcAmount}
      usdValue={btcUsdValue}
      txid={txid}
      unit="BTC"
      onDone={handleDone}
    />
  );
}
