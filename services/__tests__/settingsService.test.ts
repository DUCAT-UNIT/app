// @ts-nocheck
/**
 * Tests for Settings Service
 */

import {
  SettingKeys,
  getString,
  setString,
  getBoolean,
  setBoolean,
  getNumber,
  setNumber,
  getObject,
  setObject,
  deleteSetting,
  toggle,
  exists,
  getMultiple,
  setMultiple,
} from '../settingsService';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('SettingKeys', () => {
  it('should export all setting key constants', () => {
    expect(SettingKeys.BIOMETRIC_ENABLED).toBe('biometricEnabled');
    expect(SettingKeys.NOTIFICATIONS_ENABLED).toBe('notificationsEnabled');
    expect(SettingKeys.SHOW_ZERO_ASSETS).toBe('showZeroAssets');
    expect(SettingKeys.CURRENT_ACCOUNT).toBe('currentAccount');
  });
});

describe('getString', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get string value from storage', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('testvalue');

    const result = await getString('testKey', 'default');

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('testKey');
    expect(result).toBe('testvalue');
  });

  it('should return default value when key not found', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await getString('nonexistent', 'defaultValue');

    expect(result).toBe('defaultValue');
  });

  it('should return default value on error', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const result = await getString('testKey', 'fallback');

    expect(result).toBe('fallback');
  });

  it('should use empty string as default when not provided', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await getString('key');

    expect(result).toBe('');
  });
});

describe('setString', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set string value in storage', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await setString('testKey', 'testValue');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', 'testValue');
    expect(result).toBe(true);
  });

  it('should convert value to string', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    await setString('testKey', 123 as unknown as string);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', '123');
  });

  it('should return false on error', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const result = await setString('testKey', 'value');

    expect(result).toBe(false);
  });
});

describe('getBoolean', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get true boolean value', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    const result = await getBoolean('testKey', false);

    expect(result).toBe(true);
  });

  it('should get false boolean value', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');

    const result = await getBoolean('testKey', true);

    expect(result).toBe(false);
  });

  it('should return default value when key not found', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await getBoolean('nonexistent', true);

    expect(result).toBe(true);
  });

  it('should return default value on error', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await getBoolean('testKey', false);

    expect(result).toBe(false);
  });

  it('should use false as default when not provided', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await getBoolean('key');

    expect(result).toBe(false);
  });
});

describe('setBoolean', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set true boolean value', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await setBoolean('testKey', true);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', 'true');
    expect(result).toBe(true);
  });

  it('should set false boolean value', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await setBoolean('testKey', false);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', 'false');
    expect(result).toBe(true);
  });

  it('should return false on error', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await setBoolean('testKey', true);

    expect(result).toBe(false);
  });
});

describe('getNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get number value', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('42');

    const result = await getNumber('testKey', 0);

    expect(result).toBe(42);
  });

  it('should get float number', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('3.14');

    const result = await getNumber('testKey', 0);

    expect(result).toBe(3.14);
  });

  it('should return default value when key not found', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await getNumber('nonexistent', 100);

    expect(result).toBe(100);
  });

  it('should return default value for invalid number', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('notanumber');

    const result = await getNumber('testKey', 50);

    expect(result).toBe(50);
  });

  it('should return default value on error', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await getNumber('testKey', 0);

    expect(result).toBe(0);
  });

  it('should use 0 as default when not provided', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await getNumber('key');

    expect(result).toBe(0);
  });
});

describe('setNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set number value', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await setNumber('testKey', 42);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', '42');
    expect(result).toBe(true);
  });

  it('should set float number', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    await setNumber('testKey', 3.14159);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', '3.14159');
  });

  it('should return false on error', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await setNumber('testKey', 42);

    expect(result).toBe(false);
  });
});

describe('getObject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get object value', async () => {
    const testObj = { foo: 'bar', num: 123 };
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(testObj));

    const result = await getObject('testKey', {});

    expect(result).toEqual(testObj);
  });

  it('should return default value when key not found', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const defaultObj = { default: true };

    const result = await getObject('nonexistent', defaultObj);

    expect(result).toEqual(defaultObj);
  });

  it('should return default value on JSON parse error', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('invalid json');
    const defaultObj = { fallback: true };

    const result = await getObject('testKey', defaultObj);

    expect(result).toEqual(defaultObj);
  });

  it('should return default value on storage error', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await getObject('testKey', {});

    expect(result).toEqual({});
  });
});

describe('setObject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set object value', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    const testObj = { foo: 'bar', num: 123 };

    const result = await setObject('testKey', testObj);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', JSON.stringify(testObj));
    expect(result).toBe(true);
  });

  it('should return false on error', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await setObject('testKey', { data: 'test' });

    expect(result).toBe(false);
  });
});

describe('deleteSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete setting', async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await deleteSetting('testKey');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('testKey');
    expect(result).toBe(true);
  });

  it('should return false on error', async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await deleteSetting('testKey');

    expect(result).toBe(false);
  });
});

describe('toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should toggle true to false', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await toggle('testKey');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', 'false');
    expect(result).toBe(false);
  });

  it('should toggle false to true', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await toggle('testKey');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', 'true');
    expect(result).toBe(true);
  });

  it('should toggle null (default false) to true', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const result = await toggle('testKey');

    expect(result).toBe(true);
  });
});

describe('exists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when key exists', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('somevalue');

    const result = await exists('testKey');

    expect(result).toBe(true);
  });

  it('should return false when key does not exist', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await exists('testKey');

    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await exists('testKey');

    expect(result).toBe(false);
  });
});

describe('getMultiple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get multiple settings of different types', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'strKey') return Promise.resolve('stringValue');
      if (key === 'boolKey') return Promise.resolve('true');
      if (key === 'numKey') return Promise.resolve('42');
      if (key === 'objKey') return Promise.resolve('{"foo":"bar"}');
      return Promise.resolve(null);
    });

    const settings = [
      { key: 'strKey', type: 'string' as const, defaultValue: '' },
      { key: 'boolKey', type: 'boolean' as const, defaultValue: false },
      { key: 'numKey', type: 'number' as const, defaultValue: 0 },
      { key: 'objKey', type: 'object' as const, defaultValue: {} },
    ];

    const result = await getMultiple(settings);

    expect(result).toEqual({
      strKey: 'stringValue',
      boolKey: true,
      numKey: 42,
      objKey: { foo: 'bar' },
    });
  });

  it('should use default values for missing keys', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const settings = [
      { key: 'key1', type: 'string' as const, defaultValue: 'default' },
      { key: 'key2', type: 'boolean' as const, defaultValue: true },
    ];

    const result = await getMultiple(settings);

    expect(result).toEqual({
      key1: 'default',
      key2: true,
    });
  });
});

describe('setMultiple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set multiple settings of different types', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const settings = {
      strKey: 'stringValue',
      boolKey: true,
      numKey: 42,
      objKey: { foo: 'bar' },
    };

    const result = await setMultiple(settings);

    expect(result).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('strKey', 'stringValue');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('boolKey', 'true');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('numKey', '42');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('objKey', '{"foo":"bar"}');
  });

  it('should return false on error', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Error'));

    const result = await setMultiple({ key: 'value' });

    expect(result).toBe(false);
  });
});
