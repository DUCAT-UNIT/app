/**
 * AssetActionButtons Component
 * Send and Receive action buttons for assets
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface AssetActionButtonsProps {
  onSendPress: () => void;
  onReceivePress: () => void;
  onSwapPress?: () => void;
  onConsolidatePress?: () => void;
  onTurboPress?: () => void;
  showSwap?: boolean;
  showSend?: boolean;
  showReceive?: boolean;
  showConsolidate?: boolean;
  advancedMode?: boolean;
}

export function AssetActionButtons({
  onSendPress,
  onReceivePress,
  onSwapPress,
  showSwap = false,
  showSend = true,
  showReceive = true,
}: AssetActionButtonsProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.actionButtonsContainer, { paddingHorizontal: s(24), paddingVertical: s(12), gap: s(12) }]}>
      {showSend && (
        <TouchableOpacity
          style={[styles.actionButton, { minWidth: s(62) }]}
          onPress={onSendPress}
        >
          <View style={[styles.actionButtonIcon, { width: s(50), height: s(50), borderRadius: s(8), marginBottom: s(2) }]}>
            <Icon name="send" size={s(19)} color={COLORS.DARK_BG} />
          </View>
          <Text style={[styles.actionButtonLabel, { fontSize: sf(13) }]}>Send</Text>
        </TouchableOpacity>
      )}

      {showReceive && (
        <TouchableOpacity
          style={[styles.actionButton, { minWidth: s(62) }]}
          onPress={onReceivePress}
        >
          <View style={[styles.actionButtonIcon, { width: s(50), height: s(50), borderRadius: s(8), marginBottom: s(2) }]}>
            <Icon name="receive" size={s(19)} color={COLORS.DARK_BG} />
          </View>
          <Text style={[styles.actionButtonLabel, { fontSize: sf(13) }]}>Receive</Text>
        </TouchableOpacity>
      )}

      {showSwap && onSwapPress && (
        <TouchableOpacity
          style={[styles.actionButton, { minWidth: s(62) }]}
          onPress={onSwapPress}
          testID="asset-detail-swap-btn"
        >
          <View style={[styles.actionButtonIcon, { width: s(50), height: s(50), borderRadius: s(8), marginBottom: s(2) }]}>
            <Icon name="swap" size={s(19)} color={COLORS.DARK_BG} />
          </View>
          <Text style={[styles.actionButtonLabel, { fontSize: sf(13) }]}>Swap</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonIcon: {
    borderRadius: 8,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  actionButtonLabel: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
});
