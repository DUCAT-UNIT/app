/**
 * AssetDetailScreen Component
 * Displays detailed information about a specific asset (BTC or UNIT)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  Animated,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../../components/icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiatAmount } from '../../utils/formatters';
import globalStyles from '../../styles';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import { useToastContext } from '../../contexts/UIContext';
import { useNavigation } from '@react-navigation/native';
import TransactionItem from '../../components/transaction/TransactionItem';
import PriceChart from '../../components/charts/PriceChart';
import { API, API_KEYS } from '../../utils/constants';
import { calculateTransactionAmount } from '../../services/transactionHistoryService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_OPTIONS = ['ACTIVITY', 'ABOUT'];
const CACHE_KEY_PREFIX = 'btc_price_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for instant access across navigations
const priceCache = {};

// Sample data to reduce points to ~60
const sampleData = (data, targetPoints = 60) => {
  if (!data || data.length <= targetPoints) return data;

  const step = Math.floor(data.length / targetPoints);
  const sampled = [];

  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }

  // Always include the last point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }

  return sampled;
};

function AssetDetailScreen({ route = {}, navigation }) {
  const { assetType = 'BTC' } = route?.params || {};

  const { segwitBalance, taprootBalance } = useBalance();
  const { btcPrice } = usePrice();
  const wallet = useWallet().wallet;
  const { transactionHistory, loadingTransactionHistory } = useTransactionHistory();
  const { showToast } = useToastContext();

  const [selectedTab, setSelectedTab] = useState('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [priceError, setPriceError] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Initialize with cached data if available (synchronous)
  const initCacheKey = `${CACHE_KEY_PREFIX}1M`;
  const initCache = priceCache[initCacheKey];
  const hasValidCache = initCache && (Date.now() - initCache.timestamp < CACHE_EXPIRY_MS);

  const [priceData, setPriceData] = useState(hasValidCache ? initCache.prices : null);
  const [priceDirection, setPriceDirection] = useState(
    hasValidCache ? initCache.direction : { isPositive: true, percentChange: 0, dollarChange: 0 }
  );
  const [priceLoading, setPriceLoading] = useState(!hasValidCache && assetType === 'BTC');

  // Get balance based on asset type
  const balance = assetType === 'BTC' ? segwitBalance : taprootBalance;
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

  // Stable ref for filtered transactions
  const filteredTxRef = useRef([]);
  const lastTxHashRef = useRef('');
  const [filteredTransactions, setFilteredTransactions] = useState([]);

  // Filter and process transactions - deferred to avoid blocking navigation
  useEffect(() => {
    if (!transactionHistory || !segwitAddress || !taprootAddress) {
      setFilteredTransactions(filteredTxRef.current);
      return;
    }

    // Create a hash to check if we need to recalculate
    const txHash = `${transactionHistory.length}-${assetType}`;
    if (txHash === lastTxHashRef.current && filteredTxRef.current.length > 0) {
      setFilteredTransactions(filteredTxRef.current);
      return;
    }


    // First filter, then process only what we need
    const filtered = transactionHistory
      .filter(tx => {
        // Quick filter first to reduce processing
        if (tx.vaultTransaction) return false;

        // If already has txData, use it for filtering
        if (tx.txData) {
          return tx.txData.assetType === assetType;
        }

        // For unprocessed transactions, we'll process them next
        return true;
      })
      .map(tx => {
        // If already processed, return as-is
        if (tx.txData) return tx;

        // Process regular transaction - create new object to avoid mutation
        const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
        const amount = typeof txData === 'object' ? txData.amount : txData;
        const txAssetType = typeof txData === 'object' ? txData.type : 'BTC';
        const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;

        return {
          ...tx,
          txData: {
            amount,
            assetType: txAssetType,
            numericAmount,
            isSent: numericAmount < 0,
            isReceived: numericAmount > 0,
          },
        };
      })
      .filter(tx => tx.txData?.assetType === assetType);

    lastTxHashRef.current = txHash;
    filteredTxRef.current = filtered;
    setFilteredTransactions(filtered);
  }, [transactionHistory, segwitAddress, taprootAddress, assetType]);


  const fetchPriceData = useCallback(async () => {
    setPriceError(null);
    try {
      const days = selectedTimeframe === '1D' ? 1 :
                   selectedTimeframe === '1W' ? 7 :
                   selectedTimeframe === '1M' ? 30 : 365;

      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;

      // Check in-memory cache first (instant)
      if (priceCache[cacheKey]) {
        const { prices, timestamp, direction } = priceCache[cacheKey];
        const age = Date.now() - timestamp;

        if (age < CACHE_EXPIRY_MS) {
          setPriceData(prices);
          setPriceDirection(direction);
          setPriceLoading(false);
          return;
        }
      }

      // Check AsyncStorage cache
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          const { prices, timestamp } = JSON.parse(cachedData);
          const age = Date.now() - timestamp;

          if (age < CACHE_EXPIRY_MS) {

            // Calculate price direction (for 1 BTC)
            const firstPrice = prices[0][1];
            const lastPrice = prices[prices.length - 1][1];
            const priceChange = lastPrice - firstPrice;
            const percentChange = ((priceChange / firstPrice) * 100);

            const direction = {
              isPositive: priceChange >= 0,
              percentChange: percentChange.toFixed(2),
              dollarChange: Math.abs(priceChange).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
            };

            setPriceData(prices);
            setPriceDirection(direction);

            // Store in memory cache for next time
            priceCache[cacheKey] = { prices, timestamp, direction };

            setPriceLoading(false);
            return;
          }
        }
      } catch (cacheError) {
        // Silently fail cache read
      }

      // Only show loading if we need to fetch from network
      setPriceLoading(true);

      // Fetch fresh data
      const response = await fetch(
        `${API.COINGECKO}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
        {
          headers: {
            'accept': 'application/json',
            'x-cg-demo-api-key': API_KEYS.COINGECKO
          }
        }
      );

      if (response.status === 429) {
        throw new Error('Rate limit reached. Please try again in a moment.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.prices && data.prices.length > 0) {
        // Sample data to ~60 points
        const sampledPrices = sampleData(data.prices, 60);

        // Calculate price direction (for 1 BTC, using original data endpoints)
        const firstPrice = data.prices[0][1];
        const lastPrice = data.prices[data.prices.length - 1][1];
        const priceChange = lastPrice - firstPrice;
        const percentChange = ((priceChange / firstPrice) * 100);

        const direction = {
          isPositive: priceChange >= 0,
          percentChange: percentChange.toFixed(2),
          dollarChange: Math.abs(priceChange).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        };

        setPriceData(sampledPrices);
        setPriceDirection(direction);

        const timestamp = Date.now();

        // Store in memory cache immediately
        priceCache[cacheKey] = { prices: sampledPrices, timestamp, direction };

        // Cache to AsyncStorage (async, non-blocking)
        AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({
            prices: sampledPrices,
            timestamp
          })
        ).catch(() => {
          // Silently fail cache write
        });
      } else {
        throw new Error('Invalid data format from API');
      }
    } catch (error) {
      setPriceError(error.message || 'Failed to load price data');
      setPriceData(null);
    } finally {
      setPriceLoading(false);
    }
  }, [selectedTimeframe]);

  // Fetch price data from CoinGecko - only when timeframe changes or if no cache
  useEffect(() => {
    if (assetType === 'BTC') {
      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;
      const cached = priceCache[cacheKey];
      const isCacheValid = cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS);

      // Only fetch if no in-memory cache or cache is stale
      if (!isCacheValid) {
        fetchPriceData();
      } else {
        // Update state with cached data (only runs when timeframe changes)
        setPriceData(cached.prices);
        setPriceDirection(cached.direction);
        setPriceLoading(false);
      }
    } else {
      setPriceLoading(false);
    }
  }, [assetType, selectedTimeframe, fetchPriceData]);

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
    </View>
  );

  const renderAssetInfo = () => {
    // For UNIT, show the satoshi value directly (as whole units)
    // For BTC, show the BTC value with decimals
    const displayBalance = assetType === 'BTC'
      ? formatBalance(balance || 0)
      : formatFiatAmount(balance * 100000000 || 0, 0); // Convert BTC to satoshis for UNIT display

    return (
      <View style={styles.assetInfoContainer}>
        <Icon
          name={assetType === 'BTC' ? 'btc_logo' : 'unit_logo'}
          size={60}
        />

        <Text style={styles.assetName}>
          {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}
        </Text>

        <Text style={styles.balanceAmount}>
          {displayBalance} {assetType}
        </Text>

        <Text style={styles.balanceFiat}>
          ${formatFiatAmount(fiatValue || 0)} USD
        </Text>

        {assetType === 'BTC' && btcPrice && priceData && (
          <Text style={[styles.priceChange, { color: priceDirection.isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED }]}>
            {priceDirection.isPositive ? '▲' : '▼'} {priceDirection.percentChange}% ({priceDirection.isPositive ? '+' : '-'}${priceDirection.dollarChange})
          </Text>
        )}
      </View>
    );
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleActionPress('send')}
      >
        <View style={styles.actionButtonIcon}>
          <Icon name="send" size={19} color={COLORS.WHITE} />
        </View>
        <Text style={styles.actionButtonLabel}>Send</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleActionPress('receive')}
      >
        <View style={styles.actionButtonIcon}>
          <Icon name="receive" size={19} color={COLORS.WHITE} />
        </View>
        <Text style={styles.actionButtonLabel}>Receive</Text>
      </TouchableOpacity>
    </View>
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
              onPress={fetchPriceData}
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

    return (
      <View style={styles.activityContainer}>
        {filteredTransactions.map((transaction) => (
          <View key={transaction.txid}>
            {renderTransaction({ item: transaction })}
          </View>
        ))}
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
  menuButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  assetInfoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  assetIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
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
    paddingVertical: 4,
    marginTop: 2,
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
  transactionItem: {
    marginBottom: 3,
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
});

export default React.memo(AssetDetailScreen);