/**
 * Tests for useNotificationsPreference hook
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

jest.mock('expo-secure-store');
jest.mock('../../services/pushNotificationService', () => ({
  getExpoPushToken: jest.fn(),
  unregisterPushToken: jest.fn(),
}));

import { useNotificationsPreference } from '../useNotificationsPreference';
import { getExpoPushToken, unregisterPushToken } from '../../services/pushNotificationService';

const mockGetExpoPushToken = getExpoPushToken as jest.Mock;
const mockUnregisterPushToken = unregisterPushToken as jest.Mock;

describe('useNotificationsPreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    mockGetExpoPushToken.mockResolvedValue(null);
    mockUnregisterPushToken.mockResolvedValue(undefined);
  });

  it('should initialize with loading state', () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading
    );

    const { result } = renderHook(() => useNotificationsPreference());

    expect(result.current!.isLoading).toBe(true);
    expect(result.current!.notificationsEnabled).toBe(false);
  });

  it('should load notifications enabled as true from storage', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(result.current!.notificationsEnabled).toBe(true);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('notificationsEnabled');
  });

  it('should load notifications enabled as false from storage', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(result.current!.notificationsEnabled).toBe(false);
  });

  it('should unregister stored push token when stored preference is false', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');
    mockGetExpoPushToken.mockResolvedValue('ExponentPushToken[stale-token]');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ requestPermissions: false });
    expect(mockUnregisterPushToken).toHaveBeenCalledWith('ExponentPushToken[stale-token]');
  });

  it('should default to false when storage returns null', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(result.current!.notificationsEnabled).toBe(false);
  });

  it('should migrate to true when OS notification permission is already granted and no preference exists', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(result.current!.notificationsEnabled).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'true');
  });

  it('should default to false when storage returns undefined', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(result.current!.notificationsEnabled).toBe(false);
  });

  it('should only load once on mount', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    const { result, rerender } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    const callsAfterInitialLoad = (SecureStore.getItemAsync as jest.Mock).mock.calls.length;

    // Rerender the hook
    rerender({});

    // Should not load again after rerender
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(callsAfterInitialLoad);
  });

  it('should handle non-string values gracefully', async () => {
    // Even though getItemAsync should return string, test edge cases
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('TRUE');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    // 'TRUE' !== 'true', so should be false
    expect(result.current!.notificationsEnabled).toBe(false);
  });

  it('should return correct interface shape', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useNotificationsPreference());

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    // Check that the returned object has the expected shape
    expect(result.current).toHaveProperty('notificationsEnabled');
    expect(result.current).toHaveProperty('isLoading');
    expect(typeof result.current.notificationsEnabled).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
  });
});
