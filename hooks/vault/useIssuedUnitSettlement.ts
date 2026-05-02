import * as bitcoin from 'bitcoinjs-lib';
import { useCallback } from 'react';
import type { SendIntent } from '../../contexts/TransactionBuildContext';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { createBridgeIntent } from '../../services/bridgeApiService';
import { deriveSepoliaAccount } from '../../services/evmWalletService';
import { broadcastTransaction, createUnitIntent as createUnitIntentService, signIntent as signIntentService } from '../../services/transaction';
import { useNotificationStore } from '../../stores/notificationStore';
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import { useVaultSettlementStore, type VaultSettlementKind, type VaultSettlementPayoutAsset } from '../../stores/vaultSettlementStore';
import type { PendingTransactionOutput } from '../../stores/pendingTransactionsStore';
import { ERRORS } from '../../utils/messages';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { useTransactionPolling } from '../useTransactionPolling';
import {
  formatVaultSettlementAmountInput,
  quoteVaultBorrowSettlement,
  waitForBridgeSettlement,
} from '../../services/vaultSettlementService';

const BRIDGE_SEND_BUILD_RETRY_MS = 2_500;
const BRIDGE_SEND_BUILD_TIMEOUT_MS = 90_000;

interface BridgeIntentUnconfirmedUtxo {
  txid: string;
  vout: number;
  value: number;
  runeAmount?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as { unref?: () => void }).unref?.();
  });
}

function isUnitAvailabilityError(error: unknown): boolean {
  return error instanceof Error && error.message === ERRORS.NO_UNIT_BALANCE;
}

function isBridgeSettlementPendingError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Bridge settlement is still processing.';
}

function getUnitIntentInputs(intent: SendIntent): Array<{ txid: string; vout: number }> {
  const inputs: Array<{ txid: string; vout: number }> = [];

  if (intent.assetType !== 'UNIT') {
    return inputs;
  }

  if (intent.runeUtxos?.length) {
    intent.runeUtxos.forEach((utxo) => {
      inputs.push({ txid: utxo.transaction, vout: utxo.vout });
    });
  } else if (intent.runeUtxo) {
    inputs.push({ txid: intent.runeUtxo.transaction, vout: intent.runeUtxo.vout });
  }

  if (intent.satUtxo) {
    inputs.push({ txid: intent.satUtxo.txid, vout: intent.satUtxo.vout });
  }

  return inputs;
}

function toBridgeIntentUnconfirmedUtxo(utxo: {
  txid: string;
  vout: number;
  value?: number;
  runeAmount?: number;
}): BridgeIntentUnconfirmedUtxo {
  return {
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value ?? 0,
    runeAmount: utxo.runeAmount,
  };
}

function getRuneChangeAmount(intent: SendIntent): number {
  if (intent.assetType !== 'UNIT' || !intent.amount) {
    return 0;
  }

  const totalRuneInput = intent.runeUtxos?.length
    ? intent.runeUtxos.reduce((sum, utxo) => sum + (utxo.runeAmount || 0), 0)
    : intent.runeUtxo?.runeAmount || 0;

  return totalRuneInput - intent.amount;
}

function buildVaultBridgeClientRequestId(
  kind: VaultSettlementKind,
  accountIndex: number,
  amountInput: string,
): string {
  const safeAmount = amountInput.replace(/[^0-9a-zA-Z]+/g, '_');
  return `vault_${kind}_${accountIndex}_${safeAmount}_${Date.now()}`;
}

interface ExtractPendingOutputsResult {
  outputs: PendingTransactionOutput[];
  spentInputs: Array<{ txid: string; vout: number }>;
  parentTxid: string | null;
}

function extractPendingOutputs(
  intent: SendIntent,
  signedTxHex: string,
  wallet: { segwitAddress?: string; taprootAddress?: string } | null,
  pendingTransactions: Record<string, { status: string }>,
): ExtractPendingOutputsResult {
  const tx = bitcoin.Transaction.fromHex(signedTxHex);
  const outputs: PendingTransactionOutput[] = [];
  const spentInputs: Array<{ txid: string; vout: number }> = [];
  let parentTxid: string | null = null;
  const runeChangeAmount = getRuneChangeAmount(intent);

  tx.ins.forEach((input) => {
    const inputTxid = Buffer.from(input.hash).reverse().toString('hex');
    const inputVout = input.index;
    spentInputs.push({ txid: inputTxid, vout: inputVout });

    if (!parentTxid && pendingTransactions[inputTxid]?.status === 'pending') {
      parentTxid = inputTxid;
    }
  });

  tx.outs.forEach((output, vout) => {
    try {
      const address = bitcoin.address.fromOutputScript(output.script, MUTINYNET_NETWORK);
      const isChange = address === wallet?.segwitAddress || address === wallet?.taprootAddress;

      if (!isChange) {
        return;
      }

      const changeOutput: PendingTransactionOutput = {
        address,
        value: Number(output.value),
        vout,
      };

      if (intent.assetType === 'UNIT' && vout === 0 && runeChangeAmount > 0) {
        changeOutput.runeAmount = runeChangeAmount;
      }

      outputs.push(changeOutput);
    } catch {
      // Ignore OP_RETURN and non-standard outputs.
    }
  });

  return { outputs, spentInputs, parentTxid };
}

interface IssuedUnitSettlementResult {
  status: 'settled' | 'pending_settlement' | 'needs_retry';
  payoutAsset?: VaultSettlementPayoutAsset;
  payoutAmount?: string | null;
  bridgeIntentId?: string;
  bridgeSendTxid?: string;
  error?: string;
}

export function useIssuedUnitSettlement() {
  const { wallet, currentAccount } = useWallet();
  const { fetchBalance } = useBalance();
  const { fetchTransactionHistory } = useTransactionHistory();
  const showSnackbar = useNotificationStore((state) => state.showSnackbar);
  const startPolling = useTransactionPolling().startPolling;

  const pendingTransactions = usePendingTransactionsStore((state) => state.pendingTransactions);
  const getUnconfirmedUTXOs = usePendingTransactionsStore((state) => state.getUnconfirmedUTXOs);
  const getSpentUtxos = usePendingTransactionsStore((state) => state.getSpentUtxos);
  const markUtxoAsSpent = usePendingTransactionsStore((state) => state.markUtxoAsSpent);
  const markUtxosAsSpent = usePendingTransactionsStore((state) => state.markUtxosAsSpent);
  const unmarkUtxosAsSpent = usePendingTransactionsStore((state) => state.unmarkUtxosAsSpent);
  const addPendingTransaction = usePendingTransactionsStore((state) => state.addPendingTransaction);
  const confirmTransaction = usePendingTransactionsStore((state) => state.confirmTransaction);

  const setQuote = useVaultSettlementStore((state) => state.setQuote);
  const setPhase = useVaultSettlementStore((state) => state.setPhase);
  const setBridgeClientRequestId = useVaultSettlementStore((state) => state.setBridgeClientRequestId);
  const setBridgeIntent = useVaultSettlementStore((state) => state.setBridgeIntent);
  const setBridgeSendTxid = useVaultSettlementStore((state) => state.setBridgeSendTxid);
  const completeSettlement = useVaultSettlementStore((state) => state.completeSettlement);
  const markPendingSettlement = useVaultSettlementStore((state) => state.markPendingSettlement);
  const markNeedsRetry = useVaultSettlementStore((state) => state.markNeedsRetry);

  const quoteBorrowToUsdc = useCallback(
    async (amountUsd: number): Promise<{ estimatedUsdcOut: string; minimumUsdcOut: string }> => {
      const quote = await quoteVaultBorrowSettlement(amountUsd);
      setQuote(quote.estimatedUsdcOut, quote.minimumUsdcOut);
      return quote;
    },
    [setQuote],
  );

  const buildBridgeSendIntent = useCallback(
    async (depositAddress: string, amountInput: string): Promise<SendIntent> => {
      if (!wallet?.taprootAddress || !wallet?.segwitAddress) {
        throw new Error('Wallet not connected');
      }

      const deadline = Date.now() + BRIDGE_SEND_BUILD_TIMEOUT_MS;
      let lastError: unknown = null;

      while (Date.now() < deadline) {
        try {
          return await createUnitIntentService(
            depositAddress,
            amountInput,
            wallet.taprootAddress,
            wallet.segwitAddress,
            currentAccount,
            getUnconfirmedUTXOs('taproot').map(toBridgeIntentUnconfirmedUtxo),
            getUnconfirmedUTXOs('segwit').map(toBridgeIntentUnconfirmedUtxo),
            getSpentUtxos(),
          );
        } catch (error) {
          lastError = error;
          if (!isUnitAvailabilityError(error)) {
            throw error;
          }

          logger.info('[VaultSettlement] Waiting for freshly issued UNIT to become spendable', {
            amountInput,
          });
          await delay(BRIDGE_SEND_BUILD_RETRY_MS);
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error('Unable to prepare the bridge settlement send');
    },
    [currentAccount, getSpentUtxos, getUnconfirmedUTXOs, wallet?.segwitAddress, wallet?.taprootAddress],
  );

  const settleIssuedUnitToUsdc = useCallback(
    async (kind: VaultSettlementKind, faceValueUsd: number): Promise<IssuedUnitSettlementResult> => {
      if (!wallet?.taprootAddress || !wallet?.segwitAddress) {
        throw new Error('Wallet not connected');
      }

      const amountInput = formatVaultSettlementAmountInput(faceValueUsd);
      const quote = await quoteBorrowToUsdc(faceValueUsd);
      const sepoliaAccount = await deriveSepoliaAccount(currentAccount);
      let bridgeIntentId: string | undefined;
      let broadcastedBridgeSendTxid: string | null = null;

      try {
        setPhase('creating_bridge');
        const bridgeClientRequestId =
          useVaultSettlementStore.getState().bridgeClientRequestId ||
          buildVaultBridgeClientRequestId(kind, currentAccount, amountInput);
        setBridgeClientRequestId(bridgeClientRequestId);
        const intent = await createBridgeIntent({
          amount: amountInput,
          autoSwap: true,
          clientRequestId: bridgeClientRequestId,
          sepoliaRecipient: sepoliaAccount.address,
        });
        bridgeIntentId = intent.id;
        setBridgeIntent(intent.id, intent.depositAddress);

        setPhase('building_bridge_send');
        const bridgeSendIntent = await buildBridgeSendIntent(intent.depositAddress, amountInput);
        const inputsToLock = getUnitIntentInputs(bridgeSendIntent);
        if (inputsToLock.length > 0) {
          await markUtxosAsSpent(inputsToLock);
        }

        try {
          setPhase('signing_bridge_send');
          const signed = await signIntentService(bridgeSendIntent, currentAccount);
          const signedIntent: SendIntent = {
            ...bridgeSendIntent,
            signedTxHex: signed.signedTxHex,
            txid: signed.txid,
          };

          setPhase('broadcasting_bridge_send');
          broadcastedBridgeSendTxid = await broadcastTransaction(signed.signedTxHex);
          const finalBridgeSendTxid = broadcastedBridgeSendTxid;
          setBridgeSendTxid(finalBridgeSendTxid);

          const { outputs, spentInputs, parentTxid } = extractPendingOutputs(
            signedIntent,
            signed.signedTxHex,
            wallet,
            pendingTransactions,
          );

          for (const spentInput of spentInputs) {
            if (pendingTransactions[spentInput.txid]?.status === 'pending') {
              await markUtxoAsSpent(spentInput.txid, spentInput.vout);
            }
          }

          await addPendingTransaction(
            finalBridgeSendTxid,
            outputs,
            'UNIT',
            parentTxid,
            Math.round(faceValueUsd * 100),
            spentInputs,
          );

          startPolling(
            finalBridgeSendTxid,
            () => {
              confirmTransaction(finalBridgeSendTxid).catch(() => undefined);
              fetchBalance().catch(() => undefined);
              fetchTransactionHistory?.().catch(() => undefined);
            },
            () => {
              fetchBalance().catch(() => undefined);
              fetchTransactionHistory?.().catch(() => undefined);
            },
          );

          setPhase('waiting_bridge_fulfillment');
          const settledIntent = await waitForBridgeSettlement(intent.id);

          if (settledIntent.status === 'failed') {
            throw new Error(settledIntent.error || 'Bridge settlement failed');
          }

          const payoutAsset = settledIntent.payoutAsset || (settledIntent.status === 'fulfilled' ? 'USDC' : 'wUNIT');
          const payoutAmount =
            settledIntent.payoutAmount ||
            settledIntent.fulfilledAmount ||
            (payoutAsset === 'USDC' ? quote.estimatedUsdcOut : amountInput);

          completeSettlement(payoutAsset, payoutAmount, settledIntent.sepoliaTxHash || null);

          return {
            status: 'settled',
            payoutAsset,
            payoutAmount,
            bridgeIntentId: intent.id,
            bridgeSendTxid: finalBridgeSendTxid,
          };
        } catch (error) {
          if (!broadcastedBridgeSendTxid && inputsToLock.length > 0) {
            await unmarkUtxosAsSpent(inputsToLock);
          }
          throw error;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to settle issued UNIT to USDC';
        logger.error('[VaultSettlement] Settlement error', {
          kind,
          message,
        });

        if (isBridgeSettlementPendingError(error)) {
          markPendingSettlement(message);
          showSnackbar({
            title: 'USDC settlement still processing',
            description: 'The vault action succeeded. USDC settlement is still catching up.',
            type: 'info',
            duration: 7000,
          });
          return {
            status: 'pending_settlement',
            ...(bridgeIntentId ? { bridgeIntentId } : {}),
            ...(broadcastedBridgeSendTxid ? { bridgeSendTxid: broadcastedBridgeSendTxid } : {}),
            error: message,
          };
        }

        markNeedsRetry(message);
        showSnackbar({
          title: 'Settlement needs retry',
          description: 'The vault action succeeded, but automatic USDC settlement needs retry.',
          type: 'warning',
          duration: 7000,
        });
        return {
          status: 'needs_retry',
          ...(bridgeIntentId ? { bridgeIntentId } : {}),
          ...(broadcastedBridgeSendTxid ? { bridgeSendTxid: broadcastedBridgeSendTxid } : {}),
          error: message,
        };
      }
    },
    [
      wallet,
      quoteBorrowToUsdc,
      currentAccount,
      setPhase,
      setBridgeClientRequestId,
      setBridgeIntent,
      buildBridgeSendIntent,
      markUtxosAsSpent,
      setBridgeSendTxid,
      pendingTransactions,
      addPendingTransaction,
      startPolling,
      confirmTransaction,
      fetchBalance,
      fetchTransactionHistory,
      completeSettlement,
      unmarkUtxosAsSpent,
      markUtxoAsSpent,
      markPendingSettlement,
      markNeedsRetry,
      showSnackbar,
    ],
  );

  return {
    quoteBorrowToUsdc,
    settleIssuedUnitToUsdc,
  };
}
