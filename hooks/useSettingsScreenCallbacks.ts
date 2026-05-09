/**
 * useSettingsScreenCallbacks - Callbacks for navigating to settings sub-screens
 * Extracts the verbose navigation callbacks from WalletPage
 */

import { Alert } from 'react-native';
import type { ExtendedNavigation } from '../navigation/types';

interface SettingsHandlers {
  handleShowZeroAssetsToggle: () => void;
  handleNotificationsToggle: () => void;
  showZeroAssets: boolean;
  notificationsEnabled: boolean;
  handleFaceIdToggle: () => void;
  handleChangePin: () => void;
  handleViewSeedPhrase: () => void;
  handleDeleteWallet: () => void;
  handleAdvancedModeToggle: () => void;
  advancedMode: boolean;
  handleClearCashuCache: () => void;
  handleRecoverLockedChange: () => void;
  handleClearLockedTokens: () => void;
}

interface UseSettingsScreenCallbacksParams {
  navigation: ExtendedNavigation;
  settingsHandlers: SettingsHandlers;
  biometricEnabled: boolean;
  setShowAccountPicker: (value: boolean) => void;
  handleEcashThresholdPress: () => void;
}

interface UseSettingsScreenCallbacksReturn {
  handleViewPreferences: () => void;
  handleViewSecurity: () => void;
  handleViewAdvanced: () => void;
  handleViewCashuSettings: () => void;
  handleViewAbout: () => void;
}

/**
 * Create callbacks for settings screen navigation
 */
export function useSettingsScreenCallbacks({
  navigation,
  settingsHandlers,
  biometricEnabled,
  setShowAccountPicker,
  handleEcashThresholdPress,
}: UseSettingsScreenCallbacksParams): UseSettingsScreenCallbacksReturn {
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
      onViewSeedPhrase: settingsHandlers.handleViewSeedPhrase,
      onDeleteWallet: settingsHandlers.handleDeleteWallet,
      faceIdEnabled: biometricEnabled,
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
          const [unitCleanup, satCleanup] = await Promise.allSettled([
            removeSpentProofs('unit'),
            removeSpentProofs('sat'),
          ]);
          const unitResult = unitCleanup.status === 'fulfilled'
            ? unitCleanup.value
            : { removed: 0, kept: 0 };
          const satResult = satCleanup.status === 'fulfilled'
            ? satCleanup.value
            : { removed: 0, kept: 0 };
          const cleanupErrors = [unitCleanup, satCleanup]
            .filter((cleanup): cleanup is PromiseRejectedResult => cleanup.status === 'rejected')
            .map((cleanup) => cleanup.reason instanceof Error ? cleanup.reason.message : String(cleanup.reason));
          const result = {
            removed: unitResult.removed + satResult.removed,
            kept: unitResult.kept + satResult.kept,
          };
          Alert.alert(
            cleanupErrors.length > 0 ? 'Spent Proof Cleanup Partially Failed' : 'Spent Proofs Removed',
            cleanupErrors.length > 0
              ? `Removed ${result.removed} spent proofs. Kept ${result.kept} valid proofs. Errors: ${cleanupErrors.join('; ')}`
              : `Removed ${result.removed} spent proofs. Kept ${result.kept} valid proofs.`
          );
        } catch (error: unknown) {
          Alert.alert('Error', `Failed to remove spent proofs: ${error instanceof Error ? error.message : String(error)}`);
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
