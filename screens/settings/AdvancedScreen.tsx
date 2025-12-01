/**
 * AdvancedScreen Component
 * Advanced settings and options
 */

import React, { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import MutinynetBanner from '../../components/MutinynetBanner';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import { clearAppCache } from '../../services/cacheService';
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
  const { settingsHandlers } = useNavigationHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;
  const ecashThreshold = settingsHandlers?.ecashThreshold || 100;

  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Format threshold display value
  const getThresholdDisplay = (): string => {
    if (ecashThreshold === Infinity) return 'All transfers';
    return `${ecashThreshold} UNIT`;
  };

  const handleClearCache = (): void => {
    Alert.alert(
      'Clear App Cache',
      'This will clear all cached data except your wallet keys and PIN. This can help resolve issues with P2PK tokens and other problems.\n\nYour balance and settings will be preserved.',
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
              logger.debug('[AdvancedScreen] Cache cleared:', result);

              Alert.alert(
                'Cache Cleared',
                `Successfully cleared:\n• ${result.secureStoreCleared} secure items\n• ${result.cashuProofsCleared} cashu proof caches\n• ${result.derivedKeysCleared} derived key caches\n• ${result.asyncStorageCleared} storage items\n\n${result.errors.length > 0 ? `Errors: ${result.errors.join(', ')}` : 'No errors.'}`,
                [{ text: 'OK' }]
              );
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error(error, { context: 'AdvancedScreen', action: 'clearCache' });
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

  logger.debug('[AdvancedScreen] Rendering with advancedMode:', advancedMode, 'ecashThreshold:', ecashThreshold);

  return (
    <View style={styles.container} testID="advanced-screen">
      <MutinynetBanner />
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
              title="Ecash Default"
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

          {/* Troubleshooting section only visible in developer mode */}
          {advancedMode && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Troubleshooting</Text>
              <TouchableOpacity
                style={styles.clearCacheButton}
                onPress={handleClearCache}
                disabled={isClearing}
                activeOpacity={0.7}
                testID="advanced-clear-cache-btn"
              >
                <View style={styles.clearCacheContent}>
                  <Icon name="delete" size={24} color="#FF6B6B" />
                  <View style={styles.clearCacheTextContainer}>
                    <Text style={styles.clearCacheTitle}>Clear App Cache</Text>
                    <Text style={styles.clearCacheSubtitle}>
                      Fixes issues with P2PK tokens and other problems
                    </Text>
                  </View>
                </View>
                {isClearing && (
                  <ActivityIndicator size="small" color="#FF6B6B" style={styles.spinner} />
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
