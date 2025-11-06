/**
 * AddressInputSheet Component
 * Bottom sheet for entering recipient Bitcoin address
 * Features: paste button, address validation, back navigation
 */

import React from 'react';
import { Text, View, TouchableWithoutFeedback, TextInput, Pressable, Image, ScrollView, Modal, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import styles from '../../styles';
import { validateBitcoinAddress } from '../../utils/sendHelpers';

export default function AddressInputSheet({
  visible,
  opacity,
  translateY,
  panHandlers,
  keyboardHeight,
  sendRecipient,
  addressError,
  addressInputRef,
  onDismiss,
  onBack,
  onContinue,
  onRecipientChange,
}) {
  if (!visible) return null;

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      onRecipientChange(text);
      setTimeout(() => {
        addressInputRef.current?.focus();
      }, 50);
    }
  };

  const handleContinue = () => {
    if (!sendRecipient || addressError) return;
    const validation = validateBitcoinAddress(sendRecipient);
    if (validation.valid) {
      onContinue();
    } else {
      // Error will be shown by parent component via addressError prop
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.bottomSheetBackdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            bottom: keyboardHeight,
            flex: 1,
            paddingBottom: 10,
            paddingHorizontal: 0,
            opacity,
            transform: [{ translateY }]
          }
        ]}
        {...panHandlers}
      >
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
            onPress={onBack}
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
                  onChangeText={onRecipientChange}
                  placeholder="tb1q... or tb1p..."
                  placeholderTextColor="#666666"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                  blurOnSubmit={false}
                />
                <Pressable
                  style={styles.pasteButton}
                  onPress={handlePaste}
                >
                  <Image
                    source={require('../../assets/paste-icon.png')}
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
              onPress={handleContinue}
              disabled={!sendRecipient || !!addressError}
            >
              <Text style={styles.amountContinueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
