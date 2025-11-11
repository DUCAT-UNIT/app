/**
 * AddressInputSheet Component
 * Bottom sheet for entering recipient Bitcoin address
 * Features: paste button, address validation, back navigation
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Pressable,

  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../utils/colors';
import Icon from '../Icon';
import styles from '../../styles';
import { validateBitcoinAddress } from '../../utils/sendHelpers';

export default function AddressInputSheet({
  visible,
  opacity,
  translateY,
  _panHandlers,
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
    <>
      <TouchableOpacity style={styles.bottomSheetBackdrop} onPress={onDismiss} activeOpacity={1} />

      <Animated.View
        style={[
          styles.bottomSheet,
          localStyles.sheet,
          {
            bottom: keyboardHeight,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.bottomSheetHandle} />

        {/* Back button */}
        <Pressable style={[styles.bottomSheetBackButton, localStyles.backButton]} onPress={onBack}>
          <Icon name="back" size={20} color={COLORS.PRIMARY_BLUE} />
        </Pressable>

        <ScrollView
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          scrollEnabled={false}
          style={localStyles.scrollView}
        >
          <View style={[styles.amountInputContainer, localStyles.inputContainer]} pointerEvents="box-none">
            <View style={localStyles.formContent}>
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
                <Pressable style={styles.pasteButton} onPress={handlePaste}>
                  <Icon name="paste" size={18} color={COLORS.WHITE} />
                </Pressable>
              </View>

              <View style={localStyles.errorContainer}>
                {addressError ? <Text style={styles.addressError}>{addressError}</Text> : null}
              </View>
            </View>

            <Pressable
              style={[
                styles.addressContinueButton,
                (!sendRecipient || addressError) && styles.addressContinueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!sendRecipient || !!addressError}
            >
              <Text style={styles.amountContinueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const localStyles = StyleSheet.create({
  sheet: {
    paddingBottom: 10,
    paddingHorizontal: 0,
  },
  backButton: {
    paddingHorizontal: 15,
  },
  scrollView: {
    flex: 1,
  },
  inputContainer: {
    paddingHorizontal: 15,
  },
  formContent: {
    width: '100%',
  },
  errorContainer: {
    minHeight: 20,
  },
});

AddressInputSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  opacity: PropTypes.object.isRequired, // Animated.Value
  translateY: PropTypes.object.isRequired, // Animated.Value
  _panHandlers: PropTypes.object,
  keyboardHeight: PropTypes.number.isRequired,
  sendRecipient: PropTypes.string.isRequired,
  addressError: PropTypes.string.isRequired,
  addressInputRef: PropTypes.object.isRequired,
  onDismiss: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  onRecipientChange: PropTypes.func.isRequired,
};
