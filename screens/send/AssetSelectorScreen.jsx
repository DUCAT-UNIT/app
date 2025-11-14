/**
 * AssetSelectorScreen - Full screen for selecting asset to send
 * Features: BTC and UNIT cards with balances
 */

import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/colors';
import Icon from '../../components/icons';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useSendFlow } from '../../contexts/SendFlowContext';

export default function AssetSelectorScreen({ navigation }) {
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { setSendAssetType } = useSendFlow();

  const btcBalance = (segwitBalance || 0) + (taprootBalance || 0);
  const unitBalance = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;

  const handleSelectAsset = (assetType) => {
    console.log('Setting asset type to:', assetType);
    setSendAssetType(assetType);
    navigation.navigate('AddressInput', { assetType });
  };

  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.getParent()?.goBack()} style={localStyles.backButton}>
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Select Asset</Text>
      </View>

      {/* Content */}
      <View style={localStyles.content}>
        <Text style={localStyles.subtitle}>Choose which asset you want to send</Text>

        {/* BTC Card */}
        <TouchableOpacity
          style={localStyles.assetCard}
          onPress={() => handleSelectAsset('btc')}
          activeOpacity={0.7}
        >
          <View style={localStyles.assetIconContainer}>
            <Icon name="btc_logo" size={40} />
          </View>
          <View style={localStyles.assetInfo}>
            <Text style={localStyles.assetName}>Bitcoin</Text>
            <Text style={localStyles.assetSymbol}>BTC</Text>
          </View>
          <View style={localStyles.assetBalance}>
            <Text style={localStyles.balanceAmount}>
              {btcBalance.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 8,
              })}
            </Text>
            <Text style={localStyles.balanceUsd}>
              ${(btcBalance * (btcPrice || 0)).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
          <Icon name="arrow_right" size={20} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* UNIT Card */}
        <TouchableOpacity
          style={localStyles.assetCard}
          onPress={() => handleSelectAsset('unit')}
          activeOpacity={0.7}
        >
          <View style={localStyles.assetIconContainer}>
            <Icon name="unit_logo" size={40} />
          </View>
          <View style={localStyles.assetInfo}>
            <Text style={localStyles.assetName}>Unit Rune</Text>
            <Text style={localStyles.assetSymbol}>UNIT</Text>
          </View>
          <View style={localStyles.assetBalance}>
            <Text style={localStyles.balanceAmount}>
              {unitBalance.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </Text>
            <Text style={localStyles.balanceUsd}>
              ${unitBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
          <Icon name="arrow_right" size={20} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 24,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  assetIconContainer: {
    marginRight: 16,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 2,
  },
  assetSymbol: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  assetBalance: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 2,
  },
  balanceUsd: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
