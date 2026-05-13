/**
 * PasskeyMigrationModal - Prompts users to enable or upgrade passkey recovery
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import * as Device from 'expo-device';
import { COLORS } from '../theme';
import { addPasskeyToExistingWallet, isPasskeySupported } from '../services/passkey';
import { verifyPin } from '../services/pinService';
import { withMnemonic } from '../services/secureStorageService';
import { logger } from '../utils/logger';
import { useResponsive } from '../hooks/useResponsive';
import { spacing, radii, fontSizes } from '../styles/theme';
import styles from '../styles';

interface PasskeyMigrationModalProps {
  visible: boolean;
  onClose: () => void;
  onPasskeyEnabled?: () => void | Promise<void>;
  currentPin?: string | null;
  mode?: 'import' | 'upgrade';
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function PasskeyMigrationModal({
  visible,
  onClose,
  onPasskeyEnabled,
  currentPin,
  mode = 'import',
  showToast,
}: PasskeyMigrationModalProps) {
  const { s, sf } = useResponsive();
  const [isAdding, setIsAdding] = useState(false);
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'prompt' | 'pin'>('prompt');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (!visible) {
      setIsAdding(false);
      setPin('');
      setPinError('');
      setStep('prompt');
    }
  }, [visible]);

  const title = mode === 'upgrade' ? 'Upgrade Passkey Security?' : 'Enable Passkey Recovery?';
  const description =
    mode === 'upgrade'
      ? 'Upgrade this wallet to the stronger PRF-backed passkey derivation. You will need your current PIN once to re-encrypt the wallet backup.'
      : 'Secure your wallet with passkey and back it up to iCloud for easy recovery across devices.';
  const successMessage =
    mode === 'upgrade'
      ? 'Passkey upgraded. This wallet now uses the stronger recovery derivation.'
      : 'Passkey enabled! Your wallet is now backed up to iCloud.';
  const actionLabel = mode === 'upgrade' ? 'Upgrade Passkey' : 'Enable Passkey';

  const completePasskeyEnable = async (pinToUse: string) => {
    try {
      setIsAdding(true);
      setPinError('');

      await new Promise((resolve) => setTimeout(resolve, 300));

      const supported = await isPasskeySupported();
      if (!supported) {
        showToast('Passkeys are not supported on this device', 'error');
        onClose();
        return;
      }

      const deviceName = Device.deviceName || 'iPhone';
      const userName = `${deviceName}-DUCAT_APP`;
      const displayName = `${deviceName} - Ducat`;
      const pinVerification = await verifyPin(pinToUse);
      if (!pinVerification.success) {
        setPinError(pinVerification.error);
        showToast(pinVerification.error, 'error');
        return;
      }

      await withMnemonic(async (mnemonic) => {
        await addPasskeyToExistingWallet(mnemonic, userName, displayName, pinToUse);
      });

      showToast(successMessage, 'success');
      try {
        await onPasskeyEnabled?.();
      } catch (callbackError: unknown) {
        logger.warn('[PasskeyMigrationModal] Post-passkey setup callback failed', {
          error: callbackError instanceof Error ? callbackError.message : String(callbackError),
        });
      }
      onClose();
    } catch (error: unknown) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        component: 'PasskeyMigrationModal',
        action: 'completePasskeyEnable',
      });

      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Passkey setup failed. Please try again.';
      const wasCancelled = /cancel|abort/i.test(errorMessage);
      showToast(wasCancelled ? 'Passkey setup cancelled' : errorMessage, 'error');
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  const handleEnablePasskey = async () => {
    if (currentPin) {
      await completePasskeyEnable(currentPin);
      return;
    }

    setPin('');
    setPinError('');
    setStep('pin');
  };

  const handleConfirmPin = async () => {
    if (pin.length !== 6) {
      setPinError('Enter your current 6-digit PIN');
      return;
    }

    await completePasskeyEnable(pin);
  };

  const handleSkip = () => {
    onClose();
  };

  const Wrapper = __DEV__ ? View : Modal;
  const wrapperProps = __DEV__
    ? { style: visible ? styles.modalOverlay : { display: 'none' as const } }
    : { visible, transparent: true, animationType: 'fade' as const, onRequestClose: onClose };
  const pinContainerSpacing = { marginBottom: s(20) };
  const pinInputStyle = {
    borderColor: pinError ? COLORS.DANGER_RED : COLORS.BORDER_COLOR,
    borderRadius: s(radii.lg),
    paddingVertical: s(spacing.lg),
    paddingHorizontal: s(spacing.lg),
    fontSize: sf(fontSizes.lg),
    letterSpacing: s(6),
  };
  const pinErrorStyle = {
    marginTop: s(spacing.sm),
    fontSize: sf(fontSizes.sm),
  };

  if (!visible && __DEV__) return null;

  return (
    <Wrapper {...wrapperProps}>
      <View style={__DEV__ ? undefined : styles.modalOverlay}>
        <ScrollView
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            testID="passkey-migration-modal"
            style={[
              styles.biometricPromptModal,
              {
                borderRadius: s(radii.xxl),
                padding: s(spacing.xl),
                marginVertical: s(spacing.xl),
              },
            ]}
          >
            <Text
              style={[
                styles.biometricPromptTitle,
                {
                  fontSize: sf(fontSizes.xl),
                  marginBottom: s(spacing.lg),
                },
              ]}
            >
              {step === 'pin' ? 'Enter Current PIN' : title}
            </Text>

            <Text
              style={[
                styles.biometricPromptText,
                {
                  fontSize: sf(fontSizes.md),
                  marginBottom: s(25),
                  lineHeight: sf(24),
                },
              ]}
            >
              {step === 'pin'
                ? 'Enter your current PIN to finish re-encrypting this wallet for passkey recovery.'
                : description}
            </Text>

            {step === 'pin' && (
              <View style={[localStyles.pinContainer, pinContainerSpacing]}>
                <TextInput
                  value={pin}
                  onChangeText={(value) => {
                    const sanitized = value.replace(/[^0-9]/g, '').slice(0, 6);
                    setPin(sanitized);
                    if (pinError) {
                      setPinError('');
                    }
                  }}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  autoFocus
                  placeholder="6-digit PIN"
                  placeholderTextColor={COLORS.LIGHT_GRAY}
                  style={[localStyles.pinInput, pinInputStyle]}
                  testID="passkey-upgrade-pin-input"
                />
                {pinError ? (
                  <Text style={[localStyles.pinErrorText, pinErrorStyle]}>{pinError}</Text>
                ) : null}
              </View>
            )}

            <View style={[styles.biometricPromptButtons, { gap: s(12) }]}>
              <TouchableOpacity
                style={[
                  styles.biometricPromptButton,
                  styles.biometricPromptButtonYes,
                  {
                    paddingVertical: s(spacing.lg),
                    paddingHorizontal: s(20),
                    borderRadius: s(radii.lg),
                  },
                ]}
                onPress={step === 'pin' ? handleConfirmPin : handleEnablePasskey}
                disabled={isAdding || (step === 'pin' && pin.length !== 6)}
                testID={step === 'pin' ? 'passkey-upgrade-confirm-btn' : 'passkey-enable-btn'}
              >
                {isAdding ? (
                  <ActivityIndicator color={COLORS.VERY_LIGHT_GRAY} />
                ) : (
                  <Text style={[styles.biometricPromptButtonText, { fontSize: sf(fontSizes.md) }]}>
                    {actionLabel}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="passkey-skip-btn"
                style={[
                  styles.biometricPromptButton,
                  styles.biometricPromptButtonNo,
                  {
                    paddingVertical: s(spacing.lg),
                    paddingHorizontal: s(20),
                    borderRadius: s(radii.lg),
                  },
                ]}
                onPress={
                  step === 'pin'
                    ? () => {
                        setStep('prompt');
                        setPin('');
                        setPinError('');
                      }
                    : handleSkip
                }
                disabled={isAdding}
              >
                <Text style={[styles.biometricPromptButtonTextNo, { fontSize: sf(fontSizes.md) }]}>
                  {step === 'pin' ? 'Back' : 'Skip for Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Wrapper>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinContainer: {
    width: '100%',
  },
  pinInput: {
    borderWidth: 1,
    textAlign: 'center',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  pinErrorText: {
    color: COLORS.DANGER_RED,
    textAlign: 'center',
  },
});
