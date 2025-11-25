/**
 * TurboWarning Component
 * Warning message for Turbo mode transactions
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

export default function TurboWarning() {
  return (
    <View style={styles.warningContainer}>
      <View style={styles.iconContainer}>
        <Icon name="turbo" size={24} color={COLORS.YELLOW} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.warningText}>
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '30',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
