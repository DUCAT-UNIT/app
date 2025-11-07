/**
 * AmountInputSheet Component
 * Bottom sheet for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, TextInput, Pressable, Image, Animated } from 'react-native';
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
}) {
  if (!visible) return null;

  const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;
  const assetLabel = sendAssetType === 'btc' ? 'BTC' : 'UNIT';
  const addressType = sendRecipient.startsWith('tb1p') || sendRecipient.startsWith('bc1p') ? 'Taproot' : 'Native SegWit';

  const handleAmountChange = (text) => {
    // Handle decimal comma from keyboard
    let processed = text;

    // If text ends with a comma and there's no period yet, it's a decimal comma
    if (processed.endsWith(',') && !processed.includes('.')) {
      // Replace the last comma with a period
      processed = processed.slice(0, -1) + '.';
    }

    // Remove all remaining commas (thousand separators)
    let cleaned = processed.replace(/,/g, '');

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

  const usdValue = sendAmount && (sendAssetType === 'btc' ? btcPrice : 1)
    ? (parseFloat(sendAmount) * (sendAssetType === 'btc' ? btcPrice : 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

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
            bottom: keyboardHeight,
            paddingBottom: 10,
            paddingHorizontal: 0,
            opacity,
            transform: [{ translateY }]
          }
        ]}
      >
        <View {...panHandlers}>
          <View style={styles.bottomSheetHandle} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.bottomSheetBackButton, { paddingHorizontal: 15 }]}
            onPress={onBack}
          >
            <Text style={styles.bottomSheetBackArrow}>‹</Text>
            <Text style={styles.bottomSheetBackText}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Recipient Address Header */}
        <View style={[styles.sendToHeader, { paddingHorizontal: 15 }]}>
          <View style={styles.sendToLeft}>
            <Text style={styles.sendToLabel}>To:</Text>
            <Text style={styles.sendToAddress}>
              {sendRecipient.substring(0, 8)}...{sendRecipient.substring(sendRecipient.length - 6)}
            </Text>
          </View>
          <View style={styles.addressTypeTag}>
            <Text style={styles.addressTypeText}>{addressType}</Text>
          </View>
        </View>

        <View style={[styles.amountInputContainer, { paddingHorizontal: 15 }]}>
          <View style={styles.amountBalanceRow}>
            <Text style={styles.amountBalanceLabel}>
              {assetLabel} Balance: {sendAssetType === 'btc'
                ? (balance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
                : (balance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
            <Pressable
              style={styles.maxButton}
              onPress={() => onAmountChange(String(balance || 0))}
            >
              <Text style={styles.maxButtonText}>MAX</Text>
            </Pressable>
          </View>

          <View style={styles.amountInputRow}>
            <TextInput
              ref={amountInputRef}
              style={[
                styles.amountInputLarge,
                formatNumberWithCommas(sendAmount).length > 8 && { fontSize: 44 },
                formatNumberWithCommas(sendAmount).length > 12 && { fontSize: 36 },
                formatNumberWithCommas(sendAmount).length > 15 && { fontSize: 28 }
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
            <Image
              source={sendAssetType === 'btc'
                ? require('../../assets/btc-symbol.png')
                : require('../../assets/unit-symbol.png')}
              style={styles.amountAssetSymbolRight}
            />
          </View>

          <Text style={styles.amountUsdValue}>
            ≈ ${usdValue} USD
          </Text>

          <TouchableOpacity
            style={[
              styles.amountContinueButton,
              !sendAmount && styles.amountContinueButtonDisabled
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
};
