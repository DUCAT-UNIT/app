/**
 * AddressInputScreen - Full screen for entering recipient Bitcoin address
 * Features: paste button, QR scan, address validation, back navigation
 */

import { NavigationProp,RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import React,{ useEffect,useRef,useState } from 'react';
import {
Pressable,
Text,
TextInput,
TouchableOpacity,
View
} from 'react-native';
import Icon from '../../components/icons';
import QRScanner from '../../components/scanner/QRScanner';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useResponsive } from '../../hooks/useResponsive';
import { useSendFlowStore,type AssetType } from '../../stores/sendFlowStore';
import { COLORS } from '../../theme';
import { MUTINYNET_NETWORK,validateBitcoinAddress } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
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
  const bech32Hrp = typeof MUTINYNET_NETWORK?.bech32 === 'string' ? MUTINYNET_NETWORK.bech32 : 'tb';
  const taprootPrefix = `${bech32Hrp}1p`;
  const segwitPrefix = `${bech32Hrp}1q`;
  // Use individual selectors to avoid re-rendering on unrelated state changes
  const sendAssetType = useSendFlowStore((state) => state.sendAssetType);
  const sendRecipient = useSendFlowStore((state) => state.sendRecipient);

  // Use stable store actions directly to avoid infinite loops
  const setSendRecipient = useSendFlowStore((state) => state.setSendRecipient);
  const setSendAddressType = useSendFlowStore((state) => state.setSendAddressType);
  const setSendAssetType = useSendFlowStore((state) => state.setSendAssetType);
  const setTurboEnabled = useSendFlowStore((state) => state.setTurboEnabled);
  const { keyboardHeight } = useKeyboard();
  const { s, sf } = useResponsive();
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
    if (assetType === 'unit') {
      logger.debug('AddressInputScreen: Enabling Turbo mode by default for UNIT');
      setTurboEnabled(true);
    }
  }, [assetType, setTurboEnabled]);

  // Handle prefilled address from QR scan or deep link
  useEffect(() => {
    const { prefillAddress, prefillAmount } = route.params || {};
    if (prefillAddress) {
      // SECURITY: Validate prefilled address before using (deep link injection defense)
      const validation = validateBitcoinAddress(prefillAddress);
      if (!validation.valid) {
        logger.warn('AddressInputScreen: Rejected invalid prefilled address from deep link');
        return;
      }
      logger.debug('AddressInputScreen: Prefilling address from params:', prefillAddress);
      handleRecipientChange(prefillAddress);
      // SECURITY: Validate prefilled amount is a valid positive number
      if (prefillAmount && /^\d+(\.\d+)?$/.test(prefillAmount) && parseFloat(prefillAmount) > 0) {
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
      // Only use first line, strip control chars, enforce max length (bech32m max ~90 chars)
      const firstLine = text.split(/[\r\n]/)[0].trim().replace(/[^\x20-\x7E]/g, '').slice(0, 128);
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
        const isTaproot = cleanText.toLowerCase().startsWith(taprootPrefix);
        if (!isTaproot) {
          setAddressError('UNIT requires Taproot (bc1p/tb1p)');
        } else {
          setSendAddressType('taproot');
          setIsValidAddress(true);
        }
      } else {
        const addressType = cleanText.toLowerCase().startsWith(taprootPrefix) ? 'taproot' : 'segwit';
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
              placeholder={assetType === 'unit' ? `${taprootPrefix}...` : `${segwitPrefix}... or ${taprootPrefix}...`}
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
