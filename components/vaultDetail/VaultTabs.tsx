/**
 * VaultTabs Component
 * Tab selector for Vault detail screen (Activity/About)
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

interface VaultTabsProps {
  selectedTab: 'ACTIVITY' | 'ABOUT';
  onTabChange: (tab: 'ACTIVITY' | 'ABOUT') => void;
  filterDate?: number | null;
  onClearFilter?: () => void;
}

const formatFilterDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const VaultTabs = memo(function VaultTabs({
  selectedTab,
  onTabChange,
  filterDate,
  onClearFilter,
}: VaultTabsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'ACTIVITY' && styles.tabActive]}
          onPress={() => onTabChange('ACTIVITY')}
        >
          <Text style={[styles.tabText, selectedTab === 'ACTIVITY' && styles.tabTextActive]}>
            Activity
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'ABOUT' && styles.tabActive]}
          onPress={() => onTabChange('ABOUT')}
        >
          <Text style={[styles.tabText, selectedTab === 'ABOUT' && styles.tabTextActive]}>
            About
          </Text>
        </TouchableOpacity>
      </View>

      {filterDate && onClearFilter && (
        <TouchableOpacity style={styles.filterChip} onPress={onClearFilter}>
          <Text style={styles.filterDateText}>{formatFilterDate(filterDate)}</Text>
          <Text style={styles.filterCloseIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  tabTextActive: {
    color: COLORS.WHITE,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1858E4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  filterDateText: {
    color: '#1858E4',
    fontSize: 12,
    fontWeight: '600',
  },
  filterCloseIcon: {
    color: '#1858E4',
    fontSize: 12,
    fontWeight: '600',
  },
});
