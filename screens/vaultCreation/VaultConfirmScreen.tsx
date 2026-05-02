/**
 * VaultConfirmScreen - Review and confirm vault creation
 * Features: Summary display, biometric authentication before signing
 */

import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import React,{ useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { ActivityIndicator,Alert,ScrollView,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableScale from '../../components/common/TouchableScale';
import Icon from '../../components/icons';
import { ReceiveAssetBadge, getReceiveAssetMeta } from '../../components/vaultAction';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { useCreateVaultToUsdcSettlement } from '../../hooks/useCreateVaultToUsdcSettlement';
import { usePrice } from '../../stores/priceStore';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';
import { isE2E } from '../../utils/e2e';
import { formatFiat } from '../../utils/formatters';
import { formatVaultUsd } from '../../utils/vaultFaceValue';
import { getOpCostOpen, getVaultSettlementReserveSats } from '../../utils/vaultUtils';

interface VaultConfirmScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function VaultConfirmScreen({ navigation }: VaultConfirmScreenProps) {
  const {
    btcAmount,
    borrowAmountUsd,
    receiveAsset,
    selectedFeeRate,
    error,
    setCurrentStep,
    healthFactor,
    liquidationPrice,
  } = useVaultCreation();

  const { createVault, isLoading, quoteBorrowToUsdc } = useCreateVaultToUsdcSettlement();
  const { btcPrice } = usePrice();
  const { utxos } = useBalance();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
  const effectiveReceiveAsset = usdcFeaturesEnabled ? receiveAsset : 'UNIT';
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedUsdcOut, setEstimatedUsdcOut] = useState<string | null>(null);
  const confirmInFlightRef = useRef(false);
  const isBusy = isLoading || isAuthenticating || isSubmitting;

  useEffect(() => {
    let cancelled = false;

    if (borrowAmountUsd <= 0 || effectiveReceiveAsset !== 'USDC') {
      setEstimatedUsdcOut(null);
      return () => {
        cancelled = true;
      };
    }

    quoteBorrowToUsdc(borrowAmountUsd)
      .then((quote) => {
        if (!cancelled) {
          setEstimatedUsdcOut(quote.estimatedUsdcOut);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEstimatedUsdcOut(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [borrowAmountUsd, quoteBorrowToUsdc, effectiveReceiveAsset]);

  // Calculate USD values
  const btcUsdValue = btcPrice ? btcAmount * btcPrice : 0;

  // Dynamic fee calculation based on UTXOs and selected rate
  const estimatedFee = useMemo(() => {
    const openFee = getOpCostOpen(selectedFeeRate, utxos);
    return effectiveReceiveAsset === 'USDC'
      ? openFee + getVaultSettlementReserveSats(selectedFeeRate)
      : openFee;
  }, [effectiveReceiveAsset, selectedFeeRate, utxos]);

  const feeUsdValue = btcPrice ? (estimatedFee / 100_000_000) * btcPrice : 0;
  const payoutMeta = getReceiveAssetMeta(effectiveReceiveAsset);

  // Handle confirm with biometric authentication
  const handleConfirm = useCallback(async () => {
    if (confirmInFlightRef.current) {
      return;
    }

    confirmInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      setIsAuthenticating(true);

      // Check if biometrics are available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!isE2E() && hasHardware && isEnrolled) {
        // Authenticate with biometrics
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to create vault',
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (!result.success) {
          if (result.error !== 'user_cancel') {
            Alert.alert('Authentication Failed', 'Please try again');
          }
          setIsAuthenticating(false);
          return;
        }
      }

      // Proceed with vault creation
      setIsAuthenticating(false);
      setCurrentStep('processing');
      navigation.navigate('VaultProcessing');
      await createVault();
    } catch (err) {
      setIsAuthenticating(false);
      setCurrentStep('confirm');
      if (navigation.canGoBack()) navigation.goBack();
      Alert.alert('Error', 'Failed to create vault. Please try again.');
    } finally {
      setIsAuthenticating(false);
      setIsSubmitting(false);
      confirmInFlightRef.current = false;
    }
  }, [createVault, setCurrentStep, navigation]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (isBusy) {
      return;
    }

    setCurrentStep(usdcFeaturesEnabled ? 'payout' : 'amounts');
    navigation.goBack();
  }, [isBusy, setCurrentStep, navigation, usdcFeaturesEnabled]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="vault-create-confirm-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Review</Text>
            <Text style={styles.title}>Confirm Vault</Text>
          </View>
          <TouchableOpacity
            onPress={handleBack}
            disabled={isBusy}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Summary Card - All info in one dense block */}
        <View style={styles.summaryCard}>
          {/* Deposit Amount - Highlighted */}
          <View style={styles.depositSection}>
            <Text style={styles.depositLabel}>BTC Deposit</Text>
            <View style={styles.amountRow}>
              <Text style={styles.depositAmount}>{btcAmount.toFixed(8)}</Text>
              <Icon name="btc_symbol" size={24} />
            </View>
            <Text style={styles.depositUsd}>≈ ${formatFiat(btcUsdValue)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.routeCard}>
            <View style={styles.routeCopy}>
              <Text style={styles.routeLabel}>Payout Route</Text>
              <Text style={styles.routeText}>{payoutMeta.note}</Text>
            </View>
            <ReceiveAssetBadge asset={effectiveReceiveAsset} />
          </View>

          <View style={styles.divider} />

          {/* Borrow Amount */}
          <View style={styles.row}>
            <Text style={styles.label}>Debt to Add</Text>
            <Text style={styles.valueHighlight}>{formatVaultUsd(borrowAmountUsd)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Receive As</Text>
            <ReceiveAssetBadge asset={effectiveReceiveAsset} size="sm" />
          </View>

          {effectiveReceiveAsset === 'USDC' && estimatedUsdcOut && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Estimated Sepolia USDC Received</Text>
                <Text style={styles.valueHighlight}>{estimatedUsdcOut} USDC</Text>
              </View>
            </>
          )}

          {effectiveReceiveAsset === 'UNIT' && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Estimated UNIT Received</Text>
                <Text style={styles.valueHighlight}>{borrowAmountUsd.toFixed(2)} UNIT</Text>
              </View>
            </>
          )}

          <View style={styles.divider} />

          {/* Health Factor */}
          <View style={styles.row}>
            <Text style={styles.label}>Health Factor</Text>
            <Text style={[styles.valueHighlight, { color: getHealthColor(healthFactor) }]}>
              {borrowAmountUsd > 0 ? `${healthFactor}%` : '∞'}
            </Text>
          </View>

          {/* Liquidation Price */}
          <View style={styles.row}>
            <Text style={styles.label}>Liquidation Price</Text>
            <Text style={[styles.valueHighlight, { color: colors.semantic.error }]}>
              {liquidationPrice === Infinity || liquidationPrice === 0 ? 'None' : `$${formatFiat(liquidationPrice)}`}
            </Text>
          </View>

        </View>

        {/* Fee Display - Separate section matching other confirm screens */}
        <View style={styles.feeSection}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Network Fee</Text>
            <View style={styles.feeValues}>
              <View style={styles.feeAmountRow}>
                <Text style={styles.feeAmount}>{(estimatedFee / 100_000_000).toFixed(8)}</Text>
                <Icon name="btc_symbol" size={14} />
              </View>
              <Text style={styles.feeUsdText}>≈ ${formatFiat(feeUsdValue)}</Text>
            </View>
          </View>
          <View style={[styles.feeRow, { marginTop: spacing.sm }]}>
            <Text style={styles.feeLabel}>Fee Rate</Text>
            <Text style={styles.feeAmount}>{selectedFeeRate} sat/vB</Text>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
          <TouchableScale
            style={styles.backButton}
            onPress={handleBack}
            disabled={isBusy}
            pressLockMs={700}
          >
            <Text style={styles.backText}>Back</Text>
          </TouchableScale>

          <TouchableScale
          style={[styles.confirmButton, isBusy && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isBusy}
          testID="vault-create-confirm-btn"
          accessibilityRole="button"
          accessibilityLabel={isBusy ? 'Preparing vault creation' : 'Confirm and sign vault creation'}
          accessibilityState={{ disabled: isBusy, busy: isBusy }}
          lockWhilePending
          pressLockMs={900}
        >
          {isAuthenticating ? (
            <Ionicons name="finger-print" size={20} color={colors.text.white} />
          ) : isSubmitting || isLoading ? (
            <View style={styles.busyButtonContent}>
              <ActivityIndicator size="small" color={colors.text.white} />
              <Text style={styles.confirmText}>Preparing...</Text>
            </View>
          ) : (
            <Text style={styles.confirmText}>Confirm & Sign</Text>
          )}
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

function getHealthColor(health: number): string {
  if (health >= 200) return colors.semantic.success;
  if (health > 160) return '#fde37b'; // Moderate yellow
  return colors.semantic.error;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerCopy: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  summaryCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  depositSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  depositLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  depositAmount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  depositUsd: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.md,
  },
  routeCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  routeCopy: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  routeText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    flex: 1,
  },
  valueHighlight: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  feeSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  feeValues: {
    alignItems: 'flex-end',
  },
  feeAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  feeAmount: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  feeUsdText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  errorContainer: {
    backgroundColor: 'rgba(208, 76, 104, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.semantic.error,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  busyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
