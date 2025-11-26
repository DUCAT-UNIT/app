/**
 * UnconfirmedWarning - Display warning when using unconfirmed inputs
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

export default function UnconfirmedWarning() {
  return (
    <View style={styles.warningBanner}>
      <View style={styles.warningHeader}>
        <Icon name="warning" size={18} color={COLORS.YELLOW} />
        <Text style={styles.warningTitle}>Using Unconfirmed Outputs</Text>
      </View>
      <Text style={styles.warningText}>
        This transaction uses outputs from a pending transaction that hasn't been confirmed yet.
        If the parent transaction fails or is replaced, this transaction will also fail.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
