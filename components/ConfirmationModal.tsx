/**
 * ConfirmationModal Component
 * Custom modal for confirming destructive actions (logout, delete wallet, etc.)
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from './icons';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'destructive' | 'primary';
  iconName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  styles: {
    modalOverlay: ViewStyle;
    confirmationModal: ViewStyle;
    confirmationModalIconContainer?: ViewStyle;
    confirmationModalTitle: TextStyle;
    confirmationModalText: TextStyle;
    confirmationModalButtons: ViewStyle;
    confirmationModalButton: ViewStyle;
    confirmationModalButtonCancel: ViewStyle;
    confirmationModalButtonTextCancel: TextStyle;
    confirmationModalButtonDestructive?: ViewStyle;
    confirmationModalButtonPrimary?: ViewStyle;
    confirmationModalButtonText: TextStyle;
  };
}

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
}: ConfirmationModalProps) {
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

