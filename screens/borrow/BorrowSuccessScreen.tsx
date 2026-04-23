/**
 * BorrowSuccessScreen - Borrow operation success confirmation
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useBorrow } from '../../stores/borrowStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { analytics } from '../../services/analyticsService';
import { registerVaultSettlementHistory } from '../../services/vaultSettlementHistoryService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';
import { useWallet } from '../../contexts/WalletContext';

import type { StackScreenProps } from '@react-navigation/stack';

type BorrowStackParamList = {
  BorrowInput: undefined;
  BorrowPayout: undefined;
  BorrowConfirm: undefined;
  BorrowProcessing: undefined;
  BorrowSuccess: { txid?: string };
};

type BorrowSuccessScreenProps = StackScreenProps<BorrowStackParamList, 'BorrowSuccess'>;

export default function BorrowSuccessScreen({ navigation, route }: BorrowSuccessScreenProps) {
  const { txid: storeTxid, borrowAmountUsd, reset } = useBorrow();
  const { wallet } = useWallet();
  const {
    phase,
    payoutAsset,
    payoutAmount,
    error: settlementError,
    reset: resetSettlement,
  } = useVaultSettlementStore();

  const txid = route.params?.txid || storeTxid || '';

  useEffect(() => {
    if (txid) {
      analytics.trackTransaction(VAULT_EVENTS.VAULT_OPERATION_COMPLETED, txid, {
        operation: 'borrow',
        amount: borrowAmountUsd,
        unit: 'USD',
      });
    }

    if (wallet?.taprootPubkey && txid && payoutAsset === 'USDC' && payoutAmount) {
      registerVaultSettlementHistory({
        vaultPubkey: wallet.taprootPubkey,
        action: 'borrow_settled_to_usdc',
        amountUsd: Number.parseFloat(payoutAmount) || borrowAmountUsd,
        txid,
      }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDone = useCallback(() => {
    resetSettlement();
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
  }, [resetSettlement, reset, navigation]);

  const successUnit =
    payoutAsset === 'USDC'
      ? 'USDC'
      : payoutAsset === 'UNIT'
        ? 'UNIT'
        : payoutAsset === 'wUNIT'
          ? 'wUNIT'
        : 'USD';
  const successAmount =
    payoutAsset && payoutAmount ? Number.parseFloat(payoutAmount) || borrowAmountUsd : borrowAmountUsd;
  const titleOverride =
    payoutAsset === 'USDC'
      ? 'USDC Received!'
      : payoutAsset === 'UNIT'
        ? 'UNIT Received!'
        : payoutAsset === 'wUNIT'
          ? 'wUNIT Received!'
      : phase === 'pending_settlement'
        ? 'Borrow Complete!'
        : phase === 'needs_retry'
          ? 'Borrow Complete!'
          : undefined;
  const messageOverride =
    payoutAsset === 'USDC'
      ? 'Borrow recorded and automatically settled to USDC on Sepolia.'
      : payoutAsset === 'UNIT'
        ? 'Borrow recorded and issued as UNIT on Mutinynet.'
        : payoutAsset === 'wUNIT'
          ? 'Borrow recorded. Auto-swap could not clear safely, so you received wUNIT on Sepolia instead.'
      : phase === 'pending_settlement'
        ? 'Borrow recorded. Sepolia settlement is still processing in the background.'
        : phase === 'needs_retry'
          ? settlementError || 'Borrow recorded. Automatic USDC settlement needs retry.'
          : undefined;

  return (
    <VaultActionSuccess
      actionType="borrow"
      amount={successAmount}
      usdValue={borrowAmountUsd}
      txid={txid}
      unit={successUnit}
      titleOverride={titleOverride}
      messageOverride={messageOverride}
      onDone={handleDone}
    />
  );
}
