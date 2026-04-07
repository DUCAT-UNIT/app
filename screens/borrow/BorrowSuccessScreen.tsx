/**
 * BorrowSuccessScreen - Borrow operation success confirmation
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useBorrow } from '../../stores/borrowStore';
import { analytics } from '../../services/analyticsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';

import type { StackScreenProps } from '@react-navigation/stack';

type BorrowStackParamList = {
  BorrowInput: undefined;
  BorrowConfirm: undefined;
  BorrowProcessing: undefined;
  BorrowSuccess: { txid?: string };
};

type BorrowSuccessScreenProps = StackScreenProps<BorrowStackParamList, 'BorrowSuccess'>;

export default function BorrowSuccessScreen({ navigation, route }: BorrowSuccessScreenProps) {
  const { txid: storeTxid, borrowAmount, reset } = useBorrow();

  const txid = route.params?.txid || storeTxid || '';

  useEffect(() => {
    if (txid) {
      analytics.trackTransaction(VAULT_EVENTS.VAULT_OPERATION_COMPLETED, txid, {
        operation: 'borrow',
        amount: borrowAmount,
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
      actionType="borrow"
      amount={borrowAmount}
      usdValue={borrowAmount}
      txid={txid}
      unit="UNIT"
      onDone={handleDone}
    />
  );
}
