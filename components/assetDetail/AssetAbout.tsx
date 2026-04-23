/**
 * AssetAbout Component
 * Displays information about the asset (BTC or UNIT)
 * Uses responsive scaling with s() and sf() functions
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import Icon from '../icons';
import { EVM_CONFIG } from '../../constants/evm';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface AssetAboutProps {
  assetType: string;
  evmAddress?: string;
}

export function AssetAbout({ assetType, evmAddress }: AssetAboutProps) {
  const { s, sf } = useResponsive();
  const openLink = useCallback(async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  }, []);

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
        }}>About {assetType === 'BTC' ? 'Bitcoin' : assetType}</Text>
        <Text style={{
          fontSize: sf(14),
          color: COLORS.SECONDARY_TEXT,
          lineHeight: sf(20),
        }}>
          {assetType === 'BTC'
            ? 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network. Bitcoin transactions are verified by network nodes through cryptography and recorded in a public distributed ledger called a blockchain.'
            : assetType === 'UNIT'
              ? 'UNIT is designed to be a BTC-backed Collateralised Debt Position (CDP), programmed to be soft-pegged to the USD at 1.01 to 1.04 UNIT per USD before transaction costs, to finance responsible lending and leverage.'
              : 'USDC is a USD-denominated stablecoin. In this wallet it is tracked on Ethereum Sepolia and can be swapped against wUNIT through the Sepolia stable pool.'
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

      {assetType === 'USDC' && (
        <View style={{
          backgroundColor: COLORS.CARD_BG,
          borderRadius: s(12),
          padding: s(16),
          gap: s(12),
        }}>
          {evmAddress ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openLink(`${EVM_CONFIG.explorerBaseUrl}/address/${evmAddress}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{
                  fontSize: sf(14),
                  color: COLORS.SECONDARY_TEXT,
                  marginBottom: s(4),
                }}>Wallet on Sepolia</Text>
                <Text style={{
                  fontSize: sf(14),
                  fontWeight: '600',
                  color: COLORS.WHITE,
                }}>{`${evmAddress.slice(0, 8)}...${evmAddress.slice(-6)}`}</Text>
              </View>
              <Icon name="external_link" size={16} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openLink(`${EVM_CONFIG.explorerBaseUrl}/token/${EVM_CONFIG.usdcAddress}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text style={{
                fontSize: sf(14),
                color: COLORS.SECONDARY_TEXT,
                marginBottom: s(4),
              }}>USDC contract</Text>
              <Text style={{
                fontSize: sf(14),
                fontWeight: '600',
                color: COLORS.WHITE,
              }}>{`${EVM_CONFIG.usdcAddress.slice(0, 8)}...${EVM_CONFIG.usdcAddress.slice(-6)}`}</Text>
            </View>
            <Icon name="external_link" size={16} color={COLORS.PRIMARY_BLUE} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
