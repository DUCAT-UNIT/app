import React from 'react';
import PropTypes from 'prop-types';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import Icon from './icons';

export default function BottomNavigationBar({ activeTab, onVaultPress, onWalletPress }) {
  return (
    <View style={styles.container}>
      <View style={styles.tabButtonContainer}>
        <TouchableOpacity style={styles.tabButton} onPress={onVaultPress}>
          <Icon
            name="vault"
            size={24}
            color={activeTab === 'vault' ? COLORS.PRIMARY_BLUE : COLORS.SECONDARY_TEXT}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.tabButtonContainer}>
        <TouchableOpacity style={styles.tabButton} onPress={onWalletPress}>
          <Icon
            name="wallet"
            size={24}
            color={activeTab === 'wallet' ? COLORS.PRIMARY_BLUE : COLORS.SECONDARY_TEXT}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

BottomNavigationBar.propTypes = {
  activeTab: PropTypes.oneOf(['vault', 'wallet']).isRequired,
  onVaultPress: PropTypes.func.isRequired,
  onWalletPress: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    paddingHorizontal: 0,
    paddingVertical: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  tabButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    padding: 12,
  },
});
