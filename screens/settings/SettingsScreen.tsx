/**
 * SettingsScreen Component
 * Full-screen settings view with modern dark aesthetic
 */

import React, { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { clearAppCache } from '../../services/cacheService';
import { logger } from '../../utils/logger';

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
  onPress?: () => void;
  /** Optional text to display on the right */
  rightText?: string;
  /** Optional style override for right text */
  rightTextStyle?: { color?: string };
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
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const handleClearCache = (): void => {
    Alert.alert(
      'Clear App Cache',
      'This will clear all cached data except your wallet keys and PIN. This can help resolve issues.\n\nYour balance and settings will be preserved.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              const result = await clearAppCache();
              logger.debug('[SettingsScreen] Cache cleared:', result);

              Alert.alert(
                'Cache Cleared',
                `Successfully cleared cached data.\n\n${result.errors.length > 0 ? `Errors: ${result.errors.join(', ')}` : 'No errors.'}`,
                [{ text: 'OK' }]
              );
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error(error, { context: 'SettingsScreen', action: 'clearCache' });
              Alert.alert(
                'Error',
                `Failed to clear cache: ${errorMessage}`,
                [{ text: 'OK' }]
              );
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={localStyles.container} testID="settings-screen">
      {/* Header with back button and title on same line */}
      <View style={localStyles.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={onClose}
          style={localStyles.backButton}
          testID="settings-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title} accessibilityRole="header">Settings</Text>
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
            {/* Turbo Cashu settings only visible in developer mode */}
            {advancedMode && (
              <SettingsOption
                iconName="asset"
                title="Turbo Cashu"
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

          {/* Danger Zone - only shown in advanced/dev mode */}
          {advancedMode && (
            <View style={localStyles.section}>
              <Text style={localStyles.sectionTitle}>Danger Zone</Text>
              <TouchableOpacity
                style={localStyles.dangerOption}
                onPress={handleClearCache}
                disabled={isClearing}
                activeOpacity={0.7}
                testID="settings-clear-cache-btn"
                accessibilityRole="button"
                accessibilityLabel="Clear app cache"
                accessibilityHint="Fixes issues with tokens and data. Will prompt for confirmation."
                accessibilityState={{ disabled: isClearing }}
              >
                <View style={localStyles.optionLeft} accessibilityElementsHidden>
                  <Icon name="delete" size={24} color={COLORS.DANGER_RED} />
                  <View>
                    <Text style={localStyles.dangerText}>Clear App Cache</Text>
                    <Text style={localStyles.dangerSubtext}>Fixes issues with tokens and data</Text>
                  </View>
                </View>
                {isClearing && (
                  <ActivityIndicator size="small" color={COLORS.DANGER_RED} accessibilityElementsHidden />
                )}
              </TouchableOpacity>
            </View>
          )}
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
  rightTextStyle,
  isDanger,
  testID
}: SettingsOptionProps): React.ReactElement {
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
    return <View style={localStyles.option} testID={testID}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={localStyles.option}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={`Open ${title} settings`}
    >
      {content}
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
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  dangerSubtext: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Regular',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Medium',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dangerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
});
