/**
 * VaultInputScreen - Generic input screen for all vault operations
 * Uses configuration pattern to handle borrow, deposit, repay, and withdraw
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
ActivityIndicator,
KeyboardAvoidingView,
Platform,
ScrollView,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeeRateDropdown } from '../../components/common/FeeRateSelectorCompact';
import TouchableScale from '../../components/common/TouchableScale';
import { AmountSlider,VaultActionGauge,VaultChangesCard } from '../../components/vaultAction';
import { UnitAmountSlider } from '../../components/vaultAction/UnitAmountSlider';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';
import { useVaultInputScreen } from './hooks';
import type { VaultInputScreenConfig,VaultScreenNavigationProp,VaultStoreState } from './types';

interface VaultInputScreenProps<TStore extends VaultStoreState, TAdditionalData = unknown> {
  navigation: VaultScreenNavigationProp;
  config: VaultInputScreenConfig<TStore, TAdditionalData>;
  store: TStore;
  loadVaultData: () => void;
  additionalData?: TAdditionalData;
}

export default function VaultInputScreen<TStore extends VaultStoreState, TAdditionalData = unknown>({
  navigation,
  config,
  store,
  loadVaultData,
  additionalData,
}: VaultInputScreenProps<TStore, TAdditionalData>) {
  const {
    // Vault state
    effectiveBtcLocked,
    effectiveUnitBorrowed,
    isInitializing,
    isContinuing,
    btcPrice,

    // Amount state
    amountConfig,

    // Health calculations
    currentHealth,
    currentLiqPrice,
    preview,
    hasChanges,

    // Fees
    selectedFeeRate,
    setSelectedFeeRate,
    estimatedFeeSats,

    // Validation
    validation,

    // Empty state
    emptyState,

    // Actions
    handleClose,
    handleContinue,
    handleLiveValueChange,

    // Slider color
    sliderColor,
  } = useVaultInputScreen(
    { config, store, loadVaultData, additionalData },
    navigation
  );

  // Show loading state during initialization to prevent layout flash
  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Empty state (no vault, no balance, etc.)
  if (emptyState) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name={emptyState.icon} size={48} color={emptyState.iconColor} />
          <Text style={styles.noVaultText}>{emptyState.title}</Text>
          {emptyState.subtitle && (
            <Text style={styles.noVaultSubtext}>{emptyState.subtitle}</Text>
          )}
          <TouchableScale
            style={styles.closeBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeBtnText} accessibilityElementsHidden>Close</Text>
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Determine if we should show the "no debt" indicator on gauge (for repay operation)
  const hasNoDebt = config.operationType === 'repay' && hasChanges && preview.newDebt === 0;
  const continueDisabled = !validation.canContinue || isContinuing;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID={`vault-${config.operationType}-input-screen`}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header} accessibilityRole="header">
            <Text style={styles.title} accessibilityRole="header">{config.title}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.headerCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint={`Close ${config.title} screen`}
            >
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Gauge */}
          <VaultActionGauge
            currentHealth={currentHealth}
            newHealth={hasChanges ? preview.newHealth : undefined}
            showTransition={hasChanges}
            hasNoDebt={hasNoDebt}
          />

          {/* Slider with Fee Selector inside */}
          <View style={styles.section}>
            {amountConfig.isUnitAmount ? (
              <UnitAmountSlider
                value={amountConfig.value}
                maxValue={amountConfig.maxValue}
                onValueChange={amountConfig.setValue}
                onLiveValueChange={handleLiveValueChange}
                label={amountConfig.label}
                unitLabel={amountConfig.displayUnitLabel}
                disabled={amountConfig.maxValue <= 0}
                sliderColor={sliderColor}
                hideAvailable={amountConfig.hideAvailable}
                renderFooter={() => (
                  <FeeRateDropdown
                    selectedRate={selectedFeeRate}
                    onRateChange={setSelectedFeeRate}
                    estimatedFeeSats={estimatedFeeSats}
                    transparent
                  />
                )}
              />
            ) : (
              <AmountSlider
                value={amountConfig.value}
                maxValue={amountConfig.maxValue}
                onValueChange={amountConfig.setValue}
                onLiveValueChange={handleLiveValueChange}
                label={amountConfig.label}
                btcPrice={btcPrice ?? undefined}
                disabled={amountConfig.maxValue <= 0}
                sliderColor={sliderColor}
                renderFooter={() => (
                  <FeeRateDropdown
                    selectedRate={selectedFeeRate}
                    onRateChange={setSelectedFeeRate}
                    estimatedFeeSats={estimatedFeeSats}
                    transparent
                  />
                )}
              />
            )}
          </View>

          {/* Validation errors */}
          {validation.errors.map((error, index) => (
            <View
              key={`error-${index}`}
              style={styles.warning}
              accessibilityRole="alert"
              accessibilityLabel={`Error: ${error}`}
            >
              <Ionicons name="warning" size={20} color={colors.semantic.error} accessibilityElementsHidden />
              <Text style={styles.warningText} accessibilityElementsHidden>{error}</Text>
            </View>
          ))}

          {/* Validation warnings */}
          {validation.warnings.map((warning, index) => (
            <View
              key={`warning-${index}`}
              style={styles.warningYellow}
              accessibilityRole="alert"
              accessibilityLabel={`Warning: ${warning}`}
            >
              <Ionicons name="warning" size={20} color={colors.semantic.warning} accessibilityElementsHidden />
              <Text style={styles.warningTextYellow} accessibilityElementsHidden>{warning}</Text>
            </View>
          ))}

          {/* Store error */}
          {store.error && (
            <View
              style={styles.warning}
              accessibilityRole="alert"
              accessibilityLabel={`Error: ${store.error}`}
            >
              <Ionicons name="warning" size={20} color={colors.semantic.error} accessibilityElementsHidden />
              <Text style={styles.warningText} accessibilityElementsHidden>{store.error}</Text>
            </View>
          )}

          {/* Changes */}
          <View style={styles.section}>
            <VaultChangesCard
              currentCollateral={effectiveBtcLocked}
              currentDebt={effectiveUnitBorrowed}
              currentHealth={currentHealth}
              newCollateral={preview.newCollateral}
              newDebt={preview.newDebt}
              newHealth={hasChanges ? preview.newHealth : currentHealth}
              currentLiquidationPrice={currentLiqPrice}
              newLiquidationPrice={hasChanges ? preview.newLiqPrice : currentLiqPrice}
              showChanges={hasChanges}
              actionType={config.changesActionType}
              hideTitle
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableScale
            style={[styles.continueBtn, continueDisabled && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={continueDisabled}
            testID={`vault-${config.operationType}-continue-btn`}
            accessibilityRole="button"
            accessibilityLabel={isContinuing ? "Preparing review" : "Continue to review"}
            accessibilityHint={`Review ${config.title} details before confirming`}
            accessibilityState={{ disabled: continueDisabled, busy: isContinuing }}
            pressLockMs={700}
          >
            {isContinuing ? (
              <View style={styles.busyButtonContent}>
                <ActivityIndicator size="small" color={colors.text.white} />
                <Text style={styles.continueBtnText} accessibilityElementsHidden>Preparing...</Text>
              </View>
            ) : (
              <Text
                style={[styles.continueBtnText, !validation.canContinue && styles.continueBtnTextDisabled]}
                accessibilityElementsHidden
              >
                Continue
              </Text>
            )}
          </TouchableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  noVaultText: { color: colors.text.primary, fontSize: fontSizes.xl, fontFamily: fonts.bold },
  noVaultSubtext: { color: colors.text.secondary, fontSize: fontSizes.md, textAlign: 'center' },
  closeBtn: { backgroundColor: colors.brand.primary, borderRadius: radii.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  closeBtnText: { color: colors.text.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  headerCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
    zIndex: 10,
  },
  title: { color: colors.text.primary, fontSize: fontSizes.xxl, fontFamily: fonts.bold },
  section: { marginTop: spacing.lg },
  warning: { flexDirection: 'row', backgroundColor: 'rgba(208,76,104,0.1)', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  warningText: { flex: 1, color: colors.semantic.error, fontSize: fontSizes.sm, fontFamily: fonts.medium },
  warningYellow: { flexDirection: 'row', backgroundColor: 'rgba(253,227,123,0.15)', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  warningTextYellow: { flex: 1, color: colors.semantic.warning, fontSize: fontSizes.sm, fontFamily: fonts.medium },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border.default },
  continueBtn: { backgroundColor: colors.brand.primary, borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: colors.bg.tertiary },
  continueBtnText: { color: colors.text.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
  continueBtnTextDisabled: { color: colors.text.tertiary },
  busyButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
