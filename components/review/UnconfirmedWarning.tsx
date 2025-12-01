/**
 * UnconfirmedWarning - Display warning when using unconfirmed inputs
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { useResponsive } from '../../hooks/useResponsive';

export default function UnconfirmedWarning() {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.warningBanner, { borderRadius: s(12), padding: s(16), marginBottom: s(20) }]}>
      <View style={[styles.warningHeader, { marginBottom: s(8), gap: s(8) }]}>
        <Icon name="warning" size={s(18)} color={COLORS.YELLOW} />
        <Text style={[styles.warningTitle, { fontSize: sf(14) }]}>Using Unconfirmed Outputs</Text>
      </View>
      <Text style={[styles.warningText, { fontSize: sf(13), lineHeight: sf(18) }]}>
        This transaction uses outputs from a pending transaction that hasn't been confirmed yet.
        If the parent transaction fails or is replaced, this transaction will also fail.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  warningBanner: {
    backgroundColor: COLORS.YELLOW + '15',
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '40',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningTitle: {
    fontWeight: '600',
    color: COLORS.YELLOW,
  },
  warningText: {
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
