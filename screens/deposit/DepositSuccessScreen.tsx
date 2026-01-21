/**
 * DepositSuccessScreen - Deposit operation success confirmation
 */

import React, { useCallback } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useDeposit } from '../../stores/depositStore';
import { usePrice } from '../../stores/priceStore';

import type { StackScreenProps } from '@react-navigation/stack';

type DepositStackParamList = {
  DepositInput: undefined;
  DepositConfirm: undefined;
  DepositProcessing: undefined;
  DepositSuccess: { vaultTxid?: string };
};

type DepositSuccessScreenProps = StackScreenProps<DepositStackParamList, 'DepositSuccess'>;

export default function DepositSuccessScreen({ navigation, route }: DepositSuccessScreenProps) {
  const { vaultTxid: storeVaultTxid, depositAmountSats, reset } = useDeposit();
  const { btcPrice } = usePrice();

  const vaultTxid = route.params?.vaultTxid || storeVaultTxid || '';
  // VaultActionSuccess expects satoshis for BTC amounts (formatBTC converts sats to BTC)
  const depositUsdValue = btcPrice ? (depositAmountSats / 100_000_000) * btcPrice : 0;

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
                  routes: [
                    { name: 'WalletHome' },
                    { name: 'VaultDetail' },
                  ],
                  index: 1,
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
      actionType="deposit"
      amount={depositAmountSats}
      usdValue={depositUsdValue}
      txid={vaultTxid}
      unit="BTC"
      onDone={handleDone}
    />
  );
}
