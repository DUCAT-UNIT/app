/**
 * VaultHeader Component
 * Navigation header for VaultDetailScreen
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

interface VaultHeaderProps {
  onBackPress: () => void;
}

export const VaultHeader = memo(function VaultHeader({ onBackPress }: VaultHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBackPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="back" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>
      <Text style={styles.title}>Vault</Text>
      <View style={styles.placeholder} />
    </View>
  );
});

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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  placeholder: {
    width: 40,
  },
});
