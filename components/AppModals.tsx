import React from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import ConfirmationModal from './ConfirmationModal';
import type { NotificationsPromptMode } from '../hooks/useAppSettings';

/**
 * AppModals Component
 * Groups all confirmation modals used throughout the app
 */

export interface ConfirmationModalStyles {
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
}

export interface AppModalsProps {
  showLogoutModal: boolean;
  confirmLogout: () => void;
  cancelLogout: () => void;
  showDeleteModal: boolean;
  isDeletingWallet?: boolean;
  confirmDeleteWallet: () => void | Promise<void>;
  cancelDeleteWallet: () => void;
  showFaceIdModal: boolean;
  biometricEnabled: boolean;
  confirmFaceIdToggle: () => void;
  cancelFaceIdToggle: () => void;
  showNotificationsModal: boolean;
  notificationsEnabled: boolean;
  notificationsPromptMode?: NotificationsPromptMode;
  confirmNotificationsToggle: () => void;
  cancelNotificationsToggle: () => void;
  styles: ConfirmationModalStyles;
}

export default function AppModals({
  // Logout modal
  showLogoutModal,
  confirmLogout,
  cancelLogout,

  // Delete wallet modal
  showDeleteModal,
  isDeletingWallet = false,
  confirmDeleteWallet,
  cancelDeleteWallet,

  // Face ID modal
  showFaceIdModal,
  biometricEnabled,
  confirmFaceIdToggle,
  cancelFaceIdToggle,

  // Notifications modal
  showNotificationsModal,
  notificationsEnabled,
  notificationsPromptMode = 'settings',
  confirmNotificationsToggle,
  cancelNotificationsToggle,

  // Styles
  styles,
}: AppModalsProps) {
  const isOnboardingNotificationsPrompt =
    notificationsPromptMode === 'onboarding' && !notificationsEnabled;

  return (
    <>
      {/* Lock Wallet Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        title="Lock Wallet"
        message="Are you sure you want to lock your wallet? You'll need to enter your PIN to access it again."
        confirmText="Lock"
        confirmStyle="primary"
        iconName="logout"
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
        styles={styles}
      />

      {/* Delete Wallet Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Local Wallet"
        message="This removes wallet data from this device and cannot be undone locally. Your iCloud passkey backup is not deleted. Make sure you still have a recovery method before continuing."
        confirmText="Delete"
        confirmStyle="destructive"
        iconName="delete_wallet"
        isLoading={isDeletingWallet}
        loadingText="Deleting..."
        onConfirm={confirmDeleteWallet}
        onCancel={cancelDeleteWallet}
        styles={styles}
      />

      {/* Face ID Toggle Modal */}
      <ConfirmationModal
        visible={showFaceIdModal}
        title={biometricEnabled ? 'Disable Face ID' : 'Enable Face ID'}
        message={
          biometricEnabled
            ? 'Are you sure you want to disable Face ID authentication?'
            : 'Enable Face ID for quick and secure authentication?'
        }
        confirmText={biometricEnabled ? 'Disable' : 'Enable'}
        confirmStyle="primary"
        iconName="face_id"
        onConfirm={confirmFaceIdToggle}
        onCancel={cancelFaceIdToggle}
        styles={styles}
      />

      {/* Notifications Toggle Modal */}
      <ConfirmationModal
        visible={showNotificationsModal}
        title={
          isOnboardingNotificationsPrompt
            ? 'Activate Notifications'
            : notificationsEnabled
              ? 'Disable Notifications'
              : 'Enable Notifications'
        }
        message={
          isOnboardingNotificationsPrompt
            ? 'Activate notifications to know when transactions confirm and when your vault health needs attention.'
            : notificationsEnabled
            ? 'Are you sure you want to disable transaction notifications?'
            : 'Enable notifications for transaction confirmations?'
        }
        confirmText={
          isOnboardingNotificationsPrompt ? 'Activate' : notificationsEnabled ? 'Disable' : 'Enable'
        }
        cancelText={isOnboardingNotificationsPrompt ? 'Not Now' : undefined}
        confirmStyle="primary"
        iconName="notification"
        onConfirm={confirmNotificationsToggle}
        onCancel={cancelNotificationsToggle}
        styles={styles}
      />
    </>
  );
}
