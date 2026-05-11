/**
 * AssetTabs Component
 * Tab selector for Activity and About sections
 * Uses responsive scaling with s() and sf() functions
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface AssetTabsProps {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  assetType: 'BTC' | 'UNIT' | 'USDC' | 'ETH';
  advancedMode?: boolean;
}

export const AssetTabs = memo(function AssetTabs({
  selectedTab,
  onTabChange,
  assetType,
}: AssetTabsProps) {
  const { s, sf } = useResponsive();
  const tabOptions = useMemo(
    () => (assetType === 'BTC' || assetType === 'UNIT'
      ? ['ACTIVITY', 'TURBO', 'ABOUT']
      : ['ACTIVITY', 'ABOUT']),
    [assetType]
  );

  // Memoize individual tab handlers to avoid inline function recreation
  const handleActivityPress = useCallback(() => onTabChange('ACTIVITY'), [onTabChange]);
  const handleTurboPress = useCallback(() => onTabChange('TURBO'), [onTabChange]);
  const handleAboutPress = useCallback(() => onTabChange('ABOUT'), [onTabChange]);

  // Map tab names to their handlers
  const tabHandlers: Record<string, () => void> = {
    'ACTIVITY': handleActivityPress,
    'TURBO': handleTurboPress,
    'ABOUT': handleAboutPress,
  };

  return (
    <View style={{
      flexDirection: 'row',
      paddingHorizontal: s(24),
      marginTop: s(16),
      marginBottom: s(16),
      gap: s(24),
    }}>
      {tabOptions.map((tab) => {
        const isSelected = selectedTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={{
              paddingBottom: s(8),
              borderBottomWidth: isSelected ? 2 : 0,
              borderBottomColor: COLORS.PRIMARY_BLUE,
            }}
            onPress={tabHandlers[tab]}
            testID={`asset-tab-${tab.toLowerCase()}`}
          >
            <Text style={{
              fontSize: sf(16),
              fontWeight: '600',
              color: isSelected ? COLORS.WHITE : COLORS.SECONDARY_TEXT,
            }}>
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
