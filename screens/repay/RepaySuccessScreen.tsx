/**
 * RepaySuccessScreen - Repay operation success confirmation
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useRepay } from '../../stores/repayStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { analytics } from '../../services/analyticsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';
import { useWallet } from '../../contexts/WalletContext';
import { registerVaultSettlementHistory } from '../../services/vaultSettlementHistoryService';

import type { StackScreenProps } from '@react-navigation/stack';

type RepayStackParamList = {
  RepayInput: undefined;
  RepayConfirm: undefined;
  RepayProcessing: undefined;
  RepaySuccess: { vaultTxid?: string };
};

type RepaySuccessScreenProps = StackScreenProps<RepayStackParamList, 'RepaySuccess'>;

export default function RepaySuccessScreen({ navigation, route }: RepaySuccessScreenProps) {
  const { vaultTxid: storeVaultTxid, repayAmountUsd, reset } = useRepay();
  const { wallet } = useWallet();
  const {
    kind,
    payoutAsset,
    payoutAmount,
    error: settlementError,
    reset: resetSettlement,
  } = useVaultSettlementStore();

  const vaultTxid = route.params?.vaultTxid || storeVaultTxid || '';

  useEffect(() => {
    if (vaultTxid) {
      analytics.trackTransaction(VAULT_EVENTS.VAULT_OPERATION_COMPLETED, vaultTxid, {
        operation: 'repay',
        amount: repayAmountUsd,
        unit: 'USD',
      });
    }

    if (wallet?.taprootPubkey && vaultTxid && kind === 'repay' && payoutAsset === 'USDC') {
      registerVaultSettlementHistory({
        vaultPubkey: wallet.taprootPubkey,
        action: 'repay_from_usdc',
        amountUsd: Number.parseFloat(payoutAmount || '') || repayAmountUsd,
        txid: vaultTxid,
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

  const repaidFromUsdc = kind === 'repay' && payoutAsset === 'USDC' && payoutAmount;
  const successUnit = repaidFromUsdc ? 'USDC' : 'USD';
  const successAmount = repaidFromUsdc ? Number.parseFloat(payoutAmount) || repayAmountUsd : repayAmountUsd;
  const titleOverride = repaidFromUsdc ? 'Repayment Complete!' : undefined;
  const messageOverride = repaidFromUsdc
    ? 'USDC was swapped back into UNIT and the released UNIT repaid your vault on Mutinynet.'
    : settlementError || undefined;

  return (
    <VaultActionSuccess
      actionType="repay"
      amount={successAmount}
      usdValue={repayAmountUsd}
      txid={vaultTxid}
      unit={successUnit}
      titleOverride={titleOverride}
      messageOverride={messageOverride}
      onDone={handleDone}
    />
  );
}
