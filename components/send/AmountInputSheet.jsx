/**
 * AmountInputSheet Component
 * Bottom sheet for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, TextInput, Pressable, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/colors';
import Icon from '../Icon';
import styles from '../../styles';
import { formatNumberWithCommas } from '../../utils/sendHelpers';

export default function AmountInputSheet({
  visible,
  opacity,
  translateY,
  panHandlers,
  keyboardHeight,
  sendAssetType,
  sendAmount,
  sendRecipient,
  btcBalance,
  unitBalance,
  btcPrice,
  amountInputRef,
  onDismiss,
  onBack,
  onAmountChange,
  onReview,
  onMaxPress,
}) {
  if (!visible) return null;

  const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;
  const assetLabel = sendAssetType === 'btc' ? 'BTC' : 'UNIT';
  const addressType =
    sendRecipient.startsWith('tb1p') || sendRecipient.startsWith('bc1p')
      ? 'Taproot'
      : 'Native SegWit';

  const handleAmountChange = (text) => {
    // Handle decimal comma from keyboard
    let processed = text;

    // If text ends with a comma and there's no period yet, it's a decimal comma
    if (processed.endsWith(',') && !processed.includes('.')) {
      // Replace the last comma with a period
      processed = processed.slice(0, -1) + '.';
    }

    // Remove all remaining commas (thousand separators)
    const cleaned = processed.replace(/,/g, '');

    // Only allow numbers and one decimal point
    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
      onAmountChange(cleaned);
    }
  };

  const handleSubmit = () => {
    if (sendAmount) {
      amountInputRef.current?.blur();
      setTimeout(() => onReview(), 50);
    }
  };

  const usdValue =
    sendAmount && (sendAssetType === 'btc' ? btcPrice : 1)
      ? (parseFloat(sendAmount) * (sendAssetType === 'btc' ? btcPrice : 1)).toLocaleString(
          'en-US',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )
      : '0.00';

  return (
    <>
      <TouchableOpacity style={styles.bottomSheetBackdrop} onPress={onDismiss} activeOpacity={1} />
      <Animated.View
        style={[
          styles.bottomSheet,
          localStyles.sheet,
          {
            bottom: keyboardHeight,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View {...panHandlers}>
          <View style={styles.bottomSheetHandle} />

          {/* Header with Back button and Recipient Address */}
          <View style={[styles.sendToHeader, localStyles.headerContainer]}>
            {/* Back button */}
            <TouchableOpacity style={localStyles.backButton} onPress={onBack}>
              <Icon name="back" size={20} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>

            {/* To: Address */}
            <View style={localStyles.addressContainer}>
              <View style={styles.sendToLeft}>
                <Text style={styles.sendToLabel}>To:</Text>
                <Text style={styles.sendToAddress}>
                  {sendRecipient.substring(0, 8)}...
                  {sendRecipient.substring(sendRecipient.length - 6)}
                </Text>
              </View>
              <View style={styles.addressTypeTag}>
                <Text style={styles.addressTypeText}>{addressType}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.amountInputContainer, localStyles.inputContainer]}>
          <View style={styles.amountBalanceRow}>
            <Text style={styles.amountBalanceLabel}>
              {assetLabel} Balance:{' '}
              {sendAssetType === 'btc'
                ? (balance || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 8,
                  })
                : (balance || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
            </Text>
            <Pressable
              style={styles.maxButton}
              onPress={onMaxPress || (() => onAmountChange(String(balance || 0)))}
            >
              <Text style={styles.maxButtonText}>MAX</Text>
            </Pressable>
          </View>

          <View style={styles.amountInputRow}>
            <TextInput
              ref={amountInputRef}
              style={[
                styles.amountInputLarge,
                formatNumberWithCommas(sendAmount).length > 8 && localStyles.mediumText,
                formatNumberWithCommas(sendAmount).length > 12 && localStyles.smallText,
                formatNumberWithCommas(sendAmount).length > 15 && localStyles.xsmallText,
              ]}
              value={formatNumberWithCommas(sendAmount)}
              onChangeText={handleAmountChange}
              placeholder="0"
              placeholderTextColor="#444444"
              keyboardType="decimal-pad"
              returnKeyType="done"
              autoFocus={true}
              onSubmitEditing={handleSubmit}
            />
            <Icon
              name={sendAssetType === 'btc' ? 'btc_symbol' : 'unit_symbol'}
              size={32}
              color={COLORS.VERY_LIGHT_GRAY}
            />
          </View>

          <Text style={styles.amountUsdValue}>≈ ${usdValue} USD</Text>

          <TouchableOpacity
            style={[
              styles.amountContinueButton,
              !sendAmount && styles.amountContinueButtonDisabled,
            ]}
            activeOpacity={0.7}
            onPress={handleSubmit}
            disabled={!sendAmount}
          >
            <Text style={styles.amountContinueButtonText}>Review</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const localStyles = StyleSheet.create({
  sheet: {
    paddingBottom: 10,
    paddingHorizontal: 0,
  },
  headerContainer: {
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputContainer: {
    paddingHorizontal: 15,
  },
  mediumText: {
    fontSize: 44,
  },
  smallText: {
    fontSize: 36,
  },
  xsmallText: {
    fontSize: 28,
  },
});

AmountInputSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  opacity: PropTypes.object.isRequired, // Animated.Value
  translateY: PropTypes.object.isRequired, // Animated.Value
  panHandlers: PropTypes.object,
  keyboardHeight: PropTypes.number.isRequired,
  sendAssetType: PropTypes.oneOf(['btc', 'unit', 'ducat']).isRequired,
  sendAmount: PropTypes.string.isRequired,
  sendRecipient: PropTypes.string.isRequired,
  btcBalance: PropTypes.number,
  unitBalance: PropTypes.number,
  btcPrice: PropTypes.number,
  amountInputRef: PropTypes.object.isRequired,
  onDismiss: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onAmountChange: PropTypes.func.isRequired,
  onReview: PropTypes.func.isRequired,
  onMaxPress: PropTypes.func,
};
