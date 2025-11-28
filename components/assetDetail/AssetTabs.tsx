/**
 * AssetTabs Component
 * Tab selector for Activity, Turbo, and About sections
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

interface AssetTabsProps {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  assetType: 'BTC' | 'UNIT';
  advancedMode?: boolean;
}

// Memoized individual tab button to prevent re-renders
const TabButton = memo(function TabButton({
  tab,
  isSelected,
  onPress,
}: {
  tab: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, isSelected && styles.activeTab]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, isSelected && styles.activeTabText]}>
        {tab}
      </Text>
    </TouchableOpacity>
  );
});

export const AssetTabs = memo(function AssetTabs({
  selectedTab,
  onTabChange,
  assetType,
  advancedMode = false
}: AssetTabsProps) {
  // Memoize tab options to prevent array recreation
  const TAB_OPTIONS = useMemo(() =>
    (assetType === 'UNIT' && advancedMode)
      ? ['ACTIVITY', 'TURBO', 'ABOUT']
      : ['ACTIVITY', 'ABOUT'],
    [assetType, advancedMode]
  );

  // Memoize individual tab handlers to avoid inline function recreation
  const handleActivityPress = useCallback(() => onTabChange('ACTIVITY'), [onTabChange]);
  const handleTurboPress = useCallback(() => onTabChange('TURBO'), [onTabChange]);
  const handleAboutPress = useCallback(() => onTabChange('ABOUT'), [onTabChange]);

  // Map tab names to their handlers
  const tabHandlers: Record<string, () => void> = useMemo(() => ({
    'ACTIVITY': handleActivityPress,
    'TURBO': handleTurboPress,
    'ABOUT': handleAboutPress,
  }), [handleActivityPress, handleTurboPress, handleAboutPress]);

  return (
    <View style={styles.tabContainer}>
      {TAB_OPTIONS.map((tab) => (
        <TabButton
          key={tab}
          tab={tab}
          isSelected={selectedTab === tab}
          onPress={tabHandlers[tab]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  activeTabText: {
    color: COLORS.WHITE,
  },
});
