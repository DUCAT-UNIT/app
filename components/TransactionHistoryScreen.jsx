/**
 * Transaction History Screen
 * Displays user's transaction history in a bottom sheet
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Animated, Dimensions, ActivityIndicator, ScrollView, Linking, PanResponder } from 'react-native';
import { COLORS } from '../utils/colors';
import { decodeRunestone } from '../runestone-encoder';
import Icon from './Icon';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

// UNIT•RUNE identifier
const UNIT_RUNE_BLOCK = 1527352n;
const UNIT_RUNE_TX = 1n;

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
  const translateY = useRef(new Animated.Value(0)).current;

  const handleDismiss = () => {
    onClose();
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
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            handleDismiss();
          });
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

      // Combine and deduplicate by txid
      const txMap = new Map();
      [...segwitTxs, ...taprootTxs].forEach(tx => {
        if (!txMap.has(tx.txid)) {
          txMap.set(tx.txid, tx);
        }
      });

      // Convert back to array and sort by timestamp (most recent first)
      const allTxs = Array.from(txMap.values()).sort((a, b) => b.status.block_time - a.status.block_time);

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

  const openTxInExplorer = async (txid, assetType) => {
    try {
      // Use ord explorer for UNIT transactions, regular explorer for BTC
      const url = assetType === 'UNIT'
        ? `https://ord-mutinynet.ducatprotocol.com/tx/${txid}`
        : `https://mutinynet.com/tx/${txid}`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening transaction in explorer:', error);
    }
  };

  /**
   * Parse rune transfers from transaction outputs
   * Returns UNIT amount if this is a UNIT transfer, or null
   */
  const parseRuneTransfer = (tx) => {
    try {
      // Look for OP_RETURN output
      const opReturnOutput = tx.vout?.find(output => {
        return output.scriptpubkey?.startsWith('6a5d'); // OP_RETURN + OP_13
      });

      if (!opReturnOutput) {
        return null;
      }

      // Decode the runestone
      const runestone = decodeRunestone(opReturnOutput.scriptpubkey);
      if (!runestone || !runestone.edicts || runestone.edicts.length === 0) {
        return null;
      }

      // Find UNIT rune edicts
      const unitEdicts = runestone.edicts.filter(edict =>
        edict.id.block === UNIT_RUNE_BLOCK && edict.id.tx === UNIT_RUNE_TX
      );

      if (unitEdicts.length === 0) {
        return null;
      }

      // Determine if we're sending or receiving
      const isOurInput = tx.vin?.some(input => {
        return input.prevout?.scriptpubkey_address === segwitAddress ||
               input.prevout?.scriptpubkey_address === taprootAddress;
      });

      let netUnitChange = 0n;
      let hasOurOutput = false;

      for (const edict of unitEdicts) {
        const outputIndex = Number(edict.output);
        const targetOutput = tx.vout?.[outputIndex];

        if (!targetOutput) {
          console.warn('UNIT edict references missing output:', outputIndex);
          continue;
        }

        const isOurOutput = targetOutput.scriptpubkey_address === segwitAddress ||
                           targetOutput.scriptpubkey_address === taprootAddress;

        if (isOurOutput) {
          hasOurOutput = true;
        }

        if (isOurInput) {
          // We're sending - count transfers to non-our addresses as negative
          if (!isOurOutput) {
            netUnitChange -= edict.amount;
          }
        } else {
          // We're receiving - count transfers to our addresses as positive
          if (isOurOutput) {
            netUnitChange += edict.amount;
          }
        }
      }

      // Only return UNIT transaction if we're actually involved (input or output)
      if (isOurInput || hasOurOutput) {
        return { amount: netUnitChange, type: 'UNIT' };
      }

      return null;
    } catch (error) {
      console.error('Failed to parse rune transfer for tx:', tx.txid, error);
      console.error('Error details:', error.message, error.stack);
      return null;
    }
  };

  /**
   * Calculate the net change for this transaction
   * Positive = received, Negative = sent
   */
  const calculateTxAmount = (tx) => {
    // First check if this is a rune transfer
    const runeTransfer = parseRuneTransfer(tx);
    if (runeTransfer) {
      return runeTransfer;
    }

    // Otherwise calculate BTC amount
    // Calculate total inputs from our addresses
    let ourInputs = 0;
    let ourOutputs = 0;
    let hasNonOurOutput = false;

    // Check if any inputs are from our addresses
    const isOurInput = tx.vin?.some(input => {
      const isOurs = input.prevout?.scriptpubkey_address === segwitAddress ||
                     input.prevout?.scriptpubkey_address === taprootAddress;
      if (isOurs) {
        ourInputs += input.prevout?.value || 0;
      }
      return isOurs;
    });

    // Sum up outputs to our addresses and check for external outputs
    tx.vout?.forEach(output => {
      const isOurOutput = output.scriptpubkey_address === segwitAddress ||
                         output.scriptpubkey_address === taprootAddress;
      if (isOurOutput) {
        ourOutputs += output.value;
      } else if (output.scriptpubkey_type !== 'op_return') {
        // Not our output and not OP_RETURN (ignore OP_RETURN for runes/metadata)
        hasNonOurOutput = true;
      }
    });

    // Detect self-transfer: all inputs are ours AND all non-OP_RETURN outputs are ours
    if (isOurInput && !hasNonOurOutput) {
      // This is a self-transfer (consolidation or moving to own address)
      // Return 0 to indicate self-transfer
      return { amount: 0, type: 'BTC', isSelfTransfer: true };
    }

    // Calculate net change
    // If we're sending (have inputs), net = outputs - inputs (will be negative)
    // If we're receiving (no inputs), net = outputs (will be positive)
    const netChange = isOurInput ? ourOutputs - ourInputs : ourOutputs;

    return { amount: netChange, type: 'BTC' };
  };

  const formatAmount = (value, type) => {
    if (type === 'UNIT') {
      // UNIT is stored with 100x multiplier, so divide by 100 for display
      const unitAmount = Number(value) / 100;
      return unitAmount.toLocaleString();
    } else {
      // BTC in satoshis
      const btc = value / 100000000;
      return btc.toFixed(8);
    }
  };

  // Reset opacity when opening/closing
  const prevShowHistorySheet = useRef(showHistorySheet);
  if (showHistorySheet && !prevShowHistorySheet.current) {
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
        ) : transactions.length === 0 ? (
          <View style={styles.historyEmptyContainer}>
            <Text style={styles.historyEmptyText}>No transactions yet</Text>
          </View>
        ) : (
          <ScrollView style={styles.historyScrollView} showsVerticalScrollIndicator={false}>
            {transactions.map((tx, index) => {
              const txData = calculateTxAmount(tx);
              const amount = typeof txData === 'object' ? txData.amount : txData;
              const assetType = typeof txData === 'object' ? txData.type : 'BTC';
              const isSelfTransferFlag = typeof txData === 'object' ? txData.isSelfTransfer : false;

              // Handle BigInt for UNIT amounts
              const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;
              const isSent = numericAmount < 0;
              const isReceived = numericAmount > 0;
              const isSelfTransfer = isSelfTransferFlag || (numericAmount === 0 && assetType === 'UNIT');

              return (
                <TouchableOpacity
                  key={`${tx.txid}-${index}`}
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

                  {/* Amount and Date */}
                  <View style={styles.historyTxCenter}>
                    {isSelfTransfer ? (
                      <View style={styles.historyTxAmountRow}>
                        <View style={styles.historySelfTransferTag}>
                          <Text style={styles.historySelfTransferText}>Self Transfer</Text>
                        </View>
                      </View>
                    ) : numericAmount !== 0 ? (
                      <Text style={[
                        styles.historyTxAmount,
                        isSent && styles.historyTxAmountSent,
                        isReceived && styles.historyTxAmountReceived
                      ]}>
                        {isSent ? '-' : '+'}{formatAmount(Math.abs(numericAmount), assetType)} {assetType}
                      </Text>
                    ) : null}
                    <Text style={styles.historyTxDate}>
                      {formatDate(tx.status.block_time)}
                    </Text>
                  </View>

                  {/* Confirmation Status */}
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
              );
            })}
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
