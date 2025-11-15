/**
 * AssetDetailScreen Component
 * Displays detailed information about a specific asset (BTC or UNIT)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiatAmount } from '../../utils/formatters';
import { useBalance } from '../../contexts/WalletDataContext';
import { useNavigation } from '@react-navigation/native';
import { useTransactionHistoryData } from '../../hooks/useTransactionHistoryData';
import TransactionItem from '../../components/transaction/TransactionItem';
import PriceChart from '../../components/charts/PriceChart';
import { API, API_KEYS } from '../../utils/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_OPTIONS = ['ACTIVITY', 'ABOUT', 'BREAKDOWN'];

export default function AssetDetailScreen({ route = {}, navigation }) {
  const { assetType = 'BTC' } = route?.params || {};
  const { segwitBalance, taprootBalance, btcPrice } = useBalance();
  const nav = useNavigation();
  const [selectedTab, setSelectedTab] = useState('ACTIVITY');
  const [priceData, setPriceData] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [priceError, setPriceError] = useState(null);
  const [priceDirection, setPriceDirection] = useState({ isPositive: true, percentChange: 0, dollarChange: 0 });
  const scrollY = useRef(new Animated.Value(0)).current;

  // Get balance based on asset type
  const balance = assetType === 'BTC' ? segwitBalance : taprootBalance;
  const fiatValue = assetType === 'BTC' ? balance * btcPrice : 0;

  // Get transaction history
  const { transactions = [], loading: txLoading } = useTransactionHistoryData();

  // Filter transactions based on asset type
  const filteredTransactions = transactions?.filter(tx => {
    if (assetType === 'BTC') {
      // For BTC, show all segwit transactions
      return tx.address?.startsWith('bc1q') || tx.address?.startsWith('tb1q');
    } else {
      // For UNIT, show taproot transactions
      return tx.address?.startsWith('bc1p') || tx.address?.startsWith('tb1p');
    }
  }) || [];

  // Fetch price data from CoinGecko
  useEffect(() => {
    if (assetType === 'BTC') {
      fetchPriceData();
    } else {
      setPriceLoading(false);
    }
  }, [assetType, selectedTimeframe]);

  const fetchPriceData = async () => {
    setPriceLoading(true);
    setPriceError(null);
    try {
      const days = selectedTimeframe === '1D' ? 1 :
                   selectedTimeframe === '1W' ? 7 :
                   selectedTimeframe === '1M' ? 30 : 365;

      const response = await fetch(
        `${API.COINGECKO}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily&x_cg_demo_api_key=${API_KEYS.COINGECKO}`
      );

      if (response.status === 429) {
        throw new Error('Rate limit reached. Please try again in a moment.');
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.prices && data.prices.length > 0) {
        setPriceData(data.prices);

        // Calculate price direction
        const firstPrice = data.prices[0][1];
        const lastPrice = data.prices[data.prices.length - 1][1];
        const priceChange = lastPrice - firstPrice;
        const percentChange = ((priceChange / firstPrice) * 100).toFixed(2);

        setPriceDirection({
          isPositive: priceChange >= 0,
          percentChange: Math.abs(percentChange),
          dollarChange: Math.abs(priceChange).toFixed(2)
        });
      } else {
        throw new Error('Invalid data format from API');
      }
    } catch (error) {
      console.error('Error fetching price data:', error);
      setPriceError(error.message || 'Failed to load price data');
      setPriceData(null);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleActionPress = (action) => {
    switch (action) {
      case 'send':
        navigation.navigate('Send', {
          screen: 'AssetSelector',
          params: { preselectedAsset: assetType }
        });
        break;
      case 'receive':
        navigation.navigate('Wallet', {
          screen: 'Receive',
          params: { assetType }
        });
        break;
      case 'swap':
        // TODO: Implement swap functionality
        break;
      case 'buy':
        // TODO: Implement buy functionality
        break;
      case 'convert':
        // TODO: Implement convert functionality
        break;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="back" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuButton}>
        <Icon name="settings" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>
    </View>
  );

  const renderAssetInfo = () => (
    <View style={styles.assetInfoContainer}>
      <View style={styles.assetIcon}>
        <Icon
          name={assetType === 'BTC' ? 'btc_logo' : 'unit_logo'}
          size={60}
        />
      </View>

      <Text style={styles.assetName}>
        {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}
      </Text>

      <Text style={styles.balanceAmount}>
        {formatBalance(balance || 0)} BTC
      </Text>

      <Text style={styles.balanceFiat}>
        ${formatFiatAmount(fiatValue || 0)} USD
      </Text>

      {assetType === 'BTC' && btcPrice && priceData && (
        <View style={styles.priceChangeContainer}>
          <Text style={[styles.priceChange, { color: priceDirection.isPositive ? COLORS.SUCCESS : COLORS.ERROR }]}>
            {priceDirection.isPositive ? '▲' : '▼'} {priceDirection.percentChange}% ({priceDirection.isPositive ? '+' : '-'}${priceDirection.dollarChange})
          </Text>
        </View>
      )}
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleActionPress('send')}
      >
        <View style={styles.actionButtonIcon}>
          <Text style={styles.actionButtonIconText}>S</Text>
        </View>
        <Text style={styles.actionButtonLabel}>Send</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleActionPress('receive')}
      >
        <View style={styles.actionButtonIcon}>
          <Text style={styles.actionButtonIconText}>R</Text>
        </View>
        <Text style={styles.actionButtonLabel}>Receive</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPriceChart = () => {
    if (assetType !== 'BTC') return null;

    return (
      <View style={styles.chartContainer}>
        {priceLoading ? (
          <ActivityIndicator color={COLORS.PRIMARY_BLUE} />
        ) : priceError ? (
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
              onPress={fetchPriceData}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : priceData ? (
          <>
            <PriceChart data={priceData} isPositive={priceDirection.isPositive} />

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

  const renderActivity = () => (
    <View style={styles.activityContainer}>
      {txLoading ? (
        <ActivityIndicator color={COLORS.PRIMARY_BLUE} style={styles.loader} />
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        filteredTransactions.map((tx, index) => (
          <TransactionItem
            key={tx.txid || index}
            transaction={tx}
            style={styles.transactionItem}
          />
        ))
      )}
    </View>
  );

  const renderAbout = () => (
    <View style={styles.aboutContainer}>
      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>About {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}</Text>
        <Text style={styles.aboutDescription}>
          {assetType === 'BTC'
            ? 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network. Bitcoin transactions are verified by network nodes through cryptography and recorded in a public distributed ledger called a blockchain.'
            : 'UNIT is a token on the Bitcoin network using the Taproot protocol. It represents a unit of account and can be used for various purposes within the Ducat ecosystem.'
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

  const renderBreakdown = () => (
    <View style={styles.aboutContainer}>
      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>Balance Breakdown</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Available Balance</Text>
          <Text style={styles.statValue}>{formatBalance(balance || 0)} BTC</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>USD Value</Text>
          <Text style={styles.statValue}>${formatFiatAmount(fiatValue || 0)}</Text>
        </View>
      </View>
    </View>
  );

  return (
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

        {selectedTab === 'ACTIVITY' ? renderActivity() : selectedTab === 'ABOUT' ? renderAbout() : renderBreakdown()}
      </Animated.ScrollView>
    </SafeAreaView>
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
  menuButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  assetInfoContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  assetIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  assetName: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 4,
  },
  balanceFiat: {
    fontSize: 18,
    color: COLORS.GRAY,
    marginBottom: 8,
  },
  priceChangeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.CARD_BG,
  },
  priceChange: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 24,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 80,
  },
  actionButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_COLOR,
  },
  actionButtonIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  actionButtonLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  chartContainer: {
    paddingHorizontal: 0,
    paddingVertical: 16,
    marginTop: 8,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartPlaceholderText: {
    color: COLORS.GRAY,
    fontSize: 16,
  },
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  timeframeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    minWidth: 64,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.PRIMARY_BLUE,
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
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 20,
    gap: 12,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  activeTab: {
    backgroundColor: COLORS.CARD_BG,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.SECONDARY_TEXT,
  },
  activeTabText: {
    color: COLORS.WHITE,
  },
  activityContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loader: {
    marginTop: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.GRAY,
    fontSize: 16,
  },
  transactionItem: {
    marginBottom: 12,
  },
  aboutContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  aboutSection: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 12,
  },
  aboutDescription: {
    fontSize: 14,
    color: COLORS.GRAY,
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
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorSubtext: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 20,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
});