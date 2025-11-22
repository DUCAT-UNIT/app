/**
 * AdvancedScreen Component
 * Advanced settings and options
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
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

const AdvancedScreen = React.memo(function AdvancedScreen({ route }) {
  const {
    onClose,
    onSwitchAccount,
    onAdvancedModeToggle,
  } = route.params;

  // Get advancedMode directly from context so it updates when toggled
  const { settingsHandlers } = useNavigationHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;

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
              title="Advanced Mode"
              onPress={onAdvancedModeToggle}
              rightText={advancedMode ? 'ON' : 'OFF'}
            />
            <SettingsOption
              iconName="switch_account"
              title="Select Account"
              onPress={onSwitchAccount}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
});

// Individual settings option component
const SettingsOption = React.memo(function SettingsOption({ iconName, title, onPress, rightText }) {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress}>
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
