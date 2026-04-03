/**
 * LockScreen Component
 * Handles PIN entry for authentication
 * Displayed when app is locked and user needs to authenticate
 */

import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React,{ memo,useCallback,useEffect,useRef,useState } from 'react';
import { Animated,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import TouchableScale from '../../components/common/TouchableScale';
import Icon from '../../components/icons';
import { useResponsive } from '../../hooks/useResponsive';
import * as PasskeyService from '../../services/passkey';
import { loadLockoutState,recordFailedAttempt } from '../../services/pinLockout';
import { checkPinLockout,verifyPin } from '../../services/pinService';
import { hasSessionMnemonic } from '../../services/secureStorageService';
import { colors,fonts,fontSizes,spacing } from '../../styles/theme';
import { COLORS } from '../../theme';
import { logger } from '../../utils/logger';
import { ERRORS } from '../../utils/messages';

/**
 * Props for the KeypadButton component
 */
interface KeypadButtonProps {
  /** The digit to display on the button (0-9) */
  digit: string;
  /** Callback invoked when the button is pressed */
  onPress: (digit: string) => void;
  /** Scaled size for the key */
  keySize: number;
  /** Scaled font size for the key text */
  fontSize: number;
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
const KeypadButton = memo(function KeypadButton({ digit, onPress, keySize, fontSize }: KeypadButtonProps): React.JSX.Element {
  const handlePress = useCallback(() => onPress(digit), [digit, onPress]);
  return (
    <TouchableScale style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]} onPress={handlePress} testID={`lock-keypad-${digit}`}>
      <Text style={[styles.lockKeyText, { fontSize }]}>{digit}</Text>
    </TouchableScale>
  );
});

export default function LockScreen({ onAuthenticated, showFaceIdButton, onFaceIdPress }: LockScreenProps): React.JSX.Element {
  const { s, sf } = useResponsive();
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

  const verifyingRef = useRef(false);

  const handlePinDigit = useCallback((digit: string): void => {
    setPin(currentPin => {
      if (currentPin.length >= 6) return currentPin;
      const newPin = currentPin + digit;
      if (newPin.length === 6 && !verifyingRef.current) {
        verifyingRef.current = true;
        // Move async work outside setState callback
        (async () => {
          try {
            const result = await verifyPin(newPin);
            if (result.success) {
              logger.auth('pin_verified_success');
              try {
                const isPasskeyEnabled = await PasskeyService.isPasskeyEnabled();
                if (isPasskeyEnabled && !hasSessionMnemonic()) {
                  await PasskeyService.unlockWithPasskey(newPin);
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setPin('');
                setPinError('');
                onAuthenticated();
              } catch (error: unknown) {
                logger.auth('passkey_session_unlock_failed', {
                  error: error instanceof Error ? error.message : String(error),
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                shakeError();
                setPinError(
                  error instanceof Error
                    ? error.message
                    : 'Passkey authentication failed. Please try again.'
                );
                setPin('');
              }
            } else {
              logger.auth('pin_verified_failed', {
                remainingAttempts: result.remainingAttempts,
                isLocked: (result as { isLocked?: boolean }).isLocked || false,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              shakeError();
              setPinError(result.error || ERRORS.INCORRECT_PIN);
              setPin('');
            }
          } finally {
            verifyingRef.current = false;
          }
        })();
      }
      return newPin;
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

      // SECURITY: Check lockout before passkey attempt to prevent brute-force via passkey path
      const lockStatus = await checkPinLockout();
      if (lockStatus.isLocked) {
        setPinError(`Too many failed attempts. Try again in ${lockStatus.remainingTime} minutes.`);
        setPin('');
        return;
      }

      await PasskeyService.unlockWithPasskey(pin);
      onAuthenticated();
    } catch (error: unknown) {
      // SECURITY: Record failed passkey attempt for rate limiting
      try {
        const { failedAttempts } = await loadLockoutState();
        await recordFailedAttempt(failedAttempts);
      } catch (lockoutError) {
        // If lockout recording fails, deny access (fail closed)
        setPinError('Unable to verify. Please try again.');
        setPin('');
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Passkey authentication failed';
      setPinError(errorMessage);
      setPin('');
    }
  }, [pin, onAuthenticated]);

  const keySize = s(76);
  const keyTextSize = sf(32);
  const iconSize = s(28);
  const dotSize = s(16);
  const dotGap = s(spacing.md);
  const keypadGap = s(32);
  const keypadMaxWidth = s(352);

  return (
    <View style={styles.lockScreen} testID="lock-screen">
      <StatusBar style="light" />

      {/* Title */}
      <Text style={[styles.lockTitle, { fontSize: sf(20), marginBottom: s(32), marginTop: s(20), paddingHorizontal: s(spacing.lg) }]} testID="lock-title">
        Enter PIN
      </Text>

      {/* PIN Error */}
      {pinError ? (
        <Text style={[styles.lockPinError, { fontSize: sf(fontSizes.md), marginBottom: s(20), paddingHorizontal: s(spacing.lg) }]} testID="lock-error">
          {pinError}
        </Text>
      ) : null}

      {/* PIN Dots */}
      <Animated.View style={[styles.lockPinDots, { transform: [{ translateX: shakeAnimation }], gap: dotGap, marginBottom: s(spacing.lg) }]} testID="lock-dots">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.lockPinDot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }, i < pin.length && styles.lockPinDotFilled]} testID={`lock-dot-${i}`} />
        ))}
      </Animated.View>

      {/* Keypad */}
      <View style={[styles.lockKeypad, { maxWidth: keypadMaxWidth, paddingHorizontal: s(spacing.lg), marginBottom: s(40) }]} testID="lock-keypad">
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.lockKeypadRow, { marginBottom: s(spacing.lg), gap: keypadGap }]}>
            {row.map((num) => (
              <KeypadButton key={num} digit={num} onPress={handlePinDigit} keySize={keySize} fontSize={keyTextSize} />
            ))}
          </View>
        ))}
        <View style={[styles.lockKeypadRow, { gap: keypadGap }]}>
          {/* FaceID / Passkey Button - Bottom Left */}
          {showPasskeyButton ? (
            <TouchableOpacity style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]} onPress={handlePasskeyUnlock} testID="lock-passkey-btn">
              <Icon name="face_id" size={s(32)} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          ) : showFaceIdButton && onFaceIdPress ? (
            <TouchableOpacity style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]} onPress={onFaceIdPress} testID="lock-faceid-btn">
              <Icon name="face_id" size={s(32)} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]} />
          )}
          <KeypadButton digit="0" onPress={handlePinDigit} keySize={keySize} fontSize={keyTextSize} />
          <TouchableScale style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]} onPress={handlePinDelete} haptic={false} testID="lock-keypad-delete">
            <Icon name="delete" size={iconSize} color={COLORS.WHITE} />
          </TouchableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  lockTitle: {
    fontFamily: fonts.regular,
    color: colors.text.primary,
    textAlign: 'center',
  },
  lockPinError: {
    color: colors.semantic.error,
    fontFamily: fonts.bold,
    fontWeight: 'bold' as const,
    textAlign: 'center',
  },
  lockPinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  lockPinDot: {
    backgroundColor: colors.bg.tertiary,
  },
  lockPinDotFilled: {
    backgroundColor: colors.text.primary,
  },
  lockKeypad: {
    width: '100%',
  },
  lockKeypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  lockKey: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  lockKeyText: {
    fontFamily: fonts.regular,
    color: colors.text.primary,
    fontWeight: '300' as const,
  },
});
