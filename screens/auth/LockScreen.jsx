/**
 * LockScreen Component
 * Handles PIN entry for authentication
 * Displayed when app is locked and user needs to authenticate
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { verifyPin } from '../../services/pinService';
import * as PasskeyService from '../../services/passkeyService';
import { ERRORS } from '../../utils/messages';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import styles from '../../styles';

export default function LockScreen({ onAuthenticated, showFaceIdButton, onFaceIdPress }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [showPasskeyButton, setShowPasskeyButton] = useState(false);
  const shakeAnimation = useState(new Animated.Value(0))[0];

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

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePinDigit = (digit) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 6) {
        // Verify PIN with rate limiting
        verifyPin(newPin).then((result) => {
          if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPin('');
            setPinError('');
            onAuthenticated();
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            shakeError();
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
      <Animated.View style={[styles.lockPinDots, { transform: [{ translateX: shakeAnimation }] }]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.lockPinDot, i < pin.length && styles.lockPinDotFilled]} />
        ))}
      </Animated.View>

      {/* Keypad */}
      <View style={styles.lockKeypad}>
        {[
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.lockKeypadRow}>
            {row.map((num) => (
              <TouchableScale
                key={num}
                style={styles.lockKey}
                onPress={() => handlePinDigit(String(num))}
              >
                <Text style={styles.lockKeyText}>{num}</Text>
              </TouchableScale>
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
          <TouchableScale style={styles.lockKey} onPress={() => handlePinDigit('0')}>
            <Text style={styles.lockKeyText}>0</Text>
          </TouchableScale>
          <TouchableScale style={styles.lockKey} onPress={handlePinDelete} haptic={false}>
            <Icon name="delete" size={28} color={COLORS.WHITE} />
          </TouchableScale>
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
