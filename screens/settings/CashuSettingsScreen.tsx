/**
 * CashuSettingsScreen Component
 * Cashu-specific settings and tools
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
import MutinynetBanner from '../../components/MutinynetBanner';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

/**
 * Props for the CashuSettingsScreen component
 */
interface CashuSettingsScreenProps {
  /** Navigation route object containing params */
  route: {
    /** Route parameters */
    params: {
      /** Callback to close the Cashu Settings screen */
      onClose: () => void;
      /** Callback to clear Cashu cache */
      onClearCashuCache: () => void;
      /** Callback to recover locked change */
      onRecoverLockedChange: () => void;
      /** Callback to clear locked tokens history */
      onClearLockedTokens: () => void;
      /** Callback to recover from failed mint */
      onRecoverMint: () => void;
      /** Callback to redeem a Cashu token */
      onRedeemToken: () => void;
      /** Callback to remove spent proofs */
      onRemoveSpentProofs: () => void;
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
  /** Optional text to display on the right */
  rightText?: string;
  /** Whether this is a dangerous/destructive action */
  isDanger?: boolean;
  /** Optional test ID for testing */
  testID?: string;
}

const CashuSettingsScreen = React.memo(function CashuSettingsScreen({ route }: CashuSettingsScreenProps): React.ReactElement {
  const {
    onClose,
    onClearCashuCache,
    onRecoverLockedChange,
    onClearLockedTokens,
    onRecoverMint,
    onRedeemToken,
    onRemoveSpentProofs,
  } = route.params;
  return (
    <View style={localStyles.container} testID="cashu-settings-screen">
      <MutinynetBanner />
      {/* Header with back button and title on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton} testID="cashu-settings-back-btn">
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Cashu</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          {/* Cashu Tools Section */}
          <View style={localStyles.section}>
            <SettingsOption
              iconName="recovery_phrase"
              title="Recover Locked Change"
              onPress={onRecoverLockedChange}
              testID="cashu-recover-locked-btn"
            />
            <SettingsOption
              iconName="recovery_phrase"
              title="Recover Failed Mint"
              onPress={onRecoverMint}
              testID="cashu-recover-mint-btn"
            />
            <SettingsOption
              iconName="asset"
              title="Redeem Cashu Token"
              onPress={onRedeemToken}
              testID="cashu-redeem-token-btn"
            />
            <SettingsOption
              iconName="recovery_phrase"
              title="Remove Spent Proofs"
              onPress={onRemoveSpentProofs}
              testID="cashu-remove-proofs-btn"
            />
            <SettingsOption
              iconName="delete_wallet"
              title="Clear Locked Tokens History"
              onPress={onClearLockedTokens}
              isDanger
              testID="cashu-clear-tokens-btn"
            />
            <SettingsOption
              iconName="delete_wallet"
              title="Clear Cashu Cache"
              onPress={onClearCashuCache}
              isDanger
              testID="cashu-clear-cache-btn"
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

export default CashuSettingsScreen;

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
