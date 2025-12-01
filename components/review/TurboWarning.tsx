/**
 * TurboWarning Component
 * Warning message for Turbo mode transactions
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { useResponsive } from '../../hooks/useResponsive';

export default function TurboWarning() {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.warningContainer, { borderRadius: s(12), padding: s(16), marginBottom: s(12) }]}>
      <View style={[styles.iconContainer, { marginRight: s(12) }]}>
        <Icon name="turbo" size={s(24)} color={COLORS.YELLOW} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.warningText, { fontSize: sf(14), lineHeight: sf(20) }]}>
          Turbo mode lets you operate anonymously. All transactions are private and untraceable.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.YELLOW + '20',
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '30',
  },
  iconContainer: {
    // marginRight applied inline
  },
  textContainer: {
    flex: 1,
  },
  warningText: {
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
