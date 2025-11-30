/**
 * AssetAbout Component
 * Displays information about the asset (BTC or UNIT)
 * Uses responsive scaling with s() and sf() functions
 */

import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface AssetAboutProps {
  assetType: string;
}

export function AssetAbout({ assetType }: AssetAboutProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={{
      paddingHorizontal: s(24),
      paddingBottom: s(5),
    }}>
      <View style={{
        backgroundColor: COLORS.CARD_BG,
        borderRadius: s(12),
        padding: s(16),
        marginBottom: s(12),
      }}>
        <Text style={{
          fontSize: sf(16),
          fontWeight: '600',
          color: COLORS.WHITE,
          marginBottom: s(8),
        }}>About {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}</Text>
        <Text style={{
          fontSize: sf(14),
          color: COLORS.SECONDARY_TEXT,
          lineHeight: sf(20),
        }}>
          {assetType === 'BTC'
            ? 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network. Bitcoin transactions are verified by network nodes through cryptography and recorded in a public distributed ledger called a blockchain.'
            : 'UNIT is designed to be a BTC-backed Collateralised Debt Position (CDP), programmed to be soft-pegged to the USD at 1.01 to 1.04 UNIT per USD before transaction costs, to finance responsible lending and leverage.'
          }
        </Text>
      </View>

      {assetType === 'BTC' && (
        <View style={{
          backgroundColor: COLORS.CARD_BG,
          borderRadius: s(12),
          padding: s(16),
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: s(8),
          }}>
            <Text style={{
              fontSize: sf(14),
              color: COLORS.SECONDARY_TEXT,
            }}>Market Cap</Text>
            <Text style={{
              fontSize: sf(14),
              fontWeight: '600',
              color: COLORS.WHITE,
            }}>$2.1T</Text>
          </View>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: s(8),
          }}>
            <Text style={{
              fontSize: sf(14),
              color: COLORS.SECONDARY_TEXT,
            }}>24h Volume</Text>
            <Text style={{
              fontSize: sf(14),
              fontWeight: '600',
              color: COLORS.WHITE,
            }}>$42.5B</Text>
          </View>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: s(8),
          }}>
            <Text style={{
              fontSize: sf(14),
              color: COLORS.SECONDARY_TEXT,
            }}>Circulating Supply</Text>
            <Text style={{
              fontSize: sf(14),
              fontWeight: '600',
              color: COLORS.WHITE,
            }}>19.5M BTC</Text>
          </View>
        </View>
      )}
    </View>
  );
}
