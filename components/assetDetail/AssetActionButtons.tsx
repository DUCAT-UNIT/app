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
  onConsolidatePress: () => void;
  onTurboPress: () => void;
  showConsolidate: boolean;
  advancedMode?: boolean;
}

export function AssetActionButtons({ onSendPress, onReceivePress, onConsolidatePress, onTurboPress, showConsolidate, advancedMode = false }: AssetActionButtonsProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.actionButtonsContainer, { paddingHorizontal: s(24), paddingVertical: s(12), gap: s(12) }]}>
      {showConsolidate && advancedMode && (
        <TouchableOpacity
          style={[styles.actionButton, { minWidth: s(62) }]}
          onPress={onTurboPress}
        >
          <View style={[styles.actionButtonIcon, { width: s(50), height: s(50), borderRadius: s(8), marginBottom: s(2) }]}>
            <Icon name="turbo" size={s(19)} color={COLORS.DARK_BG} />
          </View>
          <Text style={[styles.actionButtonLabel, { fontSize: sf(13) }]}>Turbo</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.actionButton, { minWidth: s(62) }]}
        onPress={onSendPress}
      >
        <View style={[styles.actionButtonIcon, { width: s(50), height: s(50), borderRadius: s(8), marginBottom: s(2) }]}>
          <Icon name="send" size={s(19)} color={COLORS.DARK_BG} />
        </View>
        <Text style={[styles.actionButtonLabel, { fontSize: sf(13) }]}>Send</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { minWidth: s(62) }]}
        onPress={onReceivePress}
      >
        <View style={[styles.actionButtonIcon, { width: s(50), height: s(50), borderRadius: s(8), marginBottom: s(2) }]}>
          <Icon name="receive" size={s(19)} color={COLORS.DARK_BG} />
        </View>
        <Text style={[styles.actionButtonLabel, { fontSize: sf(13) }]}>Receive</Text>
      </TouchableOpacity>

      {showConsolidate && advancedMode && (
        <TouchableOpacity
          style={[styles.actionButton, { minWidth: s(62) }]}
          onPress={onConsolidatePress}
        >
          <View style={[styles.actionButtonIcon, { width: s(50), height: s(50), borderRadius: s(8), marginBottom: s(2) }]}>
            <Icon name="fuse" size={s(19)} color={COLORS.DARK_BG} />
          </View>
          <Text style={[styles.actionButtonLabel, { fontSize: sf(13) }]}>Fuse</Text>
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
