/**
 * MainTabs - Bottom tab navigation for authenticated app
 * Tabs: Wallet, Vault
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import WalletPage from '../pages/WalletPage';
import { COLORS } from '../utils/colors';

const Tab = createBottomTabNavigator();

export default function MainTabs({
  styles,
  resetInactivityTimer,
  handleOpenVault,
  vaultCredentials,
  autoCreateVaultTrigger,
  amountInputRef,
  setShowAccountPicker,
  settingsHandlers,
  biometricEnabled,
  activeTab,
  setActiveTab,
  keyboardHeight,
}) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // We'll use custom BottomNavigationBar component
        tabBarActiveTintColor: COLORS.BRIGHT_ORANGE,
        tabBarInactiveTintColor: COLORS.MEDIUM_GRAY,
      }}
    >
      <Tab.Screen name="WalletTab">
        {(props) => (
          <WalletPage
            {...props}
            styles={styles}
            resetInactivityTimer={resetInactivityTimer}
            handleOpenVault={handleOpenVault}
            vaultCredentials={vaultCredentials}
            autoCreateVaultTrigger={autoCreateVaultTrigger}
            amountInputRef={amountInputRef}
            setShowAccountPicker={setShowAccountPicker}
            settingsHandlers={settingsHandlers}
            biometricEnabled={biometricEnabled}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            keyboardHeight={keyboardHeight}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
