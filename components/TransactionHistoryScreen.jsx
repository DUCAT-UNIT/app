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
import { fetchVaultHistory } from '../services/vaultService';
import { retrySilently } from '../utils/retry';

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
  vaultPubkey,
}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // Fetch transaction history when sheet opens
  useEffect(() => {
    if (showHistorySheet) {
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
  }, [showHistorySheet, segwitAddress, taprootAddress]);

  const fetchTransactionHistory = async () => {
    setLoading(true);
    try {
      // Fetch transactions for both addresses and vault history
      const [segwitTxs, taprootTxs, vaultHistory] = await Promise.all([
        fetchAddressTransactions(segwitAddress),
        fetchAddressTransactions(taprootAddress),
        fetchVaultHistory(vaultPubkey),
      ]);

      // First, collect all vault transaction IDs
      const vaultTxIds = new Set();
      vaultHistory.forEach(vaultTx => {
        if (vaultTx.transaction_id) {
          vaultTxIds.add(vaultTx.transaction_id);
        }
      });

      // Combine and deduplicate by txid, but exclude any that are vault transactions
      const txMap = new Map();
      [...segwitTxs, ...taprootTxs].forEach(tx => {
        // Skip if this txid is a vault transaction
        if (!vaultTxIds.has(tx.txid) && !txMap.has(tx.txid)) {
          txMap.set(tx.txid, tx);
        } else if (vaultTxIds.has(tx.txid)) {
        }
      });

      // Add vault transactions
      vaultHistory.forEach(vaultTx => {
        // Create a synthetic transaction object for vault transactions
        const syntheticTx = {
          txid: vaultTx.transaction_id || `vault-${vaultTx.timestamp}`,
          status: {
            confirmed: true,
            block_time: vaultTx.timestamp,
          },
          vaultTransaction: true,
          vaultData: {
            action: vaultTx.action,
            amountBorrowed: vaultTx.amount_borrowed,
            vaultAmount: vaultTx.vault_amount,
            btcAmount: vaultTx.btc_amt,
            unitAmount: vaultTx.unit_amt,
            oraclePrice: vaultTx.oracle_price,
          },
        };

        txMap.set(syntheticTx.txid, syntheticTx);
      });

      // Convert back to array and sort by timestamp (most recent first)
      const allTxs = Array.from(txMap.values()).sort((a, b) => b.status.block_time - a.status.block_time);

      setTransactions(allTxs);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchAddressTransactions = async (address) => {
    try {
      const response = await retrySilently(
        () => fetch(`https://mutinynet.com/api/address/${address}/txs`),
        `Fetch transactions for ${address.substring(0, 8)}...`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const txs = await response.json();
      return txs || [];
    } catch (error) {
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
      }
    } catch (error) {
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
      return unitAmount.toLocaleString('en-US');
    } else {
      // BTC in satoshis
      const btc = value / 100000000;
      return btc.toFixed(8);
    }
  };

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
              // Check if this is a vault transaction
              if (tx.vaultTransaction) {
                const vaultData = tx.vaultData;
                const action = vaultData.action;

                return (
                  <TouchableOpacity
                    key={`${tx.txid}-${index}`}
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
              const txData = calculateTxAmount(tx);
              const amount = typeof txData === 'object' ? txData.amount : txData;
              const assetType = typeof txData === 'object' ? txData.type : 'BTC';
              const isSelfTransferFlag = typeof txData === 'object' ? txData.isSelfTransfer : false;

              // Handle BigInt for UNIT amounts
              const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;
              const isSent = numericAmount < 0;
              const isReceived = numericAmount > 0;
              const isSelfTransfer = isSelfTransferFlag || (numericAmount === 0 && assetType === 'UNIT');

              // Skip self transfers
              if (isSelfTransfer) {
                return null;
              }

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

                  {/* Main Content Container */}
                  <View style={{ flex: 1 }}>
                    {/* First Row: Action on left, Confirmation + Amount on right */}
                    <View style={styles.historyTxTopRow}>
                      <View style={styles.historyTxColumn1}>
                        <Text style={[styles.historyTxAmount, { color: '#DDDDDD' }]}>
                          {isSelfTransfer ? 'Self Transfer' : (isSent ? 'Sent' : 'Received')}
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
                          {!isSelfTransfer && numericAmount !== 0 && (
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
  vaultPubkey: PropTypes.string,
};
