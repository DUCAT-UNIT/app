/**
 * SettingsScreen Component
 * Full-screen settings view with modern dark aesthetic
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../utils/colors';
import Icon from '../../components/icons';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get safe area top inset - accounts for notch/status bar on different devices
const _STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

const SettingsScreen = React.memo(function SettingsScreen({
  // Callbacks
  onClose,
  onViewSeedPhrase,
  onChangePin,
  onSwitchAccount,
  onLockWallet,
  onDeleteWallet,
  onFaceIdToggle,
  onNotificationsToggle,
  onShowZeroAssetsToggle,

  // State
  faceIdEnabled,
  notificationsEnabled,
  showZeroAssets,
}) {
  return (
    <View style={localStyles.container}>
      {/* Header with back button and title on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton}>
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Settings</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          {/* Security Section */}
          <View style={localStyles.section}>
            <SettingsOption
              iconName="recovery_phrase"
              title="View Recovery Phrase"
              onPress={onViewSeedPhrase}
            />
            <SettingsOption iconName="pin" title="Change PIN" onPress={onChangePin} />
            <SettingsOption
              iconName="switch_account"
              title="Switch Account"
              onPress={onSwitchAccount}
            />
            <SettingsOption
              iconName="asset"
              title="Show Zero Value Assets"
              onPress={onShowZeroAssetsToggle}
              rightText={showZeroAssets ? 'ON' : 'OFF'}
            />
            <SettingsOption
              iconName="face_id"
              title="Face ID"
              onPress={onFaceIdToggle}
              rightText={faceIdEnabled ? 'ON' : 'OFF'}
            />
            <SettingsOption
              iconName="notification"
              title="Notifications"
              onPress={onNotificationsToggle}
              rightText={notificationsEnabled ? 'ON' : 'OFF'}
            />
            <SettingsOption iconName="logout" title="Lock Wallet" onPress={onLockWallet} />
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
      </ScrollView>
    </View>
  );
});

// Individual settings option component
const SettingsOption = React.memo(function SettingsOption({ iconName, title, onPress, rightText, isDanger }) {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress}>
      <View style={localStyles.optionLeft}>
        <Icon name={iconName} size={24} color={isDanger ? COLORS.DANGER_RED : '#DDDDDD'} />
        <Text style={[localStyles.optionTitle, isDanger && localStyles.dangerText]}>{title}</Text>
      </View>
      <View style={localStyles.optionRight}>
        {rightText && <Text style={localStyles.optionRightText}>{rightText}</Text>}
        <Text style={localStyles.optionArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
});

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
  onFaceIdToggle: PropTypes.func.isRequired,
  onNotificationsToggle: PropTypes.func.isRequired,
  onShowZeroAssetsToggle: PropTypes.func.isRequired,
  faceIdEnabled: PropTypes.bool.isRequired,
  notificationsEnabled: PropTypes.bool.isRequired,
  showZeroAssets: PropTypes.bool.isRequired,
};

export default SettingsScreen;

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  // backIcon removed - not currently used
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
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
  // optionIconImage removed - not currently used
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
