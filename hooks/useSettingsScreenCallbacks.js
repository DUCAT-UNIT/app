/**
 * useSettingsScreenCallbacks - Callbacks for navigating to settings sub-screens
 * Extracts the verbose navigation callbacks from WalletPage
 */

import { Alert } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Create callbacks for settings screen navigation
 * @param {Object} params - Parameters
 * @param {Object} params.navigation - React Navigation object
 * @param {Object} params.settingsHandlers - Settings handlers from context
 * @param {boolean} params.biometricEnabled - Whether biometric auth is enabled
 * @param {Function} params.setShowAccountPicker - Function to show account picker
 * @param {Function} params.handleEcashThresholdPress - Handler for ecash threshold press
 * @returns {Object} Callbacks for each settings sub-screen
 */
export function useSettingsScreenCallbacks({
  navigation,
  settingsHandlers,
  biometricEnabled,
  setShowAccountPicker,
  handleEcashThresholdPress,
}) {
  const handleViewPreferences = () => {
    navigation.navigate('Preferences', {
      onClose: () => navigation.goBack(),
      onShowZeroAssetsToggle: settingsHandlers.handleShowZeroAssetsToggle,
      onNotificationsToggle: settingsHandlers.handleNotificationsToggle,
      showZeroAssets: settingsHandlers.showZeroAssets,
      notificationsEnabled: settingsHandlers.notificationsEnabled,
    });
  };

  const handleViewSecurity = () => {
    navigation.navigate('Security', {
      onClose: () => navigation.goBack(),
      onFaceIdToggle: settingsHandlers.handleFaceIdToggle,
      onChangePin: settingsHandlers.handleChangePin,
      onAutoLockToggle: () => {
        // TODO: Implement auto lock toggle
        logger.debug('Auto lock toggle pressed');
      },
      onViewSeedPhrase: settingsHandlers.handleViewSeedPhrase,
      onDeleteWallet: settingsHandlers.handleDeleteWallet,
      faceIdEnabled: biometricEnabled,
      autoLockEnabled: false,
    });
  };

  const handleViewAdvanced = () => {
    navigation.navigate('Advanced', {
      onClose: () => navigation.goBack(),
      onSwitchAccount: () => {
        navigation.goBack();
        setShowAccountPicker(true);
      },
      onAdvancedModeToggle: settingsHandlers.handleAdvancedModeToggle,
      onEcashThresholdPress: handleEcashThresholdPress,
      advancedMode: settingsHandlers.advancedMode,
    });
  };

  const handleViewCashuSettings = () => {
    navigation.navigate('CashuSettings', {
      onClose: () => navigation.goBack(),
      onClearCashuCache: settingsHandlers.handleClearCashuCache,
      onRecoverLockedChange: settingsHandlers.handleRecoverLockedChange,
      onClearLockedTokens: settingsHandlers.handleClearLockedTokens,
      onRecoverMint: () => {
        navigation.goBack();
        navigation.navigate('RecoverMint');
      },
      onRedeemToken: () => {
        navigation.goBack();
        navigation.navigate('CashuReceive');
      },
      onRemoveSpentProofs: async () => {
        try {
          const { removeSpentProofs } = await import('../services/cashu/cashuWalletService');
          const result = await removeSpentProofs();
          Alert.alert(
            'Spent Proofs Removed',
            `Removed ${result.removed} spent proofs. Kept ${result.kept} valid proofs.`
          );
        } catch (error) {
          Alert.alert('Error', `Failed to remove spent proofs: ${error.message}`);
        }
      },
    });
  };

  const handleViewAbout = () => {
    navigation.navigate('About', {
      onClose: () => navigation.goBack(),
    });
  };

  return {
    handleViewPreferences,
    handleViewSecurity,
    handleViewAdvanced,
    handleViewCashuSettings,
    handleViewAbout,
  };
}
