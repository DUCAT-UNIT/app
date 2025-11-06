/**
 * useToast Hook
 * Custom hook for managing toast notifications
 *
 * @returns {Object} - { showToast, toastMessage, toastVisible }
 */

import { useState, useRef } from 'react';

export function useToast() {
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState('success'); // 'success' or 'error'
  const toastTimeout = useRef(null);

  const showToast = (message, type = 'success') => {
    // Clear any existing timeout
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    // Show new toast
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);

    // Auto-hide after 3 seconds (longer for errors to read)
    const duration = type === 'error' ? 3500 : 2000;
    toastTimeout.current = setTimeout(() => {
      setToastVisible(false);
    }, duration);
  };

  return {
    showToast,
    toastMessage,
    toastVisible,
    toastType,
  };
}
