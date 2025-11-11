/**
 * ConfirmationModal Component
 * Custom modal for confirming destructive actions (logout, delete wallet, etc.)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from './Icon';

export default function ConfirmationModal({
  // State
  visible,
  title,
  message,
  confirmText,
  cancelText,
  confirmStyle, // 'destructive' or 'primary'
  iconName, // Optional icon to display at the top

  // Callbacks
  onConfirm,
  onCancel,

  // Styles
  styles,
}) {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.confirmationModal}>
        {iconName && (
          <View style={styles.confirmationModalIconContainer}>
            <Icon name={iconName} size={48} color="#DDDDDD" />
          </View>
        )}
        <Text style={styles.confirmationModalTitle}>{title}</Text>
        <Text style={styles.confirmationModalText}>{message}</Text>
        <View style={styles.confirmationModalButtons}>
          <TouchableOpacity
            style={[styles.confirmationModalButton, styles.confirmationModalButtonCancel]}
            onPress={onCancel}
          >
            <Text style={styles.confirmationModalButtonTextCancel}>{cancelText || 'Cancel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmationModalButton,
              confirmStyle === 'destructive'
                ? styles.confirmationModalButtonDestructive
                : styles.confirmationModalButtonPrimary,
            ]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmationModalButtonText}>{confirmText || 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

ConfirmationModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  confirmStyle: PropTypes.oneOf(['destructive', 'primary']),
  iconName: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  styles: PropTypes.object.isRequired,
};
