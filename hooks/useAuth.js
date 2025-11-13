/**
 * useAuth Hook
 * Manages authentication state and flows including:
 * - Biometric authentication (FaceID/TouchID)
 * - PIN setup and verification
 * - Lock/unlock state
 * - Authentication callbacks
 */

import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';

export function useAuth({ onSeedConfirmed }) {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showFaceIdButton, setShowFaceIdButton] = useState(true);

  // PIN state
  const [settingUpPin, setSettingUpPin] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinStep, setPinStep] = useState('enter'); // 'enter' or 'confirm'

  // Check biometric support on mount
  useEffect(() => {
    const checkBiometricSupport = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
    };

    checkBiometricSupport();
  }, []);

  // Load biometric preference
  const loadBiometricPreference = async () => {
    try {
      const biometricPref = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
      setBiometricEnabled(biometricPref === 'true');
    } catch (error) {}
  };

  // Authenticate user with biometrics
  const authenticateUser = async () => {
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
      }
      // When biometric is disabled, do nothing (user should use PIN entry directly)
    } catch (error) {
      // On error, do nothing when biometric disabled (user should use PIN entry)
    }
  };

  // PIN setup completion for initial wallet creation
  const handlePinSetupComplete = () => {
    setIsAuthenticated(true);
    setSettingUpPin(false);
    if (onSeedConfirmed) {
      onSeedConfirmed(true);
    }
  };

  // PIN change completion
  const handlePinChangeComplete = () => {
    setSettingUpPin(false);
    setChangingPin(false);
  };

  // Lock screen authentication success
  const handleLockScreenAuthenticated = () => {
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
  };

  // Lock the wallet
  const lock = () => {
    setIsAuthenticated(false);
  };

  // Reset auth state (for wallet deletion)
  const resetAuth = () => {
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
  };

  // Start PIN change flow
  const startPinChange = async () => {
    setChangingPin(true);
    // Save flag to return to settings after PIN change
    await SecureStore.setItemAsync('returnToSettingsAfterPinChange', 'true');
    // Don't set settingUpPin yet - wait until after authentication
    setIsAuthenticated(false); // Lock wallet to trigger authentication
  };

  return {
    // State
    isAuthenticated,
    isBiometricSupported,
    biometricEnabled,
    showBiometricPrompt,
    showFaceIdButton,
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
    setShowPinEntry,
    setSettingUpPin,
    setChangingPin,
    setPin,
    setConfirmPin,
    setPinError,
    setPinStep,

    // Functions
    authenticateUser,
    handlePinSetupComplete,
    handlePinChangeComplete,
    handleLockScreenAuthenticated,
    loadBiometricPreference,
    lock,
    resetAuth,
    startPinChange,
  };
}
