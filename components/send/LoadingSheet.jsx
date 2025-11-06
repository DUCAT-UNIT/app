/**
 * LoadingSheet Component
 * Bottom sheet showing loading state for transaction operations
 * Used for creating, signing, and broadcasting
 */

import React from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '../../utils/colors';
import styles from '../../styles';

export default function LoadingSheet({
  visible,
  title,
  message,
  dismissible = false,
  onDismiss,
}) {
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.bottomSheetBackdrop}
        activeOpacity={1}
        onPress={dismissible ? onDismiss : undefined}
      />
      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />

        <View style={[styles.amountInputContainer, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={{ marginBottom: 20 }} />
          <Text style={[styles.reviewTitle, { textAlign: 'center', marginBottom: message ? 20 : 0 }]}>
            {title}
          </Text>
          {message && (
            <Text style={[styles.reviewValue, { textAlign: 'center' }]}>
              {message}
            </Text>
          )}
        </View>
      </View>
    </>
  );
}
