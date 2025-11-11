/**
 * useToast Hook
 * Custom hook for managing toast notifications with support for multiple toasts
 *
 * @returns {Object} - { showToast, toasts }
 */

import { useState, useRef } from 'react';

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef({});

  const showToast = (message, type = 'success') => {
    // Clear all existing timeouts
    Object.keys(timeoutsRef.current).forEach((key) => {
      clearTimeout(timeoutsRef.current[key]);
      delete timeoutsRef.current[key];
    });

    const id = nextId++;
    const duration = type === 'error' ? 3500 : 2000;

    // Replace all toasts with just this new one
    const newToast = { id, message, type };
    setToasts([newToast]);

    // Auto-hide after duration
    timeoutsRef.current[id] = setTimeout(() => {
      setToasts([]);
      delete timeoutsRef.current[id];
    }, duration);
  };

  const dismissToast = (id) => {
    // Clear timeout
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }

    // Remove toast
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return {
    showToast,
    toasts,
    dismissToast,
    // Legacy props for backwards compatibility
    toastMessage: toasts[0]?.message || '',
    toastVisible: toasts.length > 0,
    toastType: toasts[0]?.type || 'success',
  };
}
