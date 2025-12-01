/**
 * SettingsScreen Component
 * Full-screen settings view with modern dark aesthetic
 */

import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

/**
 * Props for the SettingsScreen component
 */
interface SettingsScreenProps {
  /** Callback to close the Settings screen */
  onClose: () => void;
  /** Callback to lock the wallet */
  onLockWallet: () => void;
  /** Callback to view Preferences screen */
  onViewPreferences: () => void;
  /** Callback to view Security screen */
  onViewSecurity: () => void;
  /** Callback to view Advanced screen */
  onViewAdvanced: () => void;
  /** Callback to view Cashu Settings screen */
  onViewCashuSettings: () => void;
  /** Callback to view About screen */
  onViewAbout: () => void;
  /** Whether advanced/developer mode is enabled */
  advancedMode?: boolean;
}

/**
 * Props for individual settings option component
 */
interface SettingsOptionProps {
  /** Icon name to display */
  iconName: string;
  /** Title text for the option */
  title: string;
  /** Callback when option is pressed */
  onPress: () => void;
  /** Optional text to display on the right */
  rightText?: string;
  /** Whether this is a dangerous/destructive action */
  isDanger?: boolean;
  /** Optional test ID for testing */
  testID?: string;
}

const SettingsScreen = React.memo(function SettingsScreen({
  // Callbacks
  onClose,
  onLockWallet,
  onViewPreferences,
  onViewSecurity,
  onViewAdvanced,
  onViewCashuSettings,
  onViewAbout,
  advancedMode = false,
}: SettingsScreenProps): React.ReactElement {
  return (
    <View style={localStyles.container} testID="settings-screen">
      {/* Header with back button and title on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton} testID="settings-back-btn">
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Settings</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          <View style={localStyles.section}>
            <SettingsOption
              iconName="asset"
              title="Preferences"
              onPress={onViewPreferences}
              testID="settings-preferences-btn"
            />
            <SettingsOption
              iconName="face_id"
              title="Security"
              onPress={onViewSecurity}
              testID="settings-security-btn"
            />
            <SettingsOption
              iconName="switch_account"
              title="Advanced"
              onPress={onViewAdvanced}
              testID="settings-advanced-btn"
            />
            {/* Cashu settings only visible in developer mode */}
            {advancedMode && (
              <SettingsOption
                iconName="asset"
                title="Cashu"
                onPress={onViewCashuSettings}
                testID="settings-cashu-btn"
              />
            )}
            <SettingsOption iconName="logout" title="Lock Wallet" onPress={onLockWallet} testID="settings-lock-btn" />
            <SettingsOption
              iconName="asset"
              title="About"
              onPress={onViewAbout}
              testID="settings-about-btn"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
});

// Individual settings option component
const SettingsOption = React.memo(function SettingsOption({
  iconName,
  title,
  onPress,
  rightText,
  isDanger,
  testID
}: SettingsOptionProps): React.ReactElement {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress} testID={testID}>
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
    marginBottom: 20,
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
