/**
 * Toast Component
 * Displays temporary notification messages at the bottom of the screen
 */

import React from 'react';
import { View, Text } from 'react-native';

export default function Toast({ visible, message, styles }) {
  if (!visible) return null;

  return (
    <View style={styles.toastContainer}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}
