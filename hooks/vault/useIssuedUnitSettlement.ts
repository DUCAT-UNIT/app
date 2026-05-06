import * as bitcoin from 'bitcoinjs-lib';
import { useCallback } from 'react';
import type { SendIntent } from '../../contexts/TransactionBuildContext';
import { useCashuOperations } from '../../contexts/CashuContext';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import {
  checkMintStatus,
  completeMint,
  requestMint,
  type CashuProof,
} from '../../services/cashu/cashuWalletService';
import { createBridgeIntent } from '../../services/bridgeApiService';
import { deriveSepoliaAccount } from '../../services/evmWalletService';
import { broadcastTransaction, createUnitIntent as createUnitIntentService, signIntent as signIntentService } from '../../services/transaction';
import { useNotificationStore } from '../../stores/notificationStore';
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import {
  persistVaultSettlementNow,
  useVaultSettlementStore,
  type VaultSettlementKind,
  type VaultSettlementPayoutAsset,
} from '../../stores/vaultSettlementStore';
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
const CASHU_MINT_POLL_INTERVAL_MS = 4_000;
const CASHU_MINT_COMPLETION_TIMEOUT_MS = 720_000;

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

function isTurboMintPendingError(error: unknown): boolean {
  return error instanceof Error && error.message === 'TurboUNIT mint is still processing.';
}

function sumCashuProofs(proofs: CashuProof[]): number {
  return proofs.reduce((sum, proof) => sum + proof.amount, 0);
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

function getSignedTransactionId(signedTxHex: string, fallbackTxid: string): string {
  try {
    const tx = bitcoin.Transaction.fromHex(signedTxHex);
    return typeof tx.getId === 'function' ? tx.getId() : fallbackTxid;
  } catch {
    return fallbackTxid;
  }
}

interface IssuedUnitSettlementResult {
  status: 'settled' | 'pending_settlement' | 'needs_retry';
  payoutAsset?: VaultSettlementPayoutAsset;
  payoutAmount?: string | null;
  bridgeIntentId?: string;
  bridgeSendTxid?: string;
  cashuMintQuoteId?: string;
  cashuMintSendTxid?: string;
  error?: string;
}

export function useIssuedUnitSettlement() {
  const { wallet, currentAccount } = useWallet();
  const { fetchBalance } = useBalance();
  const { fetchTransactionHistory } = useTransactionHistory();
  const { refresh: refreshCashuBalance } = useCashuOperations();
  const showSnackbar = useNotificationStore((state) => state.showSnackbar);
  const startPolling = useTransactionPolling().startPolling;

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
  const setCashuMintQuote = useVaultSettlementStore((state) => state.setCashuMintQuote);
  const setCashuMintSendTxid = useVaultSettlementStore((state) => state.setCashuMintSendTxid);
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

  const waitForCashuMintCompletion = useCallback(
    async (quoteId: string, fallbackAmount: number): Promise<number> => {
      const deadline = Date.now() + CASHU_MINT_COMPLETION_TIMEOUT_MS;

      while (Date.now() < deadline) {
        const status = await checkMintStatus(quoteId);
        const alreadyIssued = status.state === 'ISSUED' ||
          (
            (status.amountPaid ?? 0) > 0 &&
            (status.amountIssued ?? 0) >= (status.amountPaid ?? 0)
          );

        if (status.availableAmount > 0 || (!alreadyIssued && status.paid && status.state === 'PAID')) {
          const proofs = await completeMint(quoteId, status.availableAmount || fallbackAmount);
          await refreshCashuBalance().catch(() => undefined);
          return sumCashuProofs(proofs) || status.availableAmount || fallbackAmount;
        }

        if (alreadyIssued) {
          await refreshCashuBalance().catch(() => undefined);
          return status.amountIssued || fallbackAmount;
        }

        await delay(CASHU_MINT_POLL_INTERVAL_MS);
      }

      throw new Error('TurboUNIT mint is still processing.');
    },
    [refreshCashuBalance],
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
      let bridgeSendBroadcastAttempted = false;

      try {
        setPhase('creating_bridge');
        const bridgeClientRequestId =
          useVaultSettlementStore.getState().bridgeClientRequestId ||
          buildVaultBridgeClientRequestId(kind, currentAccount, amountInput);
        setBridgeClientRequestId(bridgeClientRequestId);
        await persistVaultSettlementNow();
        const intent = await createBridgeIntent({
          amount: amountInput,
          autoSwap: true,
          clientRequestId: bridgeClientRequestId,
          sepoliaRecipient: sepoliaAccount.address,
        });
        bridgeIntentId = intent.id;
        setBridgeIntent(intent.id, intent.depositAddress);
        await persistVaultSettlementNow();

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
          const preparedBridgeSendTxid = getSignedTransactionId(signed.signedTxHex, signed.txid);
          broadcastedBridgeSendTxid = preparedBridgeSendTxid;
          setBridgeSendTxid(preparedBridgeSendTxid);
          await persistVaultSettlementNow();

          const livePendingTransactions = usePendingTransactionsStore.getState().pendingTransactions;
          const { outputs, spentInputs, parentTxid } = extractPendingOutputs(
            signedIntent,
            signed.signedTxHex,
            wallet,
            livePendingTransactions,
          );

          for (const spentInput of spentInputs) {
            if (livePendingTransactions[spentInput.txid]?.status === 'pending') {
              await markUtxoAsSpent(spentInput.txid, spentInput.vout);
            }
          }

          await addPendingTransaction(
            preparedBridgeSendTxid,
            outputs,
            'UNIT',
            parentTxid,
            Math.round(faceValueUsd * 100),
            spentInputs,
          );

          setPhase('broadcasting_bridge_send');
          bridgeSendBroadcastAttempted = true;
          const finalBridgeSendTxid = await broadcastTransaction(signed.signedTxHex);
          broadcastedBridgeSendTxid = finalBridgeSendTxid;
          if (finalBridgeSendTxid !== preparedBridgeSendTxid) {
            setBridgeSendTxid(finalBridgeSendTxid);
            await persistVaultSettlementNow();
          }

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
          await persistVaultSettlementNow();

          return {
            status: 'settled',
            payoutAsset,
            payoutAmount,
            bridgeIntentId: intent.id,
            bridgeSendTxid: finalBridgeSendTxid,
          };
        } catch (error) {
          if (!bridgeSendBroadcastAttempted) {
            if (broadcastedBridgeSendTxid) {
              broadcastedBridgeSendTxid = null;
              setBridgeSendTxid(null);
              await persistVaultSettlementNow().catch((persistError) => {
                logger.error('[VaultSettlement] Failed to clear unbroadcast bridge send txid', {
                  error: persistError instanceof Error ? persistError.message : String(persistError),
                });
              });
            }
            if (inputsToLock.length > 0) {
              await unmarkUtxosAsSpent(inputsToLock);
            }
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
          await persistVaultSettlementNow();
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
        await persistVaultSettlementNow();
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

  const settleIssuedUnitToTurboUnit = useCallback(
    async (kind: VaultSettlementKind, faceValueUsd: number): Promise<IssuedUnitSettlementResult> => {
      if (!wallet?.taprootAddress || !wallet?.segwitAddress) {
        throw new Error('Wallet not connected');
      }

      const amountInput = formatVaultSettlementAmountInput(faceValueUsd);
      const amountSmallestUnits = Math.round(faceValueUsd * 100);
      let cashuMintQuoteId: string | undefined;
      let broadcastedMintSendTxid: string | null = null;
      let mintSendBroadcastAttempted = false;

      try {
        const persistedSettlement = useVaultSettlementStore.getState();
        cashuMintQuoteId = persistedSettlement.cashuMintQuoteId || undefined;
        let cashuMintDepositAddress = persistedSettlement.cashuMintDepositAddress || undefined;
        broadcastedMintSendTxid = persistedSettlement.cashuMintSendTxid;

        if (!cashuMintQuoteId || !cashuMintDepositAddress) {
          setPhase('creating_turbo_mint');
          const quote = await requestMint(amountSmallestUnits);
          cashuMintQuoteId = quote.quoteId;
          cashuMintDepositAddress = quote.depositAddress;
          setCashuMintQuote(quote.quoteId, quote.depositAddress);
          await persistVaultSettlementNow();
        }

        if (!broadcastedMintSendTxid) {
          setPhase('building_turbo_send');
          const mintSendIntent = await buildBridgeSendIntent(cashuMintDepositAddress, amountInput);
          const inputsToLock = getUnitIntentInputs(mintSendIntent);
          if (inputsToLock.length > 0) {
            await markUtxosAsSpent(inputsToLock);
          }

          try {
            setPhase('signing_turbo_send');
            const signed = await signIntentService(mintSendIntent, currentAccount);
            const signedIntent: SendIntent = {
            ...mintSendIntent,
            signedTxHex: signed.signedTxHex,
            txid: signed.txid,
          };
            const preparedMintSendTxid = getSignedTransactionId(signed.signedTxHex, signed.txid);
            broadcastedMintSendTxid = preparedMintSendTxid;
            setCashuMintSendTxid(preparedMintSendTxid);
            await persistVaultSettlementNow();

            const livePendingTransactions = usePendingTransactionsStore.getState().pendingTransactions;
            const { outputs, spentInputs, parentTxid } = extractPendingOutputs(
              signedIntent,
              signed.signedTxHex,
              wallet,
              livePendingTransactions,
            );

            for (const spentInput of spentInputs) {
              if (livePendingTransactions[spentInput.txid]?.status === 'pending') {
                await markUtxoAsSpent(spentInput.txid, spentInput.vout);
              }
            }

            await addPendingTransaction(
              preparedMintSendTxid,
              outputs,
              'UNIT',
              parentTxid,
              amountSmallestUnits,
              spentInputs,
              { displayKind: 'turbo_mint_claim' },
            );

            setPhase('broadcasting_turbo_send');
            mintSendBroadcastAttempted = true;
            const finalMintSendTxid = await broadcastTransaction(signed.signedTxHex);
            broadcastedMintSendTxid = finalMintSendTxid;
            if (finalMintSendTxid !== preparedMintSendTxid) {
              setCashuMintSendTxid(finalMintSendTxid);
              await persistVaultSettlementNow();
            }

            startPolling(
              finalMintSendTxid,
              () => {
                confirmTransaction(finalMintSendTxid).catch(() => undefined);
                fetchBalance().catch(() => undefined);
                fetchTransactionHistory?.().catch(() => undefined);
              },
              () => {
                fetchBalance().catch(() => undefined);
                fetchTransactionHistory?.().catch(() => undefined);
              },
            );
          } catch (error) {
            if (!mintSendBroadcastAttempted) {
              if (broadcastedMintSendTxid) {
                broadcastedMintSendTxid = null;
                setCashuMintSendTxid(null);
                await persistVaultSettlementNow().catch((persistError) => {
                  logger.error('[VaultSettlement] Failed to clear unbroadcast Turbo mint send txid', {
                    error: persistError instanceof Error ? persistError.message : String(persistError),
                  });
                });
              }
              if (inputsToLock.length > 0) {
                await unmarkUtxosAsSpent(inputsToLock);
              }
            }
            throw error;
          }
        }

        setPhase('waiting_turbo_mint');
        const mintedAmount = await waitForCashuMintCompletion(cashuMintQuoteId, amountSmallestUnits);
        const payoutAmount = formatVaultSettlementAmountInput(mintedAmount / 100);

        if (broadcastedMintSendTxid) {
          await confirmTransaction(broadcastedMintSendTxid).catch(() => undefined);
          await fetchBalance().catch(() => undefined);
          await fetchTransactionHistory?.().catch(() => undefined);
        }

        completeSettlement('TURBOUNIT', payoutAmount);
        await persistVaultSettlementNow();

        return {
          status: 'settled',
          payoutAsset: 'TURBOUNIT',
          payoutAmount,
          cashuMintQuoteId,
          ...(broadcastedMintSendTxid ? { cashuMintSendTxid: broadcastedMintSendTxid } : {}),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to settle issued UNIT to TurboUNIT';
        logger.error('[VaultSettlement] TurboUNIT settlement error', {
          kind,
          message,
        });

        if (isTurboMintPendingError(error)) {
          markPendingSettlement(message);
          await persistVaultSettlementNow();
          showSnackbar({
            title: 'TurboUNIT mint still processing',
            description: 'The vault action succeeded. TurboUNIT minting is still catching up.',
            type: 'info',
            duration: 7000,
          });
          return {
            status: 'pending_settlement',
            ...(cashuMintQuoteId ? { cashuMintQuoteId } : {}),
            ...(broadcastedMintSendTxid ? { cashuMintSendTxid: broadcastedMintSendTxid } : {}),
            error: message,
          };
        }

        markNeedsRetry(message);
        await persistVaultSettlementNow();
        showSnackbar({
          title: 'Settlement needs retry',
          description: 'The vault action succeeded, but automatic TurboUNIT settlement needs retry.',
          type: 'warning',
          duration: 7000,
        });
        return {
          status: 'needs_retry',
          ...(cashuMintQuoteId ? { cashuMintQuoteId } : {}),
          ...(broadcastedMintSendTxid ? { cashuMintSendTxid: broadcastedMintSendTxid } : {}),
          error: message,
        };
      }
    },
    [
      wallet,
      currentAccount,
      setPhase,
      setCashuMintQuote,
      setCashuMintSendTxid,
      buildBridgeSendIntent,
      markUtxosAsSpent,
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
      waitForCashuMintCompletion,
    ],
  );

  return {
    quoteBorrowToUsdc,
    settleIssuedUnitToUsdc,
    settleIssuedUnitToTurboUnit,
  };
}
