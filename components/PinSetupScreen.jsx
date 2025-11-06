/**
 * PinSetupScreen Component
 * Handles PIN creation, confirmation, and biometric setup prompt
 * Used after wallet creation or import (Step 4 of onboarding)
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as AuthService from '../services/authService';
import { SECURE_KEYS } from '../utils/constants';
import styles from '../styles';

export default function PinSetupScreen({
  // State
  changingPin,
  isBiometricSupported,

  // Callbacks
  onPinSetupComplete,
  onPinChangeComplete,
  fetchBalance,
  showToast,
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState('enter'); // 'enter' or 'confirm'
  const [pinError, setPinError] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  const handlePinDigit = (digit) => {
    if (pinStep === 'enter') {
      if (pin.length < 6) {
        const newPin = pin + digit;
        setPin(newPin);
        if (newPin.length === 6) {
          // Move to confirmation step
          setPinStep('confirm');
          setPinError('');
        }
      }
    } else {
      // Confirmation step
      if (confirmPin.length < 6) {
        const newConfirmPin = confirmPin + digit;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === 6) {
          // Check if PINs match
          if (newConfirmPin === pin) {
            // Save PIN and finish setup
            AuthService.savePin(pin).then(success => {
              if (success) {
                if (changingPin) {
                  // Just changing PIN, not creating wallet
                  showToast('Your PIN has been changed');
                  onPinChangeComplete();
                } else {
                  // Initial wallet creation or import
                  if (isBiometricSupported) {
                    setShowBiometricPrompt(true);
                  } else {
                    // No biometric support, complete setup
                    onPinSetupComplete();
                  }
                  // Fetch balance in background
                  if (fetchBalance) {
                    fetchBalance();
                  }
                }
              } else {
                setPinError('Failed to save PIN');
                // Reset entire PIN process
                setPin('');
                setConfirmPin('');
                setPinStep('enter');
              }
            });
          } else {
            setPinError('PINs do not match');
            // Reset entire PIN process so user starts fresh
            setPin('');
            setConfirmPin('');
            setPinStep('enter');
          }
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (pinStep === 'enter') {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
    setPinError('');
  };

  const handleBiometricEnable = async () => {
    setShowBiometricPrompt(false);
    try {
      // Save the preference
      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');

      // Trigger biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use PIN instead',
      });

      // Complete setup regardless of biometric result
      onPinSetupComplete();
    } catch (error) {
      console.log('Biometric auth error:', error);
      onPinSetupComplete();
    }
  };

  const handleBiometricSkip = async () => {
    setShowBiometricPrompt(false);
    // Save the preference as disabled
    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'false');
    onPinSetupComplete();
  };

  const currentPin = pinStep === 'confirm' ? confirmPin : pin;

  return (
    <>
      <View style={styles.lockScreen}>
        <StatusBar style="light" />

        {/* Title */}
        <Text style={styles.lockTitle}>
          {changingPin
            ? (pinStep === 'enter' ? 'Enter New PIN' : 'Confirm New PIN')
            : (pinStep === 'enter' ? 'Enter 6-Digit PIN' : 'Confirm Your PIN')}
        </Text>

        {/* PIN Error */}
        {pinError ? <Text style={styles.lockPinError}>{pinError}</Text> : null}

        {/* PIN Dots */}
        <View style={styles.lockPinDots}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.lockPinDot,
                i < currentPin.length && styles.lockPinDotFilled
              ]}
            />
          ))}
        </View>

        {/* Keypad */}
        <View style={styles.lockKeypad}>
          {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.lockKeypadRow}>
              {row.map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.lockKey}
                  onPress={() => handlePinDigit(String(num))}
                >
                  <Text style={styles.lockKeyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.lockKeypadRow}>
            <View style={styles.lockKey} />
            <TouchableOpacity
              style={styles.lockKey}
              onPress={() => handlePinDigit('0')}
            >
              <Text style={styles.lockKeyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.lockKey}
              onPress={handlePinDelete}
            >
              <Text style={styles.lockKeyText}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Biometric Authentication Prompt */}
      {showBiometricPrompt && (
        <View style={styles.modalOverlay}>
          <View style={styles.biometricPromptModal}>
            <Text style={styles.biometricPromptTitle}>Biometric Authentication</Text>
            <Text style={styles.biometricPromptText}>
              Do you want to use biometric authentication (FaceID or TouchID) for UNIT Wallet?
            </Text>
            <View style={styles.biometricPromptButtons}>
              <TouchableOpacity
                style={[styles.biometricPromptButton, styles.biometricPromptButtonYes]}
                onPress={handleBiometricEnable}
              >
                <Text style={styles.biometricPromptButtonText}>Yes, Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.biometricPromptButton, styles.biometricPromptButtonNo]}
                onPress={handleBiometricSkip}
              >
                <Text style={styles.biometricPromptButtonTextNo}>No, Thanks</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

PinSetupScreen.propTypes = {
  changingPin: PropTypes.bool.isRequired,
  isBiometricSupported: PropTypes.bool.isRequired,
  onPinSetupComplete: PropTypes.func.isRequired,
  onPinChangeComplete: PropTypes.func.isRequired,
  fetchBalance: PropTypes.func.isRequired,
  showToast: PropTypes.func.isRequired,
};
