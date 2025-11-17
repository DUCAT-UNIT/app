/**
 * AssetAbout Component
 * Displays information about the asset (BTC or UNIT)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

export function AssetAbout({ assetType }) {
  return (
    <View style={styles.aboutContainer}>
      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>About {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}</Text>
        <Text style={styles.aboutDescription}>
          {assetType === 'BTC'
            ? 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network. Bitcoin transactions are verified by network nodes through cryptography and recorded in a public distributed ledger called a blockchain.'
            : 'UNIT is designed to be a BTC-backed Collateralised Debt Position (CDP), programmed to be soft-pegged to the USD at 1.01 to 1.04 UNIT per USD before transaction costs, to finance responsible lending and leverage.'
          }
        </Text>
      </View>

      {assetType === 'BTC' && (
        <View style={styles.aboutStats}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Market Cap</Text>
            <Text style={styles.statValue}>$2.1T</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>24h Volume</Text>
            <Text style={styles.statValue}>$42.5B</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Circulating Supply</Text>
            <Text style={styles.statValue}>19.5M BTC</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aboutContainer: {
    paddingHorizontal: 14,
    paddingBottom: 5,
  },
  aboutSection: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  aboutDescription: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  aboutStats: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
