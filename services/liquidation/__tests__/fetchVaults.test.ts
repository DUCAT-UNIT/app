import {
  fetchLiquidatableVaults,
  fetchVaultsByIds,
  formatValidatorResponse,
} from '../fetchVaults';
import {
  setupMockFetch,
  getMockFetch,
  mockFetchSuccess,
  mockFetchError,
  mockFetchReject,
  getFetchCall,
  getFetchCallCount,
} from '../../__tests__/testUtils';
import { COIN_SIZE, LIQ_VALIDATOR_URL } from '../constants';
import type { ValidatorLiquidatedVault } from '../types';
import { logger } from '../../../utils/logger';

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeVault(overrides: Partial<ValidatorLiquidatedVault> = {}): ValidatorLiquidatedVault {
  return {
    vault_id: 'vault-abc123',
    master_id: 'master-001',
    guardian_pubkey: 'guard-pk-hex',
    vault_pubkey: 'vault-pk-hex',
    open_account_id: 'acct-001',
    collateral_rate: 1.8,
    thold_key: 'thold-key-hex',
    output_script: 'script-hex',
    stone: {
      txid: 'stone-txid',
      vout: 0,
      version: '1',
      action: 'open',
      balance: 5000,          // 50.00 UNIT (cents)
      oracle_price: 90000,
      oracle_timestamp: 1700000000,
      liquidation_price: 75000,
      liquidation_hash: [1, 2, 3],
    },
    output: {
      txid: 'output-txid',
      vout: 1,
      amount: 200_000_000,   // 2 BTC in sats
      address: 'bc1qtest',
    },
    quote: {
      event_origin: null,
      event_price: null,
      event_stamp: null,
      event_type: 'liquidation',
      is_expired: false,
      latest_origin: 'origin-1',
      latest_price: 88000,
      latest_stamp: 1700000100,
      quote_origin: 'origin-2',
      quote_price: 87000,
      quote_stamp: 1700000050,
      req_id: 'req-001',
      req_sig: 'sig-hex',
      srv_network: 'mutinynet',
      srv_pubkey: 'srv-pk',
      thold_hash: 'thold-hash-hex',
      thold_key: 'thold-key-hex',
      thold_price: 80000,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fetchLiquidatableVaults
// ---------------------------------------------------------------------------

describe('fetchLiquidatableVaults', () => {
  beforeEach(() => {
    setupMockFetch();
  });

  describe('happy path', () => {
    it('should return an array of vaults on success', async () => {
      const vault = makeVault();
      mockFetchSuccess([vault]);

      const result = await fetchLiquidatableVaults();

      expect(result).toHaveLength(1);
      expect(result[0].vault_id).toBe('vault-abc123');
    });

    it('should return multiple vaults', async () => {
      const vaults = [makeVault({ vault_id: 'v1' }), makeVault({ vault_id: 'v2' })];
      mockFetchSuccess(vaults);

      const result = await fetchLiquidatableVaults();

      expect(result).toHaveLength(2);
      expect(result[0].vault_id).toBe('v1');
      expect(result[1].vault_id).toBe('v2');
    });

    it('should filter out vaults with expired liquidation quotes', async () => {
      const vaults = [
        makeVault({ vault_id: 'active' }),
        makeVault({
          vault_id: 'expired',
          quote: { ...makeVault().quote, is_expired: true },
        }),
      ];
      mockFetchSuccess(vaults);

      const result = await fetchLiquidatableVaults();

      expect(result).toHaveLength(1);
      expect(result[0].vault_id).toBe('active');
    });

    it('should return [] when every returned liquidation quote is expired', async () => {
      mockFetchSuccess([
        makeVault({
          vault_id: 'expired-1',
          quote: { ...makeVault().quote, is_expired: true },
        }),
        makeVault({
          vault_id: 'expired-2',
          quote: { ...makeVault().quote, is_expired: true },
        }),
      ]);

      const result = await fetchLiquidatableVaults();

      expect(result).toEqual([]);
    });

    it('should return [] when server responds with null', async () => {
      mockFetchSuccess(null);

      const result = await fetchLiquidatableVaults();

      expect(result).toEqual([]);
    });

    it('should return [] when server responds with empty array', async () => {
      mockFetchSuccess([]);

      const result = await fetchLiquidatableVaults();

      expect(result).toEqual([]);
    });

    it('should call the correct URL with GET and JSON headers', async () => {
      mockFetchSuccess([]);

      await fetchLiquidatableVaults();

      const call = getFetchCall(0);
      expect(call).toBeDefined();
      expect(String(call![0])).toBe(`${LIQ_VALIDATOR_URL}/api/liquidated`);
      expect(call![1]).toMatchObject({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('error handling', () => {
    it('should return [] on a non-ok HTTP response', async () => {
      mockFetchError(500, 'Internal Server Error');

      const result = await fetchLiquidatableVaults();

      expect(result).toEqual([]);
    });

    it('should return [] on a 404 response', async () => {
      mockFetchError(404, 'Not Found');

      const result = await fetchLiquidatableVaults();

      expect(result).toEqual([]);
    });

    it('should return [] on a network error (fetch rejects)', async () => {
      mockFetchReject(new Error('Network failure'));

      const result = await fetchLiquidatableVaults();

      expect(result).toEqual([]);
    });

    it('should return [] on a non-Error throw', async () => {
      getMockFetch().mockRejectedValueOnce('string error');

      const result = await fetchLiquidatableVaults();

      expect(result).toEqual([]);
    });

    it('should log a warning on failure', async () => {
      mockFetchReject(new Error('boom'));

      await fetchLiquidatableVaults();

      expect(logger.warn).toHaveBeenCalledWith(
        '[Liquidation] Failed to fetch liquidatable vaults',
        expect.objectContaining({ error: 'boom' })
      );
    });

    it('should log debug with count on success', async () => {
      mockFetchSuccess([makeVault(), makeVault()]);

      await fetchLiquidatableVaults();

      expect(logger.debug).toHaveBeenCalledWith(
        '[Liquidation] Fetched vaults',
        expect.objectContaining({ count: 2 })
      );
    });

    it('should log how many validator vaults were expired', async () => {
      mockFetchSuccess([
        makeVault(),
        makeVault({
          vault_id: 'expired',
          quote: { ...makeVault().quote, is_expired: true },
        }),
      ]);

      await fetchLiquidatableVaults();

      expect(logger.debug).toHaveBeenCalledWith(
        '[Liquidation] Fetched vaults',
        expect.objectContaining({ count: 1, rawCount: 2, expiredCount: 1 })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// fetchVaultsByIds
// ---------------------------------------------------------------------------

describe('fetchVaultsByIds', () => {
  beforeEach(() => {
    setupMockFetch();
  });

  describe('happy path', () => {
    it('should return vaults for the given IDs', async () => {
      const vault = makeVault({ vault_id: 'v-001' });
      mockFetchSuccess([vault]);

      const result = await fetchVaultsByIds(['v-001']);

      expect(result).toHaveLength(1);
      expect(result[0].vault_id).toBe('v-001');
    });

    it('should return multiple vaults for multiple IDs', async () => {
      const vaults = [makeVault({ vault_id: 'v-001' }), makeVault({ vault_id: 'v-002' })];
      mockFetchSuccess(vaults);

      const result = await fetchVaultsByIds(['v-001', 'v-002']);

      expect(result).toHaveLength(2);
    });

    it('should filter expired liquidation quotes for requested IDs', async () => {
      mockFetchSuccess([
        makeVault({ vault_id: 'v-active' }),
        makeVault({
          vault_id: 'v-expired',
          quote: { ...makeVault().quote, is_expired: true },
        }),
      ]);

      const result = await fetchVaultsByIds(['v-active', 'v-expired']);

      expect(result).toHaveLength(1);
      expect(result[0].vault_id).toBe('v-active');
    });

    it('should encode each ID as a separate query param', async () => {
      mockFetchSuccess([]);

      await fetchVaultsByIds(['v-001', 'v-002']);

      const call = getFetchCall(0);
      const url = String(call![0]);
      expect(url).toContain('id=v-001');
      expect(url).toContain('id=v-002');
    });

    it('should URL-encode IDs that contain special characters', async () => {
      mockFetchSuccess([]);

      await fetchVaultsByIds(['vault/with spaces&symbols=1']);

      const call = getFetchCall(0);
      const url = String(call![0]);
      expect(url).toContain('id=vault%2Fwith%20spaces%26symbols%3D1');
    });

    it('should build the URL against the correct base path', async () => {
      mockFetchSuccess([]);

      await fetchVaultsByIds(['abc']);

      const call = getFetchCall(0);
      const url = String(call![0]);
      expect(url).toMatch(new RegExp(`^${LIQ_VALIDATOR_URL}/api/vault\\?`));
    });

    it('should use GET with JSON Content-Type header', async () => {
      mockFetchSuccess([]);

      await fetchVaultsByIds(['abc']);

      const call = getFetchCall(0);
      expect(call![1]).toMatchObject({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should handle an empty IDs array (no params in URL)', async () => {
      mockFetchSuccess([]);

      const result = await fetchVaultsByIds([]);

      expect(getFetchCallCount()).toBe(1);
      const url = String(getFetchCall(0)![0]);
      expect(url).toBe(`${LIQ_VALIDATOR_URL}/api/vault?`);
      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should return [] on a non-ok response', async () => {
      mockFetchError(503, 'Service Unavailable');

      const result = await fetchVaultsByIds(['v-001']);

      expect(result).toEqual([]);
    });

    it('should return [] on a network error', async () => {
      mockFetchReject(new Error('timeout'));

      const result = await fetchVaultsByIds(['v-001']);

      expect(result).toEqual([]);
    });

    it('should return [] on a non-Error throw', async () => {
      getMockFetch().mockRejectedValueOnce({ code: 42 });

      const result = await fetchVaultsByIds(['v-001']);

      expect(result).toEqual([]);
    });

    it('should log a warning with the error message on failure', async () => {
      mockFetchReject(new Error('connection refused'));

      await fetchVaultsByIds(['v-001']);

      expect(logger.warn).toHaveBeenCalledWith(
        '[Liquidation] Failed to fetch vault data',
        expect.objectContaining({ error: 'connection refused' })
      );
    });

    it('should log a warning with stringified non-Error throw', async () => {
      getMockFetch().mockRejectedValueOnce('plain string error');

      await fetchVaultsByIds(['v-001']);

      expect(logger.warn).toHaveBeenCalledWith(
        '[Liquidation] Failed to fetch vault data',
        expect.objectContaining({ error: 'plain string error' })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// formatValidatorResponse
// ---------------------------------------------------------------------------

describe('formatValidatorResponse', () => {
  describe('happy path', () => {
    it('should return an empty array for empty input', () => {
      expect(formatValidatorResponse([])).toEqual([]);
    });

    it('should map vault_id to vaultId', () => {
      const result = formatValidatorResponse([makeVault({ vault_id: 'vault-xyz' })]);
      expect(result[0].vaultId).toBe('vault-xyz');
    });

    it('should convert stone.balance / 100 for the unit field', () => {
      const vault = makeVault();
      vault.stone.balance = 5000; // 50.00 UNIT
      const result = formatValidatorResponse([vault]);
      expect(result[0].unit).toBe(50);
    });

    it('should convert stone.balance = 1 to 0.01 UNIT', () => {
      const vault = makeVault();
      vault.stone.balance = 1;
      const result = formatValidatorResponse([vault]);
      expect(result[0].unit).toBeCloseTo(0.01);
    });

    it('should convert stone.balance = 0 to 0 UNIT', () => {
      const vault = makeVault();
      vault.stone.balance = 0;
      const result = formatValidatorResponse([vault]);
      expect(result[0].unit).toBe(0);
    });

    it('should convert output.amount / COIN_SIZE for btcInVault', () => {
      const vault = makeVault();
      vault.output.amount = COIN_SIZE; // exactly 1 BTC
      const result = formatValidatorResponse([vault]);
      expect(result[0].btcInVault).toBe(1);
    });

    it('should convert output.amount = 200_000_000 to 2 BTC', () => {
      const vault = makeVault();
      vault.output.amount = 200_000_000;
      const result = formatValidatorResponse([vault]);
      expect(result[0].btcInVault).toBe(2);
    });

    it('should convert output.amount = 0 to 0 BTC', () => {
      const vault = makeVault();
      vault.output.amount = 0;
      const result = formatValidatorResponse([vault]);
      expect(result[0].btcInVault).toBe(0);
    });

    it('should convert fractional sats (1 sat) correctly', () => {
      const vault = makeVault();
      vault.output.amount = 1;
      const result = formatValidatorResponse([vault]);
      expect(result[0].btcInVault).toBeCloseTo(1 / COIN_SIZE);
    });

    it('should set is_locked to true', () => {
      const result = formatValidatorResponse([makeVault()]);
      expect(result[0].rdata.is_locked).toBe(true);
    });

    it('should map thold_key at top level', () => {
      const vault = makeVault({ thold_key: 'thold-key-value' });
      const result = formatValidatorResponse([vault]);
      expect(result[0].thold_key).toBe('thold-key-value');
    });

    it('should map open_account_id to acct_id', () => {
      const vault = makeVault({ open_account_id: 'acct-999' });
      const result = formatValidatorResponse([vault]);
      expect(result[0].acct_id).toBe('acct-999');
    });

    it('should map guardian_pubkey to guard_pk', () => {
      const vault = makeVault({ guardian_pubkey: 'guard-pk-value' });
      const result = formatValidatorResponse([vault]);
      expect(result[0].guard_pk).toBe('guard-pk-value');
    });

    it('should map vault_pubkey to vault_pk', () => {
      const vault = makeVault({ vault_pubkey: 'vault-pk-value' });
      const result = formatValidatorResponse([vault]);
      expect(result[0].vault_pk).toBe('vault-pk-value');
    });

    it('should map master_id', () => {
      const vault = makeVault({ master_id: 'master-xyz' });
      const result = formatValidatorResponse([vault]);
      expect(result[0].master_id).toBe('master-xyz');
    });

    it('should map output.amount as utxo.value (raw sats)', () => {
      const vault = makeVault();
      vault.output.amount = 50_000_000;
      const result = formatValidatorResponse([vault]);
      expect(result[0].utxo.value).toBe(50_000_000);
    });

    it('should map output.txid to utxo.txid', () => {
      const vault = makeVault();
      vault.output.txid = 'txid-abc';
      const result = formatValidatorResponse([vault]);
      expect(result[0].utxo.txid).toBe('txid-abc');
    });

    it('should map output.vout to utxo.vout', () => {
      const vault = makeVault();
      vault.output.vout = 3;
      const result = formatValidatorResponse([vault]);
      expect(result[0].utxo.vout).toBe(3);
    });

    it('should map output_script to utxo.script', () => {
      const vault = makeVault({ output_script: 'OP_DUP OP_HASH160' });
      const result = formatValidatorResponse([vault]);
      expect(result[0].utxo.script).toBe('OP_DUP OP_HASH160');
    });

    it('should map quote.thold_hash to rdata.thold_hash', () => {
      const vault = makeVault();
      vault.quote.thold_hash = 'hash-abc';
      const result = formatValidatorResponse([vault]);
      expect(result[0].rdata.thold_hash).toBe('hash-abc');
    });

    it('should map quote.thold_price to rdata.thold_price', () => {
      const vault = makeVault();
      vault.quote.thold_price = 77777;
      const result = formatValidatorResponse([vault]);
      expect(result[0].rdata.thold_price).toBe(77777);
    });

    it('should map stone.balance (raw cents) to rdata.unit_balance', () => {
      const vault = makeVault();
      vault.stone.balance = 9900;
      const result = formatValidatorResponse([vault]);
      expect(result[0].rdata.unit_balance).toBe(9900);
    });

    it('should map stone.oracle_price to rdata.unit_price', () => {
      const vault = makeVault();
      vault.stone.oracle_price = 95000;
      const result = formatValidatorResponse([vault]);
      expect(result[0].rdata.unit_price).toBe(95000);
    });

    it('should map stone.oracle_timestamp to rdata.unit_stamp', () => {
      const vault = makeVault();
      vault.stone.oracle_timestamp = 1700001234;
      const result = formatValidatorResponse([vault]);
      expect(result[0].rdata.unit_stamp).toBe(1700001234);
    });

    it('should map stone.action to rdata.vault_action', () => {
      const vault = makeVault();
      vault.stone.action = 'liquidate';
      const result = formatValidatorResponse([vault]);
      expect(result[0].rdata.vault_action).toBe('liquidate');
    });
  });

  describe('multiple vaults', () => {
    it('should map all vaults independently', () => {
      const vault1 = makeVault({ vault_id: 'v1' });
      vault1.stone.balance = 100;
      vault1.output.amount = COIN_SIZE;

      const vault2 = makeVault({ vault_id: 'v2' });
      vault2.stone.balance = 200;
      vault2.output.amount = 2 * COIN_SIZE;

      const result = formatValidatorResponse([vault1, vault2]);

      expect(result).toHaveLength(2);
      expect(result[0].vaultId).toBe('v1');
      expect(result[0].unit).toBe(1);
      expect(result[0].btcInVault).toBe(1);
      expect(result[1].vaultId).toBe('v2');
      expect(result[1].unit).toBe(2);
      expect(result[1].btcInVault).toBe(2);
    });

    it('should always set is_locked to true for every vault', () => {
      const vaults = [makeVault({ vault_id: 'v1' }), makeVault({ vault_id: 'v2' })];
      const result = formatValidatorResponse(vaults);
      result.forEach(v => expect(v.rdata.is_locked).toBe(true));
    });
  });

  describe('edge cases', () => {
    it('should handle very large balance values without overflow', () => {
      const vault = makeVault();
      vault.stone.balance = 1_000_000_000; // 10,000,000 UNIT
      const result = formatValidatorResponse([vault]);
      expect(result[0].unit).toBe(10_000_000);
    });

    it('should handle very large sats amounts without overflow', () => {
      const vault = makeVault();
      vault.output.amount = 21_000_000 * COIN_SIZE; // 21M BTC (theoretical max)
      const result = formatValidatorResponse([vault]);
      expect(result[0].btcInVault).toBe(21_000_000);
    });

    it('should not mutate the original input array', () => {
      const vault = makeVault();
      const input = [vault];
      formatValidatorResponse(input);
      expect(input).toHaveLength(1);
      expect(input[0]).toBe(vault);
    });
  });
});
