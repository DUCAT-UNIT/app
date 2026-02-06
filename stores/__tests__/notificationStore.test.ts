/**
 * Tests for notificationStore
 * Consolidated to test meaningful behavior - timing, cooldowns, state transitions
 */

import { act } from '@testing-library/react-native';
import {
  useNotificationStore,
  resetNotificationStore,
} from '../notificationStore';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/turbo/turboTokenStorage', () => ({
  turboGlobal: { pendingTurboSnackbars: [] },
}));

describe('notificationStore', () => {
  beforeEach(() => {
    resetNotificationStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have null snackbar initially', () => {
    expect(useNotificationStore.getState().snackbar).toBeNull();
  });

  describe('showSnackbar', () => {
    it('should show snackbar with correct properties', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => {
        showSnackbar({
          title: 'Transaction confirmed',
          description: 'Details here',
          type: 'success',
        });
      });

      const snackbar = useNotificationStore.getState().snackbar;
      expect(snackbar?.title).toBe('Transaction confirmed');
      expect(snackbar?.description).toBe('Details here');
      expect(snackbar?.type).toBe('success');
    });

    it('should auto-dismiss after default duration', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'Success', type: 'success' }); });
      expect(useNotificationStore.getState().snackbar).not.toBeNull();

      act(() => { jest.advanceTimersByTime(3000); });
      expect(useNotificationStore.getState().snackbar).toBeNull();
    });

    it('should use custom duration when provided', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'Info', type: 'info', duration: 1000 }); });

      act(() => { jest.advanceTimersByTime(1000); });
      expect(useNotificationStore.getState().snackbar).toBeNull();
    });

    it('should not auto-dismiss persistent snackbars', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'Processing', type: 'progress', persistent: true }); });

      act(() => { jest.advanceTimersByTime(60000); });
      expect(useNotificationStore.getState().snackbar).not.toBeNull();
    });

    it('should replace existing snackbar with incremented key', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'First', type: 'info' }); });
      const firstKey = useNotificationStore.getState().snackbar?.key;

      act(() => { showSnackbar({ title: 'Second', type: 'success' }); });
      const secondKey = useNotificationStore.getState().snackbar?.key;

      expect(useNotificationStore.getState().snackbar?.title).toBe('Second');
      expect(secondKey).toBeGreaterThan(firstKey!);
    });
  });

  describe('dismissSnackbar and cooldown', () => {
    it('should dismiss snackbar and enforce cooldown period', () => {
      const { showSnackbar, dismissSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'Test', type: 'info' }); });
      act(() => { dismissSnackbar(); });
      expect(useNotificationStore.getState().snackbar).toBeNull();

      // Info snackbar blocked during cooldown
      act(() => { showSnackbar({ title: 'During cooldown', type: 'info' }); });
      expect(useNotificationStore.getState().snackbar).toBeNull();

      // Wait for cooldown (500ms)
      act(() => { jest.advanceTimersByTime(500); });
      act(() => { showSnackbar({ title: 'After cooldown', type: 'info' }); });
      expect(useNotificationStore.getState().snackbar?.title).toBe('After cooldown');
    });

    it.each(['success', 'error'] as const)('should allow %s snackbars during cooldown', (type) => {
      const { showSnackbar, dismissSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'First', type: 'info' }); });
      act(() => { dismissSnackbar(); });

      act(() => { showSnackbar({ title: `Important ${type}`, type }); });
      expect(useNotificationStore.getState().snackbar?.title).toBe(`Important ${type}`);
    });
  });

  describe('showMessage helper', () => {
    it('should show simple message with defaults', () => {
      const { showMessage } = useNotificationStore.getState();

      act(() => { showMessage('Hello world'); });

      const snackbar = useNotificationStore.getState().snackbar;
      expect(snackbar?.title).toBe('Hello world');
      expect(snackbar?.type).toBe('info');
    });

    it('should accept custom type and duration', () => {
      const { showMessage } = useNotificationStore.getState();

      act(() => { showMessage('Warning!', 'warning', 1000); });

      expect(useNotificationStore.getState().snackbar?.type).toBe('warning');
      act(() => { jest.advanceTimersByTime(1000); });
      expect(useNotificationStore.getState().snackbar).toBeNull();
    });
  });

  describe('state transition logic', () => {
    it('should not allow backward state transition for same action', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'Submitted', type: 'submitted', action: 'send' }); });
      act(() => { showSnackbar({ title: 'Pending', type: 'pending', action: 'send' }); });

      // Should still be submitted (backward transition blocked)
      expect(useNotificationStore.getState().snackbar?.type).toBe('submitted');
    });

    it('should allow forward state transition for same action', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'Pending', type: 'pending', action: 'send' }); });
      act(() => { showSnackbar({ title: 'Success', type: 'success', action: 'send' }); });

      expect(useNotificationStore.getState().snackbar?.type).toBe('success');
    });

    it('should always allow error to show', () => {
      const { showSnackbar } = useNotificationStore.getState();

      act(() => { showSnackbar({ title: 'Success', type: 'success', action: 'send' }); });
      act(() => { showSnackbar({ title: 'Error occurred', type: 'error', action: 'send' }); });

      expect(useNotificationStore.getState().snackbar?.type).toBe('error');
    });
  });

  it('should reset all state and clear timeouts', () => {
    const { showSnackbar } = useNotificationStore.getState();

    act(() => { showSnackbar({ title: 'Test', type: 'info', persistent: true }); });
    expect(useNotificationStore.getState().snackbar).not.toBeNull();

    act(() => { resetNotificationStore(); });
    expect(useNotificationStore.getState().snackbar).toBeNull();
  });
});
