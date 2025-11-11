/**
 * ToastContainer Component
 * Displays multiple toast notifications stacked at the top of the screen
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';

const COLORS = {
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  DANGER_RED: '#FF4444',
};

export default function ToastContainer({ toasts }) {
  if (!toasts || toasts.length === 0) {
    return null;
  }

  // Only show the first (and only) toast
  const toast = toasts[0];

  const toastStyle =
    toast.type === 'error' ? [localStyles.toast, localStyles.toastError] : localStyles.toast;

  const textStyle =
    toast.type === 'error'
      ? [localStyles.toastText, localStyles.toastTextError]
      : localStyles.toastText;

  return (
    <View style={localStyles.container}>
      <View style={toastStyle}>
        <Text style={textStyle}>{toast.message}</Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // Below the status bar and mutinynet banner
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999999,
  },
  toast: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastError: {
    backgroundColor: COLORS.DANGER_RED,
  },
  toastText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.BLACK,
    fontWeight: '600',
    textAlign: 'center',
  },
  toastTextError: {
    color: COLORS.WHITE,
  },
});

ToastContainer.propTypes = {
  toasts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['success', 'error']),
    })
  ),
};
