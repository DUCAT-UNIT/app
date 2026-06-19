import type { LiquidVaultProfileWithMeta } from '../types';
import {
  assertLiquidVaultProfilesUnspent,
  filterUnspentLiquidVaultProfiles,
  isLiquidVaultProfileUnspent,
} from '../spendability';
import { fetchWithTimeout } from '../../../utils/api';
import { getTxOutspendUrl } from '../../../utils/constants';

jest.mock('../../../utils/api', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('../../../utils/constants', () => ({
  getTxOutspendUrl: jest.fn((txid: string, vout: number) =>
    `https://esplora.test/tx/${txid}/outspend/${vout}`
  ),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockGetTxOutspendUrl = getTxOutspendUrl as jest.MockedFunction<typeof getTxOutspendUrl>;

const VALID_TXID_A = 'a'.repeat(64);
const VALID_TXID_B = 'b'.repeat(64);

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function makeProfile(coinId: string): LiquidVaultProfileWithMeta {
  return {
    vaultId: coinId,
    coin_id: coinId,
    root_txid: coinId.split(':')[0],
  } as unknown as LiquidVaultProfileWithMeta;
}

describe('liquidation spendability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockResolvedValue(makeResponse({ spent: false }));
  });

  it('checks the profile coin outspend endpoint', async () => {
    await expect(isLiquidVaultProfileUnspent(makeProfile(`${VALID_TXID_A}:1`))).resolves.toBe(true);

    expect(mockGetTxOutspendUrl).toHaveBeenCalledWith(VALID_TXID_A, 1);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      `https://esplora.test/tx/${VALID_TXID_A}/outspend/1`,
      { headers: { Accept: 'application/json' } },
      4_000
    );
  });

  it('filters spent liquidation vault profiles', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce(makeResponse({
        spent: true,
        txid: 'spending-txid',
        vin: 1,
      }))
      .mockResolvedValueOnce(makeResponse({ spent: false }));

    const spent = makeProfile(`${VALID_TXID_A}:1`);
    const unspent = makeProfile(`${VALID_TXID_B}:1`);

    await expect(filterUnspentLiquidVaultProfiles([spent, unspent])).resolves.toEqual([unspent]);
  });

  it('keeps profiles when the spend check is temporarily unavailable', async () => {
    mockFetchWithTimeout.mockResolvedValue(makeResponse({ error: 'busy' }, 503));
    const profile = makeProfile(`${VALID_TXID_A}:1`);

    await expect(filterUnspentLiquidVaultProfiles([profile])).resolves.toEqual([profile]);
  });

  it('rejects stale selected profiles before submitting to guardian', async () => {
    mockFetchWithTimeout.mockResolvedValue(makeResponse({ spent: true }));

    await expect(
      assertLiquidVaultProfilesUnspent([makeProfile(`${VALID_TXID_A}:1`)])
    ).rejects.toThrow('already spent');
  });

  it('filters profiles with invalid coin ids', async () => {
    await expect(filterUnspentLiquidVaultProfiles([makeProfile('not-a-coin')])).resolves.toEqual([]);
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});
