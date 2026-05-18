import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PinFallbackModal from '../../components/auth/PinFallbackModal';
import Icon from '../../components/icons';
import FeeBreakdown from '../../components/review/FeeBreakdown';
import { InputOutputList } from '../../components/review/InputOutputList';
import TransactionSummary from '../../components/review/TransactionSummary';
import UnconfirmedWarning from '../../components/review/UnconfirmedWarning';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useReviewScreenData } from '../../hooks/useReviewScreenData';
import { createBridgeIntent } from '../../services/bridgeApiService';
import { authenticateWithBiometrics } from '../../services/biometricService';
import { verifyPin } from '../../services/pinService';
import { reconcileSubmittedEvmTransactionCheckpoints } from '../../services/evmTransactionCheckpointService';
import {
  classifyEvmExecutionError,
  estimateUsdcToUnitSwapExecution,
  executeUsdcToUnitSwap,
  getCrossChainSwapLimit,
  getEvmBalances,
  quoteUnitUsdcSwap,
  type CrossChainSwapAsset,
  type CrossChainSwapExecutionEstimate,
  type CrossChainSwapLimit,
  type CrossChainSwapQuote,
} from '../../services/evmBridgeService';
import { createUnitIntent as createUnitIntentService } from '../../services/transaction';
import type { BridgeIntent } from '../../shared/bridgeTypes';
import { useEvmTransactionCheckpointStore } from '../../stores/evmTransactionCheckpointStore';
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import { useSendFlow } from '../../stores/sendFlowStore';
import { registerSwapTxid } from '../../services/transactionHistoryService';
import { useNotifications } from '../../stores/notificationStore';
import { COLORS } from '../../theme';
import { logger } from '../../utils/logger';
import { releaseOrphanedUtxos } from '../../utils/pendingTransactionsUtils';
import type { PendingTransaction as UtilsPendingTransaction } from '../../utils/pendingTransactionsUtils';
import {
  describeEvmRecoveryCheckpoint,
  formatEvmCheckpointReconciliationSummary,
  selectSwapRecoveryCheckpoint,
  shortEvmTxHash,
} from '../../utils/evmCheckpointRecovery';
import type { UtxoRef } from '../../types/assets';

interface SwapSummaryScreenProps {
  route?: {
    params?: {
      amountIn?: string;
      sourceAsset?: CrossChainSwapAsset;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
    reset?: (state: { index: number; routes: Array<{ name: string; params?: object }> }) => void;
  };
}

type BridgePreparationState =
  | 'idle'
  | 'creating_intent'
  | 'syncing_send'
  | 'building_send'
  | 'ready'
  | 'failed';

type PendingPinAuthAction = 'bridge' | 'swap';

function resetToUnitAssetDetail(navigation: SwapSummaryScreenProps['navigation']): void {
  if (navigation.reset) {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'WalletHome' },
        { name: 'AssetDetail', params: { assetType: 'UNIT' } },
      ],
    });
    return;
  }

  navigation.navigate('AssetDetail', { assetType: 'UNIT' });
}

function formatTokenAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(numeric);
}

function formatEthAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0 ETH';
  }

  return `${numeric.toFixed(numeric < 0.001 ? 6 : 4)} ETH`;
}

function formatGasUnits(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(numeric);
}

function toUnitSmallestUnits(value: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(numeric * 100);
}

function isQuoteWorseThanMinimum(
  nextQuote: CrossChainSwapQuote,
  previousQuote: CrossChainSwapQuote
): boolean {
  const nextAmountOut = Number(nextQuote.amountOut);
  const previousMinimumOut = Number(previousQuote.minimumAmountOut);
  return (
    Number.isFinite(nextAmountOut) &&
    Number.isFinite(previousMinimumOut) &&
    nextAmountOut < previousMinimumOut
  );
}

function getUnitBalanceValue(
  runesBalance: Array<{ amount?: string | number } | unknown> | null | undefined
): number {
  if (!runesBalance || runesBalance.length === 0) {
    return 0;
  }

  const first = runesBalance[0];
  if (Array.isArray(first)) {
    return Number(first[1] || 0);
  }

  if (first && typeof first === 'object' && 'amount' in first) {
    return Number((first as { amount?: string | number }).amount || 0);
  }

  return 0;
}

function toTransactionBuilderUnconfirmedUtxo(utxo: {
  txid: string;
  vout: number;
  value?: number;
  runeAmount?: number;
}): { txid: string; vout: number; value: number; runeAmount?: number } {
  return {
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value ?? 0,
    runeAmount: utxo.runeAmount,
  };
}

function SummaryRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, emphasized && styles.summaryValueEmphasized]}>
        {value}
      </Text>
    </View>
  );
}

export default function SwapSummaryScreen({
  route,
  navigation,
}: SwapSummaryScreenProps): React.JSX.Element {
  const { wallet, currentAccount } = useWallet();
  const { runesBalance } = useBalance();
  const { fetchTransactionHistory } = useTransactionHistory();
  const { showToast } = useNotifications();
  const { cancelIntent, setSendIntent } = useTransactionBuild();
  const { signIntent } = useTransactionExecution();
  const evmCheckpoints = useEvmTransactionCheckpointStore((state) => state.checkpoints);
  const getUnconfirmedUTXOs = usePendingTransactionsStore((state) => state.getUnconfirmedUTXOs);
  const getSpentUtxos = usePendingTransactionsStore((state) => state.getSpentUtxos);
  const markUtxosAsSpent = usePendingTransactionsStore((state) => state.markUtxosAsSpent);
  const unmarkUtxosAsSpent = usePendingTransactionsStore((state) => state.unmarkUtxosAsSpent);
  const getPendingTransactionsForCleanup = useCallback(
    () =>
      (usePendingTransactionsStore.getState?.()?.pendingTransactions ?? {}) as unknown as Record<
        string,
        UtilsPendingTransaction
      >,
    []
  );
  const {
    selectedFeeRate,
    setIntentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
    setTurboEnabled,
  } = useSendFlow();
  const {
    sendIntent: reviewSendIntent,
    btcPrice,
    isDetailsExpanded,
    setIsDetailsExpanded,
    runeUtxoBalance,
    hasUnconfirmedInputs,
    displayAmount,
    usdAmount,
    psbtInputs,
    outputs,
    actualFee,
  } = useReviewScreenData();

  const sourceAsset = route?.params?.sourceAsset === 'USDC' ? 'USDC' : 'UNIT';
  const amountIn = route?.params?.amountIn || '';
  const destinationAsset: CrossChainSwapAsset = sourceAsset === 'UNIT' ? 'USDC' : 'UNIT';
  const isBridgeDirection = sourceAsset === 'UNIT';

  const [quote, setQuote] = useState<CrossChainSwapQuote | null>(null);
  const [limit, setLimit] = useState<CrossChainSwapLimit | null>(null);
  const [estimate, setEstimate] = useState<CrossChainSwapExecutionEstimate | null>(null);
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [sepoliaAddress, setSepoliaAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [bridgeIntent, setBridgeIntent] = useState<BridgeIntent | null>(null);
  const [bridgePreparationState, setBridgePreparationState] =
    useState<BridgePreparationState>('idle');
  const [bridgePreparationError, setBridgePreparationError] = useState<string | null>(null);
  const [swapLoadError, setSwapLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [checkpointReconciling, setCheckpointReconciling] = useState(false);
  const [checkpointRecoveryMessage, setCheckpointRecoveryMessage] = useState<string | null>(null);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pinFallbackError, setPinFallbackError] = useState<string | null>(null);
  const [pendingPinAuthAction, setPendingPinAuthAction] = useState<PendingPinAuthAction | null>(
    null
  );
  const isMountedRef = useRef(true);
  const bridgeIntentPrepKeyRef = useRef<string | null>(null);
  const bridgeSendBuildKeyRef = useRef<string | null>(null);
  const pendingSigningQuoteRef = useRef<CrossChainSwapQuote | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    bridgeIntentPrepKeyRef.current = null;
    bridgeSendBuildKeyRef.current = null;
    setBridgeIntent(null);
    setBridgePreparationState('idle');
    setBridgePreparationError(null);
  }, [amountIn, sourceAsset]);

  useEffect(() => {
    if (!amountIn || Number(amountIn) <= 0) {
      setLoading(false);
      setQuote(null);
      setLimit(null);
      setEstimate(null);
      return undefined;
    }

    let active = true;

    const load = async (): Promise<void> => {
      try {
        setLoading(true);
        setSwapLoadError(null);
        const [nextQuote, nextLimit, balances] = await Promise.all([
          quoteUnitUsdcSwap(sourceAsset, amountIn),
          getCrossChainSwapLimit(),
          getEvmBalances(currentAccount),
        ]);

        if (!active) {
          return;
        }

        setQuote(nextQuote);
        setLimit(nextLimit);
        setEthBalance(balances.eth);
        setSepoliaAddress(balances.address);

        if (!isBridgeDirection && wallet?.taprootAddress) {
          const nextEstimate = await estimateUsdcToUnitSwapExecution(
            currentAccount,
            amountIn,
            wallet.taprootAddress
          );

          if (active) {
            setEstimate(nextEstimate);
          }
        } else if (active) {
          setEstimate(null);
        }
      } catch (error) {
        if (active) {
          setEstimate(null);
          setSwapLoadError(
            error instanceof Error ? error.message : 'Unable to load the live swap quote and costs.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [
    amountIn,
    currentAccount,
    isBridgeDirection,
    reloadNonce,
    sourceAsset,
    wallet?.taprootAddress,
  ]);

  useEffect(() => {
    if (!isBridgeDirection || !amountIn || Number(amountIn) <= 0 || !sepoliaAddress) {
      return undefined;
    }

    const prepKey = `${sourceAsset}:${amountIn}:${sepoliaAddress}`;
    if (bridgeIntentPrepKeyRef.current === prepKey) {
      return undefined;
    }
    bridgeIntentPrepKeyRef.current = prepKey;

    const prepareBridgeReview = async (): Promise<void> => {
      try {
        logger.info('[SwapSummary] Starting bridge intent prep', {
          amountIn,
          sepoliaAddress,
          sourceAsset,
        });
        setBridgePreparationState('creating_intent');
        setBridgePreparationError(null);

        const nextIntent = await createBridgeIntent({
          amount: amountIn,
          autoSwap: true,
          sepoliaRecipient: sepoliaAddress,
        });

        if (!isMountedRef.current || bridgeIntentPrepKeyRef.current !== prepKey) {
          return;
        }

        logger.info('[SwapSummary] Bridge intent ready on summary screen', {
          depositAddress: nextIntent.depositAddress,
          intentId: nextIntent.id,
        });
        setBridgeIntent(nextIntent);
        setBridgePreparationState('syncing_send');
      } catch (error) {
        if (!isMountedRef.current || bridgeIntentPrepKeyRef.current !== prepKey) {
          return;
        }

        logger.error(error, {
          amountIn,
          phase: 'creating_intent',
          screen: 'SwapSummary',
        });
        setBridgePreparationError(
          error instanceof Error ? error.message : 'Unable to prepare the bridge review.'
        );
        setBridgePreparationState('failed');
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      prepareBridgeReview().catch(() => undefined);
    });

    return () => {
      task.cancel();
    };
  }, [
    amountIn,
    isBridgeDirection,
    sepoliaAddress,
    sourceAsset,
    setIntentStep,
    setSendAmount,
    setSendAssetType,
    setSendRecipient,
    setSendIntent,
    setTurboEnabled,
  ]);

  useEffect(() => {
    if (!isBridgeDirection || !bridgeIntent || bridgePreparationState !== 'syncing_send') {
      return;
    }

    const buildKey = bridgeIntent.id;
    if (bridgeSendBuildKeyRef.current === buildKey) {
      return;
    }

    if (!wallet?.taprootAddress || !wallet?.segwitAddress) {
      return;
    }
    bridgeSendBuildKeyRef.current = buildKey;

    const prepareBridgeSendReview = async (): Promise<void> => {
      let lockedUtxos: UtxoRef[] = [];

      try {
        logger.info('[SwapSummary] Starting local UNIT send build', {
          depositAddress: bridgeIntent.depositAddress,
          intentId: bridgeIntent.id,
        });
        setBridgePreparationState('building_send');

        await releaseOrphanedUtxos(
          getSpentUtxos,
          unmarkUtxosAsSpent,
          getPendingTransactionsForCleanup
        );

        const availableUnitBalance = getUnitBalanceValue(
          runesBalance as Array<{ amount?: string | number } | unknown> | null | undefined
        );
        if (!Number.isFinite(availableUnitBalance) || availableUnitBalance <= 0) {
          throw new Error('No UNIT balance available for the bridge send.');
        }

        const unconfirmedTaprootUtxos = getUnconfirmedUTXOs('taproot', null).map(
          toTransactionBuilderUnconfirmedUtxo
        );
        const unconfirmedSegwitUtxos = getUnconfirmedUTXOs('segwit', null).map(
          toTransactionBuilderUnconfirmedUtxo
        );
        const nextSendIntent = await createUnitIntentService(
          bridgeIntent.depositAddress,
          bridgeIntent.amount,
          wallet.taprootAddress,
          wallet.segwitAddress,
          currentAccount,
          unconfirmedTaprootUtxos,
          unconfirmedSegwitUtxos,
          getSpentUtxos()
        );

        const utxosToLock: UtxoRef[] = [];
        if (nextSendIntent.runeUtxos?.length) {
          nextSendIntent.runeUtxos.forEach((utxo) => {
            utxosToLock.push({ txid: utxo.transaction, vout: utxo.vout });
          });
        } else if (nextSendIntent.runeUtxo) {
          utxosToLock.push({
            txid: nextSendIntent.runeUtxo.transaction,
            vout: nextSendIntent.runeUtxo.vout,
          });
        }
        if (nextSendIntent.satUtxo) {
          utxosToLock.push({
            txid: nextSendIntent.satUtxo.txid,
            vout: nextSendIntent.satUtxo.vout,
          });
        }

        if (utxosToLock.length > 0) {
          lockedUtxos = utxosToLock;
          await markUtxosAsSpent(utxosToLock);
        }

        if (!isMountedRef.current || bridgeSendBuildKeyRef.current !== buildKey) {
          if (lockedUtxos.length > 0) {
            await unmarkUtxosAsSpent(lockedUtxos);
          }
          return;
        }

        logger.info('[SwapSummary] Local UNIT send review ready', {
          inputCount: nextSendIntent.runeUtxos?.length || (nextSendIntent.runeUtxo ? 1 : 0),
          intentId: nextSendIntent.id,
        });
        setSendAssetType('unit');
        setSendAmount(bridgeIntent.amount);
        setSendRecipient(bridgeIntent.depositAddress);
        setTurboEnabled(false);
        setSendIntent(nextSendIntent);
        setIntentStep('reviewing');
        setBridgePreparationState('ready');
      } catch (error) {
        if (lockedUtxos.length > 0) {
          await unmarkUtxosAsSpent(lockedUtxos);
        }
        await releaseOrphanedUtxos(
          getSpentUtxos,
          unmarkUtxosAsSpent,
          getPendingTransactionsForCleanup
        );

        if (!isMountedRef.current || bridgeSendBuildKeyRef.current !== buildKey) {
          return;
        }

        logger.error(error, {
          phase: 'building_send',
          screen: 'SwapSummary',
        });
        setBridgePreparationError(
          error instanceof Error ? error.message : 'Unable to build the UNIT send for this bridge.'
        );
        setBridgePreparationState('failed');
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      prepareBridgeSendReview().catch(() => undefined);
    });

    return () => {
      task.cancel();
    };
  }, [
    bridgeIntent,
    bridgePreparationState,
    currentAccount,
    getSpentUtxos,
    getPendingTransactionsForCleanup,
    getUnconfirmedUTXOs,
    isBridgeDirection,
    markUtxosAsSpent,
    runesBalance,
    setIntentStep,
    setSendAmount,
    setSendAssetType,
    setSendRecipient,
    setSendIntent,
    setTurboEnabled,
    unmarkUtxosAsSpent,
    wallet?.segwitAddress,
    wallet?.taprootAddress,
  ]);

  useEffect(() => {
    if (
      !isBridgeDirection ||
      bridgePreparationState === 'idle' ||
      bridgePreparationState === 'ready' ||
      bridgePreparationState === 'failed'
    ) {
      return undefined;
    }

    const phase = bridgePreparationState;
    logger.info('[SwapSummary] Bridge preparation phase', { phase });
    const timeoutId = setTimeout(() => {
      logger.warn('[SwapSummary] Bridge preparation phase timed out', { phase });
      setBridgePreparationError(
        phase === 'creating_intent'
          ? 'Bridge request timed out while creating the deposit address.'
          : phase === 'syncing_send'
            ? 'Bridge send details did not sync into the wallet.'
            : 'Building the final send review took too long.'
      );
      setBridgePreparationState('failed');
    }, 20_000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [bridgePreparationState, isBridgeDirection]);

  const maxInputAmount = limit?.maxInputAmount || '0';
  const exceedsMax =
    Number(amountIn) > 0 && Number(maxInputAmount) > 0 && Number(amountIn) > Number(maxInputAmount);
  const insufficientEth =
    !isBridgeDirection && estimate !== null && estimate.hasEnoughEth === false;
  const insufficientSource =
    !isBridgeDirection && estimate !== null && estimate.hasEnoughUsdc === false;
  const swapPreflightBlocked = !isBridgeDirection && estimate !== null && !estimate.canExecute;
  const swapBlockingReasons = !isBridgeDirection ? (estimate?.blockingReasons ?? []) : [];
  const routeLabel = isBridgeDirection
    ? 'UNIT → wUNIT → Sepolia USDC'
    : 'Sepolia USDC → wUNIT → UNIT';
  const receiveLabel = isBridgeDirection ? 'Estimated receive' : 'You receive';
  const bridgeReviewReady =
    isBridgeDirection && bridgePreparationState === 'ready' && !!bridgeIntent && !!reviewSendIntent;
  const swapRecoveryCheckpoint = useMemo(() => {
    if (isBridgeDirection) {
      return null;
    }

    return selectSwapRecoveryCheckpoint(
      evmCheckpoints,
      currentAccount,
      amountIn,
      wallet?.taprootAddress,
      quote?.amountOut
    );
  }, [
    amountIn,
    currentAccount,
    evmCheckpoints,
    isBridgeDirection,
    quote?.amountOut,
    wallet?.taprootAddress,
  ]);
  const swapRecoveryCopy = useMemo(
    () =>
      swapRecoveryCheckpoint ? describeEvmRecoveryCheckpoint(swapRecoveryCheckpoint, 'swap') : null,
    [swapRecoveryCheckpoint]
  );
  const canOpenRedeemRecovery = Boolean(
    swapRecoveryCheckpoint &&
      wallet?.taprootAddress &&
      (swapRecoveryCheckpoint.kind === 'redemption' ||
        (swapRecoveryCheckpoint.kind === 'swap' && swapRecoveryCheckpoint.status === 'confirmed'))
  );

  const title = isBridgeDirection ? 'Review bridge + swap' : 'Review swap + redeem';
  const description = isBridgeDirection
    ? 'Review the full UNIT send, bridge route, and estimated Sepolia USDC output before you sign.'
    : 'This executes on Sepolia now, then burns wUNIT to release canonical UNIT back to Mutinynet.';

  const confirmButtonLabel = useMemo(() => {
    if (!isBridgeDirection) {
      return 'Confirm & sign';
    }

    if (bridgePreparationState === 'ready') {
      return 'Confirm and Sign';
    }

    if (bridgePreparationState === 'failed') {
      return 'Unable to prepare';
    }

    return 'Preparing final review…';
  }, [bridgePreparationState, isBridgeDirection]);

  const feeSummary = useMemo(() => {
    if (!estimate) {
      return 'Refreshing…';
    }

    return `${formatEthAmount(estimate.totalFeeEth)} paid in ETH`;
  }, [estimate]);

  useEffect(() => {
    setCheckpointRecoveryMessage(null);
  }, [swapRecoveryCheckpoint?.status, swapRecoveryCheckpoint?.txHash]);

  const handleBack = (): void => {
    if (isBridgeDirection) {
      Promise.resolve(cancelIntent()).catch(() => undefined);
    }
    navigation.goBack();
  };

  const handleRetryLoad = (): void => {
    setReloadNonce((current) => current + 1);
  };

  const handleReconcileEvmCheckpoints = async (): Promise<void> => {
    if (checkpointReconciling) {
      return;
    }

    try {
      setCheckpointReconciling(true);
      const result = await reconcileSubmittedEvmTransactionCheckpoints();
      setCheckpointRecoveryMessage(formatEvmCheckpointReconciliationSummary(result));
    } catch (error) {
      Alert.alert(
        'Status check failed',
        error instanceof Error ? error.message : 'Unable to check Sepolia transactions.'
      );
    } finally {
      setCheckpointReconciling(false);
    }
  };

  const handleOpenRedeemRecovery = (): void => {
    const redeemAmount =
      swapRecoveryCheckpoint?.kind === 'redemption'
        ? swapRecoveryCheckpoint.amount
        : quote?.amountOut;

    navigation.navigate('SepoliaRedeem', {
      sourceAsset: 'wUNIT',
      ...(redeemAmount ? { amount: redeemAmount } : {}),
    });
  };

  const openPinFallback = (
    action: PendingPinAuthAction,
    signingQuote: CrossChainSwapQuote | null
  ): void => {
    pendingSigningQuoteRef.current = signingQuote;
    setPendingPinAuthAction(action);
    setPinFallbackError(null);
    setShowPinFallback(true);
  };

  const executeBridgeSend = async (): Promise<void> => {
    try {
      setExecuting(true);
      const txid = await signIntent();

      if (!txid) {
        throw new Error(
          'The bridge send was not broadcast. No UNIT transfer was submitted to the bridge deposit address.'
        );
      }

      await registerSwapTxid(txid, toUnitSmallestUnits(amountIn), { confirmed: false });
      await fetchTransactionHistory();
      logger.info(
        `[E2E_TX] sepolia_bridge_send_submitted txid=${txid} sourceAsset=${sourceAsset} amount=${amountIn}`
      );
      showToast('Bridge send submitted', 'success');
      resetToUnitAssetDetail(navigation);
    } catch (error) {
      Alert.alert(
        'Bridge send failed',
        error instanceof Error ? error.message : 'Unable to sign and submit the bridge send.'
      );
    } finally {
      setExecuting(false);
    }
  };

  const executeSwap = async (signingQuote: CrossChainSwapQuote): Promise<void> => {
    if (!wallet?.taprootAddress) {
      Alert.alert('Swap unavailable', 'Missing Mutinynet destination address for redemption.');
      return;
    }

    try {
      setExecuting(true);
      const result = await executeUsdcToUnitSwap(
        currentAccount,
        amountIn,
        wallet.taprootAddress,
        signingQuote.minimumAmountOut
      );
      await registerSwapTxid(result.burnTxHash, toUnitSmallestUnits(result.redeemedAmount), {
        confirmed: true,
      });
      await fetchTransactionHistory();
      logger.info(
        `[E2E_TX] sepolia_swap_submitted txHash=${result.burnTxHash} sourceAsset=${sourceAsset} amount=${amountIn} redeemedAmount=${result.redeemedAmount}`
      );
      showToast('Swap submitted', 'success');
      resetToUnitAssetDetail(navigation);
    } catch (error) {
      Alert.alert('Swap failed', classifyEvmExecutionError(error).userMessage);
    } finally {
      setExecuting(false);
    }
  };

  const handlePinFallbackSubmit = async (pin: string): Promise<void> => {
    setPinFallbackError(null);
    setExecuting(true);

    try {
      const pinResult = await verifyPin(pin);
      if (!pinResult.success) {
        setPinFallbackError(pinResult.error);
        return;
      }

      const action = pendingPinAuthAction;
      const signingQuote = pendingSigningQuoteRef.current;
      setShowPinFallback(false);
      setPendingPinAuthAction(null);
      pendingSigningQuoteRef.current = null;

      if (action === 'bridge') {
        await executeBridgeSend();
        return;
      }

      if (action === 'swap' && signingQuote) {
        await executeSwap(signingQuote);
        return;
      }

      Alert.alert('Authentication failed', 'Unable to resume the signing flow. Please try again.');
    } finally {
      setExecuting(false);
    }
  };

  const handlePinFallbackCancel = (): void => {
    if (executing) {
      return;
    }

    pendingSigningQuoteRef.current = null;
    setPendingPinAuthAction(null);
    setPinFallbackError(null);
    setShowPinFallback(false);
  };

  const handleConfirm = async (): Promise<void> => {
    if (!quote) {
      return;
    }

    let signingQuote = quote;
    try {
      setLoading(true);
      const latestQuote = await quoteUnitUsdcSwap(sourceAsset, amountIn);
      setQuote(latestQuote);
      signingQuote = latestQuote;

      if (isQuoteWorseThanMinimum(latestQuote, quote)) {
        Alert.alert(
          'Quote changed',
          `The pool now returns ${formatTokenAmount(latestQuote.amountOut)} ${destinationAsset}, below the prior minimum of ${formatTokenAmount(quote.minimumAmountOut)} ${destinationAsset}. Review the updated quote before signing.`
        );
        return;
      }
    } catch (error) {
      Alert.alert(
        'Quote refresh failed',
        error instanceof Error ? error.message : 'Refresh the quote and try again before signing.'
      );
      return;
    } finally {
      setLoading(false);
    }

    if (isBridgeDirection) {
      if (!bridgeReviewReady) {
        return;
      }

      const biometricResult = await authenticateWithBiometrics(
        'Authenticate to sign your bridge send',
        'Use PIN'
      );

      if (!biometricResult.success) {
        if (biometricResult.error !== 'user_cancel') {
          openPinFallback('bridge', signingQuote);
        }
        return;
      }

      await executeBridgeSend();
      return;
    }

    if (!wallet?.taprootAddress) {
      Alert.alert('Swap unavailable', 'Missing Mutinynet destination address for redemption.');
      return;
    }

    if (exceedsMax) {
      Alert.alert(
        'Swap too large',
        `Current max is ${formatTokenAmount(maxInputAmount)} ${sourceAsset}.`
      );
      return;
    }

    if (swapPreflightBlocked) {
      Alert.alert(
        'Swap preflight failed',
        swapBlockingReasons.length > 0
          ? swapBlockingReasons.join('\n')
          : 'Refresh the quote and balances before signing.'
      );
      return;
    }

    const biometricResult = await authenticateWithBiometrics(
      'Authenticate to sign your swap',
      'Use PIN'
    );
    if (!biometricResult.success) {
      if (biometricResult.error !== 'user_cancel') {
        openPinFallback('swap', signingQuote);
      }
      return;
    }

    await executeSwap(signingQuote);
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="cross-chain-swap-summary-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          testID="cross-chain-swap-summary-back-btn"
        >
          <Icon name="back" size={20} color={COLORS.WHITE} />
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        {(!isBridgeDirection || !bridgeReviewReady || !bridgeIntent || !reviewSendIntent) && (
          <View style={styles.summaryCard}>
            <SummaryRow
              label="You pay"
              value={`${formatTokenAmount(amountIn)} ${sourceAsset}`}
              emphasized
            />
            <View style={styles.divider} />
            <SummaryRow
              label={receiveLabel}
              value={
                loading
                  ? 'Refreshing…'
                  : `${formatTokenAmount(quote?.amountOut || '0')} ${destinationAsset}`
              }
              emphasized
            />
            <View style={styles.divider} />
            <SummaryRow label="Route" value={routeLabel} />
            {!isBridgeDirection && <SummaryRow label="Sepolia gas" value={feeSummary} />}
            {!isBridgeDirection && estimate && (
              <>
                <SummaryRow
                  label="Current pool max"
                  value={`${formatTokenAmount(maxInputAmount)} ${sourceAsset}`}
                />
                <SummaryRow
                  label="Sepolia USDC balance"
                  value={`${formatTokenAmount(estimate.usdcBalance)} USDC`}
                />
                <SummaryRow
                  label="Expected wUNIT"
                  value={`${formatTokenAmount(estimate.expectedWunitAmount)} wUNIT`}
                />
                <SummaryRow label="Gas units" value={formatGasUnits(estimate.totalGasUnits)} />
                <SummaryRow label="Gas price" value={`${estimate.gasPriceGwei} gwei`} />
              </>
            )}
          </View>
        )}

        {isBridgeDirection && bridgeReviewReady && bridgeIntent && reviewSendIntent && (
          <>
            <TransactionSummary
              recipient={bridgeIntent.depositAddress}
              assetType="UNIT"
              displayAmount={displayAmount}
              usdAmount={usdAmount}
            />
            {hasUnconfirmedInputs && <UnconfirmedWarning />}
            <Text style={styles.sectionTitle}>Bridge outcome</Text>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimated receive:</Text>
                <Text style={[styles.detailValue, styles.detailValueStrong]}>
                  {loading
                    ? 'Refreshing…'
                    : `${formatTokenAmount(quote?.amountOut || '0')} ${destinationAsset}`}
                </Text>
              </View>
              <View style={styles.detailRowLast}>
                <Text style={styles.detailLabel}>Route:</Text>
                <Text style={styles.detailValue}>{routeLabel}</Text>
              </View>
            </View>
            <FeeBreakdown actualFee={actualFee} feeRate={selectedFeeRate} />
            <TouchableOpacity
              style={styles.detailsHeaderCard}
              onPress={() => setIsDetailsExpanded(!isDetailsExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.detailsHeaderText}>Transaction Details</Text>
              <Icon
                name={isDetailsExpanded ? 'chevron_up' : 'chevron_down'}
                size={20}
                color={COLORS.PRIMARY_BLUE}
              />
            </TouchableOpacity>

            {isDetailsExpanded && (
              <InputOutputList
                psbtInputs={psbtInputs}
                outputs={outputs}
                sendIntent={reviewSendIntent}
                runeUtxoBalance={runeUtxoBalance ?? 0}
                btcPrice={btcPrice}
              />
            )}
          </>
        )}

        {isBridgeDirection && bridgePreparationState !== 'ready' && !bridgePreparationError && (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Preparing signature</Text>
            <Text style={styles.noteBody}>
              {bridgePreparationState === 'creating_intent'
                ? 'Creating the one-time bridge deposit address.'
                : bridgePreparationState === 'syncing_send'
                  ? 'Syncing the bridge send into the wallet.'
                  : bridgePreparationState === 'building_send'
                    ? 'Building the full send review with fees, inputs, and outputs.'
                    : 'Preparing bridge review.'}
            </Text>
          </View>
        )}

        {isBridgeDirection && bridgePreparationError && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Bridge review unavailable</Text>
            <Text style={styles.warningBody}>{bridgePreparationError}</Text>
          </View>
        )}

        {swapLoadError && (
          <View style={styles.warningCard} testID="cross-chain-swap-load-error-card">
            <Text style={styles.warningTitle}>Swap quote unavailable</Text>
            <Text style={styles.warningBody}>{swapLoadError}</Text>
            <TouchableOpacity
              style={styles.inlineRetryButton}
              onPress={handleRetryLoad}
              disabled={loading}
              testID="cross-chain-swap-retry-btn"
            >
              <Text style={styles.inlineRetryButtonText}>{loading ? 'Retrying…' : 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isBridgeDirection && (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Sepolia ETH balance</Text>
            <Text style={styles.noteBody}>
              {formatEthAmount(ethBalance)}
              {insufficientEth
                ? ' available, which is below the estimated gas needed.'
                : ' available.'}
            </Text>
          </View>
        )}

        {!isBridgeDirection && swapRecoveryCheckpoint && swapRecoveryCopy && (
          <View style={styles.warningCard} testID="cross-chain-swap-recovery-card">
            <Text style={styles.warningTitle}>{swapRecoveryCopy.title}</Text>
            <Text style={styles.warningBody}>{swapRecoveryCopy.body}</Text>
            <Text style={styles.warningBody}>Status: {swapRecoveryCheckpoint.status}</Text>
            <Text style={styles.warningBody}>
              Tx: {shortEvmTxHash(swapRecoveryCheckpoint.txHash)}
            </Text>
            {swapRecoveryCheckpoint.amount && (
              <Text style={styles.warningBody}>
                Amount: {formatTokenAmount(swapRecoveryCheckpoint.amount)}
              </Text>
            )}
            {checkpointRecoveryMessage && (
              <Text style={styles.warningBody} testID="cross-chain-swap-recovery-message">
                {checkpointRecoveryMessage}
              </Text>
            )}
            <View style={styles.recoveryActionRow}>
              <TouchableOpacity
                style={[
                  styles.recoveryActionButton,
                  checkpointReconciling && styles.recoveryActionButtonDisabled,
                ]}
                onPress={handleReconcileEvmCheckpoints}
                disabled={checkpointReconciling}
                testID="cross-chain-swap-recovery-reconcile-btn"
              >
                {checkpointReconciling ? (
                  <ActivityIndicator color={COLORS.DARK_BG} />
                ) : (
                  <Text style={styles.recoveryActionButtonText}>Check status</Text>
                )}
              </TouchableOpacity>
              {canOpenRedeemRecovery && (
                <TouchableOpacity
                  style={styles.recoverySecondaryButton}
                  onPress={handleOpenRedeemRecovery}
                  testID="cross-chain-swap-recovery-open-redeem-btn"
                >
                  <Text style={styles.recoverySecondaryButtonText}>Open Redeem</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {exceedsMax && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Swap too large</Text>
            <Text style={styles.warningBody}>
              Current max size is {formatTokenAmount(maxInputAmount)} {sourceAsset}. Reduce the
              amount before signing.
            </Text>
          </View>
        )}

        {!isBridgeDirection && swapBlockingReasons.length > 0 && (
          <View style={styles.warningCard} testID="cross-chain-swap-readiness-card">
            <Text style={styles.warningTitle}>Sepolia preflight blocked</Text>
            {swapBlockingReasons.map((reason) => (
              <Text key={reason} style={styles.warningBody}>
                {reason}
              </Text>
            ))}
          </View>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.WHITE} />
            <Text style={styles.loadingText}>
              {isBridgeDirection ? 'Refreshing bridge estimate…' : 'Refreshing quote and costs…'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleBack} disabled={executing}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (loading ||
              executing ||
              exceedsMax ||
              insufficientEth ||
              insufficientSource ||
              swapPreflightBlocked ||
              !quote ||
              (isBridgeDirection && !bridgeReviewReady)) &&
              styles.primaryButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={
            loading ||
            executing ||
            exceedsMax ||
            insufficientEth ||
            insufficientSource ||
            swapPreflightBlocked ||
            !quote ||
            (isBridgeDirection && !bridgeReviewReady)
          }
          testID="cross-chain-swap-summary-confirm-btn"
        >
          {executing ? (
            <ActivityIndicator color={COLORS.DARK_BG} />
          ) : (
            <Text style={styles.primaryButtonText}>{confirmButtonLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
      <PinFallbackModal
        visible={showPinFallback}
        title="Confirm with PIN"
        message="Face ID is unavailable. Enter your wallet PIN to sign this swap."
        error={pinFallbackError}
        busy={executing}
        onSubmit={handlePinFallbackSubmit}
        onCancel={handlePinFallbackCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 140,
    gap: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    color: COLORS.WHITE,
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 15,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: -2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryLabel: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  summaryValueEmphasized: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  detailsCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 10,
  },
  detailRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  detailLabel: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    fontWeight: '400',
  },
  detailValue: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'right',
    flexShrink: 1,
  },
  detailValueStrong: {
    color: COLORS.WHITE,
    fontWeight: '500',
  },
  detailsHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  detailsHeaderText: {
    fontWeight: '500',
    color: COLORS.PRIMARY_BLUE,
    fontSize: 16,
  },
  noteCard: {
    backgroundColor: '#171617',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  noteTitle: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  noteBody: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    lineHeight: 19,
  },
  warningCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.24)',
    gap: 6,
  },
  warningTitle: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  warningBody: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    lineHeight: 19,
  },
  inlineRetryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.WHITE,
    marginTop: 4,
  },
  inlineRetryButtonText: {
    color: COLORS.DARK_BG,
    fontSize: 13,
    fontWeight: '700',
  },
  recoveryActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  recoveryActionButton: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recoveryActionButtonDisabled: {
    opacity: 0.6,
  },
  recoveryActionButtonText: {
    color: COLORS.DARK_BG,
    fontSize: 13,
    fontWeight: '700',
  },
  recoverySecondaryButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  recoverySecondaryButtonText: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  loadingText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1.4,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.DARK_BG,
    fontSize: 16,
    fontWeight: '700',
  },
});
