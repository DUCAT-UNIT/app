/**
 * ConfirmationSheet Component
 * Bottom sheet showing successful transaction confirmation
 * Features: success checkmark, explorer link
 */

import React from 'react';
import { Text, View, TouchableOpacity, Linking, Animated } from 'react-native';
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
        {...panHandlers}
      >
        <View style={styles.bottomSheetHandle} />

        <TouchableOpacity
          style={styles.successCloseButton}
          onPress={onClose}
        >
          <Text style={styles.successCloseText}>✕</Text>
        </TouchableOpacity>

        <View style={[styles.amountInputContainer, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={styles.successCheckmarkContainer}>
            <View style={styles.successCheckmark}>
              <Text style={styles.successCheckmarkText}>✓</Text>
            </View>
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
