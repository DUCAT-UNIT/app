/**
 * CashuSettingsScreen Component
 * Cashu-specific settings and tools
 */

import React from 'react';
import PropTypes from 'prop-types';
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

const CashuSettingsScreen = React.memo(function CashuSettingsScreen({ route }) {
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
    <View style={localStyles.container}>
      <MutinynetBanner />
      {/* Header with back button and title on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton}>
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
            />
            <SettingsOption
              iconName="recovery_phrase"
              title="Recover Failed Mint"
              onPress={onRecoverMint}
            />
            <SettingsOption
              iconName="asset"
              title="Redeem Cashu Token"
              onPress={onRedeemToken}
            />
            <SettingsOption
              iconName="recovery_phrase"
              title="Remove Spent Proofs"
              onPress={onRemoveSpentProofs}
            />
            <SettingsOption
              iconName="delete_wallet"
              title="Clear Locked Tokens History"
              onPress={onClearLockedTokens}
              isDanger
            />
            <SettingsOption
              iconName="delete_wallet"
              title="Clear Cashu Cache"
              onPress={onClearCashuCache}
              isDanger
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
});

// Individual settings option component
const SettingsOption = React.memo(function SettingsOption({ iconName, title, onPress, rightText, isDanger }) {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress}>
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

SettingsOption.propTypes = {
  iconName: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  rightText: PropTypes.string,
  isDanger: PropTypes.bool,
};

CashuSettingsScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      onClose: PropTypes.func.isRequired,
      onClearCashuCache: PropTypes.func.isRequired,
      onRecoverLockedChange: PropTypes.func.isRequired,
      onClearLockedTokens: PropTypes.func.isRequired,
      onRecoverMint: PropTypes.func.isRequired,
      onRedeemToken: PropTypes.func.isRequired,
      onRemoveSpentProofs: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

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
