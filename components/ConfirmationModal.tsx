/**
 * ConfirmationModal Component
 * Custom modal for confirming destructive actions (logout, delete wallet, etc.)
 */

import React from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from './icons';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'destructive' | 'primary';
  iconName?: string;
  isLoading?: boolean;
  loadingText?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
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
  isLoading = false,
  loadingText,
  confirmDisabled = false,

  // Callbacks
  onConfirm,
  onCancel,

  // Styles
  styles,
}: ConfirmationModalProps) {
  if (!visible) return null;

  const confirmLabel = isLoading && loadingText ? loadingText : confirmText || 'Confirm';
  const isConfirmDisabled = isLoading || confirmDisabled;

  return (
    <View style={styles.modalOverlay} testID="confirmation-modal">
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
            style={[
              styles.confirmationModalButton,
              styles.confirmationModalButtonCancel,
              isLoading && { opacity: 0.6 },
            ]}
            onPress={onCancel}
            disabled={isLoading}
            testID="confirmation-cancel-btn"
          >
            <Text style={styles.confirmationModalButtonTextCancel}>{cancelText || 'Cancel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmationModalButton,
              confirmStyle === 'destructive'
                ? styles.confirmationModalButtonDestructive
                : styles.confirmationModalButtonPrimary,
              isConfirmDisabled && { opacity: 0.75 },
            ]}
            onPress={onConfirm}
            disabled={isConfirmDisabled}
            testID="confirmation-confirm-btn"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {isLoading && (
                <ActivityIndicator
                  size="small"
                  color="#DDDDDD"
                  style={{ marginRight: 8 }}
                  testID="confirmation-loading-indicator"
                />
              )}
              <Text style={styles.confirmationModalButtonText}>{confirmLabel}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
