/**
 * ConfirmationSheet Component
 * Bottom sheet showing successful transaction confirmation
 * Features: success checkmark, explorer link
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, Linking, Animated } from 'react-native';
import { COLORS } from '../../utils/colors';
import Icon from '../Icon';
import styles from '../../styles';

export default function ConfirmationSheet({
  visible,
  opacity,
  translateY,
  panHandlers,
  broadcastedTxid,
  onDismiss,
  onClose,
}) {
  if (!visible || !broadcastedTxid) return null;

  const handleViewExplorer = () => {
    Linking.openURL(`https://mutinynet.com/tx/${broadcastedTxid}`);
  };

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
        </View>

        <TouchableOpacity
          style={styles.successCloseButton}
          onPress={onClose}
        >
          <Text style={styles.successCloseText}>✕</Text>
        </TouchableOpacity>

        <View style={[styles.amountInputContainer, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={styles.successCheckmarkContainer}>
            <Icon name="done" size={80} color={COLORS.TEAL} />
          </View>

          <Text style={[styles.successTitle, { textAlign: 'center' }]}>Transaction Sent</Text>

          <TouchableOpacity
            style={styles.amountContinueButton}
            activeOpacity={0.7}
            onPress={handleViewExplorer}
          >
            <Text style={styles.amountContinueButtonText}>View on Explorer</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

ConfirmationSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  opacity: PropTypes.object.isRequired, // Animated.Value
  translateY: PropTypes.object.isRequired, // Animated.Value
  panHandlers: PropTypes.object,
  broadcastedTxid: PropTypes.string,
  onDismiss: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
