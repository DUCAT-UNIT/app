/**
 * VaultDetailScreen Component
 * Displays detailed information about the user's vault
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { useVaultDataFetch } from '../../hooks/useVaultDataFetch';
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
  // Chart highlighting (real-time during scrub)
  const [highlightedEventDate, setHighlightedEventDate] = useState<number | null>(null);
  // Activity list filter (only set on release/lock)
  const [filterEventDate, setFilterEventDate] = useState<number | null>(null);
  // Transaction details sheet
  const [selectedTransaction, setSelectedTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [previousTransaction, setPreviousTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);

  // Fetch vault data
  const { vaultData, loadingVault, fetchVault } = useVaultDataFetch(wallet);

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

  const handleClearFilter = useCallback(() => {
    setFilterEventDate(null);
    setHighlightedEventDate(null);
  }, []);

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
          isLoading={loadingVault}
          transactions={transactions}
          onHighlightEvent={setHighlightedEventDate}
          onLockFilter={setFilterEventDate}
          highlightedEventDate={highlightedEventDate}
        />

        <VaultTabs
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          filterDate={filterEventDate}
          onClearFilter={handleClearFilter}
        />

        {selectedTab === 'ACTIVITY' ? (
          <VaultActivityList
            transactions={transactions}
            isLoading={loadingTransactions}
            highlightedEventDate={filterEventDate}
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
