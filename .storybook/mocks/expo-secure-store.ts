// Mock for expo-secure-store
const store: Record<string, string> = {};

export const setItemAsync = async (key: string, value: string) => {
  store[key] = value;
};

export const getItemAsync = async (key: string) => {
  return store[key] || null;
};

export const deleteItemAsync = async (key: string) => {
  delete store[key];
};

export const isAvailableAsync = async () => true;

export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
export const ALWAYS = 'ALWAYS';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export const ALWAYS_THIS_DEVICE_ONLY = 'ALWAYS_THIS_DEVICE_ONLY';

export default { setItemAsync, getItemAsync, deleteItemAsync, isAvailableAsync };
