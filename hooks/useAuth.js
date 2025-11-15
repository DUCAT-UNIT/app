/**
 * useAuth Hook
 * Manages authentication state and flows including:
 * - Biometric authentication (FaceID/TouchID)
 * - PIN setup and verification
 * - Lock/unlock state
 * - Authentication callbacks
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import * as PasskeyService from '../services/passkeyService';

export function useAuth({ onSeedConfirmed }) {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showFaceIdButton, setShowFaceIdButton] = useState(true);

  // Passkey state
  const [isPasskeySupported, setIsPasskeySupported] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);

  // PIN state
  const [settingUpPin, setSettingUpPin] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinStep, setPinStep] = useState('enter'); // 'enter' or 'confirm'

  // Check biometric and passkey support on mount
  useEffect(() => {
    const checkAuthSupport = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);

      const passkeySupported = await PasskeyService.isPasskeySupported();
      setIsPasskeySupported(passkeySupported);
    };

    checkAuthSupport();
  }, []);

  // Load biometric preference
  const loadBiometricPreference = useCallback(async () => {
    try {
      const biometricPref = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
      setBiometricEnabled(biometricPref === 'true');
    } catch (error) {}
  }, []);

  // Load passkey preference
  const loadPasskeyPreference = useCallback(async () => {
    try {
      const passkeyPref = await PasskeyService.isPasskeyEnabled();
      setPasskeyEnabled(passkeyPref);
    } catch (error) {}
  }, []);

  // Authenticate with passkey
  const authenticateWithPasskey = useCallback(async () => {
    try {
      const { mnemonic, addresses } = await PasskeyService.unlockWithPasskey();
      if (mnemonic && addresses) {
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }, []);

  // Authenticate user with biometrics
  const authenticateUser = useCallback(async () => {
    try {
      // Check if user has already enabled biometric auth
      if (biometricEnabled) {
        // User has previously enabled biometrics, trigger it directly
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to access your wallet',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
        });

        if (result.success) {
          if (changingPin) {
            // User authenticated to change PIN, proceed to PIN setup
            setSettingUpPin(true);
            setPinStep('enter');
            setPin('');
            setConfirmPin('');
            setPinError('');
            // Stay authenticated but in PIN setup mode
            setIsAuthenticated(true);
          } else {
            // Normal unlock
            setIsAuthenticated(true);
          }
        }
      } else {
        // When biometric is not enabled, show the biometric prompt
        setShowBiometricPrompt(true);
      }
    } catch (error) {
      // On error, show biometric prompt so user can enable it
      setShowBiometricPrompt(true);
    }
  }, [biometricEnabled, changingPin]);

  // PIN setup completion for initial wallet creation
  const handlePinSetupComplete = useCallback(() => {
    setIsAuthenticated(true);
    setSettingUpPin(false);
    if (onSeedConfirmed) {
      onSeedConfirmed(true);
    }
  }, [onSeedConfirmed]);

  // PIN change completion
  const handlePinChangeComplete = useCallback(() => {
    setSettingUpPin(false);
    setChangingPin(false);
  }, []);

  // Lock screen authentication success
  const handleLockScreenAuthenticated = useCallback(() => {
    if (changingPin) {
      // User authenticated to change PIN, proceed to PIN setup
      setShowPinEntry(false); // Hide lock screen
      setSettingUpPin(true); // Show PIN setup screen
      setPinStep('enter');
      setPin('');
      setConfirmPin('');
      setPinError('');
      // Set authenticated to true so they can proceed, but settingUpPin keeps them in auth flow
      setIsAuthenticated(true);
    } else {
      // Normal unlock
      setIsAuthenticated(true);
      setShowPinEntry(false);
      // Restore FaceID button for next time
      setShowFaceIdButton(true);
    }
  }, [changingPin]);

  // Lock the wallet
  const lock = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  // Reset auth state (for wallet deletion)
  const resetAuth = useCallback(() => {
    setIsAuthenticated(false);
    setBiometricEnabled(false);
    setShowFaceIdButton(true);
    setShowBiometricPrompt(false);
    setSettingUpPin(false);
    setChangingPin(false);
    setShowPinEntry(false);
    setPin('');
    setConfirmPin('');
    setPinError('');
    setPinStep('enter');
  }, []);

  // Start PIN change flow
  const startPinChange = useCallback(async () => {
    setChangingPin(true);
    // Save flag to return to settings after PIN change
    await SecureStore.setItemAsync('returnToSettingsAfterPinChange', 'true');
    // Don't set settingUpPin yet - wait until after authentication
    setIsAuthenticated(false); // Lock wallet to trigger authentication
  }, []);

  // Memoize return object to prevent recreation on every render
  return useMemo(
    () => ({
      // State
      isAuthenticated,
      isBiometricSupported,
      biometricEnabled,
      showBiometricPrompt,
      showFaceIdButton,
      isPasskeySupported,
      passkeyEnabled,
      showPasskeyPrompt,
      settingUpPin,
      changingPin,
      showPinEntry,
      pin,
      confirmPin,
      pinError,
      pinStep,

      // Setters
      setIsAuthenticated,
      setBiometricEnabled,
      setShowBiometricPrompt,
      setShowFaceIdButton,
      setPasskeyEnabled,
      setShowPasskeyPrompt,
      setShowPinEntry,
      setSettingUpPin,
      setChangingPin,
      setPin,
      setConfirmPin,
      setPinError,
      setPinStep,

      // Functions
      authenticateUser,
      authenticateWithPasskey,
      handlePinSetupComplete,
      handlePinChangeComplete,
      handleLockScreenAuthenticated,
      loadBiometricPreference,
      loadPasskeyPreference,
      lock,
      resetAuth,
      startPinChange,
    }),
    [
      isAuthenticated,
      isBiometricSupported,
      biometricEnabled,
      showBiometricPrompt,
      showFaceIdButton,
      isPasskeySupported,
      passkeyEnabled,
      showPasskeyPrompt,
      settingUpPin,
      changingPin,
      showPinEntry,
      pin,
      confirmPin,
      pinError,
      pinStep,
      authenticateUser,
      authenticateWithPasskey,
      handlePinSetupComplete,
      handlePinChangeComplete,
      handleLockScreenAuthenticated,
      loadBiometricPreference,
      loadPasskeyPreference,
      lock,
      resetAuth,
      startPinChange,
    ]
  );
}
