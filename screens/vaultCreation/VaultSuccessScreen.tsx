/**
 * VaultSuccessScreen - Vault creation success confirmation
 * Uses shared VaultActionSuccess component for consistency
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { usePrice } from '../../stores/priceStore';
import { analytics } from '../../services/analyticsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';

import type { VaultCreateStackParamList } from '../../navigation/types';
import type { StackScreenProps } from '@react-navigation/stack';

type VaultSuccessScreenProps = StackScreenProps<VaultCreateStackParamList, 'VaultSuccess'>;

export default function VaultSuccessScreen({ navigation, route }: VaultSuccessScreenProps) {
  const { txid: storeTxid, btcAmount, reset } = useVaultCreation();
  const { btcPrice } = usePrice();

  const txid = route.params?.txid || storeTxid || '';

  // VaultActionSuccess expects satoshis for BTC amounts (formatBTC converts sats to BTC)
  const btcAmountSats = Math.round(btcAmount * 100_000_000);
  const btcUsdValue = btcPrice ? btcAmount * btcPrice : 0;

  useEffect(() => {
    if (txid) {
      analytics.trackTransaction(VAULT_EVENTS.VAULT_CREATED, txid, {
        btc_amount_sats: btcAmountSats,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      amount={btcAmountSats}
      usdValue={btcUsdValue}
      txid={txid}
      unit="BTC"
      onDone={handleDone}
    />
  );
}
