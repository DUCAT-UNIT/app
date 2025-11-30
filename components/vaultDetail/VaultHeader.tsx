/**
 * VaultHeader Component
 * Navigation header for VaultDetailScreen
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface VaultHeaderProps {
  onBackPress: () => void;
  onChartPress?: () => void;
}

export const VaultHeader = memo(function VaultHeader({ onBackPress, onChartPress }: VaultHeaderProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.header, { paddingHorizontal: s(16), paddingVertical: s(12) }]}>
      <TouchableOpacity
        style={[styles.backButton, { padding: s(8) }]}
        onPress={onBackPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="back" size={s(24)} color={COLORS.WHITE} />
      </TouchableOpacity>
      <Text style={[styles.title, { fontSize: sf(18) }]}>Vault</Text>
      {onChartPress ? (
        <TouchableOpacity
          style={[styles.chartButton, { width: s(40), height: s(40), borderRadius: s(20) }]}
          onPress={onChartPress}
          activeOpacity={0.7}
        >
          <Icon name="chart" size={s(20)} color={COLORS.WHITE} />
        </TouchableOpacity>
      ) : (
        <View style={[styles.placeholder, { width: s(40) }]} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {},
  title: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  chartButton: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {},
});
