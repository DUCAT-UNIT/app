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
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import MutinynetBanner from '../../components/MutinynetBanner';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import { clearAppCache } from '../../services/cacheService';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

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
              console.log('[AdvancedScreen] Cache cleared:', result);

              Alert.alert(
                'Cache Cleared',
                `Successfully cleared:\n• ${result.secureStoreCleared} secure items\n• ${result.cashuProofsCleared} cashu proof caches\n• ${result.derivedKeysCleared} derived key caches\n• ${result.asyncStorageCleared} storage items\n\n${result.errors.length > 0 ? `Errors: ${result.errors.join(', ')}` : 'No errors.'}`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('[AdvancedScreen] Failed to clear cache:', error);
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

  console.log('[AdvancedScreen] Rendering with advancedMode:', advancedMode, 'ecashThreshold:', ecashThreshold);

  return (
    <View style={localStyles.container}>
      <MutinynetBanner />
      {/* Header with back button and title on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton}>
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Advanced</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          <View style={localStyles.section}>
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

          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Troubleshooting</Text>
            <TouchableOpacity
              style={localStyles.clearCacheButton}
              onPress={handleClearCache}
              disabled={isClearing}
              activeOpacity={0.7}
            >
              <View style={localStyles.clearCacheContent}>
                <Icon name="delete" size={24} color="#FF6B6B" />
                <View style={localStyles.clearCacheTextContainer}>
                  <Text style={localStyles.clearCacheTitle}>Clear App Cache</Text>
                  <Text style={localStyles.clearCacheSubtitle}>
                    Fixes issues with P2PK tokens and other problems
                  </Text>
                </View>
              </View>
              {isClearing && (
                <ActivityIndicator size="small" color="#FF6B6B" style={localStyles.spinner} />
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
    console.log(`[AdvancedScreen] SettingsOption pressed: ${title}`);
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity style={localStyles.option} onPress={handlePress} activeOpacity={0.7}>
      <View style={localStyles.optionLeft}>
        <Icon name={iconName} size={24} color="#DDDDDD" />
        <Text style={localStyles.optionTitle}>{title}</Text>
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
  sectionTitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearCacheButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  clearCacheContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clearCacheTextContainer: {
    flex: 1,
  },
  clearCacheTitle: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '500',
    fontFamily: 'CabinetGrotesk-Medium',
    marginBottom: 4,
  },
  clearCacheSubtitle: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
    lineHeight: 18,
  },
  spinner: {
    marginLeft: 12,
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
});
