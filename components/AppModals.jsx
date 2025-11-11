import React from 'react';
import ConfirmationModal from './ConfirmationModal';

/**
 * AppModals Component
 * Groups all confirmation modals used throughout the app
 */
export default function AppModals({
  // Logout modal
  showLogoutModal,
  confirmLogout,
  cancelLogout,

  // Delete wallet modal
  showDeleteModal,
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
  confirmNotificationsToggle,
  cancelNotificationsToggle,

  // Styles
  styles,
}) {
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
        title="Delete Wallet"
        message="Are you sure you want to delete your wallet? This action cannot be undone. Make sure you have backed up your recovery phrase."
        confirmText="Delete"
        confirmStyle="destructive"
        iconName="delete_wallet"
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
        title={notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
        message={
          notificationsEnabled
            ? 'Are you sure you want to disable transaction notifications?'
            : 'Enable notifications for transaction confirmations?'
        }
        confirmText={notificationsEnabled ? 'Disable' : 'Enable'}
        confirmStyle="primary"
        iconName="notification"
        onConfirm={confirmNotificationsToggle}
        onCancel={cancelNotificationsToggle}
        styles={styles}
      />
    </>
  );
}
