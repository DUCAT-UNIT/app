/**
 * AccountSwitcherModal Component
 * Modal for switching between different wallet accounts
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ERRORS, DIALOGS } from '../utils/messages';

export default function AccountSwitcherModal({
  // State
  visible,
  accountIndex,
  switchingAccount,

  // Callbacks
  onClose,
  onAccountIndexChange,
  onSwitch,

  // Styles
  styles,
}) {
  if (!visible) return null;

  const handleSwitch = () => {
    const accountNum = parseInt(accountIndex);
    if (isNaN(accountNum) || accountNum < 1) {
      Alert.alert(DIALOGS.INVALID_ACCOUNT_TITLE, ERRORS.INVALID_ACCOUNT_NUMBER);
      return;
    }
    onSwitch(accountNum);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1A', paddingHorizontal: 0 }}>
      <View style={styles.mutinynetBanner}>
        <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
      </View>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Switch Account</Text>
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

AccountSwitcherModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  accountIndex: PropTypes.string.isRequired,
  switchingAccount: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAccountIndexChange: PropTypes.func.isRequired,
  onSwitch: PropTypes.func.isRequired,
  styles: PropTypes.object.isRequired,
};
