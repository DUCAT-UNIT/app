/**
 * AssetHeader Component
 * Navigation header for AssetDetailScreen
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

export function AssetHeader({ onBackPress }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBackPress}
      >
        <Icon name="back" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
});
