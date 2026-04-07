/**
 * RepaySuccessScreen - Repay operation success confirmation
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useRepay } from '../../stores/repayStore';
import { analytics } from '../../services/analyticsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';

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

  useEffect(() => {
    if (vaultTxid) {
      analytics.trackTransaction(VAULT_EVENTS.VAULT_OPERATION_COMPLETED, vaultTxid, {
        operation: 'repay',
        amount: repayAmountUnit,
        unit: 'UNIT',
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
      actionType="repay"
      amount={repayAmountUnit}
      usdValue={repayAmountUnit}
      txid={vaultTxid}
      unit="UNIT"
      onDone={handleDone}
    />
  );
}
