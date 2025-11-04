/**
 * SendScreen Component
 * Handles all send transaction bottom sheets and flows
 * - Asset selection (BTC or UNIT)
 * - Amount entry
 * - Address entry
 * - Transaction review
 * - Success confirmation
 */

import React from 'react';
import { Text, View, TouchableOpacity, TextInput, ActivityIndicator, Image, Linking } from 'react-native';
import { COLORS } from '../utils/colors';
import styles from '../styles';

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
                setIntentStep('entering_amount');
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
                setIntentStep('entering_amount');
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

      {/* Amount Input Bottom Sheet - After asset selection */}
      {intentStep === 'entering_amount' && sendAssetType && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setIntentStep('idle');
              setSendAssetType(null);
              setSendAmount('');
            }}
            activeOpacity={1}
          />
          <View style={[styles.bottomSheet, { bottom: keyboardHeight }]}>
            <View style={styles.bottomSheetHandle} />

            {/* Back button */}
            <TouchableOpacity
              style={styles.bottomSheetBackButton}
              onPress={() => {
                setIntentStep('selecting_asset');
                setSendAmount('');
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <View style={styles.amountInputRow}>
                <Image
                  source={sendAssetType === 'btc'
                    ? require('../assets/btc-symbol.png')
                    : require('../assets/unit-symbol.png')}
                  style={styles.amountAssetSymbol}
                />
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountInput}
                  value={sendAmount}
                  onChangeText={setSendAmount}
                  placeholder="0"
                  placeholderTextColor="#444444"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus={true}
                  onSubmitEditing={() => {
                    if (sendAmount) {
                      amountInputRef.current?.blur();
                      setTimeout(() => setIntentStep('entering_address'), 50);
                    }
                  }}
                />
              </View>
              <Text style={styles.amountInputLabel}>
                {sendAssetType === 'btc' ? 'BTC' : 'UNIT'}
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
                    setIntentStep('entering_address');
                  }
                }}
                disabled={!sendAmount}
              >
                <Text style={styles.amountContinueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Address Input Bottom Sheet - After amount entry */}
      {intentStep === 'entering_address' && sendAssetType && (
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
          <View style={[styles.bottomSheet, { bottom: keyboardHeight }]}>
            <View style={styles.bottomSheetHandle} />

            {/* Back button */}
            <TouchableOpacity
              style={styles.bottomSheetBackButton}
              onPress={() => {
                setIntentStep('entering_amount');
                setSendRecipient('');
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <Text style={styles.addressInputTitle}>Recipient Address</Text>

              <TextInput
                style={styles.addressInput}
                value={sendRecipient}
                onChangeText={setSendRecipient}
                placeholder="tb1q... or tb1p..."
                placeholderTextColor="#666666"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (sendRecipient) {
                    createSendIntent();
                  }
                }}
              />

              <TouchableOpacity
                style={[
                  styles.amountContinueButton,
                  !sendRecipient && styles.amountContinueButtonDisabled
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (sendRecipient) {
                    createSendIntent();
                  }
                }}
                disabled={!sendRecipient}
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
                setIntentStep('entering_address');
                setSendIntent(null);
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <Text style={styles.reviewTitle}>Review Transaction</Text>

              <Text style={styles.reviewLabel}>From</Text>
              <Text style={styles.reviewValue}>{sendIntent.addressType === 'taproot' ? 'Taproot' : 'SegWit'}</Text>

              <Text style={styles.reviewLabel}>To</Text>
              <Text style={styles.reviewValue}>{sendIntent.recipient.substring(0, 16)}...{sendIntent.recipient.substring(sendIntent.recipient.length - 8)}</Text>

              <Text style={styles.reviewLabel}>Amount</Text>
              {sendIntent.assetType === 'UNIT' ? (
                <>
                  <Text style={styles.reviewAmountLarge}>{sendIntent.amount.toLocaleString()} UNIT</Text>
                </>
              ) : (
                <>
                  <Text style={styles.reviewAmountLarge}>{sendIntent.amountBTC} BTC</Text>
                  <Text style={styles.reviewAmountSats}>{sendIntent.amount.toLocaleString()} sats</Text>
                </>
              )}

              <Text style={styles.reviewLabel}>Fee</Text>
              <Text style={styles.reviewValue}>{sendIntent.fee} sats</Text>

              {sendIntent.assetType !== 'UNIT' && (
                <>
                  <Text style={styles.reviewLabel}>Total</Text>
                  <Text style={styles.reviewTotal}>
                    {((sendIntent.amount + sendIntent.fee) / 100000000).toFixed(8)} BTC
                  </Text>
                </>
              )}

              <TouchableOpacity
                style={styles.amountContinueButton}
                activeOpacity={0.7}
                onPress={() => {
                  console.log('Confirm & Sign button pressed!');
                  signIntent();
                }}
              >
                <Text style={styles.amountContinueButtonText}>Confirm & Sign</Text>
              </TouchableOpacity>
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

            <View style={styles.amountInputContainer}>
              <View style={styles.successCheckmarkContainer}>
                <View style={styles.successCheckmark}>
                  <Text style={styles.successCheckmarkText}>✓</Text>
                </View>
              </View>

              <Text style={styles.successTitle}>Transaction Sent</Text>

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

      {/* Broadcasting/Signing Overlay */}
      {(intentStep === 'signing' || intentStep === 'broadcasting') && (
        <View style={styles.modalOverlay}>
          <View style={styles.intentModal}>
            <View style={styles.intentContent}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
              <Text style={styles.reviewValue}>
                {intentStep === 'signing' ? 'Signing transaction...' : 'Broadcasting transaction...'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </>
  );
}
