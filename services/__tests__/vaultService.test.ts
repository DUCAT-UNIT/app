/**
 * Tests for the v3 validator profile-backed vault service.
 */

import {
  fetchVaultHistory,
  fetchVaultData,
  fetchLatestVaultHistoryTransaction,
  selectLatestUsableVaultHistoryTransaction,
} from '../vaultService';
import {
  setupMockFetch,
  getMockFetch,
  createMockResponse,
  getFetchCallCount,
  getFetchCall,
  mockFetchReject,
  expectFetchNotCalled,
} from './testUtils';

jest.mock('../../utils/retry', () => ({
  retrySilently: jest.fn((fn) => fn()),
}));

jest.mock('../../utils/constants', () => ({
  API: {
    VAULT: 'https://api.example.com/vault',
  },
}));

const SATS_PER_BTC = 100_000_000;
const CENTS_PER_UNIT = 100;
const nowSeconds = () => Math.floor(Date.now() / 1000);

type TestVaultProfile = {
  block_timestamp: number;
  client_pubkey: string | null;
  coin_id: string | null;
  contract_id?: string | null;
  guard_pubkey: string | null;
  price_commits: Array<{
    base_price: number;
    thold_hash: string;
    thold_price: number;
  }>;
  price_stamp: number;
  root_txid: string | null;
  thold_price: number;
  unit_balance: number;
  unit_price: number | null;
  vault_action: string;
  vault_balance: number;
  vault_config: { label?: string | null } | null;
  vault_ratio?: number | null;
  vault_script: string | null;
  vault_version: number;
};

function makeProfile(overrides: Partial<TestVaultProfile> = {}): TestVaultProfile {
  const rootTxid = overrides.root_txid ?? 'vault_1';
  const timestamp = overrides.block_timestamp ?? nowSeconds() - 60;

  return {
    block_timestamp: timestamp,
    client_pubkey: 'vpk_test_123',
    coin_id: `${rootTxid}:0`,
    contract_id: 'mid_test_123',
    guard_pubkey: 'gpk_test_123',
    price_commits: [
      {
        base_price: 50_000,
        thold_hash: 'liqhash',
        thold_price: 37_500,
      },
    ],
    price_stamp: timestamp,
    root_txid: rootTxid,
    thold_price: 37_500,
    unit_balance: 100_000,
    unit_price: 50_000,
    vault_action: 'deposit',
    vault_balance: 500_000_000_000,
    vault_config: { label: 'My Vault' },
    vault_ratio: 2,
    vault_script: '5120script',
    vault_version: 3,
    ...overrides,
  };
}

function expectedHistory(profile: TestVaultProfile, previous?: TestVaultProfile) {
  return {
    amount_borrowed: profile.unit_balance,
    vault_amount: profile.vault_balance,
    btc_amt: profile.vault_balance - (previous?.vault_balance ?? 0),
    unit_amt: profile.unit_balance - (previous?.unit_balance ?? 0),
    oracle_price: profile.unit_price ?? profile.price_commits[0]?.base_price ?? 0,
    timestamp: profile.block_timestamp,
    action: profile.vault_action,
    transaction_id: profile.coin_id?.split(':')[0],
    root_txid: profile.root_txid ?? profile.coin_id?.split(':')[0],
    utxo: profile.coin_id,
    utxo_script: profile.vault_script ?? '',
    liquidation_hash: profile.price_commits[0]?.thold_hash ?? '',
    liquidation_threshold: profile.thold_price ?? profile.price_commits[0]?.thold_price ?? 0,
    latest_profile: profile,
  };
}

describe('vaultService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  describe('fetchVaultHistory', () => {
    it('returns an empty array if no vaultPubkey is provided', async () => {
      const result = await fetchVaultHistory(null as unknown as string);
      expect(result).toEqual([]);
      expect(getFetchCallCount()).toBe(0);
    });

    it('fetches vault history from v3 profile endpoints', async () => {
      const vaultPubkey = 'vault_pubkey_123';
      const first = makeProfile({
        root_txid: 'tx1',
        coin_id: 'tx1:0',
        block_timestamp: nowSeconds() - 120,
        vault_action: 'open',
        vault_balance: 400_000_000,
        unit_balance: 50_000,
      });
      const second = makeProfile({
        root_txid: 'tx1',
        coin_id: 'tx2:0',
        block_timestamp: nowSeconds() - 60,
        vault_action: 'deposit',
        vault_balance: 500_000_000,
        unit_balance: 60_000,
      });

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse([second]))
        .mockResolvedValueOnce(createMockResponse([first, second]));

      const result = await fetchVaultHistory(vaultPubkey);

      expect(result).toEqual([
        expectedHistory(second, first),
        expectedHistory(first),
      ]);
      expect(getFetchCallCount()).toBe(2);
      expect(String(getFetchCall(0)?.[0])).toBe(
        'https://api.example.com/vault/vault/pubkey/vault_pubkey_123'
      );
      expect(String(getFetchCall(1)?.[0])).toBe(
        'https://api.example.com/vault/vault/tx1/history'
      );
    });

    it('returns an empty array if no v3 profiles are found', async () => {
      getMockFetch().mockResolvedValueOnce(createMockResponse({ data: [] }));

      const result = await fetchVaultHistory('vault_pubkey_123');

      expect(result).toEqual([]);
      expect(getFetchCallCount()).toBe(1);
    });

    it('caps derived history by limit and maxPages', async () => {
      const profiles = Array.from({ length: 5 }, (_, index) => makeProfile({
        root_txid: 'tx-root',
        coin_id: `tx${index}:0`,
        block_timestamp: nowSeconds() - (5 - index) * 60,
      }));

      getMockFetch().mockResolvedValueOnce(createMockResponse(profiles));

      const result = await fetchVaultHistory('vault_pubkey_123', {
        vaultId: 'tx-root',
        limit: 2,
        maxPages: 1,
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.transaction_id).toBe('tx4');
      expect(result[1]?.transaction_id).toBe('tx3');
      expect(getFetchCallCount()).toBe(1);
      expect(String(getFetchCall(0)?.[0])).toBe(
        'https://api.example.com/vault/vault/tx-root/history'
      );
    });

    it('filters history outside the requested lookback window', async () => {
      const recent = makeProfile({
        root_txid: 'tx-root',
        coin_id: 'recent-tx:0',
        block_timestamp: nowSeconds() - 60,
      });
      const old = makeProfile({
        root_txid: 'tx-root',
        coin_id: 'old-tx:0',
        block_timestamp: nowSeconds() - 10 * 24 * 60 * 60,
      });

      getMockFetch().mockResolvedValueOnce(createMockResponse([old, recent]));

      const result = await fetchVaultHistory('vault_pubkey_123', {
        vaultId: 'tx-root',
        lookbackDays: 1,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.transaction_id).toBe('recent-tx');
    });

    it('returns an empty array on error', async () => {
      mockFetchReject(new Error('Network error'));

      const result = await fetchVaultHistory('vault_pubkey_123');

      expect(result).toEqual([]);
    });
  });

  describe('selectLatestUsableVaultHistoryTransaction', () => {
    it('picks the newest transaction with a usable vault prevout', () => {
      const result = selectLatestUsableVaultHistoryTransaction([
        {
          transaction_id: 'old-tx',
          utxo: 'old-tx:0',
          timestamp: 1000,
          action: 'borrow',
          amount_borrowed: 100,
          vault_amount: 1000,
          btc_amt: 0,
          unit_amt: 0,
          oracle_price: 50000,
        },
        {
          transaction_id: 'new-no-utxo',
          timestamp: 3000,
          action: 'borrow',
          amount_borrowed: 100,
          vault_amount: 1000,
          btc_amt: 0,
          unit_amt: 0,
          oracle_price: 50000,
        },
        {
          transaction_id: 'new-tx',
          utxo: 'new-tx:1',
          timestamp: 2000,
          action: 'repay',
          amount_borrowed: 90,
          vault_amount: 1000,
          btc_amt: 0,
          unit_amt: 0,
          oracle_price: 50000,
        },
      ]);

      expect(result?.transaction_id).toBe('new-tx');
    });
  });

  describe('fetchLatestVaultHistoryTransaction', () => {
    it('does not assume the first validator history profile is latest', async () => {
      const oldProfile = makeProfile({
        root_txid: 'vault_1',
        coin_id: 'old-tx:0',
        block_timestamp: nowSeconds() - 120,
        vault_action: 'borrow',
      });
      const newProfile = makeProfile({
        root_txid: 'vault_1',
        coin_id: 'new-tx:0',
        block_timestamp: nowSeconds() - 60,
        vault_action: 'repay',
      });
      getMockFetch().mockResolvedValueOnce(createMockResponse([oldProfile, newProfile]));

      const result = await fetchLatestVaultHistoryTransaction('vault_1', 540);

      expect(result?.transaction_id).toBe('new-tx');
      expect(String(getFetchCall(0)?.[0])).toBe(
        'https://api.example.com/vault/vault/vault_1/history'
      );
    });

    it('uses the latest profile after deriving history and applying limits', async () => {
      const profiles = [
        makeProfile({
          root_txid: 'vault_2',
          coin_id: 'old-tx:0',
          block_timestamp: nowSeconds() - 180,
        }),
        makeProfile({
          root_txid: 'vault_2',
          coin_id: 'latest-tx:0',
          block_timestamp: nowSeconds() - 60,
          vault_action: 'deposit',
        }),
      ];
      getMockFetch().mockResolvedValueOnce(createMockResponse({ data: profiles }));

      const result = await fetchLatestVaultHistoryTransaction('vault_2', 540);

      expect(result?.transaction_id).toBe('latest-tx');
      expect(getFetchCallCount()).toBe(1);
    });

    it('ignores rows without vault prevouts when signing requires a usable prevout', async () => {
      const displayOnlyNewer = makeProfile({
        root_txid: null,
        coin_id: null,
        block_timestamp: nowSeconds() - 60,
        vault_action: 'repay',
      });
      const signableOlder = makeProfile({
        root_txid: 'vault_3',
        coin_id: 'signable-older:0',
        block_timestamp: nowSeconds() - 120,
        vault_action: 'borrow',
      });
      getMockFetch().mockResolvedValueOnce(createMockResponse([displayOnlyNewer, signableOlder]));

      const result = await fetchLatestVaultHistoryTransaction('vault_3', 540, {
        requireUsablePrevout: true,
      });

      expect(result?.transaction_id).toBe('signable-older');
    });
  });

  describe('fetchVaultData', () => {
    it('returns null if no vaultPubkey is provided', async () => {
      const result = await fetchVaultData(null as unknown as string);
      expect(result).toBeNull();
      expectFetchNotCalled();
    });

    it('fetches vault data with latest transaction from v3 profiles', async () => {
      const vaultPubkey = 'vault_pubkey_123';
      const profile = makeProfile({
        root_txid: 'vault_1',
        coin_id: 'vault_1:0',
        vault_config: { label: 'My Vault' },
        vault_balance: 500_000_000_000,
        unit_balance: 100_000,
      });
      const historyProfile = makeProfile({
        root_txid: 'vault_1',
        coin_id: 'history-tx:0',
        block_timestamp: nowSeconds() - 30,
        vault_action: 'deposit',
        vault_balance: 1000,
        unit_balance: 100,
      });

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse([profile]))
        .mockResolvedValueOnce(createMockResponse([historyProfile]));

      const result = await fetchVaultData(vaultPubkey, { includeLatestTransaction: true });

      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'My Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50_000,
        latestTransaction: {
          amountBorrowed: 100,
          vaultAmount: 1000,
          btcAmount: 1000,
          unitAmt: 100,
          oraclePrice: 50_000,
          timestamp: historyProfile.block_timestamp,
          action: 'deposit',
        },
        vaultInfo: {
          vault_id: 'vault_1',
          vault_tag: 'My Vault',
          unit_borrowed: 1000,
          btc_locked: 5000,
          oracle_price: 50_000,
          vault_version: 3,
          collateral_ratio: 200,
          liquidation_price: 37_500,
          master_id: 'mid_test_123',
          creation_account: 'vpk_test_123',
          guard_pubkey: 'gpk_test_123',
          vault_pubkey: 'vpk_test_123',
          liquidation_hash: 'liqhash',
          utxo: 'vault_1:0',
          oracle_timestamp: profile.price_stamp,
          vault_last_action: 'deposit',
        },
      });
    });

    it('returns vault data from the fast profile-only path by default', async () => {
      const profile = makeProfile({
        root_txid: 'vault_1',
        vault_config: { label: 'My Vault' },
      });
      getMockFetch().mockResolvedValueOnce(createMockResponse([profile]));

      const result = await fetchVaultData('vault_pubkey_123');

      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'My Vault',
        totalDebt: profile.unit_balance / CENTS_PER_UNIT,
        totalCollateral: profile.vault_balance / SATS_PER_BTC,
        currentPrice: 50_000,
      });
      expect(result?.vaultInfo).toBeDefined();
      expect(result?.vaultInfo?.vault_id).toBe('vault_1');
      expect(result?.latestTransaction).toBeUndefined();
      expect(getFetchCallCount()).toBe(1);
    });

    it('returns null if no vault profiles are found', async () => {
      getMockFetch().mockResolvedValueOnce(createMockResponse([]));

      const result = await fetchVaultData('vault_pubkey_123');

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockFetchReject(new Error('Network error'));

      const result = await fetchVaultData('vault_pubkey_123');

      expect(result).toBeNull();
    });

    it('handles multiple profiles and uses the first one', async () => {
      const first = makeProfile({
        root_txid: 'vault_1',
        vault_config: { label: 'First Vault' },
        unit_balance: 100_000,
        vault_balance: 500_000_000_000,
      });
      const second = makeProfile({
        root_txid: 'vault_2',
        coin_id: 'vault_2:0',
        vault_config: { label: 'Second Vault' },
        unit_balance: 200_000,
        vault_balance: 1_000_000_000_000,
      });

      getMockFetch().mockResolvedValueOnce(createMockResponse([first, second]));

      const result = await fetchVaultData('vault_pubkey_123');

      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'First Vault',
        totalDebt: 1000,
        totalCollateral: 5000,
        currentPrice: 50_000,
      });
      expect(result?.vaultInfo?.vault_id).toBe('vault_1');
      expect(getFetchCallCount()).toBe(1);
    });

    it('requests profiles by vault pubkey', async () => {
      getMockFetch().mockResolvedValueOnce(createMockResponse([
        makeProfile({ root_txid: 'vault_1' }),
      ]));

      await fetchVaultData('vault_pubkey_123');

      expect(String(getFetchCall(0)?.[0])).toBe(
        'https://api.example.com/vault/vault/pubkey/vault_pubkey_123'
      );
    });

    it('returns display data without vaultInfo when a v3 profile is missing contract id', async () => {
      const profile = makeProfile({
        root_txid: 'vault_1',
        contract_id: null,
        vault_config: { label: 'Incomplete Vault' },
      });

      getMockFetch().mockResolvedValueOnce(createMockResponse([profile]));

      const result = await fetchVaultData('vault_pubkey_123');

      expect(result).toMatchObject({
        vaultId: 'vault_1',
        vaultTag: 'Incomplete Vault',
        totalDebt: profile.unit_balance / CENTS_PER_UNIT,
        totalCollateral: profile.vault_balance / SATS_PER_BTC,
        currentPrice: 50_000,
      });
      expect(result?.vaultInfo).toBeUndefined();
    });

    it('uses price commit base_price when unit_price is unavailable', async () => {
      const profile = makeProfile({
        root_txid: 'vault_1',
        unit_price: null,
        price_commits: [
          {
            base_price: 52_000,
            thold_hash: 'fallbackhash',
            thold_price: 39_000,
          },
        ],
      });

      getMockFetch().mockResolvedValueOnce(createMockResponse([profile]));

      const result = await fetchVaultData('vault_pubkey_123');

      expect(result?.currentPrice).toBe(52_000);
      expect(result?.vaultInfo?.oracle_price).toBe(52_000);
      expect(result?.vaultInfo?.liquidation_hash).toBe('fallbackhash');
    });

    it('uses first profile data while attaching latest history when requested', async () => {
      const first = makeProfile({
        root_txid: 'vault_1',
        vault_config: { label: 'First Vault' },
        unit_balance: 100_000,
        vault_balance: 500_000_000_000,
      });
      const second = makeProfile({
        root_txid: 'vault_2',
        coin_id: 'vault_2:0',
        vault_config: { label: 'Second Vault' },
        unit_balance: 200_000,
        vault_balance: 1_000_000_000_000,
      });
      const historyProfile = makeProfile({
        root_txid: 'vault_1',
        coin_id: 'history-tx:0',
        block_timestamp: nowSeconds() - 30,
      });

      getMockFetch()
        .mockResolvedValueOnce(createMockResponse([first, second]))
        .mockResolvedValueOnce(createMockResponse([historyProfile]));

      const result = await fetchVaultData('vault_pubkey_123', { includeLatestTransaction: true });

      expect(result?.totalDebt).toBe(1000);
      expect(result?.totalCollateral).toBe(5000);
      expect(result?.latestTransaction?.action).toBe(historyProfile.vault_action);
    });
  });
});
