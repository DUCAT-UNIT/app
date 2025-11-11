/**
 * ReviewSheet Component
 * Bottom sheet for reviewing transaction before signing
 * Shows recipient, amount, network, and fees
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/colors';
import Icon from '../Icon';
import styles from '../../styles';
import { formatBTC } from '../../utils/sendHelpers';

export default function ReviewSheet({
  visible,
  opacity,
  translateY,
  panHandlers,
  sendIntent,
  btcPrice,
  onDismiss,
  onBack,
  onCancel,
  onConfirm,
}) {
  if (!visible || !sendIntent) return null;

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

  const displayAmount =
    sendIntent.assetType === 'UNIT'
      ? `${(parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT`
      : `${formatBTC(sendIntent.amountBTC)} BTC`;

  return (
    <>
      <TouchableOpacity style={styles.bottomSheetBackdrop} onPress={onDismiss} activeOpacity={1} />
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View {...panHandlers}>
          <View style={styles.bottomSheetHandle} />
        </View>

        <View style={localStyles.headerRow}>
          <TouchableOpacity style={localStyles.backButton} onPress={onBack}>
            <Icon name="back" size={20} color={COLORS.PRIMARY_BLUE} />
          </TouchableOpacity>
          <Text style={localStyles.headerText}>You will send</Text>
        </View>

        <View style={[styles.amountInputContainer, localStyles.contentContainer]}>
          {/* To and Amount Card */}
          <View style={localStyles.card}>
            {/* To Row */}
            <View style={localStyles.cardRow}>
              <Text style={localStyles.labelText}>To:</Text>
              <Text style={localStyles.valueText}>
                {sendIntent.recipient.substring(0, 8)}...
                {sendIntent.recipient.substring(sendIntent.recipient.length - 7)}
              </Text>
            </View>

            {/* Amount Row */}
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
                <Text style={localStyles.usdValue}>$ {usdAmount} USD</Text>
              </View>
            </View>
          </View>

          {/* Transaction Details Section */}
          <Text style={localStyles.sectionTitle}>Transaction details</Text>

          {/* Transaction Details Card */}
          <View style={localStyles.detailsCard}>
            <View style={localStyles.detailRow}>
              <Text style={localStyles.detailLabel}>Network:</Text>
              <Text style={localStyles.detailValue}>Mutinynet</Text>
            </View>
            <View style={localStyles.detailRowLast}>
              <Text style={localStyles.detailLabel}>Total fees:</Text>
              <Text style={localStyles.detailValue}>{sendIntent.fee.toLocaleString()} sats</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={localStyles.buttonsRow}>
            <TouchableOpacity
              style={localStyles.cancelButton}
              activeOpacity={0.7}
              onPress={onCancel}
            >
              <Text style={localStyles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={localStyles.confirmButton}
              activeOpacity={0.7}
              onPress={onConfirm}
            >
              <Text style={localStyles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const localStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 2,
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
  contentContainer: {
    paddingTop: 0,
  },
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  labelText: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '400',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
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
  usdValue: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
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
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  detailRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
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

ReviewSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  opacity: PropTypes.object.isRequired, // Animated.Value
  translateY: PropTypes.object.isRequired, // Animated.Value
  panHandlers: PropTypes.object,
  sendIntent: PropTypes.shape({
    recipient: PropTypes.string.isRequired,
    assetType: PropTypes.string.isRequired,
    amount: PropTypes.string,
    amountBTC: PropTypes.string,
    fee: PropTypes.number.isRequired,
  }),
  btcPrice: PropTypes.number,
  onDismiss: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
