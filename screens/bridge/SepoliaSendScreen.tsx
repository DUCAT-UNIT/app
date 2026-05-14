import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { isAddress } from 'ethers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import OperationBusyIndicator from '../../components/common/OperationBusyIndicator';
import OperationRecoveryCard from '../../components/common/OperationRecoveryCard';
import TouchableScale from '../../components/common/TouchableScale';
import Icon from '../../components/icons';
import QRScanner from '../../components/scanner/QRScanner';
import { EVM_CONFIG, isSepoliaRpcConfigured, isValidEvmAddress } from '../../constants/evm';
import { useWallet } from '../../contexts/WalletContext';
import { authenticateWithBiometrics } from '../../services/biometricService';
import {
  classifyEvmExecutionError,
  estimateSepoliaTokenTransfer,
  getEvmBalances,
  sendSepoliaToken,
  type SepoliaTokenTransferEstimate,
  type SepoliaTransferAsset,
} from '../../services/evmBridgeService';
import { reconcileSubmittedEvmTransactionCheckpoints } from '../../services/evmTransactionCheckpointService';
import { useEvmTransactionCheckpointStore } from '../../stores/evmTransactionCheckpointStore';
import { useNotifications } from '../../stores/notificationStore';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';
import {
  formatEvmCheckpointReconciliationSummary,
  selectSendRecoveryCheckpoint,
} from '../../utils/evmCheckpointRecovery';
import { formatFiat } from '../../utils/formatters';
import { getEvmCheckpointActionCopy } from '../../utils/operationLifecycle';
import {
  formatAmountInputValue,
  formatEthAmount,
  formatReviewAddress,
  formatSelectableAmount,
  formatTokenAmount,
  getAmountPlaceholder,
  getAssetIconName,
  getSepoliaAssetDecimals,
  getSepoliaAssetLabel,
  getSepoliaAssetUnit,
  getSepoliaSendTitle,
  normalizeScannedAddress,
  sanitizeAmountInput,
} from './sepoliaSendUtils';

interface SepoliaSendScreenProps {
  route?: {
    params?: {
      asset?: SepoliaTransferAsset;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
  };
}

const SLIDER_HORIZONTAL_INSET = 12;
const SLIDER_THUMB_SIZE = 24;

export default function SepoliaSendScreen({
  route,
  navigation,
}: SepoliaSendScreenProps): React.JSX.Element {
  const { currentAccount } = useWallet();
  const { showToast } = useNotifications();
  const evmCheckpoints = useEvmTransactionCheckpointStore((state) => state.checkpoints);
  const amountInputRef = useRef<TextInput>(null);
  const sendInFlightRef = useRef(false);
  const asset = route?.params?.asset || 'USDC';
  const assetLabel = getSepoliaAssetLabel(asset);
  const assetUnit = getSepoliaAssetUnit(asset);
  const amountDecimals = getSepoliaAssetDecimals(asset);
  const amountPlaceholder = getAmountPlaceholder(asset);
  const sendTitle = getSepoliaSendTitle(asset);
  const rpcReady = isSepoliaRpcConfigured();
  const tokenReady =
    asset === 'ETH' ||
    (asset === 'USDC'
      ? isValidEvmAddress(EVM_CONFIG.usdcAddress)
      : isValidEvmAddress(EVM_CONFIG.wunitAddress));
  const sendConfigReady = rpcReady && tokenReady;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState<{ usdc: string; wunit: string; eth: string } | null>(
    null
  );
  const [estimate, setEstimate] = useState<SepoliaTokenTransferEstimate | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [sending, setSending] = useState(false);
  const [checkpointReconciling, setCheckpointReconciling] = useState(false);
  const [checkpointRecoveryMessage, setCheckpointRecoveryMessage] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);

  useEffect(() => {
    if (!rpcReady) {
      setBalances(null);
      setLoadingBalances(false);
      return undefined;
    }

    let active = true;
    setLoadingBalances(true);

    getEvmBalances(currentAccount)
      .then((nextBalances) => {
        if (!active) {
          return;
        }

        setBalances({
          usdc: nextBalances.usdc,
          wunit: nextBalances.wunit,
          eth: nextBalances.eth,
        });
      })
      .catch(() => {
        if (active) {
          setBalances(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingBalances(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentAccount, rpcReady]);

  useEffect(() => {
    if (!sendConfigReady || !recipient || !amount || Number(amount) <= 0 || !isAddress(recipient)) {
      setEstimate(null);
      setEstimating(false);
      return undefined;
    }

    let active = true;
    const estimateTimer = setTimeout(() => {
      estimateSepoliaTokenTransfer(currentAccount, asset, recipient, amount)
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
    }, 250);

    setEstimating(true);

    return () => {
      active = false;
      clearTimeout(estimateTimer);
    };
  }, [amount, asset, currentAccount, recipient, sendConfigReady]);

  const enteredAmount = Number(amount);
  const balanceValue =
    asset === 'ETH' ? balances?.eth : asset === 'USDC' ? balances?.usdc : balances?.wunit;
  const parsedMaxAmount = Number(String(balanceValue || '0').replace(/,/g, ''));
  const maxAmountValue = Number.isFinite(parsedMaxAmount) ? parsedMaxAmount : 0;
  const formattedBalance =
    asset === 'ETH'
      ? formatEthAmount(balanceValue || '0')
      : `${formatTokenAmount(balanceValue || '0')} ${assetUnit}`;
  const amountSubvalue =
    asset === 'ETH'
      ? `${formattedBalance} available`
      : `$${formatFiat(Number.isFinite(enteredAmount) ? enteredAmount : 0)}`;
  const hasValidAmount =
    /^\d+(\.\d+)?$/.test(amount.trim()) && Number.isFinite(enteredAmount) && enteredAmount > 0;
  const amountRatio =
    maxAmountValue > 0 && hasValidAmount
      ? Math.max(0, Math.min(100, (enteredAmount / maxAmountValue) * 100))
      : 0;
  const recipientIsValid = recipient.trim().length > 0 && isAddress(recipient.trim());
  const recipientError =
    recipient.trim().length > 0 && !recipientIsValid ? 'Enter a valid Ethereum address.' : null;
  const amountError =
    amount.trim().length > 0 && !hasValidAmount ? `Enter a valid ${assetUnit} amount.` : null;
  const blockingReasons = estimate?.blockingReasons ?? [];
  const insufficientAsset = estimate?.hasEnoughAsset === false;
  const insufficientEth = estimate?.hasEnoughEth === false;
  const preflightBlocked = estimate !== null && !estimate.canExecute;
  const sendRecoveryCheckpoint = useMemo(
    () => selectSendRecoveryCheckpoint(evmCheckpoints, currentAccount, asset, recipient, amount),
    [amount, asset, currentAccount, evmCheckpoints, recipient]
  );
  const sendRecoveryCopy = useMemo(
    () => (sendRecoveryCheckpoint ? getEvmCheckpointActionCopy(sendRecoveryCheckpoint) : null),
    [sendRecoveryCheckpoint]
  );
  const hasPendingSendCheckpoint = sendRecoveryCheckpoint?.status === 'submitted';
  const canSubmit = Boolean(
    recipient &&
      hasValidAmount &&
      !recipientError &&
      sendConfigReady &&
      Boolean(balances) &&
      Boolean(estimate) &&
      !loadingBalances &&
      !estimating &&
      !sending &&
      !insufficientAsset &&
      !insufficientEth &&
      !preflightBlocked &&
      !hasPendingSendCheckpoint
  );
  const footerButtonDisabled = hasPendingSendCheckpoint ? checkpointReconciling : !canSubmit;
  const footerButtonBusy = sending || (hasPendingSendCheckpoint && checkpointReconciling);
  const footerButtonLabel = hasPendingSendCheckpoint
    ? 'Check pending Sepolia transfer'
    : 'Review send';

  useEffect(() => {
    setCheckpointRecoveryMessage(null);
  }, [sendRecoveryCheckpoint?.status, sendRecoveryCheckpoint?.txHash]);

  useEffect(() => {
    setReviewVisible(false);
  }, [amount, asset, recipient]);

  const refreshBalances = async (): Promise<void> => {
    const nextBalances = await getEvmBalances(currentAccount);
    setBalances({
      usdc: nextBalances.usdc,
      wunit: nextBalances.wunit,
      eth: nextBalances.eth,
    });
  };

  const handleReconcileEvmCheckpoints = async (): Promise<void> => {
    if (checkpointReconciling) {
      return;
    }

    try {
      setCheckpointReconciling(true);
      const result = await reconcileSubmittedEvmTransactionCheckpoints();
      setCheckpointRecoveryMessage(formatEvmCheckpointReconciliationSummary(result));
      await refreshBalances();
    } catch (error) {
      Alert.alert(
        'Status check failed',
        error instanceof Error ? error.message : 'Unable to check Sepolia transactions.'
      );
    } finally {
      setCheckpointReconciling(false);
    }
  };

  const handleUseSendCheckpoint = (): void => {
    if (!sendRecoveryCheckpoint) {
      return;
    }

    if (sendRecoveryCheckpoint.recipient) {
      setRecipient(sendRecoveryCheckpoint.recipient);
    }
    if (sendRecoveryCheckpoint.amount) {
      setAmount(sendRecoveryCheckpoint.amount);
    }
  };

  const handlePasteRecipient = async (): Promise<void> => {
    const text = await Clipboard.getStringAsync();
    const nextRecipient = normalizeScannedAddress(text);
    if (nextRecipient) {
      setRecipient(nextRecipient);
    }
  };

  const handleQRScanned = (data: string): void => {
    setRecipient(normalizeScannedAddress(data));
    setShowQRScanner(false);
  };

  const handleAmountChange = (value: string): void => {
    setAmount(sanitizeAmountInput(value, amountDecimals));
  };

  const handleAmountFocus = useCallback((): void => {
    amountInputRef.current?.focus();
  }, []);

  const handleSliderLayout = useCallback((event: LayoutChangeEvent): void => {
    setSliderWidth(event.nativeEvent.layout.width);
  }, []);

  const setAmountFromSlider = useCallback(
    (locationX: number): void => {
      const trackWidth = sliderWidth - SLIDER_HORIZONTAL_INSET * 2;
      if (maxAmountValue <= 0 || trackWidth <= 0) {
        return;
      }

      const trackX = Math.max(0, Math.min(trackWidth, locationX - SLIDER_HORIZONTAL_INSET));
      const ratio = trackX / trackWidth;
      setAmount(formatSelectableAmount(maxAmountValue * ratio, asset));
    },
    [asset, maxAmountValue, sliderWidth]
  );

  const sliderGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(maxAmountValue > 0)
        .minDistance(0)
        .hitSlop({ top: 18, bottom: 18, left: 0, right: 0 })
        .onBegin((event) => {
          'worklet';
          runOnJS(setAmountFromSlider)(event.x);
        })
        .onUpdate((event) => {
          'worklet';
          runOnJS(setAmountFromSlider)(event.x);
        }),
    [maxAmountValue, setAmountFromSlider]
  );

  const handleUseMaxAmount = (): void => {
    if (maxAmountValue <= 0) {
      return;
    }

    setAmount(formatAmountInputValue(maxAmountValue));
  };

  const handleOpenReview = (): void => {
    if (hasPendingSendCheckpoint) {
      Alert.alert(
        'Transfer already pending',
        'This transfer is already submitted on Sepolia. Check its pending status before sending again.'
      );
      return;
    }

    if (!canSubmit) {
      return;
    }

    setReviewVisible(true);
  };

  const handleSend = async (): Promise<void> => {
    if (sending || sendInFlightRef.current) {
      return;
    }

    if (hasPendingSendCheckpoint) {
      Alert.alert(
        'Transfer already pending',
        'This transfer is already submitted on Sepolia. Check its pending status before sending again.'
      );
      return;
    }

    if (!canSubmit) {
      return;
    }

    if (!isAddress(recipient)) {
      Alert.alert('Invalid address', 'Enter a valid Ethereum address.');
      return;
    }

    if (preflightBlocked) {
      Alert.alert(
        'Transfer preflight failed',
        blockingReasons.length > 0
          ? blockingReasons.join('\n')
          : 'Refresh balances and fee estimates before sending.'
      );
      return;
    }

    sendInFlightRef.current = true;
    setSending(true);

    try {
      const biometricResult = await authenticateWithBiometrics(
        `Authenticate to send ${assetLabel}`,
        'Use PIN'
      );

      if (!biometricResult.success) {
        if (biometricResult.error && biometricResult.error !== 'user_cancel') {
          Alert.alert('Authentication failed', biometricResult.error);
        }
        return;
      }

      const result = await sendSepoliaToken(currentAccount, asset, recipient, amount);
      showToast(`${assetLabel} sent`, 'success');
      setRecipient('');
      setAmount('');
      setEstimate(null);
      setReviewVisible(false);
      navigation.navigate('AssetDetail', { assetType: asset === 'wUNIT' ? 'UNIT' : asset });
      Alert.alert('Transfer submitted', result.txHash);
    } catch (error) {
      Alert.alert('Send failed', classifyEvmExecutionError(error).userMessage);
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

  if (reviewVisible) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="sepolia-send-review-screen">
        <View style={styles.reviewScreen}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setReviewVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="sepolia-send-review-back-btn"
              accessibilityRole="button"
              accessibilityLabel="Back to edit transfer"
            >
              <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={navigation.goBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="sepolia-send-review-close-btn"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.reviewScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.reviewEyebrow}>Review Transfer</Text>
            <Text style={styles.title}>Review send</Text>
            <Text style={styles.reviewDescription}>
              Check the asset, amount, recipient, and Sepolia gas before signing this transfer.
            </Text>

            <View style={styles.reviewAssetCard}>
              <View style={styles.reviewAssetIcon}>
                <Icon
                  name={getAssetIconName(asset)}
                  size={asset === 'USDC' ? 34 : 32}
                  color={colors.text.white}
                />
              </View>
              <Text style={styles.reviewAmount}>
                {formatTokenAmount(amount)} {assetUnit}
              </Text>
              <Text style={styles.reviewAssetLabel}>{assetLabel}</Text>
            </View>

            <View style={styles.reviewSummaryCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>To</Text>
                <Text style={styles.reviewRowValue}>{formatReviewAddress(recipient)}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>Amount</Text>
                <Text style={styles.reviewRowValue}>
                  {formatTokenAmount(amount)} {assetUnit}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>Network</Text>
                <Text style={styles.reviewRowValue}>Ethereum Sepolia</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>Network fee</Text>
                <Text style={styles.reviewRowValue}>
                  {estimate ? `~${formatEthAmount(estimate.totalFeeEth)}` : 'Estimating...'}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewRowLabel}>Required ETH</Text>
                <Text style={styles.reviewRowValue}>
                  {estimate ? formatEthAmount(estimate.requiredEth) : 'Estimating...'}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableScale
              style={[styles.reviewBtn, (!canSubmit || sending) && styles.reviewBtnDisabled]}
              onPress={handleSend}
              disabled={!canSubmit || sending}
              testID="sepolia-send-review-submit-btn"
              accessibilityLabel="Confirm and send"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit || sending, busy: sending }}
              lockWhilePending
              pressLockMs={900}
            >
              {sending ? (
                <OperationBusyIndicator label="Submitting" compact />
              ) : (
                <Text
                  style={[
                    styles.reviewBtnText,
                    (!canSubmit || sending) && styles.reviewBtnTextDisabled,
                  ]}
                >
                  Confirm and send
                </Text>
              )}
            </TouchableScale>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="sepolia-send-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>{sendTitle}</Text>
            <TouchableOpacity
              onPress={navigation.goBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="sepolia-send-back-btn"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {!sendConfigReady && (
            <View style={styles.warningCard} testID="sepolia-send-config-warning">
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <View style={styles.warningCopy}>
                <Text style={styles.warningTitle}>Sepolia send unavailable</Text>
                <Text style={styles.warningText}>
                  {rpcReady
                    ? `Configure the ${assetLabel} contract address before sending ${assetLabel}.`
                    : 'Configure EXPO_PUBLIC_SEPOLIA_RPC_URL before sending Sepolia assets.'}
                </Text>
              </View>
            </View>
          )}

          {sendRecoveryCheckpoint && sendRecoveryCopy && (
            <OperationRecoveryCard
              title={sendRecoveryCopy.title}
              body={sendRecoveryCopy.body}
              statusLabel={sendRecoveryCopy.statusLabel}
              txid={sendRecoveryCheckpoint.txHash}
              error={sendRecoveryCheckpoint.error}
              retryable={sendRecoveryCopy.retryable}
              primaryLabel={sendRecoveryCopy.primaryLabel}
              secondaryLabel="Use details"
              onPrimaryPress={handleReconcileEvmCheckpoints}
              onSecondaryPress={handleUseSendCheckpoint}
              busy={checkpointReconciling}
              disabled={checkpointReconciling}
              testID="sepolia-send-recovery-card"
            >
              {sendRecoveryCheckpoint.amount && (
                <Text style={styles.recoveryBody}>
                  Amount: {sendRecoveryCheckpoint.amount} {assetUnit}
                </Text>
              )}
              {sendRecoveryCheckpoint.recipient && (
                <Text style={styles.recoveryBody}>
                  Recipient {sendRecoveryCheckpoint.recipient}
                </Text>
              )}
              {checkpointRecoveryMessage && (
                <Text style={styles.recoveryBody} testID="sepolia-send-recovery-message">
                  {checkpointRecoveryMessage}
                </Text>
              )}
            </OperationRecoveryCard>
          )}

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Recipient Address</Text>
              {recipientError ? (
                <View style={styles.statusRow}>
                  <Ionicons name="close-circle" size={14} color={colors.semantic.error} />
                  <Text style={styles.statusTextError}>Invalid</Text>
                </View>
              ) : recipientIsValid ? (
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.semantic.success} />
                  <Text style={styles.statusTextSuccess}>Valid</Text>
                </View>
              ) : null}
            </View>

            {recipientError && (
              <Text style={styles.errorText} testID="sepolia-send-recipient-error">
                {recipientError}
              </Text>
            )}

            <View style={styles.addressContainer}>
              <TextInput
                value={recipient}
                onChangeText={setRecipient}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
                style={styles.addressInput}
                placeholder="0x..."
                placeholderTextColor={colors.text.tertiary}
                testID="sepolia-send-recipient-input"
                accessibilityLabel="Recipient Ethereum address"
                accessibilityHint="Enter the Ethereum Sepolia address to send to"
              />
              <View style={styles.addressIcons}>
                <TouchableOpacity
                  style={styles.addressIconBtn}
                  onPress={handlePasteRecipient}
                  hitSlop={8}
                  testID="sepolia-send-paste-btn"
                  accessibilityLabel="Paste address"
                  accessibilityRole="button"
                >
                  <Ionicons name="clipboard-outline" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addressIconBtn}
                  onPress={() => setShowQRScanner(true)}
                  hitSlop={8}
                  testID="sepolia-send-scan-btn"
                  accessibilityLabel="Scan QR code"
                  accessibilityRole="button"
                >
                  <Ionicons name="qr-code-outline" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.amountCard}>
            <View style={styles.amountHeader}>
              <Text style={styles.amountLabel}>Amount to Send</Text>
              <TouchableScale
                onPress={handleUseMaxAmount}
                disabled={maxAmountValue <= 0}
                testID="sepolia-send-max-btn"
                accessibilityRole="button"
                accessibilityLabel="Set maximum amount"
                accessibilityState={{ disabled: maxAmountValue <= 0 }}
              >
                <Text style={[styles.maxBtn, maxAmountValue <= 0 && styles.maxBtnDisabled]}>
                  MAX
                </Text>
              </TouchableScale>
            </View>

            <View style={styles.amountValueContainer}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleAmountFocus}
                style={styles.amountEditTarget}
                testID="sepolia-send-amount-focus-target"
                accessibilityRole="button"
                accessibilityLabel={`Edit ${assetUnit} amount`}
              >
                <View style={styles.amountValueRow}>
                  <View style={styles.amountAssetIcon}>
                    <Icon
                      name={getAssetIconName(asset)}
                      size={asset === 'USDC' ? 30 : 28}
                      color={colors.text.white}
                    />
                  </View>
                  <TextInput
                    ref={amountInputRef}
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectTextOnFocus
                    style={styles.amountInput}
                    placeholder={amountPlaceholder}
                    placeholderTextColor={colors.text.tertiary}
                    testID="sepolia-send-amount-input"
                    accessibilityLabel={`${assetUnit} amount`}
                  />
                  <Text style={styles.amountUnit}>{assetUnit}</Text>
                </View>
                <Text style={styles.amountSubvalue}>
                  {loadingBalances ? 'Loading...' : amountSubvalue}
                </Text>
              </TouchableOpacity>
            </View>

            <GestureDetector gesture={sliderGesture}>
              <View
                style={styles.sliderWrap}
                onLayout={handleSliderLayout}
                testID="sepolia-send-amount-slider"
                accessibilityRole="adjustable"
                accessibilityLabel={`${assetUnit} amount slider`}
                accessibilityValue={{
                  min: 0,
                  max: maxAmountValue,
                  now: hasValidAmount ? enteredAmount : 0,
                }}
              >
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${amountRatio}%` }]} />
                  <View style={[styles.trackThumb, { left: `${amountRatio}%` }]} />
                </View>
              </View>
            </GestureDetector>

            <View style={styles.amountFeeFooter}>
              <View style={styles.feeFooterRow}>
                <View style={styles.feeFooterCopy}>
                  <Text style={styles.feeFooterLabel}>Network Fee</Text>
                  <Text style={styles.feeFooterDescription}>
                    {estimate
                      ? `${estimate.gasUnits} gas units`
                      : `Gas balance: ${balances ? formatEthAmount(balances.eth) : 'Loading...'}`}
                  </Text>
                </View>
                <Text style={styles.feeFooterValue}>
                  {estimating
                    ? 'Estimating...'
                    : estimate
                      ? `~${formatEthAmount(estimate.totalFeeEth)}`
                      : 'Enter amount'}
                </Text>
              </View>
              {estimate && (
                <Text style={styles.feeFooterDescription}>
                  Required ETH: {formatEthAmount(estimate.requiredEth)} at {estimate.gasPriceGwei}{' '}
                  gwei
                </Text>
              )}
            </View>
          </View>

          {amountError && (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <Text style={styles.warningText}>{amountError}</Text>
            </View>
          )}

          {(insufficientAsset || insufficientEth || blockingReasons.length > 0) && (
            <View style={styles.warningCard} testID="sepolia-send-readiness-card">
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <View style={styles.warningCopy}>
                {insufficientAsset && (
                  <Text style={styles.warningText}>Not enough {assetLabel} for this amount.</Text>
                )}
                {insufficientEth && (
                  <Text style={styles.warningText}>
                    {asset === 'ETH'
                      ? 'Not enough Sepolia ETH for the amount plus gas.'
                      : 'Not enough Sepolia ETH for gas.'}
                  </Text>
                )}
                {blockingReasons.map((reason) => (
                  <Text key={reason} style={styles.warningText}>
                    {reason}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableScale
            style={[styles.reviewBtn, footerButtonDisabled && styles.reviewBtnDisabled]}
            onPress={hasPendingSendCheckpoint ? handleReconcileEvmCheckpoints : handleOpenReview}
            disabled={footerButtonDisabled}
            testID="sepolia-send-submit-btn"
            accessibilityLabel={footerButtonLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: footerButtonDisabled, busy: footerButtonBusy }}
            lockWhilePending={hasPendingSendCheckpoint}
            pressLockMs={700}
          >
            {footerButtonBusy ? (
              <OperationBusyIndicator
                label={hasPendingSendCheckpoint ? 'Checking status' : 'Submitting'}
                compact
              />
            ) : (
              <Text
                style={[styles.reviewBtnText, footerButtonDisabled && styles.reviewBtnTextDisabled]}
              >
                {footerButtonLabel}
              </Text>
            )}
          </TouchableScale>
        </View>
      </KeyboardAvoidingView>

      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  flex: {
    flex: 1,
  },
  reviewScreen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 132,
  },
  reviewScroll: {
    paddingBottom: 132,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
  },
  reviewEyebrow: {
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  reviewDescription: {
    color: colors.text.secondary,
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  reviewAssetCard: {
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  reviewAssetIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.tertiary,
    marginBottom: spacing.md,
  },
  reviewAmount: {
    color: colors.text.primary,
    fontSize: 32,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  reviewAssetLabel: {
    color: colors.text.secondary,
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    marginTop: spacing.xs,
  },
  reviewSummaryCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  reviewRowLabel: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
  },
  reviewRowValue: {
    color: colors.text.primary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    textAlign: 'right',
    flexShrink: 1,
  },
  section: {
    marginTop: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusTextError: {
    color: colors.semantic.error,
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  statusTextSuccess: {
    color: colors.semantic.success,
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressInput: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    fontFamily: fonts.regular,
    minHeight: 52,
    lineHeight: 22,
    paddingRight: spacing.sm,
  },
  addressIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressIconBtn: {
    padding: spacing.xs,
  },
  amountCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  maxBtn: {
    color: colors.brand.primary,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  maxBtnDisabled: {
    color: colors.bg.tertiary,
  },
  amountValueContainer: {
    alignItems: 'center',
  },
  amountEditTarget: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  amountValueRow: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  amountAssetIcon: {
    position: 'absolute',
    left: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountInput: {
    color: colors.text.white,
    fontSize: 32,
    fontFamily: fonts.bold,
    padding: 0,
    margin: 0,
    width: 220,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  amountUnit: {
    position: 'absolute',
    right: 16,
    color: colors.text.secondary,
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  amountSubvalue: {
    color: colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  sliderWrap: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: SLIDER_HORIZONTAL_INSET,
  },
  track: {
    height: 5,
    backgroundColor: colors.border.light,
    borderRadius: 999,
    overflow: 'visible',
  },
  trackFill: {
    height: 5,
    backgroundColor: colors.brand.primary,
    borderRadius: 999,
  },
  trackThumb: {
    position: 'absolute',
    top: -(SLIDER_THUMB_SIZE - 5) / 2,
    width: SLIDER_THUMB_SIZE,
    height: SLIDER_THUMB_SIZE,
    marginLeft: -SLIDER_THUMB_SIZE / 2,
    borderRadius: SLIDER_THUMB_SIZE / 2,
    backgroundColor: colors.text.white,
    borderWidth: 2,
    borderColor: colors.bg.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  amountFeeFooter: {
    marginTop: 16,
    marginHorizontal: -16,
    marginBottom: -16,
    backgroundColor: '#28272C',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 6,
  },
  feeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  feeFooterCopy: {
    flex: 1,
  },
  feeFooterLabel: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    marginBottom: 4,
  },
  feeFooterValue: {
    color: colors.text.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    textAlign: 'right',
    flexShrink: 0,
  },
  feeFooterDescription: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    lineHeight: 19,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(208,76,104,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  warningCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  warningTitle: {
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
  },
  warningText: {
    flex: 1,
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    lineHeight: 19,
  },
  recoveryBody: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    lineHeight: 19,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    marginBottom: spacing.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg.primary,
  },
  reviewBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reviewBtnDisabled: {
    backgroundColor: colors.bg.tertiary,
  },
  reviewBtnText: {
    color: colors.text.white,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  reviewBtnTextDisabled: {
    color: colors.text.tertiary,
  },
});
