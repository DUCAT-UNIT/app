/**
 * LockScreen Component
 * Handles PIN entry for authentication
 * Displayed when app is locked and user needs to authenticate
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { verifyPin } from '../../services/pinService';
import * as PasskeyService from '../../services/passkeyService';
import { ERRORS } from '../../utils/messages';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import styles from '../../styles';

export default function LockScreen({ onAuthenticated, showFaceIdButton, onFaceIdPress }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [showPasskeyButton, setShowPasskeyButton] = useState(false);

  // Check if passkey is enabled on mount
  useEffect(() => {
    const checkPasskey = async () => {
      const enabled = await PasskeyService.isPasskeyEnabled();
      setPasskeyEnabled(enabled);
      // Don't show passkey button on normal lock screen
      // Passkey unlock is only for recovery scenarios (separate screen)
      setShowPasskeyButton(false);
    };
    checkPasskey();
  }, []);

  const handlePinDigit = (digit) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 6) {
        // Verify PIN with rate limiting
        verifyPin(newPin).then((result) => {
          if (result.success) {
            setPin('');
            setPinError('');
            onAuthenticated();
          } else {
            const errorMsg = result.error || ERRORS.INCORRECT_PIN;
            const attemptsMsg = result.remainingAttempts
              ? ` (${result.remainingAttempts} attempts remaining)`
              : '';
            setPinError(errorMsg + attemptsMsg);
            setPin('');
          }
        });
      }
    }
  };

  const handlePinDelete = () => {
    setPin(pin.slice(0, -1));
    setPinError('');
  };

  const handlePasskeyUnlock = async () => {
    try {
      setPinError('');

      // Passkey unlock is only for recovery scenarios
      // For normal unlock, users should use PIN only
      // This allows passkey + PIN authentication for iCloud recovery
      if (pin.length !== 6) {
        setPinError('Enter your 6-digit PIN for passkey recovery');
        return;
      }

      await PasskeyService.unlockWithPasskey(pin);
      onAuthenticated();
    } catch (error) {
      setPinError(error.message || 'Passkey authentication failed');
      setPin(''); // Clear PIN on error
    }
  };

  return (
    <View style={styles.lockScreen}>
      <StatusBar style="light" />

      {/* Title */}
      <Text style={styles.lockTitle}>Enter PIN</Text>

      {/* PIN Error */}
      {pinError ? <Text style={styles.lockPinError}>{pinError}</Text> : null}

      {/* PIN Dots */}
      <View style={styles.lockPinDots}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.lockPinDot, i < pin.length && styles.lockPinDotFilled]} />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.lockKeypad}>
        {[
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.lockKeypadRow}>
            {row.map((num) => (
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
          {/* FaceID / Passkey Button - Bottom Left */}
          {showPasskeyButton ? (
            <TouchableOpacity style={styles.lockKey} onPress={handlePasskeyUnlock}>
              <Icon name="face_id" size={32} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          ) : showFaceIdButton && onFaceIdPress ? (
            <TouchableOpacity style={styles.lockKey} onPress={onFaceIdPress}>
              <Icon name="face_id" size={32} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          ) : (
            <View style={styles.lockKey} />
          )}
          <TouchableOpacity style={styles.lockKey} onPress={() => handlePinDigit('0')}>
            <Text style={styles.lockKeyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockKey} onPress={handlePinDelete}>
            <Icon name="delete" size={28} color={COLORS.WHITE} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

LockScreen.propTypes = {
  onAuthenticated: PropTypes.func.isRequired,
  showFaceIdButton: PropTypes.bool,
  onFaceIdPress: PropTypes.func,
};
