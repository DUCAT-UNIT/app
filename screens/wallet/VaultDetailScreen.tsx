/**
 * VaultDetailScreen Component
 * Displays detailed information about the user's vault
 * Uses pre-loaded vault data and transactions from WalletDataContext for instant display
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';
import { usePrice } from '../../stores/priceStore';
import { useCashuBalanceState } from '../../contexts/CashuContext';
import { useVaultData, useBalance } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { getRunesAmount } from '../../utils/runesHelper';
import { usePendingVaultTx } from '../../stores/pendingVaultTransactionStore';
import type { VaultHistoryTransaction } from '../../services/vaultService';
import { loadVaultSettlementHistory } from '../../services/vaultSettlementHistoryService';
import {
  VaultHeader,
  VaultInfo,
  VaultTabs,
  VaultActivityList,
  VaultAbout,
} from '../../components/vaultDetail';
import VaultTransactionDetailsSheet from '../../components/vaultDetail/VaultTransactionDetailsSheet';
import { FullscreenVaultChart } from '../../components/vaultDetail/fullscreenChart';

interface VaultDetailScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
    getParent: () => { navigate: (screen: string, params?: object) => void } | undefined;
  };
}

function VaultDetailScreen({ navigation }: VaultDetailScreenProps): React.JSX.Element {
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const [selectedTab, setSelectedTab] = useState<'ACTIVITY' | 'ABOUT'>('ACTIVITY');
  const [refreshing, setRefreshing] = useState(false);
  const [settlementTransactions, setSettlementTransactions] = useState<VaultHistoryTransaction[]>([]);
  // Transaction details sheet
  const [selectedTransaction, setSelectedTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [previousTransaction, setPreviousTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  // Track if vault data has ever loaded (prevents skeleton on background refresh)
  const vaultLoadedRef = useRef(false);
  const transactionsLoadedRef = useRef(false);
  // Fullscreen chart modal
  const [chartVisible, setChartVisible] = useState(false);
  // Pending vault transaction state
  const pendingTransaction = usePendingVaultTx();

  // Use pre-loaded vault data and transactions from context (instant display, no waiting)
  const {
    vaultData,
    loadingVault,
    fetchVault,
    vaultTransactions,
    loadingVaultTransactions,
    fetchVaultTransactions,
  } = useVaultData();

  // Get wallet balances for button states
  const { segwitBalance, runesBalance } = useBalance();
  const { balance: cashuBalance } = useCashuBalanceState();
  const walletBtcBalance = segwitBalance || 0;
  const walletUnitBalance = getRunesAmount(runesBalance);
  const walletTurboUnitBalance = (cashuBalance || 0) / 100;
  const walletRepayBalance = walletUnitBalance + walletTurboUnitBalance;

  // Mark as loaded once we have data (prevents skeleton on background refresh)
  if (vaultData !== null) {
    vaultLoadedRef.current = true;
  }
  if (vaultTransactions.length > 0) {
    transactionsLoadedRef.current = true;
  }

  // Only show loading skeleton if we haven't loaded data yet
  const showVaultLoading = loadingVault && !vaultLoadedRef.current;
  const showTransactionsLoading = loadingVaultTransactions && !transactionsLoadedRef.current;
  const effectiveBtcPrice = btcPrice || vaultData?.currentPrice || 0;

  // Calculate vault health metrics
  const {
    vaultHealthPercentage,
    vaultHealthColor,
    vaultDebt,
    vaultCollateral,
  } = useWalletCalculations({
    btcPrice: effectiveBtcPrice,
    vaultData,
  });

  // Load missing vault data on mount; cached context data should paint immediately.
  useEffect(() => {
    if (!vaultData) {
      fetchVault();
    }
    if (vaultTransactions.length === 0) {
      fetchVaultTransactions(undefined, { vaultId: vaultData?.vaultId });
    }
  }, [fetchVault, fetchVaultTransactions, vaultData, vaultTransactions.length]);

  useEffect(() => {
    let cancelled = false;

    const loadSettlementTransactions = async () => {
      const history = await loadVaultSettlementHistory(wallet?.taprootPubkey);
      if (!cancelled) {
        setSettlementTransactions(history);
      }
    };

    loadSettlementTransactions().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [wallet?.taprootPubkey]);

  const mergedVaultTransactions = React.useMemo(
    () => [...settlementTransactions, ...vaultTransactions].sort((left, right) => right.timestamp - left.timestamp),
    [settlementTransactions, vaultTransactions],
  );

  // Note: Vault transaction confirmation check is now handled globally in WalletDataContext
  // This ensures snackbars are shown even when the user is not on this screen

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const [_, __, settlementHistory] = await Promise.all([
      fetchVault(),
      fetchVaultTransactions(undefined, { vaultId: vaultData?.vaultId }),
      loadVaultSettlementHistory(wallet?.taprootPubkey),
    ]);
    setSettlementTransactions(settlementHistory);
    setRefreshing(false);
  }, [fetchVault, fetchVaultTransactions, vaultData?.vaultId, wallet?.taprootPubkey]);

  // Memoized callbacks
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleTransactionPress = useCallback((
    transaction: VaultHistoryTransaction,
    prevTransaction: VaultHistoryTransaction | null
  ) => {
    setSelectedTransaction(transaction);
    setPreviousTransaction(prevTransaction);
    setShowTransactionDetails(true);
  }, []);

  const handleCloseTransactionDetails = useCallback(() => {
    setShowTransactionDetails(false);
  }, []);

  const handleChartPress = useCallback(() => {
    setChartVisible(true);
  }, []);

  const handleCloseChart = useCallback(() => {
    setChartVisible(false);
  }, []);

  // Vault action handlers
  const handleBorrowPress = useCallback(() => {
    navigation.getParent()?.navigate('BorrowFlow');
  }, [navigation]);

  const handleRepayPress = useCallback(() => {
    navigation.getParent()?.navigate('RepayFlow');
  }, [navigation]);

  const handleDepositPress = useCallback(() => {
    navigation.getParent()?.navigate('DepositFlow');
  }, [navigation]);

  const handleWithdrawPress = useCallback(() => {
    navigation.getParent()?.navigate('WithdrawFlow');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <VaultHeader onBackPress={handleBackPress} onChartPress={handleChartPress} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.PRIMARY_BLUE}
          />
        }
      >
        <VaultInfo
          totalDebt={vaultDebt}
          totalCollateral={vaultCollateral}
          currentPrice={effectiveBtcPrice}
          healthPercentage={vaultHealthPercentage}
          healthColor={vaultHealthColor}
          isLoading={showVaultLoading}
          isPendingTransaction={!!pendingTransaction}
          walletBtcBalance={walletBtcBalance}
          walletUnitBalance={walletUnitBalance}
          walletRepayBalance={walletRepayBalance}
          onChartPress={handleChartPress}
          onBorrowPress={handleBorrowPress}
          onRepayPress={handleRepayPress}
          onDepositPress={handleDepositPress}
          onWithdrawPress={handleWithdrawPress}
        />

        <VaultTabs
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
        />

        {selectedTab === 'ACTIVITY' ? (
          <VaultActivityList
            transactions={mergedVaultTransactions}
            isLoading={showTransactionsLoading}
            onTransactionPress={handleTransactionPress}
            pendingTransaction={pendingTransaction}
          />
        ) : (
          <VaultAbout />
        )}
      </ScrollView>

      <VaultTransactionDetailsSheet
        visible={showTransactionDetails}
        onClose={handleCloseTransactionDetails}
        transaction={selectedTransaction}
        previousTransaction={previousTransaction}
      />

      <FullscreenVaultChart
        visible={chartVisible}
        onClose={handleCloseChart}
        transactions={vaultTransactions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
});

export default React.memo(VaultDetailScreen);
