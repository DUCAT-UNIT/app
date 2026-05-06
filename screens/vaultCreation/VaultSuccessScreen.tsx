/**
 * VaultSuccessScreen - Vault creation success confirmation
 * Uses shared VaultActionSuccess component for consistency
 */

import React, { useCallback, useEffect } from 'react';
import VaultActionSuccess, { buildVaultSuccessTxItems } from '../../components/vault/VaultActionSuccess';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import {
  shouldPreserveVaultSettlementRecovery,
  useVaultSettlementStore,
} from '../../stores/vaultSettlementStore';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useWallet } from '../../contexts/WalletContext';
import { usePrice } from '../../stores/priceStore';
import { analytics } from '../../services/analyticsService';
import { VAULT_EVENTS } from '../../constants/analyticsEvents';
import { registerVaultSettlementHistory } from '../../services/vaultSettlementHistoryService';

import type { VaultCreateStackParamList } from '../../navigation/types';
import type { StackScreenProps } from '@react-navigation/stack';

type VaultSuccessScreenProps = StackScreenProps<VaultCreateStackParamList, 'VaultSuccess'>;

export default function VaultSuccessScreen({ navigation, route }: VaultSuccessScreenProps) {
  const { txid: storeTxid, btcAmount, borrowAmountUsd, reset } = useVaultCreation();
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
  const { btcPrice } = usePrice();

  const txid = route.params?.txid || storeTxid || '';
  const showUsdcSettlementCopy = settingsHandlers.usdcFeaturesEnabled;
  const showUsdcPayout = showUsdcSettlementCopy && payoutAsset === 'USDC';
  const showWrappedUnitPayout = showUsdcSettlementCopy && payoutAsset === 'wUNIT';
  const showTurboUnitPayout = payoutAsset === 'TURBOUNIT';

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
    if (!shouldPreserveVaultSettlementRecovery(phase)) {
      resetSettlement();
    }
    reset();
    // Navigate back to main screen
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }, [phase, resetSettlement, reset, navigation]);

  const successUnit =
    showUsdcPayout
      ? 'USDC'
      : payoutAsset === 'UNIT'
        ? 'UNIT'
        : showTurboUnitPayout
          ? 'TURBOUNIT'
        : showWrappedUnitPayout
          ? 'wUNIT'
        : 'BTC';
  const successAmount =
    (showUsdcPayout || showWrappedUnitPayout || showTurboUnitPayout || payoutAsset === 'UNIT') && payoutAmount
      ? Number.parseFloat(payoutAmount) || btcAmountSats
      : btcAmountSats;
  const titleOverride =
    showUsdcPayout
      ? 'Vault Created!'
      : payoutAsset === 'UNIT'
        ? 'UNIT Received!'
        : showTurboUnitPayout
          ? 'TurboUNIT Received!'
        : showWrappedUnitPayout
          ? 'wUNIT Received!'
      : phase === 'pending_settlement'
        ? 'Vault Created!'
        : phase === 'needs_retry'
          ? 'Vault Created!'
          : undefined;
  const messageOverride =
    showUsdcPayout
      ? 'BTC collateral is locked and the issued UNIT settled to Sepolia USDC.'
      : payoutAsset === 'UNIT'
        ? 'BTC collateral is locked and the issued UNIT is now available in your wallet.'
        : showTurboUnitPayout
          ? 'BTC collateral is locked and the issued UNIT was minted into TurboUNIT.'
        : showWrappedUnitPayout
          ? 'BTC collateral is locked. Auto-swap could not clear safely, so the issued UNIT was credited as wUNIT on Sepolia.'
      : phase === 'pending_settlement'
        ? showUsdcSettlementCopy
          ? 'Vault created. Sepolia settlement is still processing in the background.'
          : 'Vault created. Settlement is still processing in the background.'
      : phase === 'needs_retry'
          ? showUsdcSettlementCopy
            ? settlementError || 'Vault created. Automatic Sepolia USDC settlement needs retry.'
            : 'Vault created. Automatic settlement needs retry.'
          : undefined;
  const txItems = buildVaultSuccessTxItems({
    mutinynetTxid: txid,
    turboMintSendTxid: showTurboUnitPayout ? cashuMintSendTxid : null,
    sepoliaTxHash,
    includeSepolia: showUsdcPayout,
  });

  return (
    <VaultActionSuccess
      actionType="create"
      amount={successAmount}
      usdValue={payoutAsset === 'UNIT' || showWrappedUnitPayout || showTurboUnitPayout ? borrowAmountUsd : btcUsdValue}
      txid={txid}
      unit={successUnit}
      titleOverride={titleOverride}
      messageOverride={messageOverride}
      txItems={txItems}
      onDone={handleDone}
    />
  );
}
