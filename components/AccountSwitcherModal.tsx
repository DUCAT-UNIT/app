/**
 * AccountSwitcherModal Component
 * Modal for switching between different wallet accounts
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ERRORS, DIALOGS } from '../utils/messages';
import { COLORS } from '../theme';
import { NETWORK_EDITION_LABEL } from '../utils/constants';
import { WALLET_IMPORT_PROFILE_OPTIONS, type WalletImportProfile } from '../constants/bitcoin';
import type { WalletAccountSwitchOptions } from '../contexts/WalletContext';

interface AccountSwitcherModalProps {
  visible: boolean;
  accountIndex: string;
  walletProfile: WalletImportProfile;
  switchingAccount: boolean;
  onClose: () => void;
  onAccountIndexChange: (value: string) => void;
  onWalletProfileChange: (profile: WalletImportProfile) => void;
  onSwitch: (accountNum: number, options?: WalletAccountSwitchOptions) => void;
  styles: {
    mutinynetBanner: ViewStyle;
    mutinynetBannerText: TextStyle;
    modalOverlay: ViewStyle;
    modalContent: ViewStyle;
    modalTitle: TextStyle;
    modalLabel: TextStyle;
    accountInput: TextStyle;
    modalButtons: ViewStyle;
    modalButton: ViewStyle;
    modalButtonCancel: ViewStyle;
    modalButtonConfirm: ViewStyle;
    modalButtonText: TextStyle;
  };
}

export default function AccountSwitcherModal({
  // State
  visible,
  accountIndex,
  walletProfile,
  switchingAccount,

  // Callbacks
  onClose,
  onAccountIndexChange,
  onWalletProfileChange,
  onSwitch,

  // Styles
  styles,
}: AccountSwitcherModalProps) {
  if (!visible) return null;

  const handleSwitch = () => {
    const accountNum = parseInt(accountIndex, 10);
    if (isNaN(accountNum) || accountNum < 1) {
      Alert.alert(DIALOGS.INVALID_ACCOUNT_TITLE, ERRORS.INVALID_ACCOUNT_NUMBER);
      return;
    }
    onSwitch(accountNum, { walletProfile });
  };

  return (
    <View style={localStyles.modalContainer}>
      <View style={styles.mutinynetBanner}>
        <Text style={styles.mutinynetBannerText}>{NETWORK_EDITION_LABEL}</Text>
      </View>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Switch Account</Text>
          <Text style={styles.modalLabel}>Wallet source:</Text>
          <View style={localStyles.profileRow}>
            {WALLET_IMPORT_PROFILE_OPTIONS.map((profile) => {
              const isSelected = profile.id === walletProfile;
              return (
                <TouchableOpacity
                  key={profile.id}
                  style={[
                    localStyles.profileOption,
                    isSelected && localStyles.profileOptionSelected,
                  ]}
                  onPress={() => onWalletProfileChange(profile.id)}
                  disabled={switchingAccount}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      localStyles.profileOptionText,
                      isSelected && localStyles.profileOptionTextSelected,
                    ]}
                  >
                    {profile.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.modalLabel}>Enter account number:</Text>
          <TextInput
            style={styles.accountInput}
            value={accountIndex}
            onChangeText={onAccountIndexChange}
            placeholder="1"
            placeholderTextColor="#666666"
            keyboardType="number-pad"
            editable={!switchingAccount}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => {
                onClose();
                onAccountIndexChange('');
              }}
              disabled={switchingAccount}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={handleSwitch}
              disabled={switchingAccount}
            >
              <Text style={styles.modalButtonText}>
                {switchingAccount ? 'Switching...' : 'Switch'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const localStyles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  profileOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  profileOptionSelected: {
    borderColor: COLORS.PRIMARY_BLUE,
    backgroundColor: 'rgba(21,101,247,0.16)',
  },
  profileOptionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '700',
  },
  profileOptionTextSelected: {
    color: COLORS.TEXT_PRIMARY,
  },
});
