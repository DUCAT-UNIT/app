/**
 * AssetDetailScreen Component
 * Displays detailed information about a specific asset (BTC or UNIT)
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiatAmount } from '../../utils/formatters';
import globalStyles from '../../styles';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import TransactionItem from '../../components/transaction/TransactionItem';
import PriceChart from '../../components/charts/PriceChart';
import { AssetHeader, AssetInfo, AssetActionButtons } from '../../components/assetDetail';
import { usePriceChart } from '../../hooks/usePriceChart';
import { useAssetTransactions } from '../../hooks/useAssetTransactions';

const TAB_OPTIONS = ['ACTIVITY', 'ABOUT'];

function AssetDetailScreen({ route = {}, navigation }) {
  const { assetType = 'BTC' } = route?.params || {};

  const { segwitBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  const wallet = useWallet().wallet;
  const { transactionHistory, loadingTransactionHistory } = useTransactionHistory();

  const [selectedTab, setSelectedTab] = useState('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [visibleTransactions, setVisibleTransactions] = useState(20);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Use extracted price chart hook
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(assetType, selectedTimeframe);

  // Get balance based on asset type
  // For UNIT, use runesBalance which contains the actual UNIT amount
  const unitAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const balance = assetType === 'BTC' ? segwitBalance : unitAmount;
  const fiatValue = assetType === 'BTC' ? balance * btcPrice : balance * 1;

  // Extract stable wallet addresses using refs to prevent re-renders
  const segwitAddressRef = useRef(wallet?.segwitAddress);
  const taprootAddressRef = useRef(wallet?.taprootAddress);

  // Only update refs if values actually changed
  if (wallet?.segwitAddress && wallet.segwitAddress !== segwitAddressRef.current) {
    segwitAddressRef.current = wallet.segwitAddress;
  }
  if (wallet?.taprootAddress && wallet.taprootAddress !== taprootAddressRef.current) {
    taprootAddressRef.current = wallet.taprootAddress;
  }

  const segwitAddress = segwitAddressRef.current;
  const taprootAddress = taprootAddressRef.current;

  // Memoize isPositive to prevent chart re-renders
  const isPositive = useMemo(() => priceDirection.isPositive, [priceDirection.isPositive]);

  // Use extracted transaction filtering hook
  const filteredTransactions = useAssetTransactions(transactionHistory, assetType, segwitAddress, taprootAddress);

  const handleActionPress = (action) => {
    switch (action) {
      case 'send':
        const sendAssetType = assetType.toLowerCase(); // Convert BTC -> btc, UNIT -> unit
        navigation.navigate('SendFlow', {
          screen: 'AddressInput',
          params: { assetType: sendAssetType }
        });
        break;
      case 'receive':
        // Navigate to ReceiveQR screen with the appropriate address
        const receiveAddress = assetType === 'BTC' ? segwitAddress : taprootAddress;
        const addressType = assetType === 'BTC' ? 'Native SegWit' : 'Taproot';
        navigation.navigate('ReceiveQR', {
          address: receiveAddress,
          addressType: addressType,
        });
        break;
    }
  };

  // Component render functions now use extracted components
  const renderHeader = () => <AssetHeader onBackPress={() => navigation.goBack()} />;

  const renderAssetInfo = () => (
    <AssetInfo
      assetType={assetType}
      balance={balance}
      fiatValue={fiatValue}
      btcPrice={btcPrice}
      priceData={priceData}
      priceDirection={priceDirection}
    />
  );

  const renderActionButtons = () => (
    <AssetActionButtons
      onSendPress={() => handleActionPress('send')}
      onReceivePress={() => handleActionPress('receive')}
    />
  );

  // Generate fake UNIT price data that fluctuates between .995 and 1.025
  const generateUnitPriceData = (timeframe) => {
    const dataPoints = 60; // 60 points for smooth chart
    const data = [];
    const now = Date.now();

    // Time intervals based on timeframe
    const intervals = {
      '1D': 24 * 60 * 60 * 1000 / dataPoints, // 1 day in ms divided by points
      '1W': 7 * 24 * 60 * 60 * 1000 / dataPoints, // 1 week
      '1M': 30 * 24 * 60 * 60 * 1000 / dataPoints, // 1 month
      '1Y': 365 * 24 * 60 * 60 * 1000 / dataPoints, // 1 year
    };

    const interval = intervals[timeframe] || intervals['1M'];

    // Generate data points with fluctuations between .995 and 1.025
    let currentPrice = 1.0; // Start at 1.0
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = now - (dataPoints - i - 1) * interval;

      // Random walk with tendency to stay near 1.0
      const change = (Math.random() - 0.5) * 0.01; // Random change between -0.005 and +0.005
      currentPrice = currentPrice + change;

      // Keep within bounds .995 to 1.025
      currentPrice = Math.max(0.995, Math.min(1.025, currentPrice));

      data.push([timestamp, currentPrice]);
    }

    return data;
  };

  const renderPriceChart = () => {
    // For UNIT, use fake data
    if (assetType === 'UNIT') {
      const unitData = generateUnitPriceData(selectedTimeframe);

      return (
        <View style={styles.chartContainer}>
          <PriceChart
            data={unitData}
            isPositive={true}
            minBoundary={0.5}
            maxBoundary={1.5}
          />

          <View style={styles.timeframeButtons}>
            {['1D', '1W', '1M', '1Y'].map((timeframe) => (
              <TouchableOpacity
                key={timeframe}
                style={[
                  styles.timeframeButton,
                  selectedTimeframe === timeframe && styles.timeframeButtonActive,
                ]}
                onPress={() => setSelectedTimeframe(timeframe)}
              >
                <Text
                  style={[
                    styles.timeframeButtonText,
                    selectedTimeframe === timeframe && styles.timeframeButtonTextActive,
                  ]}
                >
                  {timeframe}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    // For BTC, use real data
    if (assetType !== 'BTC') return null;

    return (
      <View style={styles.chartContainer}>
        {priceError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {priceError.includes('Rate limit')
                ? 'Rate limit reached'
                : 'Failed to load price data'}
            </Text>
            <Text style={styles.errorSubtext}>
              {priceError.includes('Rate limit')
                ? 'Please wait a moment before retrying'
                : 'Check your connection and try again'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setPriceError(null)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : priceData ? (
          <>
            <PriceChart data={priceData} isPositive={isPositive} />

            <View style={styles.timeframeButtons}>
              {['1D', '1W', '1M', '1Y'].map((timeframe) => (
                <TouchableOpacity
                  key={timeframe}
                  style={[
                    styles.timeframeButton,
                    selectedTimeframe === timeframe && styles.timeframeButtonActive,
                  ]}
                  onPress={() => setSelectedTimeframe(timeframe)}
                >
                  {priceLoading && selectedTimeframe === timeframe ? (
                    <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
                  ) : (
                    <Text
                      style={[
                        styles.timeframeButtonText,
                        selectedTimeframe === timeframe && styles.timeframeButtonTextActive,
                      ]}
                    >
                      {timeframe}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {TAB_OPTIONS.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, selectedTab === tab && styles.activeTab]}
          onPress={() => setSelectedTab(tab)}
        >
          <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Memoized render function for transactions
  const renderTransaction = useCallback(
    ({ item: tx }) => (
      <TransactionItem
        tx={tx}
        styles={globalStyles}
        onPress={() => {}}
      />
    ),
    []
  );

  const renderActivity = () => {
    if (loadingTransactionHistory) {
      return (
        <View style={styles.activityContainer}>
          <ActivityIndicator color={COLORS.PRIMARY_BLUE} style={styles.loader} />
        </View>
      );
    }

    if (filteredTransactions.length === 0) {
      return (
        <View style={styles.activityContainer}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        </View>
      );
    }

    const displayedTransactions = filteredTransactions.slice(0, visibleTransactions);
    const hasMore = visibleTransactions < filteredTransactions.length;

    return (
      <View style={styles.activityContainer}>
        {displayedTransactions.map((transaction) => (
          <View key={transaction.txid}>
            {renderTransaction({ item: transaction })}
          </View>
        ))}

        {hasMore && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleTransactions(prev => prev + 20)}
          >
            <Text style={styles.loadMoreText}>
              Load More ({filteredTransactions.length - visibleTransactions} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAbout = () => (
    <View style={styles.aboutContainer}>
      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>About {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}</Text>
        <Text style={styles.aboutDescription}>
          {assetType === 'BTC'
            ? 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network. Bitcoin transactions are verified by network nodes through cryptography and recorded in a public distributed ledger called a blockchain.'
            : 'UNIT is designed to be a BTC-backed Collateralised Debt Position (CDP), programmed to be soft-pegged to the USD at 1.01 to 1.04 UNIT per USD before transaction costs, to finance responsible lending and leverage.'
          }
        </Text>
      </View>

      {assetType === 'BTC' && (
        <View style={styles.aboutStats}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Market Cap</Text>
            <Text style={styles.statValue}>$2.1T</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>24h Volume</Text>
            <Text style={styles.statValue}>$42.5B</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Circulating Supply</Text>
            <Text style={styles.statValue}>19.5M BTC</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        {renderHeader()}

        <Animated.ScrollView
          style={styles.scrollView}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {renderAssetInfo()}
          {renderActionButtons()}
          {renderPriceChart()}
          {renderTabs()}

          {selectedTab === 'ACTIVITY' ? renderActivity() : renderAbout()}
        </Animated.ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  assetInfoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
  },
  balanceAmount: {
    fontSize: 31,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  balanceFiat: {
    fontSize: 20,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
  },
  priceChange: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.SUCCESS_GREEN,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 62,
  },
  actionButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1.2,
    borderColor: COLORS.BORDER_COLOR,
  },
  actionButtonLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  chartContainer: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
  },
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 5,
  },
  timeframeButton: {
    paddingHorizontal: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeButtonText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  timeframeButtonTextActive: {
    color: COLORS.WHITE,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  activeTabText: {
    color: COLORS.WHITE,
  },
  activityContainer: {
    paddingHorizontal: 4,
    paddingBottom: 5,
  },
  loader: {
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 3,
  },
  emptyText: {
    color: COLORS.GRAY,
    fontSize: 16,
  },
  aboutContainer: {
    paddingHorizontal: 14,
    paddingBottom: 5,
  },
  aboutSection: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  aboutDescription: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  aboutStats: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 1.5,
  },
  errorSubtext: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 10,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreButton: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  loadMoreText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default React.memo(AssetDetailScreen);