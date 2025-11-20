/**
 * SpectreWarning Component
 * Warning message for Spectre mode transactions
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

export default function SpectreWarning() {
  return (
    <View style={styles.warningContainer}>
      <View style={styles.iconContainer}>
        <Icon name="spectre" size={24} color={COLORS.YELLOW} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.warningText}>
          Spectre mode will exchange your on-chain UNIT for untraceable eUNIT.{'\n'}
          Click <Text style={styles.fuseText}>Fuse</Text> to recoup your on-chain UNIT.
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
  fuseText: {
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
  },
});
