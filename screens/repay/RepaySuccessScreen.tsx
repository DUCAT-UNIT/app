/**
 * RepaySuccessScreen - Repay operation success confirmation
 */

import React, { useCallback } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useRepay } from '../../stores/repayStore';

import type { StackScreenProps } from '@react-navigation/stack';

type RepayStackParamList = {
  RepayInput: undefined;
  RepayConfirm: undefined;
  RepayProcessing: undefined;
  RepaySuccess: { vaultTxid?: string };
};

type RepaySuccessScreenProps = StackScreenProps<RepayStackParamList, 'RepaySuccess'>;

export default function RepaySuccessScreen({ navigation, route }: RepaySuccessScreenProps) {
  const { vaultTxid: storeVaultTxid, repayAmountUnit, reset } = useRepay();

  const vaultTxid = route.params?.vaultTxid || storeVaultTxid || '';

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
      actionType="repay"
      amount={repayAmountUnit}
      usdValue={repayAmountUnit}
      txid={vaultTxid}
      unit="UNIT"
      onDone={handleDone}
    />
  );
}
