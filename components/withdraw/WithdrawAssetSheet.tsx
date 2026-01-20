/**
 * WithdrawAssetSheet Component
 * Bottom sheet for selecting asset to withdraw
 * Optimized for fast appearance matching ReceiveScreen behavior
 */

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useSendFlow, type AssetType } from '../../stores/sendFlowStore';
import { formatBalance, formatFiat } from '../../utils/formatters';
import { getRunesAmount } from '../../utils/runesHelper';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface WithdrawAssetSheetProps {
  visible: boolean;
  onClose: () => void;
  onAssetSelect: (assetType: AssetType) => void;
  // Pre-computed balances passed from parent to avoid context lookups
  btcBalance: number;
  unitBalance: number;
  btcPrice: number | null;
}

const WithdrawAssetSheet = memo(function WithdrawAssetSheet({
  visible,
  onClose,
  onAssetSelect,
  btcBalance,
  unitBalance,
  btcPrice,
}: WithdrawAssetSheetProps) {
  const { setSendAssetType } = useSendFlow();

  // Animation values - using refs for stable references
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Memoize formatted values
  const formattedBtcBalance = useMemo(() => formatBalance(btcBalance, 8), [btcBalance]);
  const formattedBtcUsd = useMemo(() => formatFiat(btcBalance * (btcPrice || 0)), [btcBalance, btcPrice]);
  const formattedUnitBalance = useMemo(() => formatFiat(unitBalance), [unitBalance]);

  // Dismiss handler - close immediately, no animation delay
  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  // Pan responder created once
  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          }).start();
        }
      },
    })
  );

  // Fast open/close - ensure sheet is visible when mounted
  useEffect(() => {
    if (visible) {
      // Always reset position and show when becoming visible
      translateY.setValue(0);
      sheetOpacity.setValue(1);
    }
  }, [visible, translateY, sheetOpacity]);

  const handleSelectAsset = useCallback((assetType: AssetType) => {
    setSendAssetType(assetType);
    // Navigate immediately, close sheet in background
    onAssetSelect(assetType);
    onClose();
  }, [setSendAssetType, onAssetSelect, onClose]);

  // Don't render anything if not visible (performance optimization)
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleDismiss}
      />

      <Animated.View
        style={[
          styles.container,
          {
            opacity: sheetOpacity,
            transform: [{ translateY }],
          },
        ]}
        {...panResponderRef.current.panHandlers}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>Withdraw</Text>

        {/* BTC Card */}
        <TouchableOpacity
          style={styles.assetCard}
          onPress={() => handleSelectAsset('btc')}
          activeOpacity={0.7}
          testID="withdraw-asset-btc"
        >
          <View style={styles.assetIconContainer}>
            <Icon name="btc_logo" size={40} />
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetName}>Bitcoin</Text>
            <Text style={styles.assetSymbol}>BTC</Text>
          </View>
          <View style={styles.assetBalance}>
            <Text style={styles.balanceAmount}>{formattedBtcBalance}</Text>
            <Text style={styles.balanceUsd}>${formattedBtcUsd}</Text>
          </View>
          <Icon name="arrow_right" size={20} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* UNIT Card */}
        <TouchableOpacity
          style={styles.assetCard}
          onPress={() => handleSelectAsset('unit')}
          activeOpacity={0.7}
          testID="withdraw-asset-unit"
        >
          <View style={styles.assetIconContainer}>
            <Icon name="unit_logo" size={40} />
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetName}>Unit Rune</Text>
            <Text style={styles.assetSymbol}>UNIT</Text>
          </View>
          <View style={styles.assetBalance}>
            <Text style={styles.balanceAmount}>{formattedUnitBalance}</Text>
            <Text style={styles.balanceUsd}>${formattedUnitBalance}</Text>
          </View>
          <Icon name="arrow_right" size={20} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 999,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.DARK_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 16,
    zIndex: 1000,
    minHeight: '50%',
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
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

export default WithdrawAssetSheet;
