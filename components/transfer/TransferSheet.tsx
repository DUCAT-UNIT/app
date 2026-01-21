/**
 * TransferSheet Component
 * Bottom sheet for withdraw/deposit with toggle between modes
 */

import React, { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, PanResponder } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useSendFlow, type AssetType } from '../../stores/sendFlowStore';
import { formatBalance, formatFiat } from '../../utils/formatters';

type TransferMode = 'withdraw' | 'deposit';

interface TransferSheetProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: TransferMode;
  // Withdraw props
  onAssetSelect: (assetType: AssetType) => void;
  onVaultWithdraw?: () => void;
  // Deposit props
  onVaultDeposit?: () => void;
  segwitAddress: string;
  taprootAddress: string;
  showToast: (message: string) => void;
  // Balance props
  btcBalance: number;
  unitBalance: number;
  btcPrice: number | null;
  vaultCollateral?: number;
  hasVault?: boolean;
}

const TransferSheet = memo(function TransferSheet({
  visible,
  onClose,
  initialMode = 'withdraw',
  onAssetSelect,
  onVaultWithdraw,
  onVaultDeposit,
  segwitAddress,
  taprootAddress,
  showToast,
  btcBalance,
  unitBalance,
  btcPrice,
  vaultCollateral = 0,
  hasVault = false,
}: TransferSheetProps) {
  const [mode, setMode] = useState<TransferMode>(initialMode);
  const { setSendAssetType } = useSendFlow();

  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Reset mode when sheet opens with new initialMode
  useEffect(() => {
    if (visible) {
      setMode(initialMode);
    }
  }, [visible, initialMode]);

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

  // Withdraw handlers
  const handleSelectAsset = useCallback((assetType: AssetType) => {
    setSendAssetType(assetType);
    onAssetSelect(assetType);
    onClose();
  }, [setSendAssetType, onAssetSelect, onClose]);

  const handleVaultWithdraw = useCallback(() => {
    onClose();
    onVaultWithdraw?.();
  }, [onClose, onVaultWithdraw]);

  // Deposit handlers
  const handleCopyAddress = useCallback((address: string, type: string) => {
    Clipboard.setString(address);
    showToast(`${type} address copied to clipboard`);
  }, [showToast]);

  const handleVaultDeposit = useCallback(() => {
    onClose();
    onVaultDeposit?.();
  }, [onClose, onVaultDeposit]);

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

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

        {/* Toggle Tabs */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleTab, mode === 'withdraw' && styles.toggleTabActive]}
            onPress={() => setMode('withdraw')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, mode === 'withdraw' && styles.toggleTextActive]}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleTab, mode === 'deposit' && styles.toggleTabActive]}
            onPress={() => setMode('deposit')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, mode === 'deposit' && styles.toggleTextActive]}>Deposit</Text>
          </TouchableOpacity>
        </View>

        {mode === 'withdraw' ? (
          <>
            {/* BTC Row */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleSelectAsset('btc')}
              activeOpacity={0.7}
              testID="transfer-withdraw-btc"
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
              testID="transfer-withdraw-unit"
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
                testID="transfer-withdraw-vault"
              >
                <Icon name="vault_logo" size={32} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>Vault</Text>
                  <Text style={styles.rowSubtext}>{formattedVaultCollateral} BTC collateral</Text>
                </View>
                <Text style={styles.rowValue}>${formattedVaultUsd}</Text>
                <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* BTC Address Row */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleCopyAddress(segwitAddress, 'BTC')}
              activeOpacity={0.7}
              testID="transfer-deposit-btc"
            >
              <Icon name="btc_logo" size={32} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>BTC Address</Text>
                <Text style={styles.rowSubtext}>{truncateAddress(segwitAddress)}</Text>
              </View>
              <Icon name="copy" size={18} color={COLORS.SECONDARY_TEXT} />
            </TouchableOpacity>

            {/* UNIT Address Row */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleCopyAddress(taprootAddress, 'UNIT')}
              activeOpacity={0.7}
              testID="transfer-deposit-unit"
            >
              <Icon name="unit_logo" size={32} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>UNIT Address</Text>
                <Text style={styles.rowSubtext}>{truncateAddress(taprootAddress)}</Text>
              </View>
              <Icon name="copy" size={18} color={COLORS.SECONDARY_TEXT} />
            </TouchableOpacity>

            {/* Vault Deposit Row */}
            {hasVault && onVaultDeposit && (
              <TouchableOpacity
                style={styles.row}
                onPress={handleVaultDeposit}
                activeOpacity={0.7}
                testID="transfer-deposit-vault"
              >
                <Icon name="vault_logo" size={32} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>Vault</Text>
                  <Text style={styles.rowSubtext}>Deposit BTC collateral</Text>
                </View>
                <Icon name="arrow_right" size={18} color={COLORS.SECONDARY_TEXT} />
              </TouchableOpacity>
            )}
          </>
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
    paddingBottom: 40,
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
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.VERY_DARK_GRAY,
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleTabActive: {
    backgroundColor: COLORS.CARD_BG,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  toggleTextActive: {
    color: COLORS.WHITE,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
    gap: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
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
    marginRight: 4,
  },
});

export default TransferSheet;
