/**
 * SettingsScreen Component
 * Full-screen settings view with modern dark aesthetic
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, StyleSheet, Platform, Dimensions, StatusBar, Image } from 'react-native';
import { COLORS } from '../utils/colors';

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
          <Image
            source={require('../assets/icons/back.png')}
            style={localStyles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      <View style={localStyles.content}>
        <Text style={localStyles.title}>Settings</Text>

        {/* Security Section */}
        <View style={localStyles.section}>
          <SettingsOption
            iconSource={require('../assets/icons/recovery_phrase.png')}
            title="View Recovery Phrase"
            onPress={onViewSeedPhrase}
          />
          <SettingsOption
            iconSource={require('../assets/icons/pin.png')}
            title="Change PIN"
            onPress={onChangePin}
          />
          <SettingsOption
            iconSource={require('../assets/icons/switch_account.png')}
            title="Switch Account"
            onPress={onSwitchAccount}
          />
          <SettingsOption
            iconSource={require('../assets/icons/logout.png')}
            title="Lock Wallet"
            onPress={onLockWallet}
          />
          <SettingsOption
            iconSource={privacyMode ? require('../assets/icons/privacy_on.png') : require('../assets/icons/privacy_off.png')}
            title="Privacy Mode"
            onPress={onPrivacyModeToggle}
            rightText={privacyMode ? 'ON' : 'OFF'}
          />
        </View>

        {/* Danger Zone */}
        <View style={localStyles.section}>
          <SettingsOption
            iconSource={require('../assets/icons/delete_wallet.png')}
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
function SettingsOption({ iconSource, title, onPress, rightText, isDanger }) {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress}>
      <View style={localStyles.optionLeft}>
        <Image
          source={iconSource}
          style={localStyles.optionIconImage}
          resizeMode="contain"
        />
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
  iconSource: PropTypes.number.isRequired,
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
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconImage: {
    width: 24,
    height: 24,
    marginRight: 16,
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
