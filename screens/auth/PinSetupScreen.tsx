/**
 * PinSetupScreen Component
 * Handles PIN creation, confirmation, and biometric setup prompt
 * Used after wallet creation or import (Step 4 of onboarding)
 */

import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React,{ memo,useCallback,useRef,useState } from 'react';
import { Animated,Pressable,ScrollView,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import Icon from '../../components/icons';
import { useResponsive } from '../../hooks/useResponsive';
import { analytics } from '../../services/analyticsService';
import { ONBOARDING_EVENTS } from '../../constants/analyticsEvents';
import {
  authenticateWithBiometrics,
  setBiometricEnabled as persistBiometricEnabled,
} from '../../services/biometricService';
import { savePin } from '../../services/pinService';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';
import { COLORS } from '../../theme';
import { logger } from '../../utils/logger';
import { ERRORS } from '../../utils/messages';
import { notify } from '../../utils/notify';

/**
 * Type for the PIN setup step
 */
type PinStep = 'enter' | 'confirm';

/**
 * Props for the PinSetupScreen component
 */
interface PinSetupScreenProps {
  /** Whether the user is changing an existing PIN (vs. creating new PIN during onboarding) */
  changingPin: boolean;
  /** Whether biometric authentication (Face ID/Touch ID) is supported on this device */
  isBiometricSupported: boolean;
  /** Callback invoked when PIN setup is complete, receives the PIN for passkey migration */
  onPinSetupComplete: (pin: string) => void;
  /** Callback invoked when PIN change is complete */
  onPinChangeComplete: () => void;
  /** Optional callback invoked when user cancels the PIN setup process */
  onCancel?: () => void;
  /** Callback to fetch wallet balance after PIN setup */
  fetchBalance: () => void;
}

interface KeypadButtonProps {
  digit: string;
  onPress: (digit: string) => void;
  keySize: number;
  fontSize: number;
}

const KeypadButton = memo(function KeypadButton({ digit, onPress, keySize, fontSize }: KeypadButtonProps): React.JSX.Element {
  const handlePress = useCallback(() => onPress(digit), [digit, onPress]);
  return (
    <Pressable
      style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]}
      onPressIn={handlePress}
      hitSlop={8}
      testID={`pin-keypad-${digit}`}
    >
      <Text style={[styles.lockKeyText, { fontSize }]}>{digit}</Text>
    </Pressable>
  );
});

export default function PinSetupScreen({
  // State
  changingPin,
  isBiometricSupported,

  // Callbacks
  onPinSetupComplete,
  onPinChangeComplete,
  onCancel,
  fetchBalance,
}: PinSetupScreenProps): React.JSX.Element {
  const { s, sf } = useResponsive();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<PinStep>('enter');
  const [pinError, setPinError] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const shakeAnimation = useState(new Animated.Value(0))[0];
  const pinRef = useRef('');
  const confirmPinRef = useRef('');

  const shakeError = (): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePinDigit = async (digit: string): Promise<void> => {
    if (pinStep === 'enter') {
      if (pinRef.current.length < 6) {
        const newPin = pinRef.current + digit;
        pinRef.current = newPin;
        setPin(newPin);
        if (newPin.length === 6) {
          // Move to confirmation step
          setPinStep('confirm');
          setPinError('');
        }
      }
    } else {
      // Confirmation step
      if (confirmPinRef.current.length < 6) {
        const newConfirmPin = confirmPinRef.current + digit;
        confirmPinRef.current = newConfirmPin;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === 6) {
          // Check if PINs match
          if (newConfirmPin === pinRef.current) {
            // Save PIN and finish setup
            if (changingPin) {
              // Use atomic PIN change operation to prevent lockout
              const PasskeyService = await import('../../services/passkey');
              const result = await PasskeyService.atomicPinChangeWithPasskey(pinRef.current);

              if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                notify.pin.changed();
                onPinChangeComplete();
              } else {
                shakeError();
                setPinError(result.error || 'Failed to change PIN');
                setPin('');
                setConfirmPin('');
                setPinStep('enter');
              }
            } else {
              // Initial wallet creation - just save PIN normally
              savePin(pinRef.current).then(async (success) => {
                logger.auth('savePin result', { success, isBiometricSupported });
                if (success) {
                  // Initial wallet creation or import
                  logger.auth('PIN saved successfully, checking biometric support', { isBiometricSupported });
                  if (isBiometricSupported) {
                    logger.auth('Showing biometric prompt - setting showBiometricPrompt to true');
                    setShowBiometricPrompt(true);
                  } else {
                    // No biometric support, complete setup
                    logger.auth('No biometric support (isBiometricSupported=false), completing setup without prompt');
                    // Pass the PIN back to parent for potential passkey migration
                    onPinSetupComplete(pinRef.current);
                  }
                  // Fetch balance in background
                  if (fetchBalance) {
                    fetchBalance();
                  }
                } else {
                  shakeError();
                  setPinError(ERRORS.PIN_SAVE_FAILED);
                  // Reset entire PIN process
                  pinRef.current = '';
                  confirmPinRef.current = '';
                  setPin('');
                  setConfirmPin('');
                  setPinStep('enter');
                }
              }).catch((error: unknown) => {
                logger.error('[PinSetupScreen] savePin failed', {
                  error: error instanceof Error ? error.message : String(error),
                });
                shakeError();
                setPinError(ERRORS.PIN_SAVE_FAILED);
                pinRef.current = '';
                confirmPinRef.current = '';
                setPin('');
                setConfirmPin('');
                setPinStep('enter');
              });
            }
          } else {
            shakeError();
            setPinError(ERRORS.PINS_DO_NOT_MATCH);
            // Reset entire PIN process so user starts fresh
            pinRef.current = '';
            confirmPinRef.current = '';
            setPin('');
            setConfirmPin('');
            setPinStep('enter');
          }
        }
      }
    }
  };

  const handlePinDelete = (): void => {
    if (pinStep === 'enter') {
      pinRef.current = pinRef.current.slice(0, -1);
      setPin(pinRef.current);
    } else {
      confirmPinRef.current = confirmPinRef.current.slice(0, -1);
      setConfirmPin(confirmPinRef.current);
    }
    setPinError('');
  };

  const handleBiometricEnable = async (): Promise<void> => {
    setShowBiometricPrompt(false);
    try {
      const result = await authenticateWithBiometrics(
        'Authenticate to enable biometric login',
        'Use PIN instead'
      );

      await persistBiometricEnabled(Boolean(result.success));

      // Complete setup regardless of biometric result
      // Pass the PIN back to parent for potential passkey migration
      analytics.track(ONBOARDING_EVENTS.BIOMETRIC_ENABLED);
      onPinSetupComplete(pinRef.current);
    } catch (error: unknown) {
      await persistBiometricEnabled(false);
      onPinSetupComplete(pinRef.current);
    }
  };

  const handleBiometricSkip = async (): Promise<void> => {
    setShowBiometricPrompt(false);
    await persistBiometricEnabled(false);
    analytics.track(ONBOARDING_EVENTS.BIOMETRIC_SKIPPED);
    // Pass the PIN back to parent for potential passkey migration
    onPinSetupComplete(pinRef.current);
  };

  const currentPin = pinStep === 'confirm' ? confirmPin : pin;
  const keySize = s(76);
  const keyTextSize = sf(32);
  const iconSize = s(28);
  const dotSize = s(16);
  const dotGap = s(spacing.md);
  const keypadGap = s(32);

  return (
    <>
      <View style={styles.lockScreen} testID="pin-setup-screen">
        <StatusBar style="light" />

        {/* Cancel button (top right) */}
        {onCancel && (
          <TouchableOpacity
            style={[styles.lockCancelButton, { top: s(16), right: s(20), padding: s(12) }]}
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="pin-setup-cancel-btn"
          >
            <Text style={[styles.lockCancelButtonText, { fontSize: sf(fontSizes.md) }]}>Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Title */}
        <Text style={[styles.lockTitle, { fontSize: sf(20), marginBottom: s(32), marginTop: s(20), paddingHorizontal: s(spacing.lg) }]} testID="pin-setup-title">
          {changingPin
            ? pinStep === 'enter'
              ? 'Enter New PIN'
              : 'Confirm New PIN'
            : pinStep === 'enter'
              ? 'Enter 6-Digit PIN'
              : 'Confirm Your PIN'}
        </Text>

        {/* PIN Error */}
        {pinError ? (
          <Text style={[styles.lockPinError, { fontSize: sf(fontSizes.md), marginBottom: s(20), paddingHorizontal: s(spacing.lg) }]} testID="pin-setup-error">
            {pinError}
          </Text>
        ) : null}

        {/* PIN Dots */}
        <Animated.View style={[styles.lockPinDots, { transform: [{ translateX: shakeAnimation }], gap: dotGap, marginBottom: s(spacing.lg) }]} testID="pin-setup-dots">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[styles.lockPinDot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }, i < currentPin.length && styles.lockPinDotFilled]}
              testID={`pin-dot-${i}`}
            />
          ))}
        </Animated.View>

        {/* Keypad */}
        <View style={[styles.lockKeypad, { maxWidth: s(352), paddingHorizontal: s(spacing.lg), marginBottom: s(40) }]} testID="pin-setup-keypad">
          {[
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.lockKeypadRow, { marginBottom: s(spacing.lg), gap: keypadGap }]}>
              {row.map((num) => (
                <KeypadButton
                  key={num}
                  digit={String(num)}
                  onPress={handlePinDigit}
                  keySize={keySize}
                  fontSize={keyTextSize}
                />
              ))}
            </View>
          ))}
          <View style={[styles.lockKeypadRow, { gap: keypadGap }]}>
            <View style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]} />
            <KeypadButton digit="0" onPress={handlePinDigit} keySize={keySize} fontSize={keyTextSize} />
            <Pressable
              style={[styles.lockKey, { width: keySize, height: keySize, borderRadius: keySize / 2 }]}
              onPressIn={handlePinDelete}
              hitSlop={8}
              testID="pin-keypad-delete"
            >
              <Icon name="delete" size={iconSize} color={COLORS.WHITE} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Biometric Authentication Prompt */}
      {showBiometricPrompt && (
        <View style={styles.modalOverlay} testID="biometric-modal">
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.biometricPromptModal, {
              borderRadius: s(radii.xl),
              padding: s(spacing.xl),
              marginVertical: s(spacing.xl),
            }]}>
              <Text style={[styles.biometricPromptTitle, { fontSize: sf(fontSizes.lg), marginBottom: s(spacing.md) }]}>
                Biometric Authentication
              </Text>
              <Text style={[styles.biometricPromptText, { fontSize: sf(fontSizes.md), marginBottom: s(25), lineHeight: sf(22) }]}>
                Do you want to use biometric authentication (FaceID or TouchID) for UNIT Wallet?
              </Text>
              <View style={[styles.biometricPromptButtons, { gap: s(12) }]}>
                <TouchableOpacity
                  style={[styles.biometricPromptButton, styles.biometricPromptButtonYes, {
                    paddingVertical: s(spacing.md),
                    paddingHorizontal: s(spacing.lg),
                    borderRadius: s(radii.lg)
                  }]}
                  onPress={handleBiometricEnable}
                  testID="biometric-enable-btn"
                >
                  <Text style={[styles.biometricPromptButtonText, { fontSize: sf(fontSizes.md) }]}>Yes, Enable</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.biometricPromptButton, styles.biometricPromptButtonNo, {
                    paddingVertical: s(spacing.md),
                    paddingHorizontal: s(spacing.lg),
                    borderRadius: s(radii.lg)
                  }]}
                  onPress={handleBiometricSkip}
                  testID="biometric-skip-btn"
                >
                  <Text style={[styles.biometricPromptButtonTextNo, { fontSize: sf(fontSizes.md) }]}>No, Thanks</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </>
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
  lockCancelButton: {
    position: 'absolute',
    zIndex: 10,
  },
  lockCancelButtonText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: colors.text.primary,
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricPromptModal: {
    backgroundColor: colors.bg.secondary,
    width: '85%',
    maxWidth: 400,
  },
  biometricPromptTitle: {
    fontFamily: fonts.bold,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
    textAlign: 'center',
  },
  biometricPromptText: {
    fontFamily: fonts.regular,
    color: colors.text.primary,
    textAlign: 'center',
  },
  biometricPromptButtons: {
    flexDirection: 'column',
  },
  biometricPromptButton: {
    alignItems: 'center',
  },
  biometricPromptButtonYes: {
    backgroundColor: colors.brand.primary,
  },
  biometricPromptButtonNo: {
    backgroundColor: COLORS.OFF_WHITE,
  },
  biometricPromptButtonText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  biometricPromptButtonTextNo: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: COLORS.DARK_GRAY,
  },
});
