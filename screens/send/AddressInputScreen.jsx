/**
 * AddressInputScreen - Full screen for entering recipient Bitcoin address
 * Features: paste button, address validation, back navigation
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { validateBitcoinAddress } from '../../utils/sendHelpers';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { logger } from '../../utils/logger';

export default function AddressInputScreen({ navigation, route }) {
  const { sendAssetType, sendRecipient, setSendRecipient, setSendAddressType, setSendAssetType, spectreEnabled, setSpectreEnabled } = useSendFlow();
  const { keyboardHeight } = useKeyboard();
  const addressInputRef = useRef(null);
  const [addressError, setAddressError] = React.useState('');

  // Get asset type from route params (passed from asset selector)
  const assetType = route.params?.assetType || sendAssetType;

  useEffect(() => {
    // Set the asset type in context if it came from route params
    if (route.params?.assetType && route.params.assetType !== sendAssetType) {
      logger.debug('AddressInputScreen: Setting asset type from route params:', route.params.assetType);
      setSendAssetType(route.params.assetType);
    }
  }, [route.params?.assetType, sendAssetType, setSendAssetType]);

  // Enable Spectre mode by default for UNIT transfers (only on mount)
  useEffect(() => {
    if (assetType === 'unit') {
      logger.debug('AddressInputScreen: Enabling Spectre mode by default for UNIT');
      setSpectreEnabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType]); // Only run when assetType changes, not when spectreEnabled changes

  // Handle prefilled address (for non-Spectre flows)
  useEffect(() => {
    const { prefillAddress, prefillAmount } = route.params || {};

    if (prefillAddress && !sendRecipient) {
      handleRecipientChange(prefillAddress);

      // If both address and amount are prefilled, auto-advance to AmountInput
      if (prefillAmount) {
        // Small delay to ensure address validation completes
        setTimeout(() => {
          navigation.navigate('AmountInput', {
            prefillAmount,
            autoAdvance: true
          });
        }, 100);
      }
    }
  }, [route.params?.prefillAddress, route.params?.prefillAmount]);

  useEffect(() => {
    // Auto-focus input when screen loads
    const timer = setTimeout(() => {
      addressInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      handleRecipientChange(text);
      setTimeout(() => {
        addressInputRef.current?.focus();
      }, 50);
    }
  };

  const handleRecipientChange = (text) => {
    setSendRecipient(text);

    // Clear error when user starts typing
    if (addressError) {
      setAddressError('');
    }

    // Validate address
    if (text) {
      const validation = validateBitcoinAddress(text);
      if (!validation.valid) {
        setAddressError(validation.error);
      } else {
        // Check UNIT-specific rule: must be Taproot
        if (assetType === 'unit') {
          const isTaproot = text.startsWith('tb1p') || text.startsWith('bc1p');
          if (!isTaproot) {
            setAddressError('UNIT transfers require a Taproot address (tb1p... or bc1p...)');
          } else {
            setSendAddressType('taproot');
          }
        } else {
          // Set address type for BTC
          const addressType =
            text.startsWith('tb1p') || text.startsWith('bc1p') ? 'taproot' : 'segwit';
          setSendAddressType(addressType);
        }
      }
    }
  };

  const handleContinue = () => {
    if (!sendRecipient || addressError) return;

    const validation = validateBitcoinAddress(sendRecipient);
    if (validation.valid) {
      // Navigate to amount input screen
      navigation.navigate('AmountInput');
    } else {
      setAddressError(validation.error);
    }
  };

  return (
    <View style={localStyles.container}>
      {/* Header with back button and title */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backButton}>
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Enter Address</Text>
      </View>

      {/* Content */}
      <View style={localStyles.content}>
        <View style={localStyles.labelRow}>
          <Text style={localStyles.label}>Recipient Address</Text>
          <View style={localStyles.labelRight}>
            {assetType === 'unit' && (
              <Icon name="spectre" size={16} color={COLORS.YELLOW} />
            )}
            {assetType === 'unit' && (
              <Switch
                value={spectreEnabled}
                onValueChange={setSpectreEnabled}
                trackColor={{ false: COLORS.MID_DARK_GRAY, true: COLORS.YELLOW }}
                thumbColor={COLORS.WHITE}
                ios_backgroundColor={COLORS.MID_DARK_GRAY}
                style={localStyles.switch}
              />
            )}
          </View>
        </View>

        <View style={localStyles.inputRow}>
          <TextInput
            ref={addressInputRef}
            style={localStyles.input}
            value={sendRecipient}
            onChangeText={handleRecipientChange}
            placeholder="tb1q... or tb1p..."
            placeholderTextColor={COLORS.MEDIUM_GRAY}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            multiline
            numberOfLines={2}
          />
          <Pressable style={localStyles.pasteButton} onPress={handlePaste}>
            <Icon name="paste" size={18} color={COLORS.WHITE} />
          </Pressable>
        </View>

        <View style={localStyles.errorContainer}>
          {addressError ? <Text style={localStyles.errorText}>{addressError}</Text> : null}
        </View>

        {/* Spectre Warning - Only show when toggle is ON */}
        {assetType === 'unit' && spectreEnabled && (
          <View style={localStyles.spectreWarningContainer}>
            <View style={localStyles.spectreWarningTextContainer}>
              <Text style={localStyles.spectreWarningTitle}>Spectral Transaction</Text>
              <Text style={localStyles.spectreWarningText}>
                Anonymous, instant, and private.{'\n'}
                The recipient has to claim the funds manually.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Continue Button - Sits on top of keyboard */}
      <View style={[localStyles.buttonContainer, { bottom: keyboardHeight }]}>
        <TouchableOpacity
          style={[
            localStyles.continueButton,
            (!sendRecipient || addressError) && localStyles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!sendRecipient || !!addressError}
          activeOpacity={0.7}
        >
          <Text style={localStyles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  labelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    minHeight: 48,
    paddingTop: 0,
  },
  pasteButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 12,
  },
  errorContainer: {
    minHeight: 24,
    paddingTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.DANGER_RED,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.DARK_BG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  spectreWarningContainer: {
    backgroundColor: COLORS.YELLOW + '15',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.YELLOW + '25',
  },
  spectreWarningTextContainer: {
    alignItems: 'center',
  },
  spectreWarningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  spectreWarningText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
});
