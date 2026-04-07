/**
 * SecurityScreen Component
 * Security and authentication settings
 */

import React, { useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import ScreenLayout from '../../components/layouts/ScreenLayout';
import { useSettingsHandlers, useAuthFlowHandlers } from '../../contexts/NavigationHandlersContext';
import { analytics } from '../../services/analyticsService';
import { SETTINGS_EVENTS } from '../../constants/analyticsEvents';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

/**
 * Props for the SecurityScreen component
 */
interface SecurityScreenProps {
  /** Navigation route object containing params */
  route: {
    /** Route parameters */
    params: {
      /** Callback to close the Security screen */
      onClose: () => void;
    };
  };
}

/**
 * Props for individual settings option component
 */
interface SettingsOptionProps {
  iconName: string;
  title: string;
  onPress?: () => void;
  rightText?: string;
  rightTextStyle?: { color?: string };
  isDanger?: boolean;
  testID?: string;
}

const SecurityScreen = React.memo(function SecurityScreen({ route }: SecurityScreenProps): React.ReactElement {
  const { onClose } = route.params;

  // Get live state from context instead of stale route params
  const { settingsHandlers, biometricEnabled, passkeyUpgradeRecommended, triggerPasskeyUpgrade } = useSettingsHandlers();
  const { showPasskeyMigrationPrompt } = useAuthFlowHandlers();
  const {
    handleFaceIdToggle: rawFaceIdToggle,
    handleChangePin: rawChangePin,
    handleViewSeedPhrase: onViewSeedPhrase,
    handleDeleteWallet: onDeleteWallet,
  } = settingsHandlers;

  const faceIdEnabled = biometricEnabled;

  const onFaceIdToggle = React.useCallback(() => {
    analytics.track(SETTINGS_EVENTS.SECURITY_SETTING_CHANGED, { setting: 'biometric', new_value: !faceIdEnabled });
    rawFaceIdToggle();
  }, [rawFaceIdToggle, faceIdEnabled]);

  const onChangePin = React.useCallback(() => {
    analytics.track(SETTINGS_EVENTS.SECURITY_SETTING_CHANGED, { setting: 'pin_change' });
    rawChangePin();
  }, [rawChangePin]);

  useEffect(() => { analytics.track(SETTINGS_EVENTS.SETTINGS_OPENED, { screen: 'security' }); }, []);

  // Check passkey status
  const [passkeyEnabled, setPasskeyEnabled] = React.useState(false);
  React.useEffect(() => {
    const check = async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { isPasskeyEnabled: checkPasskey } = require('../../services/passkey') as typeof import('../../services/passkey');
      setPasskeyEnabled(await checkPasskey());
    };
    check();
  }, []);

  return (
    <ScreenLayout testID="security-screen">
      {/* Header with back button and title on same line */}
      <View style={localStyles.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={onClose}
          style={localStyles.backButton}
          testID="security-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the settings screen"
        >
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title} accessibilityRole="header">Security</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          <View style={localStyles.section}>
            <SettingsOption
              iconName="face_id"
              title="Biometric Authentication"
              onPress={onFaceIdToggle}
              rightText={faceIdEnabled ? 'ON' : 'OFF'}
              testID="security-biometric-btn"
            />
            <SettingsOption iconName="pin" title="Change PIN" onPress={onChangePin} testID="security-change-pin-btn" />
            <SettingsOption
              iconName="recovery_phrase"
              title="Backup Wallet"
              onPress={onViewSeedPhrase}
              testID="security-backup-btn"
            />
            {!passkeyEnabled ? (
              <SettingsOption
                iconName="recovery_phrase"
                title="Enable Passkey Recovery"
                onPress={() => showPasskeyMigrationPrompt('')}
                testID="security-enable-passkey-btn"
              />
            ) : (
              <SettingsOption
                iconName="recovery_phrase"
                title="Passkey Recovery"
                rightText="✓ Backup Complete"
                rightTextStyle={{ color: '#59AA8A' }}
                testID="security-passkey-status"
              />
            )}
            {passkeyUpgradeRecommended && passkeyEnabled && (
              <SettingsOption
                iconName="recovery_phrase"
                title="Upgrade Passkey Security"
                onPress={triggerPasskeyUpgrade}
                rightText="RECOMMENDED"
                testID="security-passkey-upgrade-btn"
              />
            )}
          </View>

          {/* Danger Zone */}
          <Text style={localStyles.dangerZoneHeader}>Danger Zone</Text>
          <View style={localStyles.dangerSection}>
            <SettingsOption
              iconName="delete_wallet"
              title="Delete Local Wallet"
              onPress={onDeleteWallet}
              isDanger
              testID="security-delete-btn"
            />
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
});

// Individual settings option component
const SettingsOption = React.memo(function SettingsOption({
  iconName,
  title,
  onPress,
  rightText,
  rightTextStyle,
  isDanger,
  testID
}: SettingsOptionProps): React.ReactElement {
  const accessibilityLabel = rightText
    ? `${title}, currently ${rightText}`
    : title;

  const content = (
    <>
      <View style={localStyles.optionLeft} accessibilityElementsHidden>
        <Icon name={iconName} size={24} color={isDanger ? COLORS.DANGER_RED : '#DDDDDD'} />
        <Text style={[localStyles.optionTitle, isDanger && localStyles.dangerText]}>{title}</Text>
      </View>
      <View style={localStyles.optionRight} accessibilityElementsHidden>
        {rightText && <Text style={[localStyles.optionRightText, rightTextStyle]}>{rightText}</Text>}
        {onPress && <Text style={localStyles.optionArrow}>›</Text>}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={localStyles.option} testID={testID} accessibilityLabel={accessibilityLabel}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={localStyles.option}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={isDanger ? 'Warning: Deletes wallet data from this device.' : undefined}
    >
      {content}
    </TouchableOpacity>
  );
});

export default SecurityScreen;

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
  dangerZoneHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.DANGER_RED,
    fontFamily: 'CabinetGrotesk-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 10,
  },
  dangerSection: {
    borderWidth: 1,
    borderColor: COLORS.DANGER_RED + '40',
    borderRadius: 12,
    backgroundColor: COLORS.DANGER_RED + '10',
    paddingHorizontal: 12,
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
