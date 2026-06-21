/**
 * Tests for the relay-backed oracle service.
 */

jest.mock('../../utils/constants', () => ({
  API: {
    VALIDATOR: 'https://test.validator',
    RELAY_WS: 'wss://test.relay',
    ORACLE_PUBKEY: 'b'.repeat(64),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@ducat-unit/core/lib', () => ({
  get_vault_terms: jest.fn(() => ({
    vault_ratio_min: 1.6,
    liquidation_thold: 1.35,
  })),
}));

jest.mock('../vaultWallet', () => ({
  fetchProtocolContract: jest.fn(),
}));

jest.mock('@vbyte/nostr-sdk/lib', () => ({
  parse_content: jest.fn((content: string) => ({ ok: true, result: JSON.parse(content) })),
  verify_event: jest.fn(() => null),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  fetchBreachedPriceContractsByIds,
  fetchCurrentPrice,
  fetchPriceContractsByBucketTag,
  fetchPriceContractsByCommitHashes,
  fetchPriceQuote,
  MAX_QUOTE_AGE_SECONDS,
} from '../oracleService';
import { fetchProtocolContract } from '../vaultWallet';
import { resetRequestPolicyForTests } from '../../utils/requestPolicy';

const mockFetchProtocolContract = fetchProtocolContract as jest.MockedFunction<
  typeof fetchProtocolContract
>;

type RelayResponse = {
  events: unknown[];
  error?: string;
  skipEose?: boolean;
};

type RelayListener = (event?: { data?: string; message?: string }) => void;

const relayRequests: unknown[][] = [];
const relayResponses: RelayResponse[] = [];

function getRelayReqFilters() {
  return relayRequests.filter((message) => message[0] === 'REQ').map((message) => message[2]);
}

class MockRelayWebSocket {
  static instances: MockRelayWebSocket[] = [];

  readonly url: string;
  private listeners: Record<string, RelayListener[]> = {};

  constructor(url: string) {
    this.url = url;
    MockRelayWebSocket.instances.push(this);
    setTimeout(() => this.emit('open'), 0);
  }

  addEventListener(eventName: string, listener: RelayListener) {
    this.listeners[eventName] = [...(this.listeners[eventName] ?? []), listener];
  }

  removeEventListener(eventName: string, listener: RelayListener) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).filter(
      (item) => item !== listener
    );
  }

  send(data: string) {
    const message = JSON.parse(data) as unknown[];
    relayRequests.push(message);

    if (message[0] !== 'REQ') {
      return;
    }

    const subscriptionId = String(message[1]);
    const response = relayResponses.shift() ?? { events: [] };

    setTimeout(() => {
      if (response.error) {
        this.emit('error', { message: response.error });
        return;
      }

      response.events.forEach((event) => {
        this.emit('message', {
          data: JSON.stringify(['EVENT', subscriptionId, event]),
        });
      });

      if (!response.skipEose) {
        this.emit('message', {
          data: JSON.stringify(['EOSE', subscriptionId]),
        });
      }
    }, 0);
  }

  close() {
    // No-op for tests.
  }

  private emit(eventName: string, event?: { data?: string; message?: string }) {
    (this.listeners[eventName] ?? []).forEach((listener) => listener(event));
  }
}

(globalThis as { WebSocket?: unknown }).WebSocket = MockRelayWebSocket;

function makePriceContract(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    base_price: 100000,
    base_stamp: Math.floor(Date.now() / 1000),
    chain_network: 'mutiny',
    commit_hash: 'c'.repeat(64),
    contract_id: 'a'.repeat(64),
    oracle_pubkey: 'b'.repeat(64),
    oracle_sig: 'd'.repeat(128),
    thold_hash: 'e'.repeat(40),
    thold_key: null,
    thold_price: 50000,
    vault_coin_id: 'f'.repeat(64) + ':0',
    root_txid: '1'.repeat(64),
    ...overrides,
  };
}

function makePriceQuote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    base_price: 100000,
    base_stamp: Math.floor(Date.now() / 1000),
    chain_network: 'mutiny',
    oracle_pubkey: 'b'.repeat(64),
    rate_min: 1.36,
    rate_max: 10,
    rate_thold: 1.35,
    step_size: 0.01,
    ...overrides,
  };
}

function makeRelayEvent(kind: number, content: unknown) {
  return {
    id: '1'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags: [],
    content: JSON.stringify(content),
    sig: '2'.repeat(128),
  };
}

function pushRelayQuoteResponse(quotes: unknown[]) {
  relayResponses.push({
    events: quotes.map((quote) => makeRelayEvent(10000, quote)),
  });
}

function pushRelayContractResponse(contracts: unknown[]) {
  relayResponses.push({
    events: contracts.map((contract) => makeRelayEvent(30000, contract)),
  });
}

function pushRelayBreachResponse(contracts: unknown[]) {
  relayResponses.push({
    events: contracts.map((contract) => makeRelayEvent(1000, contract)),
  });
}

function mockRelayQuote(quote = makePriceQuote(), contracts = [makePriceContract(quote)]) {
  pushRelayQuoteResponse([quote]);
  pushRelayContractResponse(contracts);
}

describe('oracleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    relayRequests.length = 0;
    relayResponses.length = 0;
    MockRelayWebSocket.instances.length = 0;
    resetRequestPolicyForTests();
    mockFetchProtocolContract.mockResolvedValue({
      proto_members: [{ group: 22, pubkey: 'b'.repeat(64) }],
      proto_terms: [],
    } as unknown as Awaited<ReturnType<typeof fetchProtocolContract>>);
  });

  describe('fetchCurrentPrice', () => {
    it('fetches the current price from the oracle relay', async () => {
      pushRelayQuoteResponse([makePriceQuote({ base_price: 100000 })]);

      const result = await fetchCurrentPrice();

      expect(getRelayReqFilters()[0]).toMatchObject({
        kinds: [10000],
        authors: ['b'.repeat(64)],
      });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toBe(100000);
    });

    it('uses the newest quote when the relay returns multiple entries', async () => {
      pushRelayQuoteResponse([
        makePriceQuote({ base_price: 90000, base_stamp: Math.floor(Date.now() / 1000) - 60 }),
        makePriceQuote({ base_price: 95000, base_stamp: Math.floor(Date.now() / 1000) }),
      ]);

      await expect(fetchCurrentPrice()).resolves.toBe(95000);
    });

    it('throws a friendly error when the relay has no fresh quotes', async () => {
      pushRelayQuoteResponse([]);

      await expect(fetchCurrentPrice()).rejects.toThrow('Failed to fetch current Bitcoin price');
    });

    it('throws a friendly error on relay failure', async () => {
      relayResponses.push({ events: [], error: 'Network error' });

      await expect(fetchCurrentPrice()).rejects.toThrow('Failed to fetch current Bitcoin price');
    });
  });

  describe('fetchPriceQuote', () => {
    it('builds a latest-SDK price quote from relay quote and relay contracts', async () => {
      const quote = makePriceQuote({ base_price: 100000 });
      const contract = makePriceContract(quote);
      mockRelayQuote(quote, [contract]);

      const result = await fetchPriceQuote(50000, { cache: false, dedupe: false });
      const filters = getRelayReqFilters();

      expect(filters[0]).toMatchObject({
        kinds: [10000],
        authors: ['b'.repeat(64)],
      });
      expect(filters[1]).toMatchObject({
        kinds: [30000],
        authors: ['b'.repeat(64)],
        since: quote.base_stamp - 10,
      });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockFetchProtocolContract).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        base_price: 100000,
        latest_price: 100000,
        quote_price: 100000,
        latest_stamp: contract.base_stamp,
        quote_stamp: contract.base_stamp,
        rate_min: 1.36,
        rate_max: 10,
        rate_thold: 1.35,
        step_size: 0.01,
        contracts: [contract],
        price_contracts: [contract],
      });
    });

    it('can fetch a quote without downloading relay contracts', async () => {
      const quote = makePriceQuote({ base_price: 100000 });
      pushRelayQuoteResponse([quote]);

      const result = await fetchPriceQuote(50000, {
        cache: false,
        dedupe: false,
        includeContracts: false,
      });
      const filters = getRelayReqFilters();

      expect(filters).toHaveLength(1);
      expect(filters[0]).toMatchObject({
        kinds: [10000],
        authors: ['b'.repeat(64)],
      });
      expect(result).toMatchObject({
        base_price: 100000,
        contracts: [],
        price_contracts: [],
      });
    });

    it('keeps the latest valid mutinynet quote within the freshness window', async () => {
      const quote = makePriceQuote({
        base_stamp: Math.floor(Date.now() / 1000) - 4 * 60,
      });
      mockRelayQuote(quote, [makePriceContract(quote)]);

      await expect(fetchPriceQuote(50000, { cache: false, dedupe: false })).resolves.toMatchObject({
        latest_price: 100000,
      });
    });

    it('rejects a price quote beyond the freshness window', async () => {
      pushRelayQuoteResponse([
        makePriceQuote({
          base_stamp: Math.floor(Date.now() / 1000) - MAX_QUOTE_AGE_SECONDS - 1,
        }),
      ]);

      await expect(fetchPriceQuote(50000, { cache: false, dedupe: false })).rejects.toThrow(
        'Oracle price is stale'
      );
    });

    it('rejects a price quote timestamped in the future', async () => {
      pushRelayQuoteResponse([
        makePriceQuote({
          base_stamp: Math.floor(Date.now() / 1000) + 11,
        }),
      ]);

      await expect(fetchPriceQuote(50000, { cache: false, dedupe: false })).rejects.toThrow(
        'Oracle price timestamp is in the future'
      );
    });

    it('maps temporary quote gaps to a retryable oracle message', async () => {
      pushRelayQuoteResponse([]);

      await expect(fetchPriceQuote(50000, { cache: false, dedupe: false })).rejects.toThrow(
        'Oracle price quote is temporarily unavailable. Please try again in a minute.'
      );
    });

    it('preserves network failures from quote fetching', async () => {
      relayResponses.push({ events: [], error: 'Network error' });

      await expect(fetchPriceQuote(50000, { cache: false, dedupe: false })).rejects.toThrow(
        'Network error'
      );
    });

    it('turns relay timeouts into a user-friendly quote timeout', async () => {
      relayResponses.push({ events: [], skipEose: true });

      await expect(
        fetchPriceQuote(50000, {
          cache: false,
          dedupe: false,
          timeout: 1,
        })
      ).rejects.toThrow('Timed out fetching oracle price quote. Please try again.');
    });

    it('fails when the relay has no matching contracts for the fresh quote', async () => {
      const quote = makePriceQuote();
      pushRelayQuoteResponse([quote]);
      pushRelayContractResponse([]);

      await expect(fetchPriceQuote(50000, { cache: false, dedupe: false })).rejects.toThrow(
        'Oracle price contracts are temporarily unavailable from the relay'
      );
    });
  });

  describe('targeted contract fetches', () => {
    it('fetches fresh price contracts by commit hash', async () => {
      const oraclePubkey = 'b'.repeat(64);
      const commitHash = 'c'.repeat(64);
      const matchingContract = makePriceContract({
        commit_hash: commitHash,
        oracle_pubkey: oraclePubkey,
      });
      pushRelayContractResponse([
        matchingContract,
        makePriceContract({ commit_hash: 'd'.repeat(64), oracle_pubkey: oraclePubkey }),
      ]);

      const result = await fetchPriceContractsByCommitHashes(
        [commitHash],
        { timeout: 100 },
        oraclePubkey
      );
      const filters = getRelayReqFilters();

      expect(filters[0]).toMatchObject({
        kinds: [30000],
        authors: [oraclePubkey],
        '#h': [commitHash],
      });
      expect(result).toEqual([matchingContract]);
      expect(mockFetchProtocolContract).not.toHaveBeenCalled();
    });

    it('fetches fresh price contracts by base-stamp bucket tag', async () => {
      const oraclePubkey = 'b'.repeat(64);
      const baseStamp = Math.floor(Date.now() / 1000);
      const matchingContract = makePriceContract({
        base_stamp: baseStamp,
        oracle_pubkey: oraclePubkey,
      });
      pushRelayContractResponse([
        matchingContract,
        makePriceContract({ base_stamp: baseStamp - 1, oracle_pubkey: oraclePubkey }),
      ]);

      const result = await fetchPriceContractsByBucketTag(
        baseStamp,
        1.6,
        { timeout: 100 },
        oraclePubkey
      );
      const filters = getRelayReqFilters();

      expect(filters[0]).toMatchObject({
        kinds: [30000],
        authors: [oraclePubkey],
        '#d': [`${baseStamp}-1.6`],
      });
      expect(result).toEqual([matchingContract]);
      expect(mockFetchProtocolContract).not.toHaveBeenCalled();
    });

    it('fetches breached price contracts by contract id without applying quote freshness', async () => {
      const oraclePubkey = 'b'.repeat(64);
      const contractId = 'a'.repeat(64);
      const matchingContract = makePriceContract({
        base_stamp: Math.floor(Date.now() / 1000) - MAX_QUOTE_AGE_SECONDS - 60,
        contract_id: contractId,
        oracle_pubkey: oraclePubkey,
        thold_key: 'f'.repeat(64),
      });
      pushRelayBreachResponse([
        matchingContract,
        makePriceContract({
          contract_id: 'd'.repeat(64),
          oracle_pubkey: oraclePubkey,
          thold_key: 'e'.repeat(64),
        }),
        makePriceContract({
          contract_id: contractId,
          oracle_pubkey: oraclePubkey,
          thold_key: null,
        }),
      ]);

      const result = await fetchBreachedPriceContractsByIds(
        [contractId],
        { timeout: 100 },
        oraclePubkey
      );
      const filters = getRelayReqFilters();

      expect(filters[0]).toMatchObject({
        kinds: [1000],
        authors: [oraclePubkey],
        '#h': [contractId],
      });
      expect(result).toEqual([matchingContract]);
      expect(mockFetchProtocolContract).not.toHaveBeenCalled();
    });
  });
});
