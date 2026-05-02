/**
 * usePasskeyBiometricFlow Hook
 *
 * Manages passkey migration and biometric setup modals.
 * Extracted from NavigationHandlersContext to reduce cognitive load.
 */

import { useCallback, useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { setBiometricEnabled as persistBiometricEnabled } from '../services/biometricService';
import { isPasskeyUpgradeRecommended } from '../services/passkey';
import { logger } from '../utils/logger';

interface PasskeyMigrationData {
  currentPin?: string | null;
  mode: 'import' | 'upgrade';
}

interface UsePasskeyBiometricFlowParams {
  passkeyEnabled: boolean;
  setBiometricEnabled: (value: boolean) => void;
  setIsAuthenticated: (value: boolean) => void;
}

interface UsePasskeyBiometricFlowReturn {
  // Passkey migration
  showPasskeyMigrationModal: boolean;
  passkeyMigrationData: PasskeyMigrationData | null;
  passkeyUpgradeRecommended: boolean;
  showPasskeyMigrationPrompt: (currentPin: string) => void;
  showPasskeyUpgradePrompt: () => void;
  hidePasskeyMigrationPrompt: () => void;
  handlePasskeyUpgradeComplete: () => void;

  // Biometric setup
  showBiometricSetupModal: boolean;
  showBiometricSetupPrompt: () => void;
  hideBiometricSetupPrompt: () => void;
  handleBiometricSetupEnable: () => Promise<void>;
  handleBiometricSetupSkip: () => Promise<void>;

  // Lock helper (dismisses all modals)
  dismissAllModals: () => void;
}

export function usePasskeyBiometricFlow({
  passkeyEnabled,
  setBiometricEnabled,
  setIsAuthenticated,
}: UsePasskeyBiometricFlowParams): UsePasskeyBiometricFlowReturn {
  const [showPasskeyMigrationModal, setShowPasskeyMigrationModal] = useState(false);
  const [passkeyMigrationData, setPasskeyMigrationData] = useState<PasskeyMigrationData | null>(null);
  const [showBiometricSetupModal, setShowBiometricSetupModal] = useState(false);
  const [passkeyUpgradeRecommended, setPasskeyUpgradeRecommended] = useState(false);

  // Check if passkey upgrade is recommended
  useEffect(() => {
    let cancelled = false;

    if (!passkeyEnabled) {
      setPasskeyUpgradeRecommended(false);
      return () => { cancelled = true; };
    }

    const check = async () => {
      try {
        const recommended = await isPasskeyUpgradeRecommended();
        if (!cancelled) setPasskeyUpgradeRecommended(recommended);
      } catch (error: unknown) {
        logger.warn('[usePasskeyBiometricFlow] Failed to check passkey upgrade', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) setPasskeyUpgradeRecommended(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [passkeyEnabled]);

  // Dismiss all modals (used when locking the app)
  const dismissAllModals = useCallback(() => {
    Keyboard.dismiss();
    setShowPasskeyMigrationModal(false);
    setPasskeyMigrationData(null);
    setShowBiometricSetupModal(false);
  }, []);

  // Passkey migration
  const showPasskeyMigrationPrompt = useCallback((currentPin: string) => {
    setPasskeyMigrationData({ currentPin, mode: 'import' });
    setShowPasskeyMigrationModal(true);
  }, []);

  const showPasskeyUpgradePrompt = useCallback(() => {
    setPasskeyMigrationData({ mode: 'upgrade' });
    setShowPasskeyMigrationModal(true);
  }, []);

  const hidePasskeyMigrationPrompt = useCallback(() => {
    setShowPasskeyMigrationModal(false);
    setPasskeyMigrationData(null);
  }, []);

  const handlePasskeyUpgradeComplete = useCallback(() => {
    setPasskeyUpgradeRecommended(false);
  }, []);

  // Biometric setup
  const showBiometricSetupPrompt = useCallback(() => {
    setShowBiometricSetupModal(true);
  }, []);

  const hideBiometricSetupPrompt = useCallback(() => {
    setShowBiometricSetupModal(false);
  }, []);

  const handleBiometricSetupEnable = useCallback(async () => {
    try {
      await persistBiometricEnabled(true);
      setBiometricEnabled(true);

      await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use PIN instead',
      });

      setShowBiometricSetupModal(false);
    } catch {
      setShowBiometricSetupModal(false);
    }
  }, [setBiometricEnabled]);

  const handleBiometricSetupSkip = useCallback(async () => {
    setShowBiometricSetupModal(false);
    setBiometricEnabled(false);
    await persistBiometricEnabled(false);
  }, [setBiometricEnabled]);

  return {
    showPasskeyMigrationModal,
    passkeyMigrationData,
    passkeyUpgradeRecommended,
    showPasskeyMigrationPrompt,
    showPasskeyUpgradePrompt,
    hidePasskeyMigrationPrompt,
    handlePasskeyUpgradeComplete,
    showBiometricSetupModal,
    showBiometricSetupPrompt,
    hideBiometricSetupPrompt,
    handleBiometricSetupEnable,
    handleBiometricSetupSkip,
    dismissAllModals,
  };
}
