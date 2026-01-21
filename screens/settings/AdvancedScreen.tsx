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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import MutinynetBanner from '../../components/MutinynetBanner';
import LowEcashBalanceModal from '../../components/ecash/LowEcashBalanceModal';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
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

  const navigation = useNavigation();

  // State for previewing the low ecash balance modal
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);

  // Get advancedMode and ecashThreshold directly from context so they update when toggled
  const { settingsHandlers } = useNavigationHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;
  const ecashThreshold = settingsHandlers?.ecashThreshold || 100;

  // Format threshold display value
  const getThresholdDisplay = (): string => {
    if (ecashThreshold === Infinity) return 'All transfers';
    return `${ecashThreshold} UNIT`;
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
              title="Turbo UNIT Default"
              onPress={onEcashThresholdPress}
              rightText={getThresholdDisplay()}
              testID="advanced-ecash-threshold-btn"
            />
            {/* Account selection only visible in developer mode */}
            {advancedMode && (
              <>
                <SettingsOption
                  iconName="switch_account"
                  title="Select Account"
                  onPress={onSwitchAccount}
                  testID="advanced-switch-account-btn"
                />
                <SettingsOption
                  iconName="settings"
                  title="Fee Selector Demo"
                  onPress={() => navigation.navigate('FeeRateDemo' as never)}
                  testID="advanced-fee-demo-btn"
                />
                <SettingsOption
                  iconName="unit_logo"
                  title="Low Balance Modal Preview"
                  onPress={() => setShowLowBalanceModal(true)}
                  testID="advanced-low-balance-modal-btn"
                />
              </>
            )}
          </View>

        </View>
      </ScrollView>

      {/* Low Ecash Balance Modal Preview */}
      <LowEcashBalanceModal
        visible={showLowBalanceModal}
        onClose={() => setShowLowBalanceModal(false)}
        onConfirm={() => {
          setShowLowBalanceModal(false);
          logger.debug('[AdvancedScreen] Low balance modal confirm pressed');
        }}
        currentBalance={25}
        defaultThreshold={100}
        amountNeeded={75}
      />
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
