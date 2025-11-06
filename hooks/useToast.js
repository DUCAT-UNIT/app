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
  const toastTimeout = useRef(null);

  const showToast = (message) => {
    // Clear any existing timeout
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    // Show new toast
    setToastMessage(message);
    setToastVisible(true);

    // Auto-hide after 2 seconds
    toastTimeout.current = setTimeout(() => {
      setToastVisible(false);
    }, 2000);
  };

  return {
    showToast,
    toastMessage,
    toastVisible,
  };
}
