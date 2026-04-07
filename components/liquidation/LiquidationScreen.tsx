import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ErrorBoundary from '../ErrorBoundary';
import CurrencyToggle from './CurrencyToggle';
import LiquidationStatusScreen from './LiquidationStatusScreen';
import LiquidationReviewScreen from './LiquidationReviewScreen';
import LiquidationInputScreen from './LiquidationInputScreen';
import LiquidationEmptyStates from './LiquidationEmptyStates';
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
  useLiqError,
  useLiqVaults,
  useLiqVaultsFull,
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
  visible: boolean;
  onClose: () => void;
  onToggle: () => void;
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
  visible,
  onClose,
}: LiquidationScreenProps): React.ReactElement | null {
  // ── Store selectors ──────────────────────────────────────────────
  const currentStep = useLiqStep();
  const fetchStatus = useLiqFetchStatus();
  const investAmount = useLiqInvestAmount();
  const showBTC = useLiqShowBTC();
  const reviewTab = useLiqReviewTab();
  const vaultExpanded = useLiqVaultExpanded();
  const processingMessage = useLiqProcessingMsg();
  const resultTxid = useLiqResultTxid();
  const error = useLiqError();
  const vaults = useLiqVaults();
  const vaultsFull = useLiqVaultsFull();
  const profitRate = useLiqProfitRate();
  const depositRate = useLiqDepositRate();
  const swapRate = useLiqSwapRate();

  const {
    setCurrentStep,
    setInvestAmount,
    setShowBTC,
    setReviewTab,
    setVaultExpanded,
  } = useLiquidationFlowStore.getState();

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
    [setReviewTab],
  );

  const handleButtonPress = useCallback(async () => {
    if (currentStep === 'input') {
      setCurrentStep('review');
    } else if (currentStep === 'review') {
      await execute();
    } else if (currentStep === 'success') {
      resetAfterSuccess();
      onClose();
    } else if (currentStep === 'error') {
      resetAfterError();
    }
  }, [currentStep, setCurrentStep, execute, resetAfterSuccess, resetAfterError, onClose]);

  // ── Early return ─────────────────────────────────────────────────
  if (!visible) return null;

  // ── Derived state for empty/loading ──────────────────────────────
  const isLoaded = fetchStatus === 'loaded' || fetchStatus === 'error';
  const isProcessingOrResult =
    currentStep === 'processing' || currentStep === 'success' || currentStep === 'error';
  const isReview = currentStep === 'review';
  const isInput = currentStep === 'input';

  // ── Button label + disabled ──────────────────────────────────────
  const buttonDisabled =
    (isInput && investAmount <= 0) || currentStep === 'processing';
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

  // ── Render body ──────────────────────────────────────────────────
  const renderBody = (): React.ReactElement => {
    if (isProcessingOrResult) {
      return (
        <LiquidationStatusScreen
          step={currentStep}
          processingMessage={processingMessage}
          txid={resultTxid}
          error={error}
        />
      );
    }

    if (isReview) {
      return (
        <LiquidationReviewScreen
          investAmount={investAmount}
          profitRate={profitRate}
          depositRate={depositRate}
          swapRate={swapRate}
          btcPrice={btcPrice ?? 0}
          showBTC={showBTC}
          reviewTab={reviewTab}
          onTabChange={handleTabChange}
        />
      );
    }

    // Input step — check empty states
    if (!hasVault) {
      return <LiquidationEmptyStates variant="noVault" />;
    }

    if (isLoaded && vaults.length === 0) {
      return <LiquidationEmptyStates variant="noVaults" />;
    }

    if (isLoaded && maxInvestable <= 0) {
      return <LiquidationEmptyStates variant="lowCollateral" />;
    }

    if (!isLoaded) {
      return <LiquidationEmptyStates variant="loading" />;
    }

    return (
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
      {/* Header — hidden during processing/success/error (status screen has its own title) */}
      {!isProcessingOrResult && (
        <View style={styles.header}>
          <Text style={styles.title}>Liquidations</Text>
          {hasVault && <CurrencyToggle showBTC={showBTC} onToggle={handleToggleBTC} />}
        </View>
      )}

      {/* Body */}
      {renderBody()}

      {/* Bottom Button — hidden during processing */}
      {currentStep !== 'processing' && (
        <View style={styles.continueWrap}>
          <TouchableOpacity
            style={[styles.continueBtn, isInput && investAmount <= 0 && { opacity: 0.5 }]}
            onPress={handleButtonPress}
            testID="liquidation-continue-btn"
            disabled={buttonDisabled}
          >
            <Text style={styles.continueBtnText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  continueWrap: {
    position: 'absolute',
    bottom: 38,
    left: 80,
    right: 16,
    zIndex: 100,
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
