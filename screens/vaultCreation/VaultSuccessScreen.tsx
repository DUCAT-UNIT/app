/**
 * VaultSuccessScreen - Vault creation success confirmation
 * Uses shared VaultActionSuccess component for consistency
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess from '../../components/vault/VaultActionSuccess';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { useWallet } from '../../contexts/WalletContext';
import { usePrice } from '../../stores/priceStore';
import { analytics } from '../../services/analyticsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';
import { registerVaultSettlementHistory } from '../../services/vaultSettlementHistoryService';

import type { VaultCreateStackParamList } from '../../navigation/types';
import type { StackScreenProps } from '@react-navigation/stack';

type VaultSuccessScreenProps = StackScreenProps<VaultCreateStackParamList, 'VaultSuccess'>;

export default function VaultSuccessScreen({ navigation, route }: VaultSuccessScreenProps) {
  const { txid: storeTxid, btcAmount, reset } = useVaultCreation();
  const { wallet } = useWallet();
  const {
    phase,
    payoutAsset,
    payoutAmount,
    error: settlementError,
    reset: resetSettlement,
  } = useVaultSettlementStore();
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

    if (wallet?.taprootPubkey && txid && payoutAsset === 'USDC' && payoutAmount) {
      registerVaultSettlementHistory({
        vaultPubkey: wallet.taprootPubkey,
        action: 'open_settled_to_usdc',
        amountUsd: Number.parseFloat(payoutAmount) || 0,
        txid,
      }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle done - reset state and go back to wallet
  const handleDone = useCallback(() => {
    resetSettlement();
    reset();
    // Navigate back to main screen
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }, [resetSettlement, reset, navigation]);

  const successUnit = payoutAsset === 'USDC' ? 'USDC' : 'BTC';
  const successAmount =
    payoutAsset === 'USDC' && payoutAmount ? Number.parseFloat(payoutAmount) || btcAmountSats : btcAmountSats;
  const titleOverride =
    payoutAsset === 'USDC'
      ? 'Vault Created!'
      : phase === 'pending_settlement'
        ? 'Vault Created!'
        : phase === 'needs_retry'
          ? 'Vault Created!'
          : undefined;
  const messageOverride =
    payoutAsset === 'USDC'
      ? 'BTC collateral is locked and the issued UNIT settled to USDC on Sepolia.'
      : phase === 'pending_settlement'
        ? 'Vault created. Sepolia settlement is still processing in the background.'
        : phase === 'needs_retry'
          ? settlementError || 'Vault created. Automatic USDC settlement needs retry.'
          : undefined;

  return (
    <VaultActionSuccess
      actionType="create"
      amount={successAmount}
      usdValue={btcUsdValue}
      txid={txid}
      unit={successUnit}
      titleOverride={titleOverride}
      messageOverride={messageOverride}
      onDone={handleDone}
    />
  );
}
