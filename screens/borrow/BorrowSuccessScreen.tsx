/**
 * BorrowSuccessScreen - Borrow operation success confirmation
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess, { buildVaultSuccessTxItems } from '../../components/vault/VaultActionSuccess';
import { useBorrow } from '../../stores/borrowStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { analytics } from '../../services/analyticsService';
import { registerVaultSettlementHistory } from '../../services/vaultSettlementHistoryService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
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
  const { settingsHandlers } = useSettingsHandlers();
  const {
    phase,
    payoutAsset,
    payoutAmount,
    cashuMintSendTxid,
    sepoliaTxHash,
    error: settlementError,
    reset: resetSettlement,
  } = useVaultSettlementStore();

  const txid = route.params?.txid || storeTxid || '';
  const showUsdcSettlementCopy = settingsHandlers.usdcFeaturesEnabled;
  const showUsdcPayout = showUsdcSettlementCopy && payoutAsset === 'USDC';
  const showWrappedUnitPayout = showUsdcSettlementCopy && payoutAsset === 'wUNIT';
  const showTurboUnitPayout = payoutAsset === 'TURBOUNIT';

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
    showUsdcPayout
      ? 'USDC'
      : payoutAsset === 'UNIT'
        ? 'UNIT'
        : showTurboUnitPayout
          ? 'TURBOUNIT'
        : showWrappedUnitPayout
          ? 'wUNIT'
        : 'USD';
  const successAmount =
    (showUsdcPayout || showWrappedUnitPayout || showTurboUnitPayout || payoutAsset === 'UNIT') && payoutAmount ? Number.parseFloat(payoutAmount) || borrowAmountUsd : borrowAmountUsd;
  const titleOverride =
    showUsdcPayout
      ? 'Sepolia USDC Received!'
      : payoutAsset === 'UNIT'
        ? 'UNIT Received!'
        : showTurboUnitPayout
          ? 'TurboUNIT Received!'
        : showWrappedUnitPayout
          ? 'wUNIT Received!'
      : phase === 'pending_settlement'
        ? 'Borrow Complete!'
        : phase === 'needs_retry'
          ? 'Borrow Complete!'
          : undefined;
  const messageOverride =
    showUsdcPayout
      ? 'Borrow recorded and automatically settled to Sepolia USDC.'
      : payoutAsset === 'UNIT'
        ? 'Borrow recorded and issued as UNIT on Mutinynet.'
        : showTurboUnitPayout
          ? 'Borrow recorded and the issued UNIT was minted into TurboUNIT.'
        : showWrappedUnitPayout
          ? 'Borrow recorded. Auto-swap could not clear safely, so you received wUNIT on Sepolia instead.'
      : phase === 'pending_settlement'
        ? showUsdcSettlementCopy
          ? 'Borrow recorded. Sepolia settlement is still processing in the background.'
          : 'Borrow recorded. Settlement is still processing in the background.'
      : phase === 'needs_retry'
          ? showUsdcSettlementCopy
            ? settlementError || 'Borrow recorded. Automatic Sepolia USDC settlement needs retry.'
            : 'Borrow recorded. Automatic settlement needs retry.'
          : undefined;
  const txItems = buildVaultSuccessTxItems({
    mutinynetTxid: txid,
    turboMintSendTxid: showTurboUnitPayout ? cashuMintSendTxid : null,
    sepoliaTxHash,
    includeSepolia: showUsdcPayout,
  });

  return (
    <VaultActionSuccess
      actionType="borrow"
      amount={successAmount}
      usdValue={borrowAmountUsd}
      txid={txid}
      unit={successUnit}
      titleOverride={titleOverride}
      messageOverride={messageOverride}
      txItems={txItems}
      onDone={handleDone}
    />
  );
}
