/**
 * Tests for useNotificationsPreference hook
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store');

import { useNotificationsPreference } from '../useNotificationsPreference';

describe('useNotificationsPreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading
    );

    const { result } = renderHook(() => useNotificationsPreference());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.notificationsEnabled).toBe(false);
  });

  it('should load notifications enabled as true from storage', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notificationsEnabled).toBe(true);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('notificationsEnabled');
  });

  it('should load notifications enabled as false from storage', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notificationsEnabled).toBe(false);
  });

  it('should default to false when storage returns null', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notificationsEnabled).toBe(false);
  });

  it('should default to false when storage returns undefined', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notificationsEnabled).toBe(false);
  });

  it('should only load once on mount', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    const { result, rerender } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Rerender the hook
    rerender({});

    // Should still only have been called once
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('should handle non-string values gracefully', async () => {
    // Even though getItemAsync should return string, test edge cases
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('TRUE');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // 'TRUE' !== 'true', so should be false
    expect(result.current.notificationsEnabled).toBe(false);
  });

  it('should return correct interface shape', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check that the returned object has the expected shape
    expect(result.current).toHaveProperty('notificationsEnabled');
    expect(result.current).toHaveProperty('isLoading');
    expect(typeof result.current.notificationsEnabled).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
  });
});
