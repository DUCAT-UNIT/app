/**
 * AssetSelectorScreen - Full screen for selecting asset to send
 * Features: BTC and UNIT cards with balances
 */

import React, { useMemo, useCallback } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useSendFlow, AssetType } from '../../contexts/SendFlowContext';
import { useCashu } from '../../contexts/CashuContext';
import { logger } from '../../utils/logger';
import { getRunesAmount } from '../../utils/runesHelper';
import { formatBalance, formatFiat } from '../../utils/formatters';

/**
 * Props for AssetSelectorScreen
 */
interface AssetSelectorScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function AssetSelectorScreen({ navigation }: AssetSelectorScreenProps): React.JSX.Element {
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { setSendAssetType } = useSendFlow();
  const { balance: cashuBalance } = useCashu();

  // Memoize balance calculations to prevent recalculation on every render
  const btcBalance = useMemo(
    () => (segwitBalance || 0) + (taprootBalance || 0),
    [segwitBalance, taprootBalance]
  );

  // For UNIT, combine on-chain runes + ecash balance
  const unitBalance = useMemo(() => {
    const unitRunesBalance = getRunesAmount(runesBalance);
    return unitRunesBalance + (cashuBalance || 0);
  }, [runesBalance, cashuBalance]);

  const handleSelectAsset = useCallback((assetType: AssetType): void => {
    logger.debug('Setting asset type to:', { assetType });
    setSendAssetType(assetType);
    navigation.navigate('AddressInput', { assetType });
  }, [setSendAssetType, navigation]);

  return (
    <View style={localStyles.container} testID="asset-selector-screen">
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.getParent()?.goBack()} style={localStyles.backButton} testID="asset-selector-back-btn">
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
          testID="asset-btc"
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
              {formatBalance(btcBalance, 8)}
            </Text>
            <Text style={localStyles.balanceUsd}>
              ${formatFiat(btcBalance * (btcPrice || 0))}
            </Text>
          </View>
          <Icon name="arrow_right" size={20} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* UNIT Card */}
        <TouchableOpacity
          style={localStyles.assetCard}
          onPress={() => handleSelectAsset('unit')}
          activeOpacity={0.7}
          testID="asset-unit"
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
              {formatFiat(unitBalance)}
            </Text>
            <Text style={localStyles.balanceUsd}>
              ${formatFiat(unitBalance)}
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
