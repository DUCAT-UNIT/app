/**
 * AssetHeader Component
 * Navigation header for AssetDetailScreen
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface AssetHeaderProps {
  onBackPress: () => void;
}

export const AssetHeader = memo(function AssetHeader({ onBackPress }: AssetHeaderProps) {
  const { s } = useResponsive();

  return (
    <View style={[styles.header, { paddingHorizontal: s(24), paddingVertical: s(12) }]}>
      <TouchableOpacity
        style={[styles.backButton, { padding: s(8) }]}
        onPress={onBackPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="back" size={s(24)} color={COLORS.WHITE} />
      </TouchableOpacity>
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
});
