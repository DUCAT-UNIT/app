/**
 * AdvancedScreen Component
 * Advanced settings and options
 */

import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import ScreenLayout from '../../components/layouts/ScreenLayout';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useRemoteConfigStore } from '../../stores/remoteConfigStore';
import { logger } from '../../utils/logger';
import { styles } from './AdvancedScreen.styles';

/**
 * Props for the AdvancedScreen component
 */
interface AdvancedScreenProps {
  /** Navigation route object containing params */
  route: {
    /** Route parameters */
    params: {
      /** Callback to close the Advanced screen */
      onClose: () => void;
      /** Callback to switch account */
      onSwitchAccount: () => void;
      /** Callback to toggle advanced/developer mode */
      onAdvancedModeToggle: () => void;
      /** Callback when ecash threshold is pressed */
      onEcashThresholdPress: () => void;
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
  /** Optional test ID for testing */
  testID?: string;
}

const AdvancedScreen = React.memo(function AdvancedScreen({ route }: AdvancedScreenProps): React.ReactElement {
  const {
    onClose,
    onSwitchAccount,
    onAdvancedModeToggle,
    onEcashThresholdPress,
  } = route.params;

  // Get advancedMode and ecashThreshold directly from context so they update when toggled
  const { settingsHandlers } = useSettingsHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;
  const ecashThreshold = settingsHandlers?.ecashThreshold || 10000;

  // Remote config store (developer-only section)
  const configVersion = useRemoteConfigStore((s) => s.config.version);
  const configNetworkId = useRemoteConfigStore((s) => s.config.network.id);
  const configIsLoading = useRemoteConfigStore((s) => s.isLoading);
  const refreshConfig = useRemoteConfigStore((s) => s.refresh);
  const resetOverrides = useRemoteConfigStore((s) => s.resetOverrides);

  // Format threshold display value
  const getThresholdDisplay = (): string => {
    if (ecashThreshold === Infinity) return 'All transfers';
    return `${(ecashThreshold / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT`;
  };

  logger.debug('[AdvancedScreen] Rendering with advancedMode:', advancedMode, 'ecashThreshold:', ecashThreshold);

  return (
    <ScreenLayout testID="advanced-screen">
      {/* Header with back button and title on same line */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton} testID="advanced-back-btn">
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={styles.title}>Advanced</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.section}>
            <SettingsOption
              iconName="asset"
              title="Developer Mode"
              onPress={onAdvancedModeToggle}
              rightText={advancedMode ? 'ON' : 'OFF'}
              testID="advanced-dev-mode-btn"
            />
            <SettingsOption
              iconName="unit_logo"
              title="Turbo UNIT Default"
              onPress={onEcashThresholdPress}
              rightText={getThresholdDisplay()}
              testID="advanced-ecash-threshold-btn"
            />
            {/* Account selection only visible in developer mode */}
            {advancedMode && (
              <SettingsOption
                iconName="switch_account"
                title="Select Account"
                onPress={onSwitchAccount}
                testID="advanced-switch-account-btn"
              />
            )}
          </View>

          {/* Remote Config section — only visible in developer mode */}
          {advancedMode && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Remote Config</Text>
              <SettingsOption
                iconName="asset"
                title="Config Version"
                onPress={() => {
                  logger.debug('[AdvancedScreen] Config version pressed');
                }}
                rightText={configVersion}
                testID="advanced-config-version"
              />
              <SettingsOption
                iconName="asset"
                title="Network"
                onPress={() => {
                  logger.debug('[AdvancedScreen] Network ID pressed');
                }}
                rightText={configNetworkId}
                testID="advanced-config-network"
              />
              <SettingsOption
                iconName="asset"
                title="Force Refresh"
                onPress={() => {
                  refreshConfig().catch(() => {});
                }}
                rightText={configIsLoading ? 'Loading...' : ''}
                testID="advanced-config-refresh-btn"
              />
              <SettingsOption
                iconName="asset"
                title="Reset Overrides"
                onPress={resetOverrides}
                testID="advanced-config-reset-btn"
              />
            </View>
          )}

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
  testID
}: SettingsOptionProps): React.ReactElement {
  const handlePress = (): void => {
    logger.debug(`[AdvancedScreen] SettingsOption pressed: ${title}`);
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity style={styles.option} onPress={handlePress} activeOpacity={0.7} testID={testID}>
      <View style={styles.optionLeft}>
        <Icon name={iconName} size={24} color="#DDDDDD" />
        <Text style={styles.optionTitle}>{title}</Text>
      </View>
      <View style={styles.optionRight}>
        {rightText && <Text style={styles.optionRightText}>{rightText}</Text>}
        <Text style={styles.optionArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
});

export default AdvancedScreen;
