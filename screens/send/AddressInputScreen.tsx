/**
 * AddressInputScreen - Full screen for entering recipient Bitcoin address
 * Features: paste button, QR scan, address validation, back navigation
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
import { NavigationProp, RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import QRScanner from '../../components/scanner/QRScanner';
import { validateBitcoinAddress } from '../../utils/bitcoin';
import { useSendFlow, type AssetType } from '../../stores/sendFlowStore';
import { useKeyboard } from '../../hooks/useKeyboard';
import { logger } from '../../utils/logger';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import { useResponsive } from '../../hooks/useResponsive';
import styles from './AddressInputScreen.styles';

/**
 * Route parameters for AddressInputScreen
 */
interface AddressInputRouteParams {
  assetType?: AssetType;
  prefillAddress?: string;
  prefillAmount?: string;
}

/**
 * Props for AddressInputScreen
 */
interface AddressInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: AddressInputRouteParams }, 'params'>;
}

export default function AddressInputScreen({ navigation, route }: AddressInputScreenProps): React.JSX.Element {
  const { sendAssetType, sendRecipient, setSendRecipient, setSendAddressType, setSendAssetType, turboEnabled, setTurboEnabled } = useSendFlow();
  const { settingsHandlers } = useNavigationHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;
  const { keyboardHeight } = useKeyboard();
  const { s, sf, scale } = useResponsive();
  const addressInputRef = useRef<TextInput>(null);
  const [addressError, setAddressError] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const assetType = route.params?.assetType || sendAssetType;
  const assetSymbol = assetType === 'btc' ? 'BTC' : 'UNIT';

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

  // Handle prefilled address from QR scan or deep link
  useEffect(() => {
    const { prefillAddress, prefillAmount } = route.params || {};
    if (prefillAddress) {
      logger.debug('AddressInputScreen: Prefilling address from params:', prefillAddress);
      handleRecipientChange(prefillAddress);
      if (prefillAmount) {
        setTimeout(() => {
          navigation.navigate('AmountInput', { prefillAmount, autoAdvance: true });
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.prefillAddress]);

  useEffect(() => {
    const timer = setTimeout(() => addressInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      // Only use first line (remove newlines and extra whitespace)
      const firstLine = text.split(/[\r\n]/)[0].trim();
      handleRecipientChange(firstLine);
      setTimeout(() => addressInputRef.current?.focus(), 50);
    }
  };

  const handleScanQR = () => {
    setShowQRScanner(true);
  };

  const handleQRScanned = (data: string) => {
    setShowQRScanner(false);
    // Extract address from BIP21 URI if present (bitcoin:address?amount=...)
    let address = data;
    if (data.toLowerCase().startsWith('bitcoin:')) {
      address = data.replace(/^bitcoin:/i, '').split('?')[0];
    }
    handleRecipientChange(address);
  };

  const handleRecipientChange = (text: string): void => {
    // Strip newlines and only use first line
    const cleanText = text.split(/[\r\n]/)[0].trim();
    setSendRecipient(cleanText);
    setAddressError('');
    setIsValidAddress(false);

    if (cleanText) {
      const validation = validateBitcoinAddress(cleanText);
      if (!validation.valid) {
        setAddressError(validation.error || 'Invalid address');
      } else if (assetType === 'unit') {
        const isTaproot = cleanText.startsWith('tb1p') || cleanText.startsWith('bc1p');
        if (!isTaproot) {
          setAddressError('UNIT requires Taproot (bc1p/tb1p)');
        } else {
          setSendAddressType('taproot');
          setIsValidAddress(true);
        }
      } else {
        const addressType = cleanText.startsWith('tb1p') || cleanText.startsWith('bc1p') ? 'taproot' : 'segwit';
        setSendAddressType(addressType);
        setIsValidAddress(true);
      }
    }
  };

  const handleContinue = () => {
    if (!sendRecipient || addressError) return;
    const validation = validateBitcoinAddress(sendRecipient);
    if (validation.valid) {
      navigation.navigate('AmountInput');
    } else {
      setAddressError(validation.error || 'Invalid address');
    }
  };

  return (
    <View style={styles.container} testID="address-input-screen">
      {/* Header */}
      <View style={[styles.header, { paddingTop: s(60), paddingHorizontal: s(20), paddingBottom: s(16) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { width: s(40), height: s(40), marginRight: s(8) }]}
          testID="address-input-back-btn"
        >
          <Icon name="back" size={s(24)} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={[styles.title, { fontSize: sf(26) }]}>Send {assetSymbol}</Text>
      </View>

      <View style={[styles.content, { paddingHorizontal: s(20), paddingTop: s(20) }]}>
        {/* Label Row with Valid/Error Indicator and Turbo Toggle */}
        <View style={[styles.labelRow, { marginBottom: s(10) }]}>
          <Text style={[styles.label, { fontSize: sf(12) }]}>Recipient Address</Text>
          <View style={[styles.labelRight, { gap: s(8) }]}>
            {addressError ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Icon name="close" size={s(14)} color={COLORS.DANGER_RED} />
                <Text style={{ fontSize: sf(11), color: COLORS.DANGER_RED, fontFamily: 'CabinetGrotesk-Regular' }}>Invalid</Text>
              </View>
            ) : isValidAddress ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Icon name="check" size={s(14)} color={COLORS.GREEN} />
                <Text style={{ fontSize: sf(12), color: COLORS.GREEN, fontFamily: 'CabinetGrotesk-Regular' }}>Valid</Text>
              </View>
            ) : null}
            {assetType === 'unit' && advancedMode && (
              <>
                <Icon name="turbo" size={s(16)} color={COLORS.YELLOW} />
                <Switch
                  value={turboEnabled}
                  onValueChange={setTurboEnabled}
                  trackColor={{ false: COLORS.MID_DARK_GRAY, true: COLORS.YELLOW }}
                  thumbColor={COLORS.WHITE}
                  ios_backgroundColor={COLORS.MID_DARK_GRAY}
                  style={{ transform: [{ scale: scale * 0.8 }] }}
                  testID="address-turbo-toggle"
                />
              </>
            )}
          </View>
        </View>
        {/* Error message displayed below label row */}
        {addressError && (
          <Text style={{ fontSize: sf(12), color: COLORS.DANGER_RED, fontFamily: 'CabinetGrotesk-Regular', marginBottom: s(8) }}>
            {addressError}
          </Text>
        )}

        {/* Input Container with Action Buttons */}
        <View style={[styles.inputContainer, { borderRadius: s(16) }]}>
          {/* Text Input Area */}
          <View style={[styles.inputRow, { paddingHorizontal: s(16), paddingVertical: s(14) }]}>
            <TextInput
              ref={addressInputRef}
              style={[styles.input, { fontSize: sf(16), minHeight: s(52) }]}
              value={sendRecipient}
              onChangeText={handleRecipientChange}
              placeholder={assetType === 'unit' ? 'tb1p... or bc1p...' : 'tb1q... or tb1p...'}
              placeholderTextColor={COLORS.MEDIUM_GRAY}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              contextMenuHidden={false}
              selectTextOnFocus={false}
              testID="address-input"
            />
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            <Pressable
              style={[styles.actionButton, { paddingVertical: s(14) }]}
              onPress={handlePaste}
              testID="address-paste-btn"
            >
              <Icon name="paste" size={s(18)} color={COLORS.PRIMARY_BLUE} />
              <Text style={[styles.actionButtonText, { fontSize: sf(14) }]}>Paste</Text>
            </Pressable>

            <View style={styles.actionButtonDivider} />

            <Pressable
              style={[styles.actionButton, { paddingVertical: s(14) }]}
              onPress={handleScanQR}
              testID="address-scan-btn"
            >
              <Icon name="qr_code" size={s(18)} color={COLORS.PRIMARY_BLUE} />
              <Text style={[styles.actionButtonText, { fontSize: sf(14) }]}>Scan QR</Text>
            </Pressable>
          </View>
        </View>

      </View>

      {/* Continue Button */}
      <View style={[styles.buttonContainer, { bottom: keyboardHeight, paddingHorizontal: s(20), paddingVertical: s(16) }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { borderRadius: s(14), paddingVertical: s(18) },
            (!sendRecipient || addressError) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!sendRecipient || !!addressError}
          activeOpacity={0.7}
          testID="address-continue-btn"
        >
          <Text style={[styles.continueButtonText, { fontSize: sf(17) }]}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanned}
      />
    </View>
  );
}
