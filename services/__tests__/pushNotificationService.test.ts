/**
 * Tests for Push Notification Service
 *
 * expo-notifications, expo-constants, react-native Platform, apiClient, and isE2E
 * are all mocked so no native code executes.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Inline-mock the modules that pushNotificationService depends on beyond jest.setup.js
jest.mock('../../utils/apiClient', () => ({
  deleteJSON: jest.fn(),
  postJSON: jest.fn(),
}));

jest.mock('../../utils/e2e', () => ({
  isE2E: jest.fn(() => false),
}));

jest.mock('../settingsService', () => ({
  getNotificationsEnabled: jest.fn().mockResolvedValue(true),
}));

// Pull the mocked implementations after jest.mock declarations
import { deleteJSON, postJSON } from '../../utils/apiClient';
import { getNotificationsEnabled } from '../settingsService';
import {
  getExpoPushToken,
  registerPushToken,
  unregisterPushToken,
  sendLocalNotification,
  watchTransaction,
  initializePushNotifications,
} from '../pushNotificationService';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockScheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
const mockSetNotificationChannelAsync = Notifications.setNotificationChannelAsync as jest.Mock;
const mockDeleteJSON = deleteJSON as jest.Mock;
const mockPostJSON = postJSON as jest.Mock;
const mockGetNotificationsEnabled = getNotificationsEnabled as jest.Mock;
const PUSH_API_BASE_URL = 'https://config.ducatprotocol.com';

// ─── getExpoPushToken ────────────────────────────────────────────────────────

describe('getExpoPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore non-E2E mode for each test
    jest.resetModules();
  });

  describe('happy path', () => {
    it('should return the push token string when permissions are already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token-abc]' });

      const token = await getExpoPushToken();

      expect(token).toBe('ExponentPushToken[test-token-abc]');
      expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'mock-project-id' });
    });

    it('should request permissions when existing status is not granted, then succeed', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[new-token]' });

      const token = await getExpoPushToken();

      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
      expect(token).toBe('ExponentPushToken[new-token]');
    });
  });

  describe('permission denied', () => {
    it('should return null when existing permission is denied and request is also denied', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const token = await getExpoPushToken();

      expect(token).toBeNull();
      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('should return null when permission request returns undetermined', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'undetermined' });

      const token = await getExpoPushToken();

      expect(token).toBeNull();
    });
  });

  describe('missing projectId', () => {
    it('should return null when Constants has no projectId in any field', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

      // Temporarily remove projectId sources
      const originalExpoConfig = Constants.expoConfig;
      const originalEasConfig = Constants.easConfig;

      Object.assign(Constants, { expoConfig: {} });
      Object.assign(Constants, { easConfig: {} });

      const token = await getExpoPushToken();

      Object.assign(Constants, { expoConfig: originalExpoConfig });
      Object.assign(Constants, { easConfig: originalEasConfig });

      expect(token).toBeNull();
      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return null and not throw when getExpoPushTokenAsync rejects', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockGetExpoPushTokenAsync.mockRejectedValue(new Error('Device not registered'));

      const token = await getExpoPushToken();

      expect(token).toBeNull();
    });

    it('should return null when getPermissionsAsync throws', async () => {
      mockGetPermissionsAsync.mockRejectedValue(new Error('Permissions API unavailable'));

      const token = await getExpoPushToken();

      expect(token).toBeNull();
    });

    it('should return null when error is a non-Error object', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockGetExpoPushTokenAsync.mockRejectedValue('string error');

      const token = await getExpoPushToken();

      expect(token).toBeNull();
    });
  });
});

// ─── registerPushToken ───────────────────────────────────────────────────────

describe('registerPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationsEnabled.mockResolvedValue(true);
  });

  describe('happy path', () => {
    it('should call postJSON with the correct endpoint, token, and walletAddress', async () => {
      mockPostJSON.mockResolvedValue(undefined);

      await registerPushToken('ExponentPushToken[abc]', 'tb1pMY_ADDRESS');

      expect(mockPostJSON).toHaveBeenCalledWith(
        `${PUSH_API_BASE_URL}/api/register`,
        {
          token: 'ExponentPushToken[abc]',
          walletAddress: 'tb1pMY_ADDRESS',
          network: 'mutinynet',
        }
      );
    });

    it('should always include network: "mutinynet" in the payload', async () => {
      mockPostJSON.mockResolvedValue(undefined);

      await registerPushToken('any-token', 'any-address');

      const callArgs = mockPostJSON.mock.calls[0][1] as Record<string, string>;
      expect(callArgs.network).toBe('mutinynet');
    });
  });

  describe('error handling', () => {
    it('should not throw when postJSON rejects', async () => {
      mockPostJSON.mockRejectedValue(new Error('Network error'));

      await expect(registerPushToken('token', 'address')).resolves.toBeUndefined();
    });

    it('should not throw when postJSON rejects with a non-Error value', async () => {
      mockPostJSON.mockRejectedValue('unexpected failure');

      await expect(registerPushToken('token', 'address')).resolves.toBeUndefined();
    });
  });
});

// ─── unregisterPushToken ─────────────────────────────────────────────────────

describe('unregisterPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should call deleteJSON with the unregister endpoint and token', async () => {
      mockDeleteJSON.mockResolvedValue(undefined);

      await unregisterPushToken('ExponentPushToken[xyz]');

      expect(mockDeleteJSON).toHaveBeenCalledWith(
        `${PUSH_API_BASE_URL}/api/unregister`,
        { token: 'ExponentPushToken[xyz]' }
      );
      expect(mockPostJSON).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should not throw when deleteJSON rejects', async () => {
      mockDeleteJSON.mockRejectedValue(new Error('Server error'));

      await expect(unregisterPushToken('token')).resolves.toBeUndefined();
    });
  });
});

// ─── sendLocalNotification ───────────────────────────────────────────────────

describe('sendLocalNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should schedule a notification with the provided title and body', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notif-id-1');

      await sendLocalNotification({ title: 'TX Confirmed', body: 'Your transaction was confirmed' });

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'TX Confirmed',
          body: 'Your transaction was confirmed',
          data: {},
          sound: true,
        },
        trigger: null,
      });
    });

    it('should include the data payload when provided', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notif-id-2');

      await sendLocalNotification({
        title: 'Vault Alert',
        body: 'Health below threshold',
        data: { vaultId: 'v1', severity: 'high' },
      });

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            data: { vaultId: 'v1', severity: 'high' },
          }),
        })
      );
    });

    it('should default data to an empty object when not provided', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notif-id-3');

      await sendLocalNotification({ title: 'Hi', body: 'Hello' });

      const callArgs = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(callArgs.content.data).toEqual({});
    });

    it('should use trigger: null to deliver immediately', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notif-id-4');

      await sendLocalNotification({ title: 'Now', body: 'Immediate' });

      const callArgs = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(callArgs.trigger).toBeNull();
    });

    it('should enable sound on every notification', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notif-id-5');

      await sendLocalNotification({ title: 'Sound test', body: 'Should ring' });

      const callArgs = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(callArgs.content.sound).toBe(true);
    });

    it('should not schedule when notifications are disabled', async () => {
      mockGetNotificationsEnabled.mockResolvedValue(false);

      await sendLocalNotification({ title: 'TX Confirmed', body: 'Your transaction was confirmed' });

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should not throw when scheduleNotificationAsync rejects', async () => {
      mockScheduleNotificationAsync.mockRejectedValue(new Error('Permission denied'));

      await expect(
        sendLocalNotification({ title: 'Fail', body: 'This will fail' })
      ).resolves.toBeUndefined();
    });

    it('should not throw when error is a non-Error object', async () => {
      mockScheduleNotificationAsync.mockRejectedValue('raw string rejection');

      await expect(
        sendLocalNotification({ title: 'Fail', body: 'Also fails' })
      ).resolves.toBeUndefined();
    });
  });
});

// ─── watchTransaction ───────────────────────────────────────────────────────

describe('watchTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationsEnabled.mockResolvedValue(true);
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[watch-token]' });
    mockPostJSON.mockResolvedValue(undefined);
  });

  it('should include network: "mutinynet" in watch-tx registrations', async () => {
    await watchTransaction('txid1234567890', 'tb1pMY_ADDRESS', 'liquidation');

    expect(mockPostJSON).toHaveBeenCalledWith(
      `${PUSH_API_BASE_URL}/api/watch-tx`,
      {
        txid: 'txid1234567890',
        token: 'ExponentPushToken[watch-token]',
        walletAddress: 'tb1pMY_ADDRESS',
        type: 'liquidation',
        network: 'mutinynet',
      }
    );
  });

  it('humanizes backend watch labels before registration', async () => {
    await watchTransaction('vaulttxid1234567890', 'tb1pMY_ADDRESS', 'vault_operation');

    expect(mockPostJSON).toHaveBeenCalledWith(
      `${PUSH_API_BASE_URL}/api/watch-tx`,
      expect.objectContaining({
        txid: 'vaulttxid1234567890',
        type: 'vault transaction',
        network: 'mutinynet',
      })
    );
  });

  it('does not request a token or register a watch when notifications are disabled', async () => {
    mockGetNotificationsEnabled.mockResolvedValue(false);

    await watchTransaction('txid1234567890', 'tb1pMY_ADDRESS', 'liquidation');

    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockPostJSON).not.toHaveBeenCalled();
  });
});

// ─── initializePushNotifications ─────────────────────────────────────────────

describe('initializePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationsEnabled.mockResolvedValue(true);
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[init-token]' });
    mockPostJSON.mockResolvedValue(undefined);
  });

  describe('happy path (iOS)', () => {
    it('should return the push token after successful initialization', async () => {
      const token = await initializePushNotifications('tb1pADDRESS');

      expect(token).toBe('ExponentPushToken[init-token]');
    });

    it('should register the obtained token with the backend', async () => {
      await initializePushNotifications('tb1pADDRESS');

      expect(mockPostJSON).toHaveBeenCalledWith(
        `${PUSH_API_BASE_URL}/api/register`,
        expect.objectContaining({ token: 'ExponentPushToken[init-token]', walletAddress: 'tb1pADDRESS' })
      );
    });

    it('should NOT call setNotificationChannelAsync on iOS', async () => {
      // Platform.OS is mocked to 'ios' in jest.setup.js
      await initializePushNotifications('tb1pADDRESS');

      expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    });

    it('should skip initialization when notifications are disabled', async () => {
      mockGetNotificationsEnabled.mockResolvedValue(false);

      const token = await initializePushNotifications('tb1pADDRESS');

      expect(token).toBeNull();
      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockPostJSON).not.toHaveBeenCalled();
    });
  });

  describe('when token is unavailable', () => {
    it('should return null without calling registerPushToken when token is null', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const token = await initializePushNotifications('tb1pADDRESS');

      expect(token).toBeNull();
      expect(mockPostJSON).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return null and not throw when getExpoPushTokenAsync throws', async () => {
      mockGetExpoPushTokenAsync.mockRejectedValue(new Error('Token fetch failed'));

      const token = await initializePushNotifications('tb1pADDRESS');

      expect(token).toBeNull();
    });

    it('should return null when registerPushToken throws internally', async () => {
      // getExpoPushToken succeeds, but postJSON (used by registerPushToken) rejects
      mockPostJSON.mockRejectedValue(new Error('Backend unreachable'));

      // Should still return the token (registerPushToken swallows its own errors)
      const token = await initializePushNotifications('tb1pADDRESS');

      // registerPushToken doesn't throw — so initializePushNotifications still gets the token
      expect(token).toBe('ExponentPushToken[init-token]');
    });
  });
});

// ─── E2E mode notification suppression ───────────────────────────────────────
// jest.isolateModules + require() is used because dynamic import() requires
// --experimental-vm-modules which is not enabled in this project's Jest config.

describe('E2E mode notification suppression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getExpoPushToken should return null in E2E mode', async () => {
    let getTokenE2E!: () => Promise<string | null>;

    jest.isolateModules(() => {
      jest.doMock('../../utils/e2e', () => ({ isE2E: jest.fn(() => true) }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ({ getExpoPushToken: getTokenE2E } = require('../pushNotificationService'));
    });

    const token = await getTokenE2E();
    expect(token).toBeNull();
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
  });

  it('registerPushToken should return immediately in E2E mode', async () => {
    let registerE2E!: (token: string, walletAddress: string) => Promise<void>;

    jest.isolateModules(() => {
      jest.doMock('../../utils/e2e', () => ({ isE2E: jest.fn(() => true) }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ({ registerPushToken: registerE2E } = require('../pushNotificationService'));
    });

    await registerE2E('some-token', 'some-address');
    expect(mockPostJSON).not.toHaveBeenCalled();
  });

  it('sendLocalNotification should return immediately in E2E mode', async () => {
    let sendE2E!: (params: { title: string; body: string; data?: Record<string, unknown> }) => Promise<void>;

    jest.isolateModules(() => {
      jest.doMock('../../utils/e2e', () => ({ isE2E: jest.fn(() => true) }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ({ sendLocalNotification: sendE2E } = require('../pushNotificationService'));
    });

    await sendE2E({ title: 'Test', body: 'Body' });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('initializePushNotifications should return null in E2E mode', async () => {
    let initE2E!: (walletAddress: string) => Promise<string | null>;

    jest.isolateModules(() => {
      jest.doMock('../../utils/e2e', () => ({ isE2E: jest.fn(() => true) }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ({ initializePushNotifications: initE2E } = require('../pushNotificationService'));
    });

    const result = await initE2E('tb1pADDRESS');
    expect(result).toBeNull();
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
  });
});
