// @ts-nocheck
/**
 * Tests for useSettingsScreenCallbacks hook
 */

import { Alert } from 'react-native';
import { useSettingsScreenCallbacks } from '../useSettingsScreenCallbacks';

// Mock react-native Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock cashuWalletService for dynamic import
const mockRemoveSpentProofs = jest.fn();
jest.mock('../../services/cashu/cashuWalletService', () => ({
  removeSpentProofs: (...args) => mockRemoveSpentProofs(...args),
}));

describe('useSettingsScreenCallbacks', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockSettingsHandlers = {
    handleShowZeroAssetsToggle: jest.fn(),
    handleNotificationsToggle: jest.fn(),
    showZeroAssets: true,
    notificationsEnabled: false,
    handleFaceIdToggle: jest.fn(),
    handleChangePin: jest.fn(),
    handleViewSeedPhrase: jest.fn(),
    handleDeleteWallet: jest.fn(),
    handleAdvancedModeToggle: jest.fn(),
    advancedMode: false,
    handleClearCashuCache: jest.fn(),
    handleRecoverLockedChange: jest.fn(),
    handleClearLockedTokens: jest.fn(),
  };

  const mockSetShowAccountPicker = jest.fn();
  const mockHandleEcashThresholdPress = jest.fn();

  let callbacks;

  beforeEach(() => {
    jest.clearAllMocks();
    callbacks = useSettingsScreenCallbacks({
      navigation: mockNavigation,
      settingsHandlers: mockSettingsHandlers,
      biometricEnabled: true,
      setShowAccountPicker: mockSetShowAccountPicker,
      handleEcashThresholdPress: mockHandleEcashThresholdPress,
    });
  });

  describe('handleViewPreferences', () => {
    it('should navigate to Preferences with correct params', () => {
      callbacks.handleViewPreferences();

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Preferences', {
        onClose: expect.any(Function),
        onShowZeroAssetsToggle: mockSettingsHandlers.handleShowZeroAssetsToggle,
        onNotificationsToggle: mockSettingsHandlers.handleNotificationsToggle,
        showZeroAssets: true,
        notificationsEnabled: false,
      });
    });

    it('should call goBack when onClose is called', () => {
      callbacks.handleViewPreferences();

      const navigateCall = mockNavigation.navigate.mock.calls[0];
      const params = navigateCall[1];

      params.onClose();

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('handleViewSecurity', () => {
    it('should navigate to Security with correct params', () => {
      callbacks.handleViewSecurity();

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Security', {
        onClose: expect.any(Function),
        onFaceIdToggle: mockSettingsHandlers.handleFaceIdToggle,
        onChangePin: mockSettingsHandlers.handleChangePin,
        onAutoLockToggle: expect.any(Function),
        onViewSeedPhrase: mockSettingsHandlers.handleViewSeedPhrase,
        onDeleteWallet: mockSettingsHandlers.handleDeleteWallet,
        faceIdEnabled: true,
        autoLockEnabled: false,
      });
    });

    it('should call goBack when onClose is called', () => {
      callbacks.handleViewSecurity();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onClose();

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should log info when onAutoLockToggle is called', () => {
      const { logger } = require('../../utils/logger');
      callbacks.handleViewSecurity();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onAutoLockToggle();

      expect(logger.info).toHaveBeenCalledWith('Auto lock toggle pressed - feature not yet available');
    });

    it('should use biometricEnabled value for faceIdEnabled', () => {
      // Test with biometricEnabled = false
      const callbacksDisabled = useSettingsScreenCallbacks({
        navigation: mockNavigation,
        settingsHandlers: mockSettingsHandlers,
        biometricEnabled: false,
        setShowAccountPicker: mockSetShowAccountPicker,
        handleEcashThresholdPress: mockHandleEcashThresholdPress,
      });

      callbacksDisabled.handleViewSecurity();

      const params = mockNavigation.navigate.mock.calls[0][1];
      expect(params.faceIdEnabled).toBe(false);
    });
  });

  describe('handleViewAdvanced', () => {
    it('should navigate to Advanced with correct params', () => {
      callbacks.handleViewAdvanced();

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Advanced', {
        onClose: expect.any(Function),
        onSwitchAccount: expect.any(Function),
        onAdvancedModeToggle: mockSettingsHandlers.handleAdvancedModeToggle,
        onEcashThresholdPress: mockHandleEcashThresholdPress,
        advancedMode: false,
      });
    });

    it('should call goBack when onClose is called', () => {
      callbacks.handleViewAdvanced();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onClose();

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should call goBack and show account picker when onSwitchAccount is called', () => {
      callbacks.handleViewAdvanced();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onSwitchAccount();

      expect(mockNavigation.goBack).toHaveBeenCalled();
      expect(mockSetShowAccountPicker).toHaveBeenCalledWith(true);
    });
  });

  describe('handleViewCashuSettings', () => {
    it('should navigate to CashuSettings with correct params', () => {
      callbacks.handleViewCashuSettings();

      expect(mockNavigation.navigate).toHaveBeenCalledWith('CashuSettings', {
        onClose: expect.any(Function),
        onClearCashuCache: mockSettingsHandlers.handleClearCashuCache,
        onRecoverLockedChange: mockSettingsHandlers.handleRecoverLockedChange,
        onClearLockedTokens: mockSettingsHandlers.handleClearLockedTokens,
        onRecoverMint: expect.any(Function),
        onRedeemToken: expect.any(Function),
        onRemoveSpentProofs: expect.any(Function),
      });
    });

    it('should call goBack when onClose is called', () => {
      callbacks.handleViewCashuSettings();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onClose();

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should navigate to RecoverMint when onRecoverMint is called', () => {
      callbacks.handleViewCashuSettings();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onRecoverMint();

      expect(mockNavigation.goBack).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('RecoverMint');
    });

    it('should navigate to CashuReceive when onRedeemToken is called', () => {
      callbacks.handleViewCashuSettings();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onRedeemToken();

      expect(mockNavigation.goBack).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('CashuReceive');
    });

    describe('onRemoveSpentProofs', () => {
      it('should handle onRemoveSpentProofs and show alert', async () => {
        callbacks.handleViewCashuSettings();
        const params = mockNavigation.navigate.mock.calls[0][1];

        // The dynamic import will fail in Jest test environment
        // This tests the error handling path (lines 87-88)
        await params.onRemoveSpentProofs();

        // Alert is called with Error title (due to dynamic import failing in Jest)
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to remove spent proofs')
        );
      });
    });
  });

  describe('handleViewAbout', () => {
    it('should navigate to About with correct params', () => {
      callbacks.handleViewAbout();

      expect(mockNavigation.navigate).toHaveBeenCalledWith('About', {
        onClose: expect.any(Function),
      });
    });

    it('should call goBack when onClose is called', () => {
      callbacks.handleViewAbout();

      const params = mockNavigation.navigate.mock.calls[0][1];
      params.onClose();

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    it('should return all callback functions', () => {
      expect(callbacks.handleViewPreferences).toBeDefined();
      expect(callbacks.handleViewSecurity).toBeDefined();
      expect(callbacks.handleViewAdvanced).toBeDefined();
      expect(callbacks.handleViewCashuSettings).toBeDefined();
      expect(callbacks.handleViewAbout).toBeDefined();
    });
  });
});
