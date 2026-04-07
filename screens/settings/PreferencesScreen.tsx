/**
 * PreferencesScreen Component
 * User preferences and display options
 */

import React from 'react';
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
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

/**
 * Props for the PreferencesScreen component
 */
interface PreferencesScreenProps {
  /** Navigation route object containing params */
  route: {
    /** Route parameters */
    params: {
      /** Callback to close the Preferences screen */
      onClose: () => void;
      /** Callback to toggle show zero assets setting */
      onShowZeroAssetsToggle: () => void;
      /** Callback to toggle notifications setting */
      onNotificationsToggle: () => void;
      /** Whether to show zero value assets */
      showZeroAssets: boolean;
      /** Whether notifications are enabled */
      notificationsEnabled: boolean;
    };
  };
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
  /** Optional text to display on the right (e.g., ON/OFF) */
  rightText?: string;
  /** Whether this is a dangerous/destructive action */
  isDanger?: boolean;
  /** Optional test ID for testing */
  testID?: string;
}

function PreferencesScreen({ route }: PreferencesScreenProps): React.ReactElement {
  const { onClose } = route.params;

  // Get live state from context instead of stale route params
  const { settingsHandlers } = useSettingsHandlers();
  const {
    handleShowZeroAssetsToggle: onShowZeroAssetsToggle,
    handleNotificationsToggle: onNotificationsToggle,
    showZeroAssets,
    notificationsEnabled,
  } = settingsHandlers;

  return (
    <ScreenLayout testID="preferences-screen">
      {/* Header with back button and title on same line */}
      <View style={localStyles.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={onClose}
          style={localStyles.backButton}
          testID="preferences-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the settings screen"
        >
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title} accessibilityRole="header">Preferences</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          <View style={localStyles.section}>
            <SettingsOption
              iconName="asset"
              title="Show Zero Value Assets"
              onPress={onShowZeroAssetsToggle}
              rightText={showZeroAssets ? 'ON' : 'OFF'}
              testID="preferences-zero-assets-btn"
            />
            <SettingsOption
              iconName="notification"
              title="Notifications"
              onPress={onNotificationsToggle}
              rightText={notificationsEnabled ? 'ON' : 'OFF'}
              testID="preferences-notifications-btn"
            />
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

// Individual settings option component
function SettingsOption({
  iconName,
  title,
  onPress,
  rightText,
  isDanger,
  testID
}: SettingsOptionProps): React.ReactElement {
  // Build accessibility label with status if available
  const accessibilityLabel = rightText
    ? `${title}, currently ${rightText}`
    : title;

  return (
    <TouchableOpacity
      style={localStyles.option}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Tap to toggle this setting"
    >
      <View style={localStyles.optionLeft} accessibilityElementsHidden>
        <Icon name={iconName} size={24} color={isDanger ? COLORS.DANGER_RED : '#DDDDDD'} />
        <Text style={[localStyles.optionTitle, isDanger && localStyles.dangerText]}>{title}</Text>
      </View>
      <View style={localStyles.optionRight} accessibilityElementsHidden>
        {rightText && <Text style={localStyles.optionRightText}>{rightText}</Text>}
        <Text style={localStyles.optionArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default PreferencesScreen;

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
