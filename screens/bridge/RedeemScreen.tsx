import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isEvmBridgeConfigured } from '../../constants/evm';
import { useWallet } from '../../contexts/WalletContext';
import {
  classifyEvmExecutionError,
  estimateRedemptionExecution,
  getEvmBalances,
  requestRedemption,
  type RedemptionExecutionEstimate,
  type SepoliaAsset,
} from '../../services/evmBridgeService';
import { getRedemptionStatus } from '../../services/bridgeApiService';
import {
  recoverConfirmedRedemptionTracking,
  reconcileSubmittedEvmTransactionCheckpoints,
} from '../../services/evmTransactionCheckpointService';
import { useEvmTransactionCheckpointStore } from '../../stores/evmTransactionCheckpointStore';
import { useNotifications } from '../../stores/notificationStore';
import { COLORS } from '../../theme';
import type { RedemptionRequest } from '../../shared/bridgeTypes';
import { TAPROOT_ADDRESS_PREFIX, validateBitcoinAddress } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import {
  describeEvmRecoveryCheckpoint,
  formatEvmCheckpointReconciliationSummary,
  selectRedeemRecoveryCheckpoint,
  shortEvmTxHash,
} from '../../utils/evmCheckpointRecovery';

interface RedeemScreenProps {
  route?: {
    params?: {
      amount?: string;
      maxInputAmount?: string;
      sourceAsset?: SepoliaAsset;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
  };
}

export default function RedeemScreen({ route, navigation }: RedeemScreenProps): React.JSX.Element {
  const { wallet, currentAccount } = useWallet();
  const { showToast } = useNotifications();
  const evmCheckpoints = useEvmTransactionCheckpointStore((state) => state.checkpoints);
  const bridgeReady = isEvmBridgeConfigured();
  const [destination, setDestination] = useState(wallet?.taprootAddress || '');
  const [amount, setAmount] = useState(route?.params?.amount || '25');
  const [sourceAsset, setSourceAsset] = useState<SepoliaAsset>(route?.params?.sourceAsset || 'wUNIT');
  const [balances, setBalances] = useState<{ usdc: string; wunit: string; eth: string } | null>(null);
  const [estimate, setEstimate] = useState<RedemptionExecutionEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [redemption, setRedemption] = useState<RedemptionRequest | null>(null);
  const [executing, setExecuting] = useState(false);
  const [checkpointReconciling, setCheckpointReconciling] = useState(false);
  const [releaseTrackingRecovering, setReleaseTrackingRecovering] = useState(false);
  const [checkpointRecoveryMessage, setCheckpointRecoveryMessage] = useState<string | null>(null);
  const maxInputAmount = route?.params?.maxInputAmount;

  useEffect(() => {
    if (!destination && wallet?.taprootAddress) {
      setDestination(wallet.taprootAddress);
    }
  }, [destination, wallet?.taprootAddress]);

  useEffect(() => {
    if (route?.params?.amount) {
      setAmount(route.params.amount);
    }
    if (route?.params?.sourceAsset) {
      setSourceAsset(route.params.sourceAsset);
    }
  }, [route?.params?.amount, route?.params?.sourceAsset]);

  useEffect(() => {
    if (!bridgeReady) {
      setBalances(null);
      return undefined;
    }

    let active = true;
    getEvmBalances(currentAccount)
      .then((next) => {
        if (active) {
          setBalances({ usdc: next.usdc, wunit: next.wunit, eth: next.eth });
        }
      })
      .catch(() => {
        if (active) {
          setBalances(null);
        }
      });

    return () => {
      active = false;
    };
  }, [bridgeReady, currentAccount]);

  const enteredAmount = Number(amount);
  const hasValidAmount = /^\d+(\.\d+)?$/.test(amount.trim()) && Number.isFinite(enteredAmount) && enteredAmount > 0;
  const destinationValidation = destination.trim().length > 0 ? validateBitcoinAddress(destination.trim()) : null;
  const destinationError = destination.trim().length === 0
    ? null
    : destinationValidation?.valid
      ? destinationValidation.type === 'taproot'
        ? null
        : `Redemption requires a Mutinynet Taproot address (${TAPROOT_ADDRESS_PREFIX}...).`
      : destinationValidation?.error || 'Enter a valid Mutinynet Taproot address';
  const hasDestination = destination.trim().length > 0 && !destinationError;

  useEffect(() => {
    if (!bridgeReady || !hasDestination || !hasValidAmount) {
      setEstimate(null);
      setEstimating(false);
      return undefined;
    }

    let active = true;
    setEstimating(true);
    estimateRedemptionExecution(currentAccount, amount, destination.trim(), sourceAsset)
      .then((nextEstimate) => {
        if (active) {
          setEstimate(nextEstimate);
        }
      })
      .catch(() => {
        if (active) {
          setEstimate(null);
        }
      })
      .finally(() => {
        if (active) {
          setEstimating(false);
        }
      });

    return () => {
      active = false;
    };
  }, [amount, bridgeReady, currentAccount, destination, hasDestination, hasValidAmount, sourceAsset]);

  useEffect(() => {
    if (!redemption || redemption.status === 'released' || redemption.status === 'failed') {
      return undefined;
    }

    const interval = setInterval(() => {
      getRedemptionStatus(redemption.id)
        .then(setRedemption)
        .catch(() => undefined);
    }, 8000);

    return () => clearInterval(interval);
  }, [redemption]);

  useEffect(() => {
    if (!redemption?.releaseTxid) {
      return;
    }

    logger.info(
      `[E2E_TX] sepolia_redeem_released txid=${redemption.releaseTxid} releaseId=${redemption.id}`
    );
  }, [redemption?.id, redemption?.releaseTxid]);

  const requiredSourceAmount = estimate?.requiredSourceAmount || amount;
  const blockingReasons = estimate?.blockingReasons ?? [];
  const insufficientSource = estimate?.hasEnoughSource === false;
  const insufficientEth = estimate?.hasEnoughEth === false;
  const preflightBlocked = estimate !== null && !estimate.canExecute;
  const redeemRecoveryCheckpoint = useMemo(
    () => selectRedeemRecoveryCheckpoint(evmCheckpoints, currentAccount, destination, amount),
    [amount, currentAccount, destination, evmCheckpoints],
  );
  const redeemRecoveryCopy = useMemo(
    () => (redeemRecoveryCheckpoint ? describeEvmRecoveryCheckpoint(redeemRecoveryCheckpoint, 'redeem') : null),
    [redeemRecoveryCheckpoint],
  );
  const canSubmit = Boolean(
    hasDestination
    && hasValidAmount
    && bridgeReady
    && Boolean(balances)
    && estimate
    && !estimating
    && !executing
    && !insufficientSource
    && !insufficientEth
    && !preflightBlocked,
  );
  const canRecoverReleaseTracking = Boolean(
    redeemRecoveryCheckpoint?.status === 'confirmed'
    && redeemRecoveryCheckpoint.releaseId,
  );

  useEffect(() => {
    setCheckpointRecoveryMessage(null);
  }, [redeemRecoveryCheckpoint?.status, redeemRecoveryCheckpoint?.txHash]);

  const handleReconcileEvmCheckpoints = async (): Promise<void> => {
    if (checkpointReconciling) {
      return;
    }

    try {
      setCheckpointReconciling(true);
      const result = await reconcileSubmittedEvmTransactionCheckpoints();
      setCheckpointRecoveryMessage(formatEvmCheckpointReconciliationSummary(result));

      const nextBalances = await getEvmBalances(currentAccount);
      setBalances({ usdc: nextBalances.usdc, wunit: nextBalances.wunit, eth: nextBalances.eth });
    } catch (error) {
      Alert.alert(
        'Status check failed',
        error instanceof Error ? error.message : 'Unable to check Sepolia transactions.',
      );
    } finally {
      setCheckpointReconciling(false);
    }
  };

  const handleUseRedeemCheckpoint = (): void => {
    if (!redeemRecoveryCheckpoint) {
      return;
    }

    if (redeemRecoveryCheckpoint.destinationTaprootAddress) {
      setDestination(redeemRecoveryCheckpoint.destinationTaprootAddress);
    }
    if (redeemRecoveryCheckpoint.amount) {
      setAmount(redeemRecoveryCheckpoint.amount);
    }
    setSourceAsset('wUNIT');
  };

  const handleRecoverReleaseTracking = async (): Promise<void> => {
    if (!redeemRecoveryCheckpoint?.releaseId || releaseTrackingRecovering) {
      return;
    }

    try {
      setReleaseTrackingRecovering(true);
      const result = await recoverConfirmedRedemptionTracking(redeemRecoveryCheckpoint.releaseId);
      if (result.lastRedemption) {
        setRedemption(result.lastRedemption);
      }
      setCheckpointRecoveryMessage(
        `Release tracking checked ${result.checked}; recovered ${result.tracked}, already tracked ${result.alreadyTracked}, failed ${result.failed}.`,
      );
    } catch (error) {
      Alert.alert(
        'Recovery failed',
        error instanceof Error ? error.message : 'Unable to recover redemption release tracking.',
      );
    } finally {
      setReleaseTrackingRecovering(false);
    }
  };

  const handleRedeem = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }

    if (preflightBlocked) {
      Alert.alert(
        'Redemption preflight failed',
        blockingReasons.length > 0
          ? blockingReasons.join('\n')
          : 'Refresh the quote and balances before redeeming.',
      );
      return;
    }

    try {
      setExecuting(true);
      const sourceSpendCap = sourceAsset === 'USDC'
        ? route?.params?.amount === amount && maxInputAmount ? maxInputAmount : estimate?.requiredSourceAmount
        : undefined;
      const result = await requestRedemption(currentAccount, amount, destination.trim(), sourceAsset, sourceSpendCap);
      logger.info(
        `[E2E_TX] sepolia_redeem_submitted txHash=${result.burnTxHash} releaseId=${result.releaseId} sourceAsset=${sourceAsset} amount=${amount}`
      );
      let trackedStatusLoaded = false;
      try {
        const tracked = await getRedemptionStatus(result.releaseId);
        setRedemption(tracked);
        trackedStatusLoaded = true;
      } catch (statusError) {
        const now = new Date().toISOString();
        setRedemption({
          id: result.releaseId,
          createdAt: now,
          updatedAt: now,
          requester: '',
          destinationTaprootAddress: destination.trim(),
          amount: result.redeemedAmount,
          sourceAsset: result.sourceAsset,
          burnTxHash: result.burnTxHash,
          status: 'pending_release',
          error: result.trackRedemptionError || (statusError instanceof Error ? statusError.message : String(statusError)),
        });
      }

      getEvmBalances(currentAccount)
        .then((nextBalances) => {
          setBalances({ usdc: nextBalances.usdc, wunit: nextBalances.wunit, eth: nextBalances.eth });
        })
        .catch(() => undefined);

      if (result.trackRedemptionError || !trackedStatusLoaded) {
        showToast('Burn confirmed; bridge tracking needs retry', 'warning');
      } else {
        showToast('Redemption request submitted', 'success');
      }
    } catch (error) {
      Alert.alert('Redemption failed', classifyEvmExecutionError(error).userMessage);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="sepolia-redeem-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={navigation.goBack} testID="sepolia-redeem-back-btn">
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Sepolia → Mutinynet</Text>
        <Text style={styles.title}>Burn wUNIT and release UNIT back home</Text>
        <Text style={styles.description}>
          Redeem with wUNIT directly, or start from Sepolia USDC and let the app acquire wUNIT first before emitting the release event.
        </Text>

        {!bridgeReady && (
          <View style={styles.recoveryCard} testID="sepolia-redeem-config-warning">
            <Text style={styles.recoveryTitle}>Redemption unavailable</Text>
            <Text style={styles.recoveryBody}>
              Configure Sepolia RPC, bridge API, wUNIT, router, and UNIT/USDC pool addresses before redeeming back to Mutinynet.
            </Text>
          </View>
        )}

        {redeemRecoveryCheckpoint && redeemRecoveryCopy && (
          <View style={styles.recoveryCard} testID="sepolia-redeem-recovery-card">
            <Text style={styles.recoveryTitle}>{redeemRecoveryCopy.title}</Text>
            <Text style={styles.recoveryBody}>{redeemRecoveryCopy.body}</Text>
            <Text style={styles.recoveryBody}>Status: {redeemRecoveryCheckpoint.status}</Text>
            <Text style={styles.recoveryBody}>Tx: {shortEvmTxHash(redeemRecoveryCheckpoint.txHash)}</Text>
            {redeemRecoveryCheckpoint.amount && (
              <Text style={styles.recoveryBody}>Amount: {redeemRecoveryCheckpoint.amount} UNIT</Text>
            )}
            {redeemRecoveryCheckpoint.destinationTaprootAddress && (
              <Text style={styles.recoveryBody}>
                Destination {redeemRecoveryCheckpoint.destinationTaprootAddress}
              </Text>
            )}
            {checkpointRecoveryMessage && (
              <Text style={styles.recoveryBody} testID="sepolia-redeem-recovery-message">
                {checkpointRecoveryMessage}
              </Text>
            )}
            <View style={styles.recoveryActionRow}>
              <TouchableOpacity
                style={[styles.recoveryActionButton, checkpointReconciling && styles.recoveryActionButtonDisabled]}
                onPress={handleReconcileEvmCheckpoints}
                disabled={checkpointReconciling}
                testID="sepolia-redeem-recovery-reconcile-btn"
              >
                {checkpointReconciling ? (
                  <ActivityIndicator color={COLORS.DARK_BG} />
                ) : (
                  <Text style={styles.recoveryActionButtonText}>Check status</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.recoverySecondaryButton}
                onPress={handleUseRedeemCheckpoint}
                testID="sepolia-redeem-recovery-use-btn"
              >
                <Text style={styles.recoverySecondaryButtonText}>Use details</Text>
              </TouchableOpacity>
              {canRecoverReleaseTracking && (
                <TouchableOpacity
                  style={[
                    styles.recoverySecondaryButton,
                    releaseTrackingRecovering && styles.recoveryActionButtonDisabled,
                  ]}
                  onPress={handleRecoverReleaseTracking}
                  disabled={releaseTrackingRecovering}
                  testID="sepolia-redeem-recovery-release-btn"
                >
                  <Text style={styles.recoverySecondaryButtonText}>
                    {releaseTrackingRecovering ? 'Recovering' : 'Recover release'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sepolia balances</Text>
          <Text style={styles.balanceText}>USDC {balances?.usdc || '—'}</Text>
          <Text style={styles.balanceText}>wUNIT {balances?.wunit || '—'}</Text>
          <Text style={styles.helperText}>Sepolia ETH {balances?.eth || '—'}</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('SepoliaSwap', { sourceAsset: 'USDC' })}
            testID="sepolia-redeem-open-swap-btn"
          >
            <Text style={styles.linkButtonText}>Open Sepolia swap screen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, sourceAsset === 'wUNIT' && styles.toggleButtonActive]}
              onPress={() => setSourceAsset('wUNIT')}
              testID="sepolia-redeem-wunit-btn"
            >
              <Text style={[styles.toggleText, sourceAsset === 'wUNIT' && styles.toggleTextActive]}>Redeem wUNIT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, sourceAsset === 'USDC' && styles.toggleButtonActive]}
              onPress={() => setSourceAsset('USDC')}
              testID="sepolia-redeem-usdc-btn"
            >
              <Text style={[styles.toggleText, sourceAsset === 'USDC' && styles.toggleTextActive]}>Swap Sepolia USDC first</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardLabel}>Mutinynet Taproot destination</Text>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
            placeholder="tb1p..."
            placeholderTextColor={COLORS.SECONDARY_TEXT}
            testID="sepolia-redeem-destination-input"
          />
          {destinationError && (
            <Text style={styles.errorText} testID="sepolia-redeem-destination-error">{destinationError}</Text>
          )}

          <Text style={styles.cardLabel}>UNIT amount to release</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
            placeholder="25"
            placeholderTextColor={COLORS.SECONDARY_TEXT}
            testID="sepolia-redeem-amount-input"
          />

          <View style={styles.estimateBox}>
            <Text style={styles.cardLabel}>Execution estimate</Text>
            <Text style={styles.helperText}>
              Source needed: {estimating ? 'Estimating…' : estimate ? `${requiredSourceAmount} ${sourceAsset}` : 'Enter amount and destination'}
            </Text>
            <Text style={styles.helperText}>
              Sepolia gas: {estimating ? 'Estimating…' : estimate ? `${estimate.totalFeeEth} ETH` : '—'}
            </Text>
            {estimate && (
              <Text style={styles.helperText}>
                Available source: {estimate.sourceBalance} {sourceAsset}
              </Text>
            )}
            {estimate?.requiresUsdcApproval && (
              <Text style={styles.helperText}>Sepolia USDC approval required before swap.</Text>
            )}
            {estimate?.requiresWunitApproval && (
              <Text style={styles.helperText}>wUNIT approval required before burn.</Text>
            )}
            {insufficientSource && (
              <Text style={styles.errorText}>Not enough {sourceAsset} for this redemption.</Text>
            )}
            {insufficientEth && (
              <Text style={styles.errorText}>Not enough Sepolia ETH for execution gas.</Text>
            )}
            {blockingReasons.length > 0 && (
              <View testID="sepolia-redeem-readiness-card">
                {blockingReasons.map((reason) => (
                  <Text key={reason} style={styles.errorText}>{reason}</Text>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
            onPress={handleRedeem}
            disabled={!canSubmit}
            testID="sepolia-redeem-submit-btn"
          >
            {executing ? <ActivityIndicator color={COLORS.DARK_BG} /> : <Text style={styles.primaryButtonText}>Approve and redeem</Text>}
          </TouchableOpacity>
        </View>

        {redemption && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Release status</Text>
            <Text style={styles.statusText}>{redemption.status}</Text>
            <Text style={styles.helperText}>Amount {redemption.amount} UNIT</Text>
            <Text style={styles.helperText}>Destination {redemption.destinationTaprootAddress}</Text>
            <Text style={styles.helperText}>Burn tx {redemption.burnTxHash || 'Pending'}</Text>
            <Text style={styles.helperText}>Release tx {redemption.releaseTxid || 'Waiting on operator'}</Text>
          </View>
        )}
      </ScrollView>
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
    padding: 20,
    gap: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backButtonText: {
    color: COLORS.WHITE,
    fontSize: 15,
    fontWeight: '600',
  },
  eyebrow: {
    color: '#9FE870',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: COLORS.WHITE,
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
  },
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  recoveryCard: {
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderRadius: 20,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.24)',
  },
  recoveryTitle: {
    color: COLORS.WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  recoveryBody: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    lineHeight: 19,
  },
  recoveryActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  recoveryActionButton: {
    backgroundColor: '#9FE870',
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
  cardLabel: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '600',
  },
  balanceText: {
    color: COLORS.WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkButtonText: {
    color: '#9FE870',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#171922',
  },
  toggleButtonActive: {
    backgroundColor: '#9FE870',
  },
  toggleText: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.DARK_BG,
  },
  textInput: {
    borderRadius: 16,
    backgroundColor: '#16161B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  estimateBox: {
    backgroundColor: '#151A15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(159,232,112,0.16)',
    padding: 14,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#9FE870',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: COLORS.DARK_BG,
    fontWeight: '700',
  },
  statusText: {
    color: COLORS.WHITE,
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  helperText: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  errorText: {
    color: COLORS.RED,
    fontSize: 13,
    lineHeight: 18,
  },
});
