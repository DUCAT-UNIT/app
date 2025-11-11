/**
 * Transaction History Screen
 * Displays user's transaction history in a bottom sheet
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Animated, Dimensions, ActivityIndicator, FlatList, Linking, PanResponder } from 'react-native';
import { COLORS } from '../utils/colors';
import Icon from './Icon';
import { calculateTransactionAmount } from '../services/transactionHistoryService';
import { useTransactionHistory } from '../contexts/TransactionHistoryContext';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function TransactionHistoryScreen({
  styles,
  showHistorySheet,
  onClose,
  segwitAddress,
  taprootAddress,
  vaultPubkey,
}) {
  // Get transaction history from context (pre-loaded in background)
  const { transactionHistory, loadingTransactionHistory, fetchTransactionHistory } = useTransactionHistory();

  const [loading, setLoading] = useState(false);
  const historySheetOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      historySheetOpacity.setValue(0);
      onClose();
    });
  };

  // Pan responder for swipe down gesture on handle area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // Manage sheet animation and loading state when opened
  useEffect(() => {
    if (showHistorySheet) {
      // Only show loading spinner if we don't have any cached data
      setLoading(transactionHistory.length === 0 && loadingTransactionHistory);

      // Trigger a fresh fetch in background (context will update automatically)
      fetchTransactionHistory();

      // Animate in
      historySheetOpacity.setValue(0);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(historySheetOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      historySheetOpacity.setValue(0);
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [showHistorySheet]);

  // Update loading state when context loading changes
  useEffect(() => {
    // Only show loading if we have no cached data
    if (transactionHistory.length === 0) {
      setLoading(loadingTransactionHistory);
    } else {
      setLoading(false);
    }
  }, [loadingTransactionHistory, transactionHistory]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Pending';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTxid = (txid) => {
    if (!txid) return '';
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
  };

  const openTxInExplorer = async (txid, assetType) => {
    try {
      // Use ord explorer for UNIT transactions, regular explorer for BTC
      const url = assetType === 'UNIT' ? getOrdTxUrl(txid) : getTxUrl(txid);

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
      }
    } catch (error) {
    }
  };

  const formatAmount = (value, type) => {
    if (type === 'UNIT') {
      // UNIT is stored with 100x multiplier, so divide by 100 for display
      const unitAmount = Number(value) / 100;
      return unitAmount.toLocaleString('en-US');
    } else {
      // BTC in satoshis
      const btc = value / 100000000;
      return btc.toFixed(8);
    }
  };

  // Filter out self-transfers and prepare display data
  // useMemo prevents recalculating on every render
  const displayTransactions = useMemo(() => {
    return transactionHistory.filter(tx => {
      if (tx.vaultTransaction) return true; // Always show vault transactions

      const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
      const isSelfTransfer = txData.isSelfTransfer ||
        (txData.amount === 0n || txData.amount === 0);

      return !isSelfTransfer; // Filter out self-transfers
    });
  }, [transactionHistory, segwitAddress, taprootAddress]);

  // Render function for each transaction (memoized with useCallback)
  const renderTransaction = useCallback(({ item: tx }) => {
    // Check if this is a vault transaction
    if (tx.vaultTransaction) {
      const vaultData = tx.vaultData;
      const action = vaultData.action;

      return (
        <TouchableOpacity
          style={styles.historyTxRow}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          {/* Vault Logo */}
          <View style={{ marginRight: 10 }}>
            <Icon name="vault_logo" size={40} />
          </View>

          {/* Main Content Container */}
          <View style={{ flex: 1 }}>
            {/* First Row: Action on left, Confirmation + Amount on right */}
            <View style={styles.historyTxTopRow}>
              <View style={styles.historyTxColumn1}>
                <Text style={[styles.historyTxAmount, { color: '#DDDDDD' }]}>
                  {action === 'Borrow' ? 'Borrow' : action === 'Repay' ? 'Repay' : action === 'Deposit' ? 'Deposit' : action === 'Withdraw' ? 'Withdraw' : action}
                </Text>
              </View>
              <View style={styles.historyTxRightGroup}>
                <View style={styles.historyTxColumn2}>
                  <View style={[
                    styles.vaultAmountChip,
                    {
                      backgroundColor: 'rgba(89, 170, 138, 0.2)',
                      marginLeft: 0
                    }
                  ]}>
                    <Text style={[
                      styles.vaultAmountChipText,
                      {
                        color: COLORS.GREEN
                      }
                    ]}>
                      Confirmed
                    </Text>
                  </View>
                </View>
                <View style={styles.historyTxColumn3}>
                  {vaultData.btcAmount > 0 ? (
                    <View style={styles.balanceWithIcon}>
                      <Icon
                        name="btc_symbol"
                        size={12}
                        color={(action === 'Deposit' || action === 'Repay') ? COLORS.GREEN : COLORS.RED}
                        style={styles.assetAmountIcon}
                      />
                      <Text style={[
                        styles.assetAmount,
                        {
                          color: (action === 'Deposit' || action === 'Repay')
                            ? COLORS.GREEN
                            : COLORS.RED
                        }
                      ]}>
                        {(vaultData.btcAmount / 100000000).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                      </Text>
                    </View>
                  ) : vaultData.unitAmount > 0 ? (
                    <View style={styles.balanceWithIcon}>
                      <Icon
                        name="unit_symbol"
                        size={12}
                        color={(action === 'Deposit' || action === 'Repay') ? COLORS.GREEN : COLORS.RED}
                        style={styles.assetAmountIcon}
                      />
                      <Text style={[
                        styles.assetAmount,
                        {
                          color: (action === 'Deposit' || action === 'Repay')
                            ? COLORS.GREEN
                            : COLORS.RED
                        }
                      ]}>
                        {(vaultData.unitAmount / 100).toLocaleString('en-US')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            {/* Second Row: Date */}
            <View style={styles.historyTxBottomRow}>
              <Text style={styles.historyTxDate}>
                {formatDate(tx.status.block_time)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Regular transaction logic
    const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
    const amount = typeof txData === 'object' ? txData.amount : txData;
    const assetType = typeof txData === 'object' ? txData.type : 'BTC';

    // Handle BigInt for UNIT amounts
    const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;
    const isSent = numericAmount < 0;
    const isReceived = numericAmount > 0;

    return (
      <TouchableOpacity
        style={styles.historyTxRow}
        onPress={() => openTxInExplorer(tx.txid, assetType)}
        activeOpacity={0.7}
      >
        {/* Asset Logo */}
        <View style={{ marginRight: 10 }}>
          <Icon
            name={assetType === 'UNIT' ? 'unit_logo' : 'btc_logo'}
            size={40}
          />
        </View>

        {/* Main Content Container */}
        <View style={{ flex: 1 }}>
          {/* First Row: Action on left, Confirmation + Amount on right */}
          <View style={styles.historyTxTopRow}>
            <View style={styles.historyTxColumn1}>
              <Text style={[styles.historyTxAmount, { color: '#DDDDDD' }]}>
                {isSent ? 'Sent' : 'Received'}
              </Text>
            </View>
            <View style={styles.historyTxRightGroup}>
              <View style={styles.historyTxColumn2}>
                <View style={[
                  styles.vaultAmountChip,
                  {
                    backgroundColor: tx.status.confirmed
                      ? 'rgba(89, 170, 138, 0.2)'
                      : 'rgba(255, 165, 0, 0.2)',
                    marginLeft: 0
                  }
                ]}>
                  <Text style={[
                    styles.vaultAmountChipText,
                    {
                      color: tx.status.confirmed ? COLORS.GREEN : COLORS.YELLOW
                    }
                  ]}>
                    {tx.status.confirmed ? 'Confirmed' : 'Pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.historyTxColumn3}>
                {numericAmount !== 0 && (
                  <View style={styles.balanceWithIcon}>
                    <Icon
                      name={assetType === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
                      size={12}
                      color={isReceived ? COLORS.GREEN : COLORS.RED}
                      style={styles.assetAmountIcon}
                    />
                    <Text style={[
                      styles.assetAmount,
                      {
                        color: isReceived ? COLORS.GREEN : COLORS.RED
                      }
                    ]}>
                      {assetType === 'UNIT'
                        ? (Math.abs(numericAmount) / 100).toLocaleString('en-US')
                        : (Math.abs(numericAmount) / 100000000).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })
                      }
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {/* Second Row: Date */}
          <View style={styles.historyTxBottomRow}>
            <Text style={styles.historyTxDate}>
              {formatDate(tx.status.block_time)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [styles, segwitAddress, taprootAddress, formatDate, openTxInExplorer]);

  // KeyExtractor for FlatList
  const keyExtractor = useCallback((item) => item.txid, []);

  return (
    <>
      {showHistorySheet && (
        <TouchableOpacity
          style={styles.bottomSheetBackdrop}
          activeOpacity={1}
          onPress={handleDismiss}
        />
      )}
      <Animated.View
        style={[
          styles.bottomSheet,
          styles.historySheet,
          {
            opacity: historySheetOpacity,
            transform: [{ translateY }],
          },
        ]}
        pointerEvents={!showHistorySheet ? 'none' : 'auto'}
      >
        <View style={styles.historyHandleArea} {...panResponder.panHandlers}>
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>Transaction History</Text>
        </View>

        {loading ? (
          <View style={styles.historyLoadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.historyLoadingText}>Loading transactions...</Text>
          </View>
        ) : displayTransactions.length === 0 ? (
          <View style={styles.historyEmptyContainer}>
            <Text style={styles.historyEmptyText}>No transactions yet</Text>
          </View>
        ) : (
          <FlatList
            data={displayTransactions}
            renderItem={renderTransaction}
            keyExtractor={keyExtractor}
            style={styles.historyScrollView}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={true}
          />
        )}
      </Animated.View>
    </>
  );
}


TransactionHistoryScreen.propTypes = {
  styles: PropTypes.object.isRequired,
  showHistorySheet: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  segwitAddress: PropTypes.string.isRequired,
  taprootAddress: PropTypes.string.isRequired,
  vaultPubkey: PropTypes.string,
};
