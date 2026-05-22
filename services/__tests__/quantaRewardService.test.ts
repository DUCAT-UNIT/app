import * as SecureStore from 'expo-secure-store';
import {
  clearQuantaRewardLocalState,
  isQuantaAddressMarkedUnified,
  markQuantaAddressesUnified,
} from '../quantaRewardService';

const UNIFIED_ADDRESSES_KEY = 'ducat_quanta_unified_addresses_v1';
const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

describe('quantaRewardService unified account cache', () => {
  const getItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
    typeof SecureStore.getItemAsync
  >;
  const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
    typeof SecureStore.setItemAsync
  >;
  const deleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
    typeof SecureStore.deleteItemAsync
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    getItemAsync.mockResolvedValue(null);
    setItemAsync.mockResolvedValue(undefined);
    deleteItemAsync.mockResolvedValue(undefined);
  });

  it('marks Quanta addresses as unified and reads them case-insensitively', async () => {
    const address = 'tb1pUnifiedAddressForQuanta0000000000000000000000000000';

    await markQuantaAddressesUnified([address]);

    expect(setItemAsync).toHaveBeenCalledWith(
      UNIFIED_ADDRESSES_KEY,
      JSON.stringify([address.toLowerCase()]),
      DEVICE_ONLY
    );

    getItemAsync.mockResolvedValueOnce(JSON.stringify([address.toLowerCase()]));

    await expect(isQuantaAddressMarkedUnified(address.toUpperCase())).resolves.toBe(true);
  });

  it('merges existing unified addresses and ignores invalid values', async () => {
    const existingAddress = 'tb1qUnifiedExistingAddress000000000000000000000000';
    const nextAddress = 'tb1pUnifiedNextAddress000000000000000000000000000';
    getItemAsync.mockResolvedValueOnce(JSON.stringify([existingAddress]));

    await markQuantaAddressesUnified([existingAddress.toUpperCase(), nextAddress, 'bad']);

    const [, storedValue] = setItemAsync.mock.calls[0]!;
    const storedAddresses = JSON.parse(storedValue) as string[];

    expect(storedAddresses.sort()).toEqual(
      [existingAddress.toLowerCase(), nextAddress.toLowerCase()].sort()
    );
  });

  it('does not clear unified account history during local reward disconnect reset', async () => {
    await clearQuantaRewardLocalState();

    expect(deleteItemAsync).not.toHaveBeenCalledWith(UNIFIED_ADDRESSES_KEY, DEVICE_ONLY);
  });
});
