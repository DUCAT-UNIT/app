/**
 * LockScreen Component
 * Handles PIN entry for authentication
 * Displayed when app is locked and user needs to authenticate
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Text, View, TouchableOpacity, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { verifyPin } from '../../services/pinService';
import * as PasskeyService from '../../services/passkey';
import { ERRORS } from '../../utils/messages';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import styles from '../../styles';
import logger from '../../utils/logger';

/**
 * Props for the KeypadButton component
 */
interface KeypadButtonProps {
  /** The digit to display on the button (0-9) */
  digit: string;
  /** Callback invoked when the button is pressed */
  onPress: (digit: string) => void;
}

/**
 * Props for the LockScreen component
 */
interface LockScreenProps {
  /** Callback invoked when the user successfully authenticates with their PIN */
  onAuthenticated: () => void;
  /** Whether to show the Face ID/Touch ID button in the bottom-left of the keypad */
  showFaceIdButton?: boolean;
  /** Callback invoked when the Face ID/Touch ID button is pressed */
  onFaceIdPress?: () => void;
}

// Memoized keypad button component
const KeypadButton = memo(function KeypadButton({ digit, onPress }: KeypadButtonProps): React.JSX.Element {
  const handlePress = useCallback(() => onPress(digit), [digit, onPress]);
  return (
    <TouchableScale style={styles.lockKey} onPress={handlePress} testID={`lock-keypad-${digit}`}>
      <Text style={styles.lockKeyText}>{digit}</Text>
    </TouchableScale>
  );
});

export default function LockScreen({ onAuthenticated, showFaceIdButton, onFaceIdPress }: LockScreenProps): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [, setPasskeyEnabled] = useState(false);
  const [showPasskeyButton, setShowPasskeyButton] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Check if passkey is enabled on mount
  useEffect(() => {
    const checkPasskey = async () => {
      const enabled = await PasskeyService.isPasskeyEnabled();
      setPasskeyEnabled(enabled);
      setShowPasskeyButton(false);
    };
    checkPasskey();
  }, []);

  const shakeError = useCallback((): void => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const handlePinDigit = useCallback((digit: string): void => {
    setPin(currentPin => {
      if (currentPin.length < 6) {
        const newPin = currentPin + digit;
        if (newPin.length === 6) {
          // Verify PIN with rate limiting
          verifyPin(newPin).then((result) => {
            if (result.success) {
              logger.auth('pin_verified_success');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setPin('');
              setPinError('');
              onAuthenticated();
            } else {
              logger.auth('pin_verified_failed', {
                remainingAttempts: result.remainingAttempts,
                isLocked: (result as { isLocked?: boolean }).isLocked || false,
              });
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
        return newPin;
      }
      return currentPin;
    });
  }, [onAuthenticated, shakeError]);

  const handlePinDelete = useCallback((): void => {
    setPin(currentPin => currentPin.slice(0, -1));
    setPinError('');
  }, []);

  const handlePasskeyUnlock = useCallback(async (): Promise<void> => {
    try {
      setPinError('');

      if (pin.length !== 6) {
        setPinError('Enter your 6-digit PIN for passkey recovery');
        return;
      }

      await PasskeyService.unlockWithPasskey(pin);
      onAuthenticated();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Passkey authentication failed';
      setPinError(errorMessage);
      setPin('');
    }
  }, [pin, onAuthenticated]);

  return (
    <View style={styles.lockScreen} testID="lock-screen">
      <StatusBar style="light" />

      {/* Title */}
      <Text style={styles.lockTitle} testID="lock-title">Enter PIN</Text>

      {/* PIN Error */}
      {pinError ? <Text style={styles.lockPinError} testID="lock-error">{pinError}</Text> : null}

      {/* PIN Dots */}
      <Animated.View style={[styles.lockPinDots, { transform: [{ translateX: shakeAnimation }] }]} testID="lock-dots">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.lockPinDot, i < pin.length && styles.lockPinDotFilled]} testID={`lock-dot-${i}`} />
        ))}
      </Animated.View>

      {/* Keypad */}
      <View style={styles.lockKeypad} testID="lock-keypad">
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.lockKeypadRow}>
            {row.map((num) => (
              <KeypadButton key={num} digit={num} onPress={handlePinDigit} />
            ))}
          </View>
        ))}
        <View style={styles.lockKeypadRow}>
          {/* FaceID / Passkey Button - Bottom Left */}
          {showPasskeyButton ? (
            <TouchableOpacity style={styles.lockKey} onPress={handlePasskeyUnlock} testID="lock-passkey-btn">
              <Icon name="face_id" size={32} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          ) : showFaceIdButton && onFaceIdPress ? (
            <TouchableOpacity style={styles.lockKey} onPress={onFaceIdPress} testID="lock-faceid-btn">
              <Icon name="face_id" size={32} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          ) : (
            <View style={styles.lockKey} />
          )}
          <KeypadButton digit="0" onPress={handlePinDigit} />
          <TouchableScale style={styles.lockKey} onPress={handlePinDelete} haptic={false} testID="lock-keypad-delete">
            <Icon name="delete" size={28} color={COLORS.WHITE} />
          </TouchableScale>
        </View>
      </View>
    </View>
  );
}
