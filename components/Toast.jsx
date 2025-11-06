/**
 * Toast Component
 * Displays temporary notification messages at the bottom of the screen
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';

export default function Toast({ visible, message, type, styles }) {
  if (!visible) return null;

  const containerStyle = type === 'error'
    ? [styles.toastContainer, styles.toastContainerError]
    : styles.toastContainer;

  return (
    <View style={containerStyle}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

Toast.propTypes = {
  visible: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error']),
  styles: PropTypes.object.isRequired,
};
