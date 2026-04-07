/**
 * WithdrawSuccessScreen - Withdraw operation success confirmation
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useWithdraw } from '../../stores/withdrawStore';
import { usePrice } from '../../stores/priceStore';
import { analytics } from '../../services/analyticsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';

import type { StackScreenProps } from '@react-navigation/stack';

type WithdrawStackParamList = {
  WithdrawInput: undefined;
  WithdrawConfirm: undefined;
  WithdrawProcessing: undefined;
  WithdrawSuccess: { vaultTxid?: string };
};

type WithdrawSuccessScreenProps = StackScreenProps<WithdrawStackParamList, 'WithdrawSuccess'>;

export default function WithdrawSuccessScreen({ navigation, route }: WithdrawSuccessScreenProps) {
  const { vaultTxid: storeVaultTxid, withdrawAmountSats, reset } = useWithdraw();
  const { btcPrice } = usePrice();

  const vaultTxid = route.params?.vaultTxid || storeVaultTxid || '';
  // VaultActionSuccess expects satoshis for BTC amounts (formatBTC converts sats to BTC)
  const withdrawUsdValue = btcPrice ? (withdrawAmountSats / 100_000_000) * btcPrice : 0;

  useEffect(() => {
    if (vaultTxid) {
      analytics.trackTransaction(VAULT_EVENTS.VAULT_OPERATION_COMPLETED, vaultTxid, {
        operation: 'withdraw',
        amount_sats: withdrawAmountSats,
        unit: 'BTC',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDone = useCallback(() => {
    reset();
    navigation.getParent()?.reset({
      index: 0,
      routes: [
        {
          name: 'Main',
          state: {
            routes: [
              {
                name: 'WalletTab',
                state: {
                  routes: [{ name: 'WalletHome' }],
                  index: 0,
                },
              },
            ],
            index: 0,
          },
        },
      ],
    });
  }, [reset, navigation]);

  return (
    <VaultActionSuccess
      actionType="withdraw"
      amount={withdrawAmountSats}
      usdValue={withdrawUsdValue}
      txid={vaultTxid}
      unit="BTC"
      onDone={handleDone}
    />
  );
}
