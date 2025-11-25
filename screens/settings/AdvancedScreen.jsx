/**
 * AdvancedScreen Component
 * Advanced settings and options
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
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

const AdvancedScreen = React.memo(function AdvancedScreen({ route }) {
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

  const [isClearing, setIsClearing] = useState(false);

  // Format threshold display value
  const getThresholdDisplay = () => {
    if (ecashThreshold === Infinity) return 'All transfers';
    return `${ecashThreshold} UNIT`;
  };

  const handleClearCache = () => {
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
            } catch (error) {
              logger.error('[AdvancedScreen] Failed to clear cache:', error);
              Alert.alert(
                'Error',
                `Failed to clear cache: ${error.message}`,
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
    <View style={styles.container}>
      <MutinynetBanner />
      {/* Header with back button and title on same line */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
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
            />
            <SettingsOption
              iconName="unit_logo"
              title="Ecash Default"
              onPress={onEcashThresholdPress}
              rightText={getThresholdDisplay()}
            />
            <SettingsOption
              iconName="switch_account"
              title="Select Account"
              onPress={onSwitchAccount}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Troubleshooting</Text>
            <TouchableOpacity
              style={styles.clearCacheButton}
              onPress={handleClearCache}
              disabled={isClearing}
              activeOpacity={0.7}
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
        </View>
      </ScrollView>
    </View>
  );
});

// Individual settings option component
const SettingsOption = React.memo(function SettingsOption({ iconName, title, onPress, rightText }) {
  const handlePress = () => {
    logger.debug(`[AdvancedScreen] SettingsOption pressed: ${title}`);
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity style={styles.option} onPress={handlePress} activeOpacity={0.7}>
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

SettingsOption.propTypes = {
  iconName: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  rightText: PropTypes.string,
};

AdvancedScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      onClose: PropTypes.func.isRequired,
      onSwitchAccount: PropTypes.func.isRequired,
      onAdvancedModeToggle: PropTypes.func.isRequired,
      onEcashThresholdPress: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

export default AdvancedScreen;
