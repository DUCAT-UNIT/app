/**
 * Toast Component
 * Displays temporary notification messages at the bottom of the screen
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';

export default function Toast({ visible, message, styles }) {
  if (!visible) return null;

  return (
    <View style={styles.toastContainer}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

Toast.propTypes = {
  visible: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  styles: PropTypes.object.isRequired,
};
