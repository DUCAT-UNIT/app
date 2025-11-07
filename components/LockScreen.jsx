/**
 * LockScreen Component
 * Handles PIN entry for authentication
 * Displayed when app is locked and user needs to authenticate
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as AuthService from '../services/authService';
import { ERRORS } from '../utils/messages';
import styles from '../styles';

export default function LockScreen({ onAuthenticated, showFaceIdButton, onFaceIdPress }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handlePinDigit = (digit) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 6) {
        // Verify PIN
        AuthService.verifyPin(newPin).then(isValid => {
          if (isValid) {
            setPin('');
            setPinError('');
            onAuthenticated();
          } else {
            setPinError(ERRORS.INCORRECT_PIN);
            setPin('');
          }
        });
      }
    }
  };

  const handlePinDelete = () => {
    setPin(pin.slice(0, -1));
    setPinError('');
  };

  return (
    <View style={styles.lockScreen}>
      <StatusBar style="light" />

      {/* Title */}
      <Text style={styles.lockTitle}>Enter PIN</Text>

      {/* PIN Error */}
      {pinError ? <Text style={styles.lockPinError}>{pinError}</Text> : null}

      {/* PIN Dots */}
      <View style={styles.lockPinDots}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <View
            key={i}
            style={[
              styles.lockPinDot,
              i < pin.length && styles.lockPinDotFilled
            ]}
          />
        ))}
      </View>

      {/* FaceID Button */}
      {showFaceIdButton && onFaceIdPress && (
        <TouchableOpacity style={styles.faceIdButton} onPress={onFaceIdPress}>
          <Text style={styles.faceIdText}>FaceID</Text>
          <Text style={styles.faceIdArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Keypad */}
      <View style={styles.lockKeypad}>
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.lockKeypadRow}>
            {row.map(num => (
              <TouchableOpacity
                key={num}
                style={styles.lockKey}
                onPress={() => handlePinDigit(String(num))}
              >
                <Text style={styles.lockKeyText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.lockKeypadRow}>
          <View style={styles.lockKey} />
          <TouchableOpacity
            style={styles.lockKey}
            onPress={() => handlePinDigit('0')}
          >
            <Text style={styles.lockKeyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.lockKey}
            onPress={handlePinDelete}
          >
            <Text style={styles.lockKeyText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

LockScreen.propTypes = {
  onAuthenticated: PropTypes.func.isRequired,
  showFaceIdButton: PropTypes.bool,
  onFaceIdPress: PropTypes.func,
};
