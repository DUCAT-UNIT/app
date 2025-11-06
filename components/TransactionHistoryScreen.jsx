/**
 * Transaction History Screen
 * Displays user's transaction history in a bottom sheet
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, PanResponder, Animated, Dimensions, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { COLORS } from '../utils/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function TransactionHistoryScreen({
  styles,
  showHistorySheet,
  onClose,
  segwitAddress,
  taprootAddress,
}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const historySheetOpacity = useRef(new Animated.Value(0)).current;
  const historyTranslateY = useRef(new Animated.Value(0)).current;

  // Pan responder for swipe-down to dismiss
  const panResponderRef = useRef(null);

  const handleDismiss = () => {
    Animated.timing(historyTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      historySheetOpacity.setValue(0);
      onClose();
    });
  };

  // Create pan responder for swipe-down
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe = gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          historyTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(historyTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  // Fetch transaction history when sheet opens
  useEffect(() => {
    if (showHistorySheet) {
      fetchTransactionHistory();
    }
  }, [showHistorySheet, segwitAddress, taprootAddress]);

  const fetchTransactionHistory = async () => {
    setLoading(true);
    try {
      // Fetch transactions for both addresses
      const [segwitTxs, taprootTxs] = await Promise.all([
        fetchAddressTransactions(segwitAddress),
        fetchAddressTransactions(taprootAddress),
      ]);

      // Combine and sort by timestamp (most recent first)
      const allTxs = [...segwitTxs, ...taprootTxs].sort((a, b) => b.status.block_time - a.status.block_time);

      setTransactions(allTxs);
    } catch (error) {
      console.error('Failed to fetch transaction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddressTransactions = async (address) => {
    try {
      const response = await fetch(`https://mutinynet.com/api/address/${address}/txs`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const txs = await response.json();
      return txs || [];
    } catch (error) {
      console.error('Error fetching transactions for', address, error);
      return [];
    }
  };

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

  const openTxInExplorer = (txid) => {
    Linking.openURL(`https://mutinynet.com/tx/${txid}`);
  };

  // Reset position when opening, force invisible when closed
  const prevShowHistorySheet = useRef(showHistorySheet);
  if (showHistorySheet && !prevShowHistorySheet.current) {
    historyTranslateY.setValue(0);
    historySheetOpacity.setValue(1);
  } else if (!showHistorySheet && prevShowHistorySheet.current) {
    historySheetOpacity.setValue(0);
  }
  prevShowHistorySheet.current = showHistorySheet;

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
            transform: [{ translateY: historyTranslateY }],
          },
        ]}
        pointerEvents={!showHistorySheet ? 'none' : 'auto'}
        {...panResponderRef.current.panHandlers}
      >
        <View style={styles.bottomSheetHandle} />
        <Text style={styles.bottomSheetTitle}>Transaction History</Text>

        {loading ? (
          <View style={styles.historyLoadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.historyLoadingText}>Loading transactions...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.historyEmptyContainer}>
            <Text style={styles.historyEmptyText}>No transactions yet</Text>
          </View>
        ) : (
          <ScrollView style={styles.historyScrollView} showsVerticalScrollIndicator={false}>
            {transactions.map((tx, index) => (
              <TouchableOpacity
                key={`${tx.txid}-${index}`}
                style={styles.historyTxRow}
                onPress={() => openTxInExplorer(tx.txid)}
                activeOpacity={0.7}
              >
                <View style={styles.historyTxLeft}>
                  <Text style={styles.historyTxId}>{formatTxid(tx.txid)}</Text>
                  <Text style={styles.historyTxDate}>
                    {formatDate(tx.status.block_time)}
                  </Text>
                </View>
                <View style={styles.historyTxRight}>
                  {tx.status.confirmed ? (
                    <View style={styles.historyTxStatusConfirmed}>
                      <Text style={styles.historyTxStatusText}>Confirmed</Text>
                    </View>
                  ) : (
                    <View style={styles.historyTxStatusPending}>
                      <Text style={styles.historyTxStatusTextPending}>Pending</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
};
