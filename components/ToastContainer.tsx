import React from 'react';
import { View, StyleSheet } from 'react-native';
import TransactionToast from './TransactionToast';
import type { Toast } from '../contexts/NotificationContext';

interface ToastContainerProps {
  toasts: Toast[];
}

export default function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <View style={styles.toastContainer}>
      {toasts.map((toast) => (
        <TransactionToast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 9999,
  },
});
