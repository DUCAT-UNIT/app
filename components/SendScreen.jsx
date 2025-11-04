/**
 * SendScreen Component
 * Handles all send transaction bottom sheets and flows
 * - Asset selection (BTC or UNIT)
 * - Address entry (first)
 * - Amount entry (second)
 * - Transaction review
 * - Success confirmation
 */

import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, TextInput, ActivityIndicator, Image, Linking, Alert, ScrollView, Pressable, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../utils/colors';
import styles from '../styles';

// Format number with commas while preserving decimals
const formatNumberWithCommas = (value) => {
  if (!value) return '';

  // Split into integer and decimal parts
  const parts = value.split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Return with decimal part if it exists
  return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
};

// Remove commas from formatted number
const removeCommas = (value) => {
  return value.replace(/,/g, '');
};

// Format BTC amount to show only significant decimals
const formatBTC = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';

  // Convert to fixed 8 decimals then trim trailing zeros
  const fixed = num.toFixed(8);
  const trimmed = fixed.replace(/\.?0+$/, '');

  // If no decimals remain or only removed trailing zeros, ensure at least 2 decimals
  if (!trimmed.includes('.') || trimmed.split('.')[1].length === 0) {
    return num.toFixed(2);
  }

  return trimmed;
};

// Bitcoin address validation
const validateBitcoinAddress = (address) => {
  if (!address) return { valid: false, error: '' };

  const trimmed = address.trim();

  // Check for basic bitcoin address patterns
  const isValidFormat =
    /^(bc1|tb1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed) || // Mainnet/Testnet
    /^[mn2][a-zA-HJ-NP-Z0-9]{25,34}$/.test(trimmed); // Legacy testnet

  if (!isValidFormat) {
    return { valid: false, error: 'Invalid Bitcoin address format' };
  }

  // Check length constraints
  if (trimmed.length < 26 || trimmed.length > 90) {
    return { valid: false, error: 'Address length is invalid' };
  }

  return { valid: true, error: '' };
};

export default function SendScreen({
  // State
  intentStep,
  sendAssetType,
  sendAmount,
  sendRecipient,
  sendIntent,
  broadcastedTxid,
  keyboardHeight,
  amountInputRef,
  btcBalance,
  unitBalance,
  btcPrice,

  // Setters
  setIntentStep,
  setSendAssetType,
  setSendAmount,
  setSendRecipient,
  setSendIntent,
  setBroadcastedTxid,

  // Handlers
  createSendIntent,
  signIntent,
}) {
  // Address validation state
  const [addressError, setAddressError] = useState('');

  // Loading message state
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Ref for address input to maintain focus
  const addressInputRef = React.useRef(null);

  // Auto-validate address on change
  useEffect(() => {
    if (intentStep === 'entering_address' && sendRecipient) {
      const validation = validateBitcoinAddress(sendRecipient);
      setAddressError(validation.error);
    } else {
      setAddressError('');
    }
  }, [sendRecipient, intentStep]);

  // Cycle through loading messages
  useEffect(() => {
    if (intentStep === 'creating') {
      setLoadingMessageIndex(0);
      const maxMessages = sendAssetType === 'btc' ? 2 : 3;

      const timer = setInterval(() => {
        setLoadingMessageIndex((prev) => {
          if (prev < maxMessages - 1) {
            return prev + 1;
          }
          return prev; // Stay on last message
        });
      }, 500); // 500ms between messages

      return () => clearInterval(timer);
    }
  }, [intentStep, sendAssetType]);

  // If not in any send flow, don't render anything
  if (intentStep === 'idle') {
    return null;
  }

  return (
    <>
      {/* Asset Selector Bottom Sheet - Slides from absolute bottom */}
      {intentStep === 'selecting_asset' && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => setIntentStep('idle')}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Send What?</Text>

            <TouchableOpacity
              style={styles.assetOption}
              onPress={() => {
                console.log('BTC asset selected');
                setSendAssetType('btc');
                setIntentStep('entering_address');
              }}
            >
              <Image
                source={require('../assets/btc-logo.png')}
                style={styles.assetOptionLogo}
              />
              <View style={styles.assetOptionInfo}>
                <Text style={styles.assetOptionTitle}>Bitcoin</Text>
                <Text style={styles.assetOptionSubtitle}>Send BTC</Text>
              </View>
              <Text style={styles.assetOptionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.assetOption}
              onPress={() => {
                console.log('UNIT asset selected');
                setSendAssetType('unit');
                setIntentStep('entering_address');
              }}
            >
              <Image
                source={require('../assets/unit-logo.png')}
                style={styles.assetOptionLogo}
              />
              <View style={styles.assetOptionInfo}>
                <Text style={styles.assetOptionTitle}>Unit</Text>
                <Text style={styles.assetOptionSubtitle}>Send DUCAT•UNIT•RUNE</Text>
              </View>
              <Text style={styles.assetOptionArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Address Input Bottom Sheet - After asset selection (FIRST) */}
      <Modal
        visible={intentStep === 'entering_address' && !!sendAssetType}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          setIntentStep('idle');
          setSendAssetType(null);
          setSendRecipient('');
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setIntentStep('idle');
            setSendAssetType(null);
            setSendRecipient('');
          }}
        >
          <View style={styles.bottomSheetBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.bottomSheet, { bottom: keyboardHeight, flex: 1, paddingBottom: 10, paddingHorizontal: 0 }]}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            scrollEnabled={false}
            contentContainerStyle={{ flex: 1 }}
          >
            <View style={styles.bottomSheetHandle} />

            {/* Back button */}
            <Pressable
              style={[styles.bottomSheetBackButton, { paddingHorizontal: 15 }]}
              onPress={() => {
                setIntentStep('selecting_asset');
                setSendRecipient('');
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </Pressable>

            <View style={[styles.amountInputContainer, { paddingHorizontal: 15 }]} pointerEvents="box-none">
              <View style={{ width: '100%' }}>
                <Text style={styles.addressInputTitleLeft}>Recipient Address</Text>

                <View style={styles.addressInputRow}>
                  <TextInput
                    ref={addressInputRef}
                    style={styles.addressInput}
                    value={sendRecipient}
                    onChangeText={setSendRecipient}
                    placeholder="tb1q... or tb1p..."
                    placeholderTextColor="#666666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={true}
                    blurOnSubmit={false}
                  />
                  <Pressable
                    style={styles.pasteButton}
                    onPress={async () => {
                      const text = await Clipboard.getStringAsync();
                      if (text) {
                        setSendRecipient(text);
                        setTimeout(() => {
                          addressInputRef.current?.focus();
                        }, 50);
                      }
                    }}
                  >
                    <Image
                      source={require('../assets/paste-icon.png')}
                      style={{ width: 16, height: 16, tintColor: 'white' }}
                    />
                  </Pressable>
                </View>

                <View style={{ minHeight: 20 }}>
                  {addressError ? (
                    <Text style={styles.addressError}>{addressError}</Text>
                  ) : null}
                </View>
              </View>

              <Pressable
                style={[
                  styles.addressContinueButton,
                  (!sendRecipient || addressError) && styles.addressContinueButtonDisabled
                ]}
                onPress={() => {
                  if (!sendRecipient || addressError) return;
                  const validation = validateBitcoinAddress(sendRecipient);
                  if (validation.valid) {
                    setIntentStep('entering_amount');
                  } else {
                    setAddressError(validation.error || 'Please enter a valid Bitcoin address');
                  }
                }}
                disabled={!sendRecipient || !!addressError}
              >
                <Text style={styles.amountContinueButtonText}>Continue</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Amount Input Bottom Sheet - After address entry (SECOND) */}
      {intentStep === 'entering_amount' && sendAssetType && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setIntentStep('idle');
              setSendAssetType(null);
              setSendAmount('');
              setSendRecipient('');
            }}
            activeOpacity={1}
          />
          <View style={[styles.bottomSheet, { bottom: keyboardHeight, paddingBottom: 10, paddingHorizontal: 0 }]}>
            <View style={styles.bottomSheetHandle} />

            {/* Back button */}
            <TouchableOpacity
              style={[styles.bottomSheetBackButton, { paddingHorizontal: 15 }]}
              onPress={() => {
                setIntentStep('entering_address');
                setSendAmount('');
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            {/* Recipient Address Header */}
            <View style={[styles.sendToHeader, { paddingHorizontal: 15 }]}>
              <View style={styles.sendToLeft}>
                <Text style={styles.sendToLabel}>To:</Text>
                <Text style={styles.sendToAddress}>
                  {sendRecipient.substring(0, 8)}...{sendRecipient.substring(sendRecipient.length - 6)}
                </Text>
              </View>
              <View style={styles.addressTypeTag}>
                <Text style={styles.addressTypeText}>
                  {sendRecipient.startsWith('tb1p') || sendRecipient.startsWith('bc1p') ? 'Taproot' : 'Native SegWit'}
                </Text>
              </View>
            </View>

            <View style={[styles.amountInputContainer, { paddingHorizontal: 15 }]}>
              <View style={styles.amountBalanceRow}>
                <Text style={styles.amountBalanceLabel}>
                  {sendAssetType === 'btc' ? 'BTC' : 'UNIT'} Balance: {sendAssetType === 'btc'
                    ? (btcBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
                    : (unitBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
                <Pressable
                  style={styles.maxButton}
                  onPress={() => setSendAmount(String(sendAssetType === 'btc' ? (btcBalance || 0) : (unitBalance || 0)))}
                >
                  <Text style={styles.maxButtonText}>MAX</Text>
                </Pressable>
              </View>

              <View style={styles.amountInputRow}>
                <TextInput
                  ref={amountInputRef}
                  style={[
                    styles.amountInputLarge,
                    formatNumberWithCommas(sendAmount).length > 8 && { fontSize: 44 },
                    formatNumberWithCommas(sendAmount).length > 12 && { fontSize: 36 },
                    formatNumberWithCommas(sendAmount).length > 15 && { fontSize: 28 }
                  ]}
                  value={formatNumberWithCommas(sendAmount)}
                  onChangeText={(text) => {
                    // Handle decimal comma from keyboard
                    let processed = text;

                    // If text ends with a comma and there's no period yet, it's a decimal comma
                    if (processed.endsWith(',') && !processed.includes('.')) {
                      // Replace the last comma with a period
                      processed = processed.slice(0, -1) + '.';
                    }

                    // Remove all remaining commas (thousand separators)
                    let cleaned = processed.replace(/,/g, '');

                    // Only allow numbers and one decimal point
                    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
                      setSendAmount(cleaned);
                    }
                  }}
                  placeholder="0"
                  placeholderTextColor="#444444"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus={true}
                  onSubmitEditing={() => {
                    if (sendAmount) {
                      amountInputRef.current?.blur();
                      setTimeout(() => createSendIntent(), 50);
                    }
                  }}
                />
                <Image
                  source={sendAssetType === 'btc'
                    ? require('../assets/btc-symbol.png')
                    : require('../assets/unit-symbol.png')}
                  style={styles.amountAssetSymbolRight}
                />
              </View>

              <Text style={styles.amountUsdValue}>
                ≈ ${sendAmount && (sendAssetType === 'btc' ? btcPrice : 1)
                  ? (parseFloat(sendAmount) * (sendAssetType === 'btc' ? btcPrice : 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '0.00'} USD
              </Text>

              <TouchableOpacity
                style={[
                  styles.amountContinueButton,
                  !sendAmount && styles.amountContinueButtonDisabled
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (sendAmount) {
                    amountInputRef.current?.blur();
                    createSendIntent();
                  }
                }}
                disabled={!sendAmount}
              >
                <Text style={styles.amountContinueButtonText}>Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Review Transaction Bottom Sheet */}
      {intentStep === 'reviewing' && sendIntent && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setIntentStep('idle');
              setSendIntent(null);
            }}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            <TouchableOpacity
              style={styles.bottomSheetBackButton}
              onPress={() => {
                setIntentStep('entering_amount');
                setSendIntent(null);
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <Text style={{ fontSize: 20, fontWeight: '500', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 24 }}>You will send</Text>

              {/* To and Amount Card */}
              <View style={{ backgroundColor: COLORS.CARD_BG, borderRadius: 12, padding: 16, marginBottom: 32, width: '100%' }}>
                {/* To Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, color: COLORS.MEDIUM_GRAY, fontWeight: '600' }}>To:</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.VERY_LIGHT_GRAY }}>
                    {sendIntent.recipient.substring(0, 8)}...{sendIntent.recipient.substring(sendIntent.recipient.length - 7)}
                  </Text>
                </View>

                {/* Amount Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                  <Image
                    source={sendIntent.assetType === 'UNIT'
                      ? require('../assets/unit-logo.png')
                      : require('../assets/btc-logo.png')}
                    style={{ width: 42, height: 42, marginRight: 14 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 4 }}>Amount</Text>
                    <Text style={{ fontSize: 12, color: COLORS.MEDIUM_GRAY }}>
                      {sendIntent.assetType === 'UNIT' ? 'Unit' : 'Bitcoin'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 4 }}>
                      {sendIntent.assetType === 'UNIT'
                        ? `${(parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT`
                        : `${formatBTC(sendIntent.amountBTC)} BTC`}
                    </Text>
                    <Text style={{ fontSize: 12, color: COLORS.MEDIUM_GRAY }}>
                      $ {sendIntent.assetType === 'UNIT'
                        ? (parseFloat(sendIntent.amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : (parseFloat(sendIntent.amountBTC) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </Text>
                  </View>
                </View>
              </View>

              {/* Transaction Details Section */}
              <Text style={{ fontSize: 17, fontWeight: '600', color: COLORS.VERY_LIGHT_GRAY, marginBottom: 16 }}>Transaction details</Text>

              {/* Transaction Details Card */}
              <View style={{ backgroundColor: COLORS.CARD_BG, borderRadius: 12, padding: 16, marginBottom: 32, width: '100%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, width: '100%' }}>
                  <Text style={{ fontSize: 16, color: COLORS.MEDIUM_GRAY, fontWeight: '600' }}>Network:</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.VERY_LIGHT_GRAY }}>Mutinynet</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 16, color: COLORS.MEDIUM_GRAY, fontWeight: '600' }}>Total fees:</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.VERY_LIGHT_GRAY }}>{sendIntent.fee.toLocaleString()} sats</Text>
                </View>
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: '#444444',
                    backgroundColor: 'transparent',
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIntentStep('asset');
                    setSendIntent(null);
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '500', color: COLORS.VERY_LIGHT_GRAY }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 10,
                    backgroundColor: COLORS.PRIMARY_BLUE,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                  onPress={() => {
                    console.log('Confirm button pressed!');
                    signIntent();
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '500', color: COLORS.VERY_LIGHT_GRAY }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Transaction Success Bottom Sheet */}
      {intentStep === 'confirmed' && broadcastedTxid && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setSendIntent(null);
              setIntentStep('idle');
              setSendAmount('');
              setSendRecipient('');
              setSendAssetType(null);
              setBroadcastedTxid(null);
            }}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            <TouchableOpacity
              style={styles.successCloseButton}
              onPress={() => {
                setSendIntent(null);
                setIntentStep('idle');
                setSendAmount('');
                setSendRecipient('');
                setSendAssetType(null);
                setBroadcastedTxid(null);
              }}
            >
              <Text style={styles.successCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={[styles.amountInputContainer, { alignItems: 'center', justifyContent: 'center' }]}>
              <View style={styles.successCheckmarkContainer}>
                <View style={styles.successCheckmark}>
                  <Text style={styles.successCheckmarkText}>✓</Text>
                </View>
              </View>

              <Text style={[styles.successTitle, { textAlign: 'center' }]}>Transaction Sent</Text>

              <TouchableOpacity
                style={styles.amountContinueButton}
                activeOpacity={0.7}
                onPress={() => {
                  Linking.openURL(`https://mutinynet.com/tx/${broadcastedTxid}`);
                }}
              >
                <Text style={styles.amountContinueButtonText}>View on Explorer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Creating Transaction Bottom Sheet */}
      {intentStep === 'creating' && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            <View style={[styles.amountInputContainer, { alignItems: 'center', justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={{ marginBottom: 20 }} />
              <Text style={[styles.reviewTitle, { textAlign: 'center', marginBottom: 20 }]}>Creating Transaction</Text>
              {sendAssetType === 'btc' ? (
                <Text style={[styles.reviewValue, { textAlign: 'center' }]}>
                  {loadingMessageIndex === 0 && 'Collecting UTXOs...'}
                  {loadingMessageIndex === 1 && 'Building PSBT...'}
                </Text>
              ) : (
                <Text style={[styles.reviewValue, { textAlign: 'center' }]}>
                  {loadingMessageIndex === 0 && 'Collecting rune UTXOs...'}
                  {loadingMessageIndex === 1 && 'Constructing runestone...'}
                  {loadingMessageIndex === 2 && 'Building PSBT...'}
                </Text>
              )}
            </View>
          </View>
        </>
      )}

      {/* Broadcasting/Signing Bottom Sheet */}
      {(intentStep === 'signing' || intentStep === 'broadcasting') && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            <View style={[styles.amountInputContainer, { alignItems: 'center', justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={{ marginBottom: 20 }} />
              <Text style={[styles.reviewTitle, { textAlign: 'center' }]}>
                {intentStep === 'signing' ? 'Signing transaction...' : 'Broadcasting transaction...'}
              </Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}
