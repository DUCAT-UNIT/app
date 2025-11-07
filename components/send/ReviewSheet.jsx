/**
 * ReviewSheet Component
 * Bottom sheet for reviewing transaction before signing
 * Shows recipient, amount, network, and fees
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, Image, Animated } from 'react-native';
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

  const usdAmount = sendIntent.assetType === 'UNIT'
    ? (parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (parseFloat(sendIntent.amountBTC) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const displayAmount = sendIntent.assetType === 'UNIT'
    ? `${(parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT`
    : `${formatBTC(sendIntent.amountBTC)} BTC`;

  return (
    <>
      <TouchableOpacity
        style={styles.bottomSheetBackdrop}
        onPress={onDismiss}
        activeOpacity={1}
      />
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            opacity,
            transform: [{ translateY }]
          }
        ]}
      >
        <View {...panHandlers}>
          <View style={styles.bottomSheetHandle} />

          <TouchableOpacity
            style={styles.bottomSheetBackButton}
            onPress={onBack}
          >
            <Icon name="back" size={20} color={COLORS.PRIMARY_BLUE} />
          </TouchableOpacity>
        </View>

        <View style={styles.amountInputContainer}>
          <Text style={{ fontSize: 18, fontWeight: '500', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 16 }}>
            You will send
          </Text>

          {/* To and Amount Card */}
          <View style={{ backgroundColor: COLORS.CARD_BG, borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' }}>
            {/* To Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: COLORS.SECONDARY_TEXT, fontWeight: '400' }}>To:</Text>
              <Text style={{ fontSize: 14, fontWeight: '400', color: COLORS.VERY_LIGHT_GRAY }}>
                {sendIntent.recipient.substring(0, 8)}...{sendIntent.recipient.substring(sendIntent.recipient.length - 7)}
              </Text>
            </View>

            {/* Amount Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ marginRight: 20 }}>
                <Icon
                  name={sendIntent.assetType === 'UNIT' ? 'unit_logo' : 'btc_logo'}
                  size={30}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '400', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 3 }}>
                  Amount
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.SECONDARY_TEXT }}>
                  {sendIntent.assetType === 'UNIT' ? 'UNIT•RUNE' : 'Bitcoin'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: '400', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 3 }}>
                  {displayAmount}
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.SECONDARY_TEXT }}>
                  $ {usdAmount} USD
                </Text>
              </View>
            </View>
          </View>

          {/* Transaction Details Section */}
          <Text style={{ fontSize: 16, fontWeight: '400', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 12 }}>
            Transaction details
          </Text>

          {/* Transaction Details Card */}
          <View style={{ backgroundColor: COLORS.CARD_BG, borderRadius: 12, padding: 14, marginBottom: 24, width: '100%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, width: '100%' }}>
              <Text style={{ fontSize: 14, color: COLORS.SECONDARY_TEXT, fontWeight: '400' }}>Network:</Text>
              <Text style={{ fontSize: 14, fontWeight: '400', color: COLORS.VERY_LIGHT_GRAY }}>Mutinynet</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Text style={{ fontSize: 14, color: COLORS.SECONDARY_TEXT, fontWeight: '400' }}>Total fees:</Text>
              <Text style={{ fontSize: 14, fontWeight: '400', color: COLORS.VERY_LIGHT_GRAY }}>
                {sendIntent.fee.toLocaleString()} sats
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: COLORS.BORDER_COLOR,
                backgroundColor: 'transparent',
                alignItems: 'center',
              }}
              activeOpacity={0.7}
              onPress={onCancel}
            >
              <Text style={{ fontSize: 15, fontWeight: '500', color: COLORS.VERY_LIGHT_GRAY }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 10,
                backgroundColor: COLORS.PRIMARY_BLUE,
                alignItems: 'center',
              }}
              activeOpacity={0.7}
              onPress={onConfirm}
            >
              <Text style={{ fontSize: 15, fontWeight: '500', color: COLORS.VERY_LIGHT_GRAY }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

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
