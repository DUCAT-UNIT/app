/**
 * BorrowSuccessScreen - Borrow operation success confirmation
 */

import React, { useCallback } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useBorrow } from '../../stores/borrowStore';

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
      actionType="borrow"
      amount={borrowAmount}
      usdValue={borrowAmount}
      txid={txid}
      unit="UNIT"
      onDone={handleDone}
    />
  );
}
