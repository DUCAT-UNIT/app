/**
 * ReviewScreen - Full screen for reviewing transaction before signing
 * Shows recipient, amount, UTXOs, change, network, and fees
 */

import React, { useState, useMemo } from 'react';
import { Text, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { usePrice } from '../../contexts/PriceContext';
import * as bitcoin from 'bitcoinjs-lib';

export default function ReviewScreen({ navigation }) {
  const { sendIntent } = useTransactionBuild();
  const { btcPrice } = usePrice();
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [runeUtxoBalance, setRuneUtxoBalance] = useState(null);

  // Get UNIT balance from rune UTXO (it's already in the object)
  React.useEffect(() => {
    if (sendIntent?.assetType === 'UNIT' && sendIntent?.runeUtxo && sendIntent?.runeUtxo.runeAmount) {
      console.log('Setting rune balance from UTXO:', sendIntent.runeUtxo.runeAmount);
      setRuneUtxoBalance(sendIntent.runeUtxo.runeAmount);
    }
  }, [sendIntent]);

  // Check if any inputs are unconfirmed (must be before early return)
  const hasUnconfirmedInputs = useMemo(() => {
    if (!sendIntent) return false;

    if (sendIntent.assetType === 'UNIT') {
      // Check rune UTXO and sat UTXO
      const runeUnconfirmed = sendIntent.runeUtxo?.status?.confirmed === false;
      const satUnconfirmed = sendIntent.satUtxo?.status?.confirmed === false;
      return runeUnconfirmed || satUnconfirmed;
    } else {
      // Check BTC inputs
      return (sendIntent.inputs || []).some(input => input.status?.confirmed === false);
    }
  }, [sendIntent]);

  if (!sendIntent) {
    // Should not happen, but handle gracefully
    navigation.goBack();
    return null;
  }

  // Calculate display values
  const displayAmount =
    sendIntent.assetType === 'UNIT'
      ? `${(parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT`
      : `${(sendIntent.amountBTC)} BTC`;

  const usdAmount =
    sendIntent.assetType === 'UNIT'
      ? (parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : (parseFloat(sendIntent.amountBTC) * (btcPrice || 0)).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  // Decode PSBT to get all actual inputs and outputs, and calculate actual fee
  const { psbtInputs, psbtOutputs, actualFee } = useMemo(() => {
    try {
      const psbt = bitcoin.Psbt.fromBase64(sendIntent.psbt);

      // Build inputs based on transaction type
      let inputs = [];
      if (sendIntent.assetType === 'UNIT') {
        // For UNIT transactions, we have runeUtxo and satUtxo
        if (sendIntent.runeUtxo) {
          inputs.push({
            address: sendIntent.sourceAddress,
            value: sendIntent.runeUtxo.value,
            type: 'rune',
            runeAmount: sendIntent.runeUtxo.runeAmount,
          });
        }
        if (sendIntent.satUtxo) {
          inputs.push({
            address: sendIntent.feeAddress,
            value: sendIntent.satUtxo.value,
            type: 'fee',
          });
        }
      } else {
        // For BTC transactions, use the inputs from sendIntent
        inputs = (sendIntent.inputs || []).map((input) => ({
          address: sendIntent.sourceAddress,
          value: input.value,
          type: 'btc',
        }));
      }

      const outputs = psbt.txOutputs.map((output, index) => {
        let address = 'Unknown';
        let type = 'unknown';

        // Check for OP_RETURN first (script starts with 0x6a)
        if (output.script[0] === 0x6a) {
          address = 'OP_RETURN (Runestone)';
          type = 'op_return';
          return {
            address,
            value: Number(output.value),
            type,
            index,
          };
        }

        // Try to decode address from script
        try {
          address = bitcoin.address.fromOutputScript(output.script, bitcoin.networks.testnet);
        } catch (e) {
          // Failed to decode address
          address = 'Unknown';
        }

        // Determine output type for UNIT transactions
        if (sendIntent.assetType === 'UNIT') {
          if (index === 0) {
            type = 'rune_return'; // Unallocated runes return
          } else if (index === 1) {
            type = 'recipient'; // UNIT recipient
          } else {
            type = 'change'; // BTC change
          }
        } else {
          // BTC transaction
          if (address === sendIntent.recipient) {
            type = 'recipient';
          } else {
            type = 'change';
          }
        }

        return {
          address,
          value: Number(output.value),
          type,
          index,
        };
      });

      // Calculate actual fee: sum of inputs - sum of outputs
      const totalInputValue = inputs.reduce((sum, input) => sum + input.value, 0);
      const totalOutputValue = outputs.reduce((sum, output) => sum + output.value, 0);
      const fee = totalInputValue - totalOutputValue;

      return { psbtInputs: inputs, psbtOutputs: outputs, actualFee: fee };
    } catch (error) {
      console.error('Error decoding PSBT:', error);
      return { psbtInputs: [], psbtOutputs: [], actualFee: 0 };
    }
  }, [sendIntent]);

  // Use PSBT outputs if available, otherwise fall back to manual construction
  const outputs = psbtOutputs.length > 0 ? psbtOutputs : (() => {
    const fallbackOutputs = [];
    fallbackOutputs.push({
      address: sendIntent.recipient,
      value: sendIntent.assetType === 'UNIT' ? sendIntent.amount : Math.floor(parseFloat(sendIntent.amountBTC) * 100000000),
      type: 'recipient'
    });
    if (sendIntent.change && sendIntent.change > 0) {
      fallbackOutputs.push({
        address: sendIntent.sourceAddress,
        value: sendIntent.change,
        type: 'change'
      });
    }
    return fallbackOutputs;
  })();

  const handleConfirm = () => {
    // Navigate to processing screen to sign and broadcast
    navigation.navigate('Processing', {
      fromScreen: 'Review',
      action: 'sign_and_broadcast'
    });
  };

  const handleCancel = () => {
    // Dismiss the send flow modal
    navigation.getParent()?.goBack();
  };

  return (
    <View style={localStyles.container}>
      {/* Header with back button */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backButton}>
          <Icon name="back" size={20} color={COLORS.PRIMARY_BLUE} />
        </TouchableOpacity>
        <Text style={localStyles.headerText}>You will send</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          {/* Main Card */}
          <View style={localStyles.card}>
            {/* To Row - Address on same line */}
            <View style={localStyles.toRow}>
              <Text style={localStyles.labelText}>To:</Text>
              <Text style={localStyles.addressText} selectable>
                {sendIntent.recipient.substring(0, 5)}...{sendIntent.recipient.substring(sendIntent.recipient.length - 5)}
              </Text>
            </View>

            {/* Amount Row with Icon */}
            <View style={localStyles.amountRow}>
              <View style={localStyles.assetIcon}>
                <Icon name={sendIntent.assetType === 'UNIT' ? 'unit_logo' : 'btc_logo'} size={30} />
              </View>
              <View style={localStyles.assetInfo}>
                <Text style={localStyles.assetAmountLabel}>Amount</Text>
                <Text style={localStyles.assetTypeText}>
                  {sendIntent.assetType === 'UNIT' ? 'UNIT•RUNE' : 'Bitcoin'}
                </Text>
              </View>
              <View style={localStyles.amountValues}>
                <Text style={localStyles.amountValue}>{displayAmount}</Text>
                <Text style={localStyles.amountUsdValue}>$ {usdAmount}</Text>
              </View>
            </View>
          </View>

          {/* Unconfirmed Inputs Warning */}
          {hasUnconfirmedInputs && (
            <View style={localStyles.warningBanner}>
              <View style={localStyles.warningHeader}>
                <Icon name="warning" size={18} color={COLORS.YELLOW} />
                <Text style={localStyles.warningTitle}>Using Unconfirmed Outputs</Text>
              </View>
              <Text style={localStyles.warningText}>
                This transaction uses outputs from a pending transaction that hasn't been confirmed yet. If the parent transaction fails or is replaced, this transaction will also fail.
              </Text>
            </View>
          )}

          {/* Transaction Details Section */}
          <Text style={localStyles.sectionTitle}>Transaction details</Text>
          <View style={localStyles.detailsCard}>
            <View style={localStyles.detailRow}>
              <Text style={localStyles.detailLabel}>Network:</Text>
              <Text style={localStyles.detailValue}>Mutinynet</Text>
            </View>
            <View style={localStyles.detailRowLast}>
              <Text style={localStyles.detailLabel}>Total fees:</Text>
              <Text style={localStyles.detailValue}>{actualFee.toLocaleString()} sats</Text>
            </View>
          </View>

          {/* Details Section - Collapsible */}
          <TouchableOpacity
            style={localStyles.detailsHeaderCard}
            onPress={() => setIsDetailsExpanded(!isDetailsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={localStyles.detailsHeaderText}>Transaction Details</Text>
            <Icon
              name={isDetailsExpanded ? 'chevron_up' : 'chevron_down'}
              size={20}
              color={COLORS.PRIMARY_BLUE}
            />
          </TouchableOpacity>

          {isDetailsExpanded && (
            <View style={localStyles.txDetailsContainer}>
              {/* Inputs */}
              <View style={localStyles.txSection}>
                <Text style={localStyles.txSectionTitle}>
                  Inputs ({psbtInputs.length})
                </Text>
                {psbtInputs.map((input, index) => (
                  <View key={`input-${index}`} style={localStyles.txItem}>
                    <View style={localStyles.txItemHeader}>
                      <Text style={localStyles.txAddress} selectable numberOfLines={1}>
                        {input.address.substring(0, 5)}...{input.address.substring(input.address.length - 5)}
                      </Text>
                      {input.type === 'rune' && input.runeAmount && (
                        <View style={localStyles.unitChip}>
                          <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
                          <Text style={localStyles.unitChipText}>
                            {(input.runeAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={localStyles.txValueRow}>
                      <Text style={localStyles.txValue}>
                        {(input.value / 100000000).toFixed(8)} BTC
                      </Text>
                      <Text style={localStyles.txUsd}>
                        ${((input.value / 100000000) * (btcPrice || 0)).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Outputs */}
              <View style={localStyles.txSection}>
                <Text style={localStyles.txSectionTitle}>
                  Outputs ({outputs.length})
                </Text>
                {outputs.map((output, index) => {
                  const unitAmount = sendIntent.assetType === 'UNIT' ? parseFloat(sendIntent.amount) : 0;
                  const isRuneOutput = sendIntent.assetType === 'UNIT' && (output.type === 'recipient' || output.type === 'rune_return');

                  // Calculate remaining UNIT for rune_return output
                  const remainingUnit = runeUtxoBalance ? (runeUtxoBalance / 100) - (unitAmount / 100) : 0;

                  // Determine label based on output type
                  let outputLabel = null;
                  if (output.type === 'change') {
                    outputLabel = 'Change';
                  } else if (output.type === 'rune_return') {
                    outputLabel = 'Rune Return';
                  } else if (output.type === 'op_return') {
                    outputLabel = 'Runestone';
                  }

                  return (
                    <View key={`output-${index}`} style={localStyles.txItem}>
                      <View style={localStyles.txItemHeader}>
                        <Text style={localStyles.txAddress} selectable numberOfLines={1}>
                          {output.address.length > 20
                            ? `${output.address.substring(0, 5)}...${output.address.substring(output.address.length - 5)}`
                            : output.address}
                        </Text>
                        {/* Show UNIT chip for rune outputs */}
                        {isRuneOutput && output.type === 'recipient' && (
                          <View style={localStyles.unitChip}>
                            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
                            <Text style={localStyles.unitChipText}>
                              {(unitAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>
                        )}
                        {isRuneOutput && output.type === 'rune_return' && runeUtxoBalance && (
                          <View style={localStyles.unitChip}>
                            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
                            <Text style={localStyles.unitChipText}>
                              {remainingUnit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>
                        )}
                        {/* Show regular labels for non-rune outputs */}
                        {!isRuneOutput && outputLabel && output.type !== 'op_return' && (
                          <Text style={localStyles.txChangeLabel}>{outputLabel}</Text>
                        )}
                        {output.type === 'op_return' && (
                          <Text style={localStyles.txChangeLabel}>Runestone</Text>
                        )}
                      </View>
                      {output.type === 'op_return' && sendIntent.assetType === 'UNIT' ? (
                        <View style={localStyles.runestoneInfo}>
                          <View style={localStyles.runestoneHeader}>
                            <Text style={localStyles.runestoneTitle}>⧉ Runestone Protocol</Text>
                          </View>
                          <View style={localStyles.runestoneDetail}>
                            <Text style={localStyles.runestoneDetailLabel}>Edict</Text>
                            <Text style={localStyles.runestoneDetailValue}>
                              Send {(unitAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT to {sendIntent.recipient.substring(0, 5)}...{sendIntent.recipient.substring(sendIntent.recipient.length - 5)}
                            </Text>
                          </View>
                          <View style={localStyles.runestoneDetail}>
                            <Text style={localStyles.runestoneDetailLabel}>Pointer</Text>
                            <Text style={localStyles.runestoneDetailValue}>
                              Send the rest to {sendIntent.sourceAddress.substring(0, 5)}...{sendIntent.sourceAddress.substring(sendIntent.sourceAddress.length - 5)}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={localStyles.txValueRow}>
                          <Text style={localStyles.txValue}>
                            {(output.value / 100000000).toFixed(8)} BTC
                          </Text>
                          <Text style={localStyles.txUsd}>
                            ${((output.value / 100000000) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Buttons - Fixed at bottom */}
      <View style={localStyles.buttonContainer}>
        <TouchableOpacity
          style={localStyles.cancelButton}
          activeOpacity={0.7}
          onPress={handleCancel}
        >
          <Text style={localStyles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.confirmButton}
          activeOpacity={0.7}
          onPress={handleConfirm}
        >
          <Text style={localStyles.confirmButtonText}>Confirm and Sign</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
  },
  toRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  labelText: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '400',
    marginRight: 8,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    flex: 1,
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  assetIcon: {
    marginRight: 20,
  },
  assetInfo: {
    flex: 1,
  },
  assetAmountLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 3,
  },
  assetTypeText: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
  amountValues: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 3,
  },
  amountUsdValue: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
  },
  detailsHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  detailsHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.PRIMARY_BLUE,
  },
  txDetailsContainer: {
    marginBottom: 24,
  },
  txSection: {
    marginBottom: 20,
  },
  txSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 10,
  },
  txItem: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  txItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  txAddress: {
    fontSize: 12,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'monospace',
    flex: 1,
    marginRight: 8,
  },
  txValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  txUsd: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
  },
  txChangeLabel: {
    fontSize: 10,
    color: COLORS.PRIMARY_BLUE,
    backgroundColor: COLORS.PRIMARY_BLUE + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontWeight: '500',
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY_BLUE + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  unitChipText: {
    fontSize: 10,
    color: COLORS.PRIMARY_BLUE,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Bold',
  },
  runestoneInfo: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.PRIMARY_BLUE + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  runestoneHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY_BLUE + '30',
  },
  runestoneTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  runestoneDetail: {
    marginBottom: 8,
  },
  runestoneDetailLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Bold',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  runestoneDetailValue: {
    fontSize: 13,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  runestoneLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 6,
  },
  runestoneText: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 4,
  },
  detailsCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  detailRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '400',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    textAlign: 'right',
  },
  warningBanner: {
    backgroundColor: COLORS.YELLOW + '15',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '40',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.YELLOW,
  },
  warningText: {
    fontSize: 13,
    color: COLORS.VERY_LIGHT_GRAY,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
