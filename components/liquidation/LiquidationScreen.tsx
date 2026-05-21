import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analytics } from '../../services/analyticsService';
import { LIQUIDATION_EVENTS } from '../../constants/analyticsEvents';
import Icon from '../icons';
import ErrorBoundary from '../ErrorBoundary';
import MutinynetBanner from '../MutinynetBanner';
import {
  selectItemsForAmount,
  getTotalClaimBtc,
  getTotalEstimatedProfit,
  getHealthAfterLiquidation,
} from '../../services/liquidation/calculations';
import { MIN_COL_RATE, UNIT_TO_BTC_RATE } from '../../services/liquidation/constants';
import CurrencyToggle from './CurrencyToggle';
import LiquidationStatusScreen from './LiquidationStatusScreen';
import LiquidationReviewScreen from './LiquidationReviewScreen';
import LiquidationInputScreen from './LiquidationInputScreen';
import LiquidationEmptyStates from './LiquidationEmptyStates';
import OperationRecoveryCard from '../common/OperationRecoveryCard';
import {
  useLiquidationFlowStore,
  useLiqStep,
  useLiqFetchStatus,
  useLiqInvestAmount,
  useLiqShowBTC,
  useLiqReviewTab,
  useLiqVaultExpanded,
  useLiqProcessingMsg,
  useLiqResultTxid,
  useLiqResultSwapTxid,
  useLiqError,
  useLiqVaults,
  useLiqVaultsFull,
  useLiqIsExecuting,
  useLiqProfitRate,
  useLiqDepositRate,
  useLiqSwapRate,
} from '../../stores/liquidationFlowStore';
import { useHasPendingVaultTx } from '../../stores/pendingVaultTransactionStore';
import { useLiquidationVaults } from '../../hooks/liquidation/useLiquidationVaults';
import { useLiquidationExecution } from '../../hooks/liquidation/useLiquidationExecution';
import { isStaleLiquidationOpportunityError } from '../../utils/liquidationErrors';
import { colors, fonts, fontSizes } from '../../styles/theme';
import type { WalletAddresses } from '../../contexts/WalletContext';
import type { VaultData } from '../../services/vaultService';

/**
 * Props for LiquidationScreen
 */
export interface LiquidationScreenProps {
  btcPrice: number | null;
  segwitBalance: number;
  taprootBalance: number;
  vaultCollateral: number;
  vaultDebt: number;
  hasVault: boolean;
  wallet: WalletAddresses | null;
  vaultData: VaultData | null;
  currentAccount: number;
  visible: boolean;
  onClose: () => void;
  onToggle: () => void;
  onReviewStart?: () => void;
  onBackToInput?: () => void;
  bottomInset?: number;
}

const LiquidationScreen = React.memo(function LiquidationScreen({
  btcPrice,
  segwitBalance,
  taprootBalance,
  vaultCollateral,
  vaultDebt,
  hasVault,
  wallet,
  vaultData,
  currentAccount,
  visible,
  onClose,
  onReviewStart,
  onBackToInput,
  bottomInset,
}: LiquidationScreenProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();

  // ── Store selectors ──────────────────────────────────────────────
  const currentStep = useLiqStep();
  const fetchStatus = useLiqFetchStatus();
  const investAmount = useLiqInvestAmount();
  const showBTC = useLiqShowBTC();
  const reviewTab = useLiqReviewTab();
  const vaultExpanded = useLiqVaultExpanded();
  const processingMessage = useLiqProcessingMsg();
  const resultTxid = useLiqResultTxid();
  const resultSwapTxid = useLiqResultSwapTxid();
  const error = useLiqError();
  const vaults = useLiqVaults();
  const vaultsFull = useLiqVaultsFull();
  const isExecuting = useLiqIsExecuting();
  const profitRate = useLiqProfitRate();
  const _depositRate = useLiqDepositRate();
  const _swapRate = useLiqSwapRate();
  const hasPendingVaultTx = useHasPendingVaultTx();
  const isStaleOpportunityError = isStaleLiquidationOpportunityError(error);

  const { setCurrentStep, setInvestAmount, setShowBTC, setReviewTab, setVaultExpanded } =
    useLiquidationFlowStore.getState();

  // Track screen opened when visible
  useEffect(() => {
    if (visible) {
      analytics.track(LIQUIDATION_EVENTS.LIQUIDATION_SCREEN_OPENED);
    }
  }, [visible]);

  // ── Hooks ────────────────────────────────────────────────────────
  const { maxInvestable, refreshLiqVaults } = useLiquidationVaults({
    btcPrice,
    segwitBalance,
    taprootBalance,
    vaultCollateral,
    vaultDebt,
    hasVault,
    visible,
  });
  const hadPendingVaultTxRef = useRef(hasPendingVaultTx);

  useEffect(() => {
    const hadPendingVaultTx = hadPendingVaultTxRef.current;
    hadPendingVaultTxRef.current = hasPendingVaultTx;

    if (hadPendingVaultTx && !hasPendingVaultTx) {
      refreshLiqVaults({ force: true }).catch(() => undefined);
    }
  }, [hasPendingVaultTx, refreshLiqVaults]);

  useEffect(() => {
    if (visible && currentStep === 'error' && isStaleOpportunityError) {
      refreshLiqVaults({ force: true }).catch(() => undefined);
    }
  }, [currentStep, isStaleOpportunityError, refreshLiqVaults, visible]);

  const { execute, resetAfterSuccess, resetAfterError } = useLiquidationExecution({
    wallet,
    vaultCollateral,
    vaultDebt,
    btcPrice,
    vaultData,
    currentAccount,
  });

  // ── Derived state for empty/loading ──────────────────────────────
  const isLoaded = fetchStatus === 'loaded' || fetchStatus === 'error';
  const isProcessingOrResult =
    currentStep === 'processing' || currentStep === 'success' || currentStep === 'error';
  const isReview = currentStep === 'review';
  const isInput = currentStep === 'input';
  const hasStaleVaultData = fetchStatus === 'error' && vaults.length > 0;
  const hasClaimableLiquidations = hasVault && isLoaded && vaults.length > 0 && maxInvestable > 0;
  const shouldShowBottomButton =
    currentStep !== 'processing' && (!isInput || hasClaimableLiquidations);
  const selectedInputVaults = useMemo(() => {
    if (investAmount <= 0 || vaultsFull.length === 0) {
      return [];
    }

    return selectItemsForAmount(vaultsFull, investAmount);
  }, [investAmount, vaultsFull]);
  const healthAfterLiquidation = useMemo(() => {
    if (!btcPrice || selectedInputVaults.length === 0) {
      return null;
    }

    return getHealthAfterLiquidation({
      btcPrice,
      btcInVault: vaultCollateral || 0,
      unitInVault: vaultDebt || 0,
      claimedVaults: selectedInputVaults,
    });
  }, [btcPrice, selectedInputVaults, vaultCollateral, vaultDebt]);
  const wouldBreakMinimumHealth =
    healthAfterLiquidation !== null
    && (!Number.isFinite(healthAfterLiquidation.finalHealthValue)
      || healthAfterLiquidation.finalHealthValue < MIN_COL_RATE * 100);
  const inputAmountInvalid =
    investAmount <= 0
    || investAmount > maxInvestable
    || wouldBreakMinimumHealth
    || hasPendingVaultTx
    || !hasClaimableLiquidations;

  // ── Callbacks ────────────────────────────────────────────────────
  const handleToggleBTC = useCallback(() => {
    setShowBTC(!showBTC);
  }, [showBTC, setShowBTC]);

  const handleExpandToggle = useCallback(() => {
    setVaultExpanded(!vaultExpanded);
  }, [vaultExpanded, setVaultExpanded]);

  const handleTabChange = useCallback(
    (tab: 'overview' | 'howItWorks') => {
      setReviewTab(tab);
    },
    [setReviewTab]
  );

  const handleBack = useCallback(() => {
    if (isExecuting) {
      return;
    }

    if (currentStep === 'review') {
      setCurrentStep('input');
      onBackToInput?.();
    }
  }, [currentStep, isExecuting, onBackToInput, setCurrentStep]);

  const handleButtonPress = useCallback(async () => {
    const latestState = useLiquidationFlowStore.getState();
    const isLocked = latestState.isExecuting;
    const latestStep = latestState.currentStep;

    if (
      isLocked
      || latestStep === 'processing'
      || (hasPendingVaultTx && (latestStep === 'input' || latestStep === 'review'))
    ) {
      return;
    }

    if (latestStep === 'input') {
      if (
        latestState.investAmount <= 0
        || latestState.investAmount > maxInvestable
        || wouldBreakMinimumHealth
        || !hasClaimableLiquidations
      ) {
        return;
      }

      setCurrentStep('review');
      onReviewStart?.();
    } else if (latestStep === 'review') {
      await execute();
    } else if (latestStep === 'success') {
      resetAfterSuccess();
      onClose();
    } else if (latestStep === 'error') {
      if (isStaleLiquidationOpportunityError(latestState.error)) {
        resetAfterError();
        useLiquidationFlowStore.getState().setFetchStatus('idle');
        refreshLiqVaults({ force: true }).catch(() => undefined);
        return;
      }
      resetAfterError();
    }
  }, [
    hasClaimableLiquidations,
    hasPendingVaultTx,
    maxInvestable,
    wouldBreakMinimumHealth,
    setCurrentStep,
    onReviewStart,
    execute,
    resetAfterSuccess,
    onClose,
    resetAfterError,
    refreshLiqVaults,
  ]);

  const handleErrorDecline = useCallback(() => {
    resetAfterError();
    onClose();
  }, [onClose, resetAfterError]);

  // ── Button label + disabled ──────────────────────────────────────
  const buttonDisabled =
    isExecuting
    || (isInput && inputAmountInvalid)
    || (isReview && hasPendingVaultTx)
    || currentStep === 'processing';
  const buttonLabel =
    currentStep === 'processing'
      ? 'Processing...'
      : currentStep === 'success'
        ? 'Done'
        : currentStep === 'error'
          ? isStaleOpportunityError
            ? 'Yes, Try Again'
            : 'Try Again'
          : isReview
            ? 'Claim Liquidation'
            : 'Continue';

  const headerTopPadding = 0;
  const useStickyActionBar = !isInput;
  const stickyBottomOffset = useStickyActionBar ? (bottomInset ?? 0) : 0;
  const continueBottomInset = useStickyActionBar
    ? 0
    : (bottomInset ?? Math.max(insets.bottom + 24, 38));
  const actionWrapStyle = [
    useStickyActionBar ? styles.stickyActionWrap : styles.continueWrap,
    useStickyActionBar
      ? { bottom: stickyBottomOffset, paddingBottom: Math.max(insets.bottom + 14, 24) }
      : { bottom: continueBottomInset },
  ];

  const bottomAction = shouldShowBottomButton ? (
    <View style={actionWrapStyle}>
      <TouchableOpacity
        style={[styles.continueBtn, buttonDisabled && styles.continueBtnDisabled]}
        onPress={handleButtonPress}
        testID="liquidation-continue-btn"
        disabled={buttonDisabled}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
      >
        <Text style={styles.continueBtnText}>{buttonLabel}</Text>
      </TouchableOpacity>
      {currentStep === 'error' && isStaleOpportunityError && (
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleErrorDecline}
          testID="liquidation-decline-retry-btn"
          accessibilityRole="button"
          accessibilityLabel="No, Back Home"
        >
          <Text style={styles.secondaryBtnText}>No, Back Home</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  // ── Render body ──────────────────────────────────────────────────
  const renderBody = (): React.ReactElement => {
    if (isProcessingOrResult) {
      return (
        <LiquidationStatusScreen
          step={currentStep}
          processingMessage={processingMessage}
          txid={resultTxid}
          swapTxid={resultSwapTxid}
          error={error}
          isStaleOpportunity={isStaleOpportunityError}
          remainingVaultCount={vaults.length}
        />
      );
    }

    if (isReview) {
      // Compute exact values from actual selected vaults (not approximated rates)
      const selected = selectItemsForAmount(vaultsFull, investAmount);
      const exactClaimBtc = getTotalClaimBtc(selected);
      const exactProfitBtc = getTotalEstimatedProfit(selected);
      const exactSwapUnit = selected.reduce(
        (acc, v) =>
          acc +
          (v.claimAmountPartial ? (v.claimAmountPartial / v.claimAmountBtc) * v.unit : v.unit),
        0
      );
      // Swap BTC includes protocol swap rate (matching calculateSwapBtcAmount in execution)
      const exactSwapBtc = btcPrice
        ? parseFloat(((exactSwapUnit / (btcPrice ?? 1)) * UNIT_TO_BTC_RATE).toFixed(8))
        : 0;
      const exactTotalBtc = exactClaimBtc + exactSwapBtc;
      const exactReturnBtc = exactTotalBtc + exactProfitBtc;
      const exactProfitPercent = exactClaimBtc > 0 ? (exactProfitBtc / exactClaimBtc) * 100 : 0;

      return (
        <LiquidationReviewScreen
          claimBtc={exactClaimBtc}
          swapBtc={exactSwapBtc}
          swapUnit={exactSwapUnit}
          profitBtc={exactProfitBtc}
          profitPercent={exactProfitPercent}
          totalBtc={exactTotalBtc}
          returnBtc={exactReturnBtc}
          btcPrice={btcPrice ?? 0}
          showBTC={showBTC}
          reviewTab={reviewTab}
          onTabChange={handleTabChange}
        />
      );
    }

    // Input step — check empty states
    if (!hasVault) {
      return <LiquidationEmptyStates variant="noVault" onBackToWallet={onClose} />;
    }

    if (fetchStatus === 'error' && vaults.length === 0) {
      return <LiquidationEmptyStates variant="error" onBackToWallet={onClose} />;
    }

    if (isLoaded && vaults.length === 0) {
      return <LiquidationEmptyStates variant="noVaults" onBackToWallet={onClose} />;
    }

    if (isLoaded && maxInvestable <= 0) {
      return <LiquidationEmptyStates variant="lowCollateral" onBackToWallet={onClose} />;
    }

    if (!isLoaded) {
      return <LiquidationEmptyStates variant="loading" />;
    }

    return (
      <View style={styles.inputBody}>
        {hasStaleVaultData && (
          <View style={styles.staleCardWrap}>
            <OperationRecoveryCard
              title="Showing last vault data"
              body="The latest liquidation refresh failed, so this dashboard is keeping the last successful vault set visible. Refresh will retry automatically."
              statusLabel="Stale"
              testID="liquidation-stale-data-card"
            />
          </View>
        )}
        <LiquidationInputScreen
          maxInvestable={maxInvestable}
          investAmount={investAmount}
          onInvestAmountChange={setInvestAmount}
          btcPrice={btcPrice ?? 0}
          showBTC={showBTC}
          vaults={vaults}
          vaultsFull={vaultsFull}
          vaultsLoaded={isLoaded}
          vaultExpanded={vaultExpanded}
          onExpandToggle={handleExpandToggle}
          profitRate={profitRate}
          disabled={hasPendingVaultTx}
        />
      </View>
    );
  };

  return (
    <ErrorBoundary
      boundaryName="Liquidations"
      fallbackMessage="Unable to load liquidations. Please try again."
      onReset={() => {
        onClose();
      }}
    >
      {!isProcessingOrResult && <MutinynetBanner />}

      {/* Header — hidden during processing/success/error (status screen has its own title) */}
      {!isProcessingOrResult && (
        <View style={[styles.header, { paddingTop: headerTopPadding }]}>
          <View style={styles.headerLeft}>
            {isReview && (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                testID="liquidation-back-btn"
              >
                <Icon name="back" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            )}
            <Text style={styles.title}>Liquidations</Text>
          </View>
          {hasVault && <CurrencyToggle showBTC={showBTC} onToggle={handleToggleBTC} />}
        </View>
      )}

      {/* Body */}
      {renderBody()}

      {/* Bottom Button — hidden during processing */}
      {bottomAction}
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flexShrink: 1,
    fontSize: 30,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  inputBody: {
    flex: 1,
  },
  staleCardWrap: {
    paddingHorizontal: 16,
  },
  continueWrap: {
    position: 'absolute',
    bottom: 38,
    left: 24,
    right: 24,
    zIndex: 100,
  },
  stickyActionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  continueBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.secondary,
  },
  secondaryBtnText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
  },
});

export default LiquidationScreen;
