/**
 * VaultAbout Component
 * Displays information about the vault system
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

const ABOUT_SECTIONS = [
  {
    title: 'What is a Vault?',
    content:
      'A vault lets you deposit BTC as collateral and borrow dollar-denominated liquidity against it, without selling your Bitcoin.',
  },
  {
    title: 'Collateral Ratio',
    content:
      'Your collateral ratio is the value of your BTC divided by your vault debt. A higher ratio means your vault is healthier and further from liquidation.',
  },
  {
    title: 'Liquidation',
    content:
      'If your collateral ratio drops below 161%, your vault may be liquidated. This means your BTC collateral can be sold to repay your outstanding debt.',
  },
  {
    title: 'Managing Your Vault',
    content:
      'You can deposit more BTC to increase your collateral ratio, or repay debt to reduce what you owe. Both actions improve your vault health.',
  },
];

export const VaultAbout = memo(function VaultAbout() {
  return (
    <View style={styles.container}>
      {ABOUT_SECTIONS.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionContent}>{section.content}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
});
