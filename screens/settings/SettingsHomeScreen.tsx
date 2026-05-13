/**
 * SettingsHomeScreen
 * Root-stack settings menu so the native tab bar is not present underneath.
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import EcashConversionModal from '../../components/settings/EcashConversionModal';
import MutinynetBanner from '../../components/MutinynetBanner';
import { useCashu } from '../../contexts/CashuContext';
import {
  useAccountSwitcherContext,
  useSettingsHandlers,
} from '../../contexts/NavigationHandlersContext';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { useEcashThresholdManager } from '../../hooks/useEcashThresholdManager';
import { useSettingsScreenCallbacks } from '../../hooks/useSettingsScreenCallbacks';
import type { ExtendedNavigation } from '../../navigation/types';
import { COLORS } from '../../theme';
import SettingsScreen from './SettingsScreen';

export default function SettingsHomeScreen(): React.ReactElement {
  const navigation = useNavigation<ExtendedNavigation>();
  const { settingsHandlers, biometricEnabled } = useSettingsHandlers();
  const { setShowAccountPicker } = useAccountSwitcherContext();
  const { balance: cashuBalance } = useCashu();
  const { runesBalance } = useBalance();
  const { wallet } = useWallet();

  const closeSettings = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const {
    showConversionModal,
    conversionAmount,
    savedUnitBalance,
    pendingThreshold,
    setShowConversionModal,
    handleEcashThresholdPress,
    handleConfirmConversion,
  } = useEcashThresholdManager({
    cashuBalance,
    runesBalance,
    settingsHandlers,
    showSettings: true,
    closeSettings,
    lowBalanceAmountNeeded: 0,
    closeLowBalanceModal: () => undefined,
    senderTaprootAddress: wallet?.taprootAddress,
  });

  const {
    handleViewPreferences,
    handleViewSecurity,
    handleViewAdvanced,
    handleViewCashuSettings,
    handleViewAbout,
  } = useSettingsScreenCallbacks({
    navigation,
    settingsHandlers,
    biometricEnabled,
    setShowAccountPicker,
    handleEcashThresholdPress,
  });

  return (
    <View style={styles.container}>
      <MutinynetBanner />
      <SettingsScreen
        onClose={closeSettings}
        onLockWallet={settingsHandlers.handleLogout}
        onViewPreferences={handleViewPreferences}
        onViewSecurity={handleViewSecurity}
        onViewAdvanced={handleViewAdvanced}
        onViewCashuSettings={handleViewCashuSettings}
        onViewAbout={handleViewAbout}
        advancedMode={settingsHandlers.advancedMode}
      />
      <EcashConversionModal
        visible={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        onConfirm={handleConfirmConversion}
        amountToConvert={conversionAmount}
        unitBalance={savedUnitBalance}
        newThreshold={pendingThreshold || 100}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
});
