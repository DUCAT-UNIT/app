/**
 * WithdrawSheet Component
 * Bottom sheet for selecting asset to withdraw
 */

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, PanResponder } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useSendFlow, type AssetType } from '../../stores/sendFlowStore';
import { formatBalance, formatFiat } from '../../utils/formatters';

interface WithdrawSheetProps {
  visible: boolean;
  onClose: () => void;
  onAssetSelect: (assetType: AssetType) => void;
  onVaultWithdraw?: () => void;
  btcBalance: number;
  unitBalance: number;
  btcPrice: number | null;
  vaultCollateral?: number;
  hasVault?: boolean;
}

export const WithdrawSheet = memo(function WithdrawSheet({
  visible,
  onClose,
  onAssetSelect,
  onVaultWithdraw,
  btcBalance,
  unitBalance,
  btcPrice,
  vaultCollateral = 0,
  hasVault = false,
}: WithdrawSheetProps) {
  const { setSendAssetType } = useSendFlow();

  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const formattedBtcBalance = useMemo(() => formatBalance(btcBalance, 8), [btcBalance]);
  const formattedBtcUsd = useMemo(() => formatFiat(btcBalance * (btcPrice || 0)), [btcBalance, btcPrice]);
  const formattedUnitBalance = useMemo(() => formatFiat(unitBalance), [unitBalance]);
  const formattedVaultCollateral = useMemo(() => formatBalance(vaultCollateral, 8), [vaultCollateral]);
  const formattedVaultUsd = useMemo(() => formatFiat(vaultCollateral * (btcPrice || 0)), [vaultCollateral, btcPrice]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

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

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      sheetOpacity.setValue(1);
    }
  }, [visible, translateY, sheetOpacity]);

  const handleSelectAsset = useCallback((assetType: AssetType) => {
    setSendAssetType(assetType);
    onAssetSelect(assetType);
    onClose();
  }, [setSendAssetType, onAssetSelect, onClose]);

  const handleVaultWithdraw = useCallback(() => {
    onClose();
    onVaultWithdraw?.();
  }, [onClose, onVaultWithdraw]);

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

        {/* BTC Row */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelectAsset('btc')}
          activeOpacity={0.7}
          testID="withdraw-btc"
        >
          <Icon name="btc_logo" size={32} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Bitcoin</Text>
            <Text style={styles.rowSubtext}>{formattedBtcBalance} BTC</Text>
          </View>
          <Text style={styles.rowValue}>${formattedBtcUsd}</Text>
          <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* UNIT Row */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelectAsset('unit')}
          activeOpacity={0.7}
          testID="withdraw-unit"
        >
          <Icon name="unit_logo" size={32} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>UNIT</Text>
            <Text style={styles.rowSubtext}>{formattedUnitBalance} UNIT</Text>
          </View>
          <Text style={styles.rowValue}>${formattedUnitBalance}</Text>
          <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* Vault Row */}
        {hasVault && onVaultWithdraw && (
          <TouchableOpacity
            style={styles.row}
            onPress={handleVaultWithdraw}
            activeOpacity={0.7}
            testID="withdraw-vault"
          >
            <Icon name="vault_logo" size={32} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Vault</Text>
              <Text style={styles.rowSubtext}>{formattedVaultCollateral} BTC</Text>
            </View>
            <Text style={styles.rowValue}>${formattedVaultUsd}</Text>
            <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </>
  );
});

/**
 * DepositSheet Component
 * Bottom sheet for selecting asset to deposit
 */

interface DepositSheetProps {
  visible: boolean;
  onClose: () => void;
  onAssetSelect: (assetType: 'btc' | 'unit') => void;
  onVaultDeposit?: () => void;
  hasVault?: boolean;
}

export const DepositSheet = memo(function DepositSheet({
  visible,
  onClose,
  onAssetSelect,
  onVaultDeposit,
  hasVault = false,
}: DepositSheetProps) {
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

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

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      sheetOpacity.setValue(1);
    }
  }, [visible, translateY, sheetOpacity]);

  const handleSelectAsset = useCallback((assetType: 'btc' | 'unit') => {
    onAssetSelect(assetType);
    onClose();
  }, [onAssetSelect, onClose]);

  const handleVaultDeposit = useCallback(() => {
    onClose();
    onVaultDeposit?.();
  }, [onClose, onVaultDeposit]);

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
        <Text style={styles.title}>Deposit</Text>

        {/* BTC Row */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelectAsset('btc')}
          activeOpacity={0.7}
          testID="deposit-btc"
        >
          <Icon name="btc_logo" size={32} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Bitcoin</Text>
            <Text style={styles.rowSubtext}>Receive BTC</Text>
          </View>
          <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* UNIT Row */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelectAsset('unit')}
          activeOpacity={0.7}
          testID="deposit-unit"
        >
          <Icon name="unit_logo" size={32} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>UNIT</Text>
            <Text style={styles.rowSubtext}>Receive UNIT</Text>
          </View>
          <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>

        {/* Vault Row */}
        {hasVault && onVaultDeposit && (
          <TouchableOpacity
            style={styles.row}
            onPress={handleVaultDeposit}
            activeOpacity={0.7}
            testID="deposit-vault"
          >
            <Icon name="vault_logo" size={32} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Vault</Text>
              <Text style={styles.rowSubtext}>Deposit collateral</Text>
            </View>
            <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
          </TouchableOpacity>
        )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    paddingBottom: 60,
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 1000,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.MEDIUM_GRAY,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
    gap: 14,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  rowSubtext: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginRight: 6,
  },
});
