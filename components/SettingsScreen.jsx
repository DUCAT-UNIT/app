/**
 * SettingsScreen Component
 * Full-screen settings view with modern dark aesthetic
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, StyleSheet, Platform, Dimensions, StatusBar } from 'react-native';
import { COLORS } from '../utils/colors';
import Icon from './Icon';

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
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
      </View>

      <View style={localStyles.content}>
        <Text style={localStyles.title}>Settings</Text>

        {/* Security Section */}
        <View style={localStyles.section}>
          <SettingsOption
            iconName="recovery_phrase"
            title="View Recovery Phrase"
            onPress={onViewSeedPhrase}
          />
          <SettingsOption
            iconName="pin"
            title="Change PIN"
            onPress={onChangePin}
          />
          <SettingsOption
            iconName="switch_account"
            title="Switch Account"
            onPress={onSwitchAccount}
          />
          <SettingsOption
            iconName="logout"
            title="Lock Wallet"
            onPress={onLockWallet}
          />
          <SettingsOption
            iconName={privacyMode ? "privacy_on" : "privacy_off"}
            title="Privacy Mode"
            onPress={onPrivacyModeToggle}
            rightText={privacyMode ? 'ON' : 'OFF'}
          />
        </View>

        {/* Danger Zone */}
        <View style={localStyles.section}>
          <SettingsOption
            iconName="delete_wallet"
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
function SettingsOption({ iconName, title, onPress, rightText, isDanger }) {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress}>
      <View style={localStyles.optionLeft}>
        <Icon name={iconName} size={24} color={isDanger ? COLORS.DANGER_RED : COLORS.VERY_LIGHT_GRAY} />
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

SettingsOption.propTypes = {
  iconName: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  rightText: PropTypes.string,
  isDanger: PropTypes.bool,
};

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
    backgroundColor: COLORS.DARK_BG,
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
  backIcon: {
    width: 24,
    height: 24,
    tintColor: COLORS.VERY_LIGHT_GRAY,
  },
  content: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
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
    paddingVertical: 20,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  optionIconImage: {
    width: 24,
    height: 24,
    tintColor: COLORS.VERY_LIGHT_GRAY,
  },
  optionTitle: {
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
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
    color: COLORS.DANGER_RED,
  },
});
