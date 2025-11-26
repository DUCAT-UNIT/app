/**
 * useToast Hook
 * Custom hook for managing toast notifications with support for multiple toasts
 */

import { useState, useRef } from 'react';
import type { ToastType, Toast } from '../types/notification';

// Re-export types for backwards compatibility
export type { ToastType, Toast } from '../types/notification';

interface UseToastReturn {
  showToast: (message: string, type?: ToastType) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  toastMessage: string;
  toastVisible: boolean;
  toastType: ToastType;
}

let nextId = 0;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const showToast = (message: string, type: ToastType = 'success'): void => {
    // Clear all existing timeouts
    Object.keys(timeoutsRef.current).forEach((key) => {
      clearTimeout(timeoutsRef.current[Number(key)]);
      delete timeoutsRef.current[Number(key)];
    });

    const id = nextId++;
    const duration = type === 'error' ? 3500 : 2000;

    // Replace all toasts with just this new one
    const newToast: Toast = { id, message, type };
    setToasts([newToast]);

    // Auto-hide after duration
    timeoutsRef.current[id] = setTimeout(() => {
      setToasts([]);
      delete timeoutsRef.current[id];
    }, duration);
  };

  const dismissToast = (id: number): void => {
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
