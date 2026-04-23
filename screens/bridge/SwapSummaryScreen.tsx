import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
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
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import { useSendFlow } from '../../stores/sendFlowStore';
import { registerSwapTxid } from '../../services/transactionHistoryService';
import { useNotifications } from '../../stores/notificationStore';
import { COLORS } from '../../theme';
import { logger } from '../../utils/logger';
import { releaseOrphanedUtxos } from '../../utils/pendingTransactionsUtils';
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
  };
}

type BridgePreparationState =
  | 'idle'
  | 'creating_intent'
  | 'syncing_send'
  | 'building_send'
  | 'ready'
  | 'failed';

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

function getUnitBalanceValue(
  runesBalance: Array<{ amount?: string | number } | unknown> | null | undefined,
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

function toTransactionBuilderUnconfirmedUtxo(
  utxo: { txid: string; vout: number; value?: number; runeAmount?: number },
): { txid: string; vout: number; value: number; runeAmount?: number } {
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
      <Text style={[styles.summaryValue, emphasized && styles.summaryValueEmphasized]}>{value}</Text>
    </View>
  );
}

function shouldBypassBiometricReauth(error?: string): boolean {
  return error === 'not_enrolled' || error === 'not_available' || error === 'passcode_not_set';
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
  const getUnconfirmedUTXOs = usePendingTransactionsStore((state) => state.getUnconfirmedUTXOs);
  const getSpentUtxos = usePendingTransactionsStore((state) => state.getSpentUtxos);
  const markUtxosAsSpent = usePendingTransactionsStore((state) => state.markUtxosAsSpent);
  const unmarkUtxosAsSpent = usePendingTransactionsStore((state) => state.unmarkUtxosAsSpent);
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
  const [bridgePreparationState, setBridgePreparationState] = useState<BridgePreparationState>('idle');
  const [bridgePreparationError, setBridgePreparationError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const bridgeIntentPrepKeyRef = useRef<string | null>(null);
  const bridgeSendBuildKeyRef = useRef<string | null>(null);

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
            wallet.taprootAddress,
          );

          if (active) {
            setEstimate(nextEstimate);
          }
        } else if (active) {
          setEstimate(null);
        }
      } catch {
        if (active) {
          setQuote(null);
          setLimit(null);
          setEstimate(null);
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
  }, [amountIn, currentAccount, isBridgeDirection, sourceAsset, wallet?.taprootAddress]);

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
          error instanceof Error ? error.message : 'Unable to prepare the bridge review.',
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

        await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

        const availableUnitBalance = getUnitBalanceValue(
          runesBalance as Array<{ amount?: string | number } | unknown> | null | undefined,
        );
        if (!Number.isFinite(availableUnitBalance) || availableUnitBalance <= 0) {
          throw new Error('No UNIT balance available for the bridge send.');
        }

        const unconfirmedTaprootUtxos = getUnconfirmedUTXOs('taproot', null)
          .map(toTransactionBuilderUnconfirmedUtxo);
        const unconfirmedSegwitUtxos = getUnconfirmedUTXOs('segwit', null)
          .map(toTransactionBuilderUnconfirmedUtxo);
        const nextSendIntent = await createUnitIntentService(
          bridgeIntent.depositAddress,
          bridgeIntent.amount,
          wallet.taprootAddress,
          wallet.segwitAddress,
          currentAccount,
          unconfirmedTaprootUtxos,
          unconfirmedSegwitUtxos,
          getSpentUtxos(),
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
          utxosToLock.push({ txid: nextSendIntent.satUtxo.txid, vout: nextSendIntent.satUtxo.vout });
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
        await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

        if (!isMountedRef.current || bridgeSendBuildKeyRef.current !== buildKey) {
          return;
        }

        logger.error(error, {
          phase: 'building_send',
          screen: 'SwapSummary',
        });
        setBridgePreparationError(
          error instanceof Error ? error.message : 'Unable to build the UNIT send for this bridge.',
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
      !isBridgeDirection
      || bridgePreparationState === 'idle'
      || bridgePreparationState === 'ready'
      || bridgePreparationState === 'failed'
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
            : 'Building the final send review took too long.',
      );
      setBridgePreparationState('failed');
    }, 20_000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [bridgePreparationState, isBridgeDirection]);

  const maxInputAmount = limit?.maxInputAmount || '0';
  const exceedsMax = Number(amountIn) > 0 && Number(maxInputAmount) > 0 && Number(amountIn) > Number(maxInputAmount);
  const insufficientEth =
    !isBridgeDirection
    && estimate !== null
    && Number(estimate.totalFeeEth) > 0
    && Number(ethBalance) < Number(estimate.totalFeeEth);
  const routeLabel = isBridgeDirection ? 'UNIT → wUNIT → USDC' : 'USDC → wUNIT → UNIT';
  const receiveLabel = isBridgeDirection ? 'Estimated receive' : 'You receive';
  const bridgeReviewReady =
    isBridgeDirection
    && bridgePreparationState === 'ready'
    && !!bridgeIntent
    && !!reviewSendIntent;

  const title = isBridgeDirection ? 'Review bridge + swap' : 'Review swap + redeem';
  const description = isBridgeDirection
    ? 'Review the full UNIT send, bridge route, and estimated USDC output before you sign.'
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

  const handleBack = (): void => {
    if (isBridgeDirection) {
      Promise.resolve(cancelIntent()).catch(() => undefined);
    }
    navigation.goBack();
  };

  const handleConfirm = async (): Promise<void> => {
    if (!quote) {
      return;
    }

    if (isBridgeDirection) {
      if (!bridgeReviewReady) {
        return;
      }

      const biometricResult = await authenticateWithBiometrics(
        'Authenticate to sign your bridge send',
        'Use PIN',
      );

      if (!biometricResult.success && !shouldBypassBiometricReauth(biometricResult.error)) {
        if (biometricResult.error && biometricResult.error !== 'user_cancel') {
          Alert.alert('Authentication failed', biometricResult.error);
        }
        return;
      }

      try {
        setExecuting(true);
        const txid = await signIntent();

        if (!txid) {
          throw new Error('Unable to sign and broadcast the bridge transaction.');
        }

        await registerSwapTxid(txid, toUnitSmallestUnits(amountIn), { confirmed: false });
        await fetchTransactionHistory();
        showToast('Bridge send submitted', 'success');
        navigation.navigate('AssetDetail', { assetType: 'UNIT' });
      } catch (error) {
        Alert.alert(
          'Bridge send failed',
          error instanceof Error ? error.message : 'Unable to sign and submit the bridge send.',
        );
      } finally {
        setExecuting(false);
      }
      return;
    }

    if (!wallet?.taprootAddress) {
      Alert.alert('Swap unavailable', 'Missing Mutinynet destination address for redemption.');
      return;
    }

    if (exceedsMax) {
      Alert.alert('Swap too large', `Current max is ${formatTokenAmount(maxInputAmount)} ${sourceAsset}.`);
      return;
    }

    if (insufficientEth) {
      Alert.alert(
        'Not enough ETH',
        `This swap needs about ${formatEthAmount(estimate?.totalFeeEth || '0')} in Sepolia ETH for gas.`,
      );
      return;
    }

    const biometricResult = await authenticateWithBiometrics('Authenticate to sign your swap', 'Use PIN');
    if (!biometricResult.success && !shouldBypassBiometricReauth(biometricResult.error)) {
      if (biometricResult.error && biometricResult.error !== 'user_cancel') {
        Alert.alert('Authentication failed', biometricResult.error);
      }
      return;
    }

    try {
      setExecuting(true);
      const result = await executeUsdcToUnitSwap(currentAccount, amountIn, wallet.taprootAddress);
      await registerSwapTxid(result.burnTxHash, toUnitSmallestUnits(result.redeemedAmount), { confirmed: true });
      await fetchTransactionHistory();
      showToast('Swap submitted', 'success');
      navigation.navigate('AssetDetail', { assetType: 'UNIT' });
    } catch (error) {
      Alert.alert('Swap failed', error instanceof Error ? error.message : 'Unable to execute swap');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="cross-chain-swap-summary-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} testID="cross-chain-swap-summary-back-btn">
          <Icon name="back" size={20} color={COLORS.WHITE} />
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        {(!isBridgeDirection || !bridgeReviewReady || !bridgeIntent || !reviewSendIntent) && (
          <View style={styles.summaryCard}>
            <SummaryRow label="You pay" value={`${formatTokenAmount(amountIn)} ${sourceAsset}`} emphasized />
            <View style={styles.divider} />
            <SummaryRow
              label={receiveLabel}
              value={loading ? 'Refreshing…' : `${formatTokenAmount(quote?.amountOut || '0')} ${destinationAsset}`}
              emphasized
            />
            <View style={styles.divider} />
            <SummaryRow label="Route" value={routeLabel} />
            {!isBridgeDirection && <SummaryRow label="Sepolia gas" value={feeSummary} />}
            {!isBridgeDirection && estimate && (
              <>
                <SummaryRow label="Current pool max" value={`${formatTokenAmount(maxInputAmount)} ${sourceAsset}`} />
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
                  {loading ? 'Refreshing…' : `${formatTokenAmount(quote?.amountOut || '0')} ${destinationAsset}`}
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

        {!isBridgeDirection && (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Sepolia ETH balance</Text>
            <Text style={styles.noteBody}>
              {formatEthAmount(ethBalance)}
              {insufficientEth ? ' available, which is below the estimated gas needed.' : ' available.'}
            </Text>
          </View>
        )}

        {exceedsMax && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Swap too large</Text>
            <Text style={styles.warningBody}>
              Current max size is {formatTokenAmount(maxInputAmount)} {sourceAsset}. Reduce the amount before signing.
            </Text>
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
            (
              loading
              || executing
              || exceedsMax
              || insufficientEth
              || !quote
              || (isBridgeDirection && !bridgeReviewReady)
            ) && styles.primaryButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={loading || executing || exceedsMax || insufficientEth || !quote || (isBridgeDirection && !bridgeReviewReady)}
          testID="cross-chain-swap-summary-confirm-btn"
        >
          {executing ? (
            <ActivityIndicator color={COLORS.DARK_BG} />
          ) : (
            <Text style={styles.primaryButtonText}>{confirmButtonLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
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
