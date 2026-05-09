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
import { usePrice } from '../../stores/priceStore';
import { useSendFlow, type AssetType } from '../../stores/sendFlowStore';
import { useCashuBalanceState } from '../../contexts/CashuContext';
import { logger } from '../../utils/logger';
import { getRunesAmount } from '../../utils/runesHelper';
import { formatBalance, formatFiat } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';

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
  const { balance: cashuBalance, btcBalanceSats: cashuBtcBalanceSats } = useCashuBalanceState();
  const { s, sf } = useResponsive();

  // Memoize balance calculations to prevent recalculation on every render
  const btcBalance = useMemo(
    () => (segwitBalance || 0) + (taprootBalance || 0) + ((cashuBtcBalanceSats || 0) / 100_000_000),
    [segwitBalance, taprootBalance, cashuBtcBalanceSats]
  );

  // For UNIT, combine on-chain runes + ecash balance
  // Runes come in display units, ecash is in smallest units (needs /100)
  const unitBalance = useMemo(() => {
    const unitRunesBalance = getRunesAmount(runesBalance);
    return unitRunesBalance + ((cashuBalance || 0) / 100);
  }, [runesBalance, cashuBalance]);

  const hasNoBtc = btcBalance <= 0;
  const hasNoUnit = unitBalance <= 0;

  const handleSelectAsset = useCallback((assetType: AssetType): void => {
    logger.debug('Setting asset type to:', { assetType });
    setSendAssetType(assetType);
    navigation.navigate('SendInput', { assetType });
  }, [setSendAssetType, navigation]);

  return (
    <View style={localStyles.container} testID="asset-selector-screen">
      {/* Header */}
      <View style={[localStyles.header, { paddingTop: s(60), paddingHorizontal: s(20), paddingBottom: s(20) }]}>
        <TouchableOpacity onPress={() => navigation.getParent()?.goBack()} style={[localStyles.backButton, { width: s(40), height: s(40) }]} testID="asset-selector-back-btn">
          <Icon name="back" size={s(24)} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={[localStyles.title, { fontSize: sf(32) }]}>Select Asset</Text>
      </View>

      {/* Content */}
      <View style={[localStyles.content, { paddingHorizontal: s(20), paddingTop: s(20) }]}>
        <Text style={[localStyles.subtitle, { fontSize: sf(16), marginBottom: s(24) }]}>Choose which asset you want to send</Text>

        {/* BTC Card */}
        <TouchableOpacity
          style={[localStyles.assetCard, { padding: s(16), marginBottom: s(12) }, hasNoBtc && localStyles.assetCardDisabled]}
          onPress={hasNoBtc ? undefined : () => handleSelectAsset('btc')}
          activeOpacity={hasNoBtc ? 1 : 0.7}
          testID="asset-btc"
        >
          <View style={[localStyles.assetIconContainer, { marginRight: s(16) }, hasNoBtc && localStyles.iconDisabled]}>
            <Icon name="btc_logo" size={s(40)} />
          </View>
          <View style={localStyles.assetInfo}>
            <Text style={[localStyles.assetName, { fontSize: sf(16), marginBottom: s(2) }, hasNoBtc && localStyles.textDisabled]}>Bitcoin</Text>
            <Text style={[localStyles.assetSymbol, { fontSize: sf(13) }]}>BTC</Text>
          </View>
          <View style={[localStyles.assetBalance, { marginRight: s(12) }]}>
            <Text style={[localStyles.balanceAmount, { fontSize: sf(16), marginBottom: s(2) }, hasNoBtc && localStyles.textDisabled]}>
              {hasNoBtc ? 'No balance' : formatBalance(btcBalance, 8)}
            </Text>
            <Text style={[localStyles.balanceUsd, { fontSize: sf(13) }]}>
              {hasNoBtc ? '' : `$${formatFiat(btcBalance * (btcPrice || 0))}`}
            </Text>
          </View>
          <Icon name="arrow_right" size={s(20)} color={hasNoBtc ? COLORS.DARK_GRAY : COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* UNIT Card */}
        <TouchableOpacity
          style={[localStyles.assetCard, { padding: s(16), marginBottom: s(12) }, hasNoUnit && localStyles.assetCardDisabled]}
          onPress={hasNoUnit ? undefined : () => handleSelectAsset('unit')}
          activeOpacity={hasNoUnit ? 1 : 0.7}
          testID="asset-unit"
        >
          <View style={[localStyles.assetIconContainer, { marginRight: s(16) }, hasNoUnit && localStyles.iconDisabled]}>
            <Icon name="unit_logo" size={s(40)} />
          </View>
          <View style={localStyles.assetInfo}>
            <Text style={[localStyles.assetName, { fontSize: sf(16), marginBottom: s(2) }, hasNoUnit && localStyles.textDisabled]}>UNIT</Text>
            <Text style={[localStyles.assetSymbol, { fontSize: sf(13) }]}>UNIT</Text>
          </View>
          <View style={[localStyles.assetBalance, { marginRight: s(12) }]}>
            <Text style={[localStyles.balanceAmount, { fontSize: sf(16), marginBottom: s(2) }, hasNoUnit && localStyles.textDisabled]}>
              {hasNoUnit ? 'No balance' : formatFiat(unitBalance)}
            </Text>
            <Text style={[localStyles.balanceUsd, { fontSize: sf(13) }]}>
              {hasNoUnit ? '' : `$${formatFiat(unitBalance)}`}
            </Text>
          </View>
          <Icon name="arrow_right" size={s(20)} color={hasNoUnit ? COLORS.DARK_GRAY : COLORS.SECONDARY_TEXT} />
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
  },
  backButton: {
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  assetCardDisabled: {
    opacity: 0.5,
  },
  iconDisabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: COLORS.SECONDARY_TEXT,
  },
  assetIconContainer: {},
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  assetSymbol: {
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  assetBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  balanceUsd: {
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
