jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../cashuProofManager', () => ({
  addProofs: jest.fn(),
  getCurrentCashuAccount: jest.fn(() => null),
}));

import * as SecureStore from 'expo-secure-store';
import { addProofs, getCurrentCashuAccount } from '../cashuProofManager';
import {
  persistProofRecoveryRecord,
  recoverFailedProofSaves,
} from '../cashuProofRecoveryQueue';
import type { CashuProof } from '../crypto';

const REGISTRY_KEY = 'cashu_failed_proof_recovery_keys_v1';
const FALLBACK_KEY = 'cashu_failed_proofs_latest_v1';

describe('cashuProofRecoveryQueue', () => {
  const proof: CashuProof = {
    amount: 1,
    secret: 'secret-1',
    C: 'C1',
    id: 'keyset1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (addProofs as jest.Mock).mockResolvedValue(undefined);
    (getCurrentCashuAccount as jest.Mock).mockReturnValue(null);
  });

  it('persists recovery records with the current Cashu account', async () => {
    (getCurrentCashuAccount as jest.Mock).mockReturnValue('tb1paccount');

    const recoveryKey = await persistProofRecoveryRecord([proof], 1, 'receive_token', 'save failed');

    expect(recoveryKey).toMatch(/^cashu_failed_proofs_/);
    const recordWrite = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
      ([key]) => key === recoveryKey,
    );
    expect(JSON.parse(recordWrite[1])).toMatchObject({
      proofs: [proof],
      amount: 1,
      source: 'receive_token',
      error: 'save failed',
      taprootAddress: 'tb1paccount',
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      REGISTRY_KEY,
      JSON.stringify([recoveryKey]),
      expect.any(Object),
    );
  });

  it('fails closed instead of overwriting a corrupt recovery registry', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{bad json');

    await expect(
      persistProofRecoveryRecord([proof], 1, 'receive_token')
    ).rejects.toThrow('Proof recovery registry corrupted');

    expect((SecureStore.setItemAsync as jest.Mock).mock.calls.some(
      ([key]) => key === REGISTRY_KEY,
    )).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^cashu_failed_proof_recovery_keys_v1_corrupt_/),
      '{bad json',
      expect.any(Object),
    );
  });

  it('does not replay recovery records into a different account', async () => {
    (getCurrentCashuAccount as jest.Mock).mockReturnValue('tb1pcurrent');
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === REGISTRY_KEY) {
        return Promise.resolve(JSON.stringify(['recovery-1']));
      }
      if (key === 'recovery-1') {
        return Promise.resolve(JSON.stringify({
          proofs: [proof],
          amount: 1,
          timestamp: new Date().toISOString(),
          source: 'receive_token',
          taprootAddress: 'tb1pother',
        }));
      }
      return Promise.resolve(null);
    });

    const result = await recoverFailedProofSaves();

    expect(result).toMatchObject({
      checked: 1,
      recovered: 0,
      totalAmountRecovered: 0,
      errors: [],
    });
    expect(addProofs).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('recovery-1');
  });

  it('does not replay account-tagged recovery records before account initialization', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === REGISTRY_KEY) {
        return Promise.resolve(JSON.stringify(['recovery-1']));
      }
      if (key === 'recovery-1') {
        return Promise.resolve(JSON.stringify({
          proofs: [proof],
          amount: 1,
          timestamp: new Date().toISOString(),
          source: 'receive_token',
          taprootAddress: 'tb1paccount',
        }));
      }
      return Promise.resolve(null);
    });

    const result = await recoverFailedProofSaves();

    expect(result).toMatchObject({
      checked: 1,
      recovered: 0,
      totalAmountRecovered: 0,
      errors: [],
    });
    expect(addProofs).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('recovery-1');
  });

  it('reports corrupt recovery registry during startup recovery without overwriting it', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('not json');

    const result = await recoverFailedProofSaves();

    expect(result.checked).toBe(0);
    expect(result.recovered).toBe(0);
    expect(result.errors[0]).toContain('Proof recovery registry corrupted');
    expect((SecureStore.setItemAsync as jest.Mock).mock.calls.some(
      ([key]) => key === REGISTRY_KEY,
    )).toBe(false);
  });

  it('recovers proofs from the fallback slot when the registry write was interrupted', async () => {
    const fallbackRecord = {
      proofs: [proof],
      amount: 1,
      timestamp: new Date().toISOString(),
      source: 'receive_token',
      taprootAddress: 'tb1paccount',
    };
    (getCurrentCashuAccount as jest.Mock).mockReturnValue('tb1paccount');
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === REGISTRY_KEY) {
        return Promise.resolve(null);
      }
      if (key === FALLBACK_KEY) {
        return Promise.resolve(JSON.stringify(fallbackRecord));
      }
      return Promise.resolve(null);
    });

    const result = await recoverFailedProofSaves();

    expect(result).toMatchObject({
      checked: 1,
      recovered: 1,
      totalAmountRecovered: 1,
      errors: [],
    });
    expect(addProofs).toHaveBeenCalledWith([proof]);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(FALLBACK_KEY);
  });
});
