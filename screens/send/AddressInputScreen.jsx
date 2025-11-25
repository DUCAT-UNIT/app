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
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { validateBitcoinAddress } from '../../utils/bitcoin';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { logger } from '../../utils/logger';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import styles from './AddressInputScreen.styles';

export default function AddressInputScreen({ navigation, route }) {
  const { sendAssetType, sendRecipient, setSendRecipient, setSendAddressType, setSendAssetType, turboEnabled, setTurboEnabled } = useSendFlow();
  const { settingsHandlers } = useNavigationHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;
  const { keyboardHeight } = useKeyboard();
  const addressInputRef = useRef(null);
  const [addressError, setAddressError] = useState('');

  const assetType = route.params?.assetType || sendAssetType;

  useEffect(() => {
    if (route.params?.assetType && route.params.assetType !== sendAssetType) {
      logger.debug('AddressInputScreen: Setting asset type from route params:', route.params.assetType);
      setSendAssetType(route.params.assetType);
    }
  }, [route.params?.assetType, sendAssetType, setSendAssetType]);

  useEffect(() => {
    if (assetType === 'unit' && advancedMode) {
      logger.debug('AddressInputScreen: Enabling Turbo mode by default for UNIT');
      setTurboEnabled(true);
    }
  }, [assetType, advancedMode, setTurboEnabled]);

  useEffect(() => {
    const { prefillAddress, prefillAmount } = route.params || {};
    if (prefillAddress && !sendRecipient) {
      handleRecipientChange(prefillAddress);
      if (prefillAmount) {
        setTimeout(() => {
          navigation.navigate('AmountInput', { prefillAmount, autoAdvance: true });
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => addressInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      handleRecipientChange(text);
      setTimeout(() => addressInputRef.current?.focus(), 50);
    }
  };

  const handleRecipientChange = (text) => {
    setSendRecipient(text);
    if (addressError) setAddressError('');

    if (text) {
      const validation = validateBitcoinAddress(text);
      if (!validation.valid) {
        setAddressError(validation.error);
      } else if (assetType === 'unit') {
        const isTaproot = text.startsWith('tb1p') || text.startsWith('bc1p');
        if (!isTaproot) {
          setAddressError('UNIT transfers require a Taproot address (tb1p... or bc1p...)');
        } else {
          setSendAddressType('taproot');
        }
      } else {
        const addressType = text.startsWith('tb1p') || text.startsWith('bc1p') ? 'taproot' : 'segwit';
        setSendAddressType(addressType);
      }
    }
  };

  const handleContinue = () => {
    if (!sendRecipient || addressError) return;
    const validation = validateBitcoinAddress(sendRecipient);
    if (validation.valid) {
      navigation.navigate('AmountInput');
    } else {
      setAddressError(validation.error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={styles.title}>Enter Address</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Recipient Address</Text>
          <View style={styles.labelRight}>
            {assetType === 'unit' && advancedMode && (
              <>
                <Icon name="turbo" size={16} color={COLORS.YELLOW} />
                <Switch
                  value={turboEnabled}
                  onValueChange={setTurboEnabled}
                  trackColor={{ false: COLORS.MID_DARK_GRAY, true: COLORS.YELLOW }}
                  thumbColor={COLORS.WHITE}
                  ios_backgroundColor={COLORS.MID_DARK_GRAY}
                  style={styles.switch}
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            ref={addressInputRef}
            style={styles.input}
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
          <Pressable style={styles.pasteButton} onPress={handlePaste}>
            <Icon name="paste" size={18} color={COLORS.WHITE} />
          </Pressable>
        </View>

        <View style={styles.errorContainer}>
          {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}
        </View>

        {assetType === 'unit' && turboEnabled && (
          <View style={styles.turboWarningContainer}>
            <View style={styles.turboWarningTextContainer}>
              <Text style={styles.turboWarningTitle}>Turbo Transaction</Text>
              <Text style={styles.turboWarningText}>
                Anonymous, instant, and private.{'\n'}
                The recipient has to claim the funds manually.
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.buttonContainer, { bottom: keyboardHeight }]}>
        <TouchableOpacity
          style={[styles.continueButton, (!sendRecipient || addressError) && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!sendRecipient || !!addressError}
          activeOpacity={0.7}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
