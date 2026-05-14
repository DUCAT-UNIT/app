import React, { useCallback, useEffect } from 'react';
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
} from '../../services/liquidation/calculations';
import { UNIT_TO_BTC_RATE } from '../../services/liquidation/constants';
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
import { useLiquidationVaults } from '../../hooks/liquidation/useLiquidationVaults';
import { useLiquidationExecution } from '../../hooks/liquidation/useLiquidationExecution';
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

  const { setCurrentStep, setInvestAmount, setShowBTC, setReviewTab, setVaultExpanded } =
    useLiquidationFlowStore.getState();

  // Track screen opened when visible
  useEffect(() => {
    if (visible) {
      analytics.track(LIQUIDATION_EVENTS.LIQUIDATION_SCREEN_OPENED);
    }
  }, [visible]);

  // ── Hooks ────────────────────────────────────────────────────────
  const { maxInvestable } = useLiquidationVaults({
    btcPrice,
    segwitBalance,
    taprootBalance,
    vaultCollateral,
    vaultDebt,
    hasVault,
    visible,
  });

  const { execute, resetAfterSuccess, resetAfterError } = useLiquidationExecution({
    wallet,
    vaultCollateral,
    vaultDebt,
    btcPrice,
    vaultData,
    currentAccount,
  });

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
    if (currentStep === 'review') {
      setCurrentStep('input');
      onBackToInput?.();
    }
  }, [currentStep, onBackToInput, setCurrentStep]);

  const handleButtonPress = useCallback(async () => {
    if (currentStep === 'input') {
      setCurrentStep('review');
      onReviewStart?.();
    } else if (currentStep === 'review') {
      await execute();
    } else if (currentStep === 'success') {
      resetAfterSuccess();
      onClose();
    } else if (currentStep === 'error') {
      resetAfterError();
    }
  }, [
    currentStep,
    setCurrentStep,
    onReviewStart,
    execute,
    resetAfterSuccess,
    onClose,
    resetAfterError,
  ]);

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

  // ── Button label + disabled ──────────────────────────────────────
  const buttonDisabled =
    isExecuting
    || (isInput && (investAmount <= 0 || !hasClaimableLiquidations))
    || currentStep === 'processing';
  const buttonLabel =
    currentStep === 'processing'
      ? 'Processing...'
      : currentStep === 'success'
        ? 'Done'
        : currentStep === 'error'
          ? 'Try Again'
          : isReview
            ? 'Claim Liquidation'
            : 'Continue';

  const headerTopPadding = 0;
  const useStickyActionBar = !isInput;
  const continueBottomInset = useStickyActionBar
    ? 0
    : (bottomInset ?? Math.max(insets.bottom + 24, 38));
  const actionWrapStyle = [
    useStickyActionBar ? styles.stickyActionWrap : styles.continueWrap,
    useStickyActionBar
      ? { paddingBottom: Math.max(insets.bottom + 14, 24) }
      : { bottom: continueBottomInset },
  ];

  const bottomAction = shouldShowBottomButton ? (
    <View style={actionWrapStyle}>
      <TouchableOpacity
        style={[styles.continueBtn, isInput && investAmount <= 0 && { opacity: 0.5 }]}
        onPress={handleButtonPress}
        testID="liquidation-continue-btn"
        disabled={buttonDisabled}
      >
        <Text style={styles.continueBtnText}>{buttonLabel}</Text>
      </TouchableOpacity>
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
  continueBtnText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
});

export default LiquidationScreen;
