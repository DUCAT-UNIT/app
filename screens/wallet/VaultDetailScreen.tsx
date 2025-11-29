/**
 * VaultDetailScreen Component
 * Displays detailed information about the user's vault
 * Uses pre-loaded vault data from WalletDataContext for instant display
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import { useVaultData } from '../../contexts/WalletDataContext';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { fetchVaultHistory } from '../../services/vaultService';
import type { VaultHistoryTransaction } from '../../services/vaultService';
import {
  VaultHeader,
  VaultInfo,
  VaultTabs,
  VaultActivityList,
  VaultAbout,
} from '../../components/vaultDetail';
import VaultTransactionDetailsSheet from '../../components/vaultDetail/VaultTransactionDetailsSheet';
import { FullscreenVaultChart } from '../../components/vaultDetail/FullscreenVaultChart';

interface VaultDetailScreenProps {
  navigation: {
    goBack: () => void;
  };
}

function VaultDetailScreen({ navigation }: VaultDetailScreenProps): React.JSX.Element {
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const [selectedTab, setSelectedTab] = useState<'ACTIVITY' | 'ABOUT'>('ACTIVITY');
  const [transactions, setTransactions] = useState<VaultHistoryTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Transaction details sheet
  const [selectedTransaction, setSelectedTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [previousTransaction, setPreviousTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  // Track if vault data has ever loaded (prevents skeleton on background refresh)
  const vaultLoadedRef = useRef(false);
  // Fullscreen chart modal
  const [chartVisible, setChartVisible] = useState(false);

  // Use pre-loaded vault data from context (instant display, no waiting)
  const { vaultData, loadingVault, fetchVault } = useVaultData();

  // Mark as loaded once we have data
  if (vaultData !== null) {
    vaultLoadedRef.current = true;
  }

  // Only show loading skeleton if we haven't loaded data yet
  const showVaultLoading = loadingVault && !vaultLoadedRef.current;

  // Calculate vault health metrics
  const {
    vaultHealthPercentage,
    vaultHealthColor,
    vaultDebt,
    vaultCollateral,
  } = useWalletCalculations({
    btcPrice,
    vaultData,
  });

  // Fetch transaction history
  const fetchTransactions = useCallback(async () => {
    if (!wallet?.taprootPubkey) return;

    setLoadingTransactions(true);
    try {
      const history = await fetchVaultHistory(wallet.taprootPubkey);
      setTransactions(history);
    } catch (error) {
      // Silently fail - vault history is optional
      void error;
    } finally {
      setLoadingTransactions(false);
    }
  }, [wallet?.taprootPubkey]);

  // Load vault data and transactions on mount
  useEffect(() => {
    fetchVault();
    fetchTransactions();
  }, [fetchVault, fetchTransactions]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchVault(),
      fetchTransactions(),
    ]);
    setRefreshing(false);
  }, [fetchVault, fetchTransactions]);

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

  return (
    <SafeAreaView style={styles.container}>
      <VaultHeader onBackPress={handleBackPress} />

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
          currentPrice={btcPrice || 0}
          healthPercentage={vaultHealthPercentage}
          healthColor={vaultHealthColor}
          isLoading={showVaultLoading}
          onChartPress={handleChartPress}
        />

        <VaultTabs
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
        />

        {selectedTab === 'ACTIVITY' ? (
          <VaultActivityList
            transactions={transactions}
            isLoading={loadingTransactions}
            onTransactionPress={handleTransactionPress}
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
        transactions={transactions}
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
