/**
 * SettingsScreen Component
 * Full-screen settings view with modern dark aesthetic
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, StyleSheet, Platform, Dimensions, StatusBar } from 'react-native';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get safe area top inset - accounts for notch/status bar on different devices
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0);

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : (SCREEN_WIDTH > 414 ? 24 : 20);

export default function SettingsScreen({
  // Callbacks
  onClose,
  onViewSeedPhrase,
  onChangePin,
  onSwitchAccount,
  onLockWallet,
  onDeleteWallet,
  onPrivacyModeToggle,

  // State
  privacyMode,
}) {
  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton}>
          <Text style={localStyles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={localStyles.content}>
        <Text style={localStyles.title}>Settings</Text>

        {/* Security Section */}
        <View style={localStyles.section}>
          <SettingsOption
            icon="🔑"
            title="View Recovery Phrase"
            onPress={onViewSeedPhrase}
          />
          <SettingsOption
            icon="🔢"
            title="Change PIN"
            onPress={onChangePin}
          />
          <SettingsOption
            icon="🔄"
            title="Switch Account"
            onPress={onSwitchAccount}
          />
          <SettingsOption
            icon="🔒"
            title="Lock Wallet"
            onPress={onLockWallet}
          />
          <SettingsOption
            icon="👁️"
            title="Privacy Mode"
            onPress={onPrivacyModeToggle}
            rightText={privacyMode ? 'ON' : 'OFF'}
          />
        </View>

        {/* Danger Zone */}
        <View style={localStyles.section}>
          <SettingsOption
            icon="⚠️"
            title="Delete Wallet"
            onPress={onDeleteWallet}
            isDanger
          />
        </View>
      </View>
    </View>
  );
}

// Individual settings option component
function SettingsOption({ icon, title, onPress, rightText, isDanger }) {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress}>
      <View style={localStyles.optionLeft}>
        <Text style={localStyles.optionIcon}>{icon}</Text>
        <Text style={[localStyles.optionTitle, isDanger && localStyles.dangerText]}>
          {title}
        </Text>
      </View>
      <View style={localStyles.optionRight}>
        {rightText && <Text style={localStyles.optionRightText}>{rightText}</Text>}
        <Text style={localStyles.optionArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

SettingsScreen.propTypes = {
  onClose: PropTypes.func.isRequired,
  onViewSeedPhrase: PropTypes.func.isRequired,
  onChangePin: PropTypes.func.isRequired,
  onSwitchAccount: PropTypes.func.isRequired,
  onLockWallet: PropTypes.func.isRequired,
  onDeleteWallet: PropTypes.func.isRequired,
  onPrivacyModeToggle: PropTypes.func.isRequired,
  privacyMode: PropTypes.bool.isRequired,
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    color: '#fff',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  content: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
    marginTop: 10,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  section: {
    marginBottom: 30,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    fontSize: 22,
    marginRight: 16,
    width: 28,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  optionTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionRightText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  optionArrow: {
    fontSize: 24,
    color: '#666',
    marginLeft: 4,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  dangerText: {
    color: '#ff4444',
  },
});
