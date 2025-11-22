/**
 * TransactionItem Component
 * Displays a single transaction in the history list
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatTransactionDate } from '../../utils/transactionFormatters';

export default function TransactionItem({ tx, styles, onPress, advancedMode = false }) {
  // Check if this is a vault transaction
  if (tx.vaultTransaction) {
    return <VaultTransactionItem tx={tx} styles={styles} onPress={onPress} />;
  }

  // Check if this is an ecash transaction
  if (tx.ecashToken) {
    return <EcashTransactionItem tx={tx} styles={styles} onPress={onPress} />;
  }

  // Regular transaction
  return <RegularTransactionItem tx={tx} styles={styles} onPress={onPress} advancedMode={advancedMode} />;
}

// Helper component to reduce nesting
function VaultAmountDisplay({ vaultData, action, styles }) {
  const isPositiveAction = action === 'Deposit' || action === 'Repay';
  const color = isPositiveAction ? COLORS.GREEN : COLORS.RED;

  if (vaultData.btcAmount > 0) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="btc_symbol" size={12} color={color} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color }]}>
          {(vaultData.btcAmount / 100000000).toLocaleString('en-US', {
            minimumFractionDigits: 8,
            maximumFractionDigits: 8,
          })}
        </Text>
      </View>
    );
  }

  if (vaultData.unitAmount > 0) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="unit_symbol" size={12} color={color} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color }]}>
          {(vaultData.unitAmount / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>
    );
  }

  return null;
}

function VaultTransactionItem({ tx, styles, onPress }) {
  const vaultData = tx.vaultData;
  const action = vaultData.action;

  return (
    <TouchableOpacity style={styles.historyTxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={localStyles.vaultLogo}>
        <Icon name="vault_logo" size={40} />
      </View>

      <View style={localStyles.txContentContainer}>
        <View style={styles.historyTxTopRow}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText]}>
              {action === 'Borrow'
                ? 'Borrow'
                : action === 'Repay'
                  ? 'Repay'
                  : action === 'Deposit'
                    ? 'Deposit'
                    : action === 'Withdraw'
                      ? 'Withdraw'
                      : action}
            </Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[styles.vaultAmountChip, localStyles.vaultConfirmedChip]}>
                <Text style={[styles.vaultAmountChipText, localStyles.vaultConfirmedText]}>
                  Confirmed
                </Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              <VaultAmountDisplay vaultData={vaultData} action={action} styles={styles} />
            </View>
          </View>
        </View>
        <View style={styles.historyTxBottomRow}>
          <Text style={styles.historyTxDate}>{formatTransactionDate(tx.status.block_time)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EcashTransactionItem({ tx, styles, onPress }) {
  const { amount } = tx.txData;
  const isClaimed = tx.claimed === true;

  return (
    <TouchableOpacity style={styles.historyTxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={localStyles.assetLogo}>
        <Icon name="unit_logo" size={40} />
      </View>

      <View style={localStyles.txContentContainer}>
        <View style={styles.historyTxTopRow}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText]}>
              Sent
            </Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[
                styles.vaultAmountChip,
                isClaimed ? localStyles.claimedChip : localStyles.confirmedChip
              ]}>
                <Text style={[
                  styles.vaultAmountChipText,
                  isClaimed ? localStyles.claimedChipText : localStyles.confirmedChipText
                ]}>
                  {isClaimed ? 'Claimed' : 'Sent'}
                </Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              <View style={styles.balanceWithIcon}>
                <Icon
                  name="unit_symbol"
                  size={12}
                  color={COLORS.RED}
                  style={styles.assetAmountIcon}
                />
                <Text style={[styles.assetAmount, { color: COLORS.RED }]}>
                  {Math.abs(amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.historyTxBottomRow}>
          <Text style={styles.historyTxDate}>{formatTransactionDate(tx.timestamp / 1000)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function RegularTransactionItem({ tx, styles, onPress, advancedMode = false }) {
  const { amount, assetType, isSent, isReceived } = tx.txData;

  // Handle BigInt for UNIT amounts
  const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;

  // Check if this is a Spectre transaction (to mint address)
  const SPECTRE_MINT_ADDRESS = 'tb1p7p74tg67aaw94vz2kewzeyuq80x0a65wpgegnat98f5hkcnpfjsqntv2em';
  const isSpectreTransaction = assetType === 'UNIT' && tx.vout?.some(output =>
    output.scriptpubkey_address === SPECTRE_MINT_ADDRESS
  );

  // Only show Spectre UI if advanced mode is enabled
  const showSpectreUI = isSpectreTransaction && advancedMode;

  // Determine action label
  const getActionLabel = () => {
    if (showSpectreUI) {
      return isSent ? 'Activate' : 'Deactivate';
    }
    return isSent ? 'Sent' : 'Received';
  };

  return (
    <TouchableOpacity style={styles.historyTxRow} onPress={onPress} activeOpacity={0.7}>
      {/* Asset Logo */}
      {showSpectreUI ? (
        <View style={localStyles.assetLogo}>
          <Icon name="spectre" size={40} color="#DDDDDD" />
        </View>
      ) : (
        <View style={localStyles.assetLogo}>
          <Icon name={assetType === 'UNIT' ? 'unit_logo' : 'btc_logo'} size={40} />
        </View>
      )}

      {/* Main Content Container */}
      <View style={localStyles.txContentContainer}>
        {/* First Row: Action on left, Confirmation + Amount on right */}
        <View style={styles.historyTxTopRow}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText]}>
              {getActionLabel()}
            </Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View
                style={[
                  styles.vaultAmountChip,
                  tx.status.confirmed ? localStyles.confirmedChip : localStyles.pendingChip,
                ]}
              >
                <Text
                  style={[
                    styles.vaultAmountChipText,
                    tx.status.confirmed
                      ? localStyles.confirmedChipText
                      : localStyles.pendingChipText,
                  ]}
                >
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
                  <Text
                    style={[
                      styles.assetAmount,
                      {
                        color: isReceived ? COLORS.GREEN : COLORS.RED,
                      },
                    ]}
                  >
                    {assetType === 'UNIT'
                      ? (Math.abs(numericAmount) / 100).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : (Math.abs(numericAmount) / 100000000).toLocaleString('en-US', {
                          minimumFractionDigits: 8,
                          maximumFractionDigits: 8,
                        })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {/* Second Row: Date */}
        <View style={styles.historyTxBottomRow}>
          <Text style={styles.historyTxDate}>{formatTransactionDate(tx.status.block_time)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const localStyles = StyleSheet.create({
  vaultLogo: {
    marginRight: 10,
  },
  assetLogo: {
    marginRight: 10,
  },
  txContentContainer: {
    flex: 1,
  },
  actionText: {
    color: '#DDDDDD',
  },
  vaultConfirmedChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    marginLeft: 0,
  },
  vaultConfirmedText: {
    color: COLORS.GREEN,
  },
  confirmedChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    marginLeft: 0,
  },
  confirmedChipText: {
    color: COLORS.GREEN,
  },
  pendingChip: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    marginLeft: 0,
  },
  pendingChipText: {
    color: COLORS.YELLOW,
  },
  claimedChip: {
    backgroundColor: 'transparent',
    marginLeft: 0,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  claimedChipText: {
    color: COLORS.PRIMARY_BLUE,
  },
});

TransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
};

VaultAmountDisplay.propTypes = {
  vaultData: PropTypes.object.isRequired,
  action: PropTypes.string.isRequired,
  styles: PropTypes.object.isRequired,
};

VaultTransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
};

RegularTransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
};

EcashTransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
};
