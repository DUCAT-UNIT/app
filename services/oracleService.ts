/**
 * Oracle Service
 * Fetches price quotes from the Oracle API for vault operations
 */

import type { PriceQuote as SdkPriceQuote } from '@ducat-unit/client-sdk';
import type { PriceContract, PriceQuote, ProtoProfile } from '@ducat-unit/core';
import * as SHARED from '@ducat-unit/core/schema';
import { parse_content, verify_event } from '@vbyte/nostr-sdk/lib';
import { API } from '../utils/constants';
import { logger } from '../utils/logger';
import { getJSON } from '../utils/apiClient';
import { fetchProtocolContract } from './vaultWallet';

// Keep this aligned with the guardian validator, which rejects vault requests
// built from oracle attestations older than five minutes.
const PRICE_CONTRACT_CACHE_TTL_MS = 30_000;
export const MAX_QUOTE_AGE_SECONDS = 5 * 60;
const ORACLE_MEMBER_GROUP = 22;

interface FetchPriceQuoteOptions {
  timeout?: number;
  dedupe?: boolean;
  cache?: boolean;
  transport?: 'fetch' | 'xhr';
  includeContracts?: boolean;
}

function isTemporaryOracleQuoteGap(error: Error): boolean {
  return /price point not found|invalid quote|no fresh oracle price quote|HTTP 400/i.test(
    error.message
  );
}

type ValidatorPriceHistoryResponse = {
  data?: PriceContract[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type LegacyPriceQuote = PriceQuote & {
  contracts: PriceContract[];
  price_contracts: PriceContract[];
  latest_price: number;
  latest_stamp: number;
  quote_price: number;
  quote_stamp: number;
};

let cachedRelayQuote: { key: string; expiresAt: number; quote: LegacyPriceQuote } | null = null;
let inFlightRelayQuote: { key: string; promise: Promise<LegacyPriceQuote> } | null = null;

type RuntimeWebSocketEventName = 'open' | 'message' | 'error' | 'close';
type RuntimeWebSocketEvent = { data?: unknown; message?: unknown };
type RuntimeWebSocketHandler = (event?: RuntimeWebSocketEvent) => void;
type RuntimeWebSocket = {
  send(data: string): void;
  close(): void;
  addEventListener?: (event: RuntimeWebSocketEventName, handler: RuntimeWebSocketHandler) => void;
  removeEventListener?: (
    event: RuntimeWebSocketEventName,
    handler: RuntimeWebSocketHandler
  ) => void;
};

type NostrFilter = {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [tag: `#${string}`]: string[] | number[] | undefined;
};

type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

function createRelaySubscriptionId(label: string): string {
  return `ducat-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getRuntimeWebSocket(): new (url: string) => RuntimeWebSocket {
  const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => RuntimeWebSocket })
    .WebSocket;
  if (!WebSocketCtor) {
    throw new Error('WebSocket is unavailable in this runtime');
  }
  return WebSocketCtor;
}

function getOraclePubkey(proto?: Pick<ProtoProfile, 'proto_members'>): string {
  return (
    proto?.proto_members?.find((member) => member.group === ORACLE_MEMBER_GROUP)?.pubkey ??
    API.ORACLE_PUBKEY
  );
}

function attachWebSocketHandler(
  socket: RuntimeWebSocket,
  eventName: RuntimeWebSocketEventName,
  handler: RuntimeWebSocketHandler
): () => void {
  if (socket.addEventListener) {
    socket.addEventListener(eventName, handler);
    return () => socket.removeEventListener?.(eventName, handler);
  }

  const handlerKey = `on${eventName}`;
  const socketWithHandlers = socket as unknown as Record<
    string,
    RuntimeWebSocketHandler | null | undefined
  >;
  socketWithHandlers[handlerKey] = handler;
  return () => {
    if (socketWithHandlers[handlerKey] === handler) {
      socketWithHandlers[handlerKey] = null;
    }
  };
}

function getWebSocketMessageData(event?: RuntimeWebSocketEvent): string | null {
  if (!event || typeof event.data !== 'string') {
    return null;
  }
  return event.data;
}

function getWebSocketErrorMessage(event?: RuntimeWebSocketEvent): string {
  if (event && typeof event.message === 'string' && event.message.length > 0) {
    return event.message;
  }
  return 'unknown WebSocket error';
}

function isNostrEvent(value: unknown): value is NostrEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<NostrEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.created_at === 'number' &&
    typeof event.kind === 'number' &&
    Array.isArray(event.tags) &&
    typeof event.content === 'string' &&
    typeof event.sig === 'string'
  );
}

function queryOracleRelay(
  filter: NostrFilter,
  options: FetchPriceQuoteOptions,
  label: string
): Promise<NostrEvent[]> {
  const timeoutMs = options.timeout ?? 8000;
  const WebSocketCtor = getRuntimeWebSocket();
  const subscriptionId = createRelaySubscriptionId(label);
  const socket = new WebSocketCtor(API.RELAY_WS);

  return new Promise((resolve, reject) => {
    let settled = false;
    const events: NostrEvent[] = [];
    const cleanups: Array<() => void> = [];

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      cleanups.forEach((cleanup) => cleanup());
      try {
        socket.close();
      } catch {
        // Best-effort socket cleanup after a terminal relay response.
      }
      callback();
    };

    const fail = (error: Error) => settle(() => reject(error));
    const finish = () => settle(() => resolve(events));

    const timer = setTimeout(() => {
      fail(new Error(`Timed out fetching oracle ${label} from relay`));
    }, timeoutMs);

    cleanups.push(
      attachWebSocketHandler(socket, 'open', () => {
        socket.send(JSON.stringify(['REQ', subscriptionId, filter]));
      }),
      attachWebSocketHandler(socket, 'message', (event) => {
        const data = getWebSocketMessageData(event);
        if (!data) {
          return;
        }

        let message: unknown;
        try {
          message = JSON.parse(data);
        } catch {
          return;
        }

        if (!Array.isArray(message) || message[1] !== subscriptionId) {
          return;
        }

        if (message[0] === 'EVENT' && isNostrEvent(message[2])) {
          events.push(message[2]);
          return;
        }

        if (message[0] === 'EOSE') {
          try {
            socket.send(JSON.stringify(['CLOSE', subscriptionId]));
          } catch {
            // The socket may already be closing after EOSE; the query is complete.
          }
          finish();
          return;
        }

        if (message[0] === 'CLOSED') {
          fail(new Error(`Oracle relay closed ${label} subscription: ${String(message[2] ?? '')}`));
        }
      }),
      attachWebSocketHandler(socket, 'error', (event) => {
        fail(new Error(`Oracle relay ${label} query failed: ${getWebSocketErrorMessage(event)}`));
      }),
      attachWebSocketHandler(socket, 'close', () => {
        if (!settled) {
          fail(new Error(`Oracle relay closed before ${label} query completed`));
        }
      })
    );
  });
}

function pickLatestQuote(quotes: PriceQuote[]): PriceQuote {
  const latest = quotes
    .filter(
      (quote) =>
        typeof quote.base_price === 'number' &&
        Number.isFinite(quote.base_price) &&
        typeof quote.base_stamp === 'number' &&
        Number.isFinite(quote.base_stamp)
    )
    .sort((a, b) => b.base_stamp - a.base_stamp)[0];

  if (!latest) {
    throw new Error('No fresh oracle price quote was returned by the relay');
  }

  return latest;
}

function assertFreshOracleStamp(stamp: number): void {
  if (typeof stamp !== 'number') {
    throw new Error('Oracle price quote is missing timestamp');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const quoteAge = nowSeconds - stamp;
  if (stamp > nowSeconds + 10) {
    throw new Error('Oracle price timestamp is in the future. Rejecting quote.');
  }
  if (quoteAge > MAX_QUOTE_AGE_SECONDS) {
    logger.error('[OracleService] Oracle price quote is stale', {
      quoteStamp: stamp,
      ageSeconds: quoteAge,
      maxAgeSeconds: MAX_QUOTE_AGE_SECONDS,
    });
    throw new Error(
      `Oracle price is stale (${Math.floor(quoteAge / 60)} minutes old). Please try again.`
    );
  }
}

function parsePriceQuotes(events: NostrEvent[]): PriceQuote[] {
  return events
    .filter((event) => {
      const verificationError = verify_event(event as Parameters<typeof verify_event>[0]);
      if (verificationError) {
        logger.warn('[OracleService] Ignoring invalid oracle price quote event', {
          error: verificationError,
          eventId: event.id,
        });
        return false;
      }
      return true;
    })
    .map((event) => parse_content(event.content, SHARED.price.quote))
    .filter((parsed): parsed is { ok: true; result: PriceQuote } => parsed.ok === true)
    .map((parsed) => parsed.result);
}

async function fetchLatestRelayQuote(
  oraclePubkey: string,
  options: FetchPriceQuoteOptions
): Promise<PriceQuote> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const events = await queryOracleRelay(
    {
      kinds: [10000],
      authors: [oraclePubkey],
      since: nowSeconds - MAX_QUOTE_AGE_SECONDS,
    },
    options,
    'price quote'
  );

  const quotes = parsePriceQuotes(events);
  const quote = pickLatestQuote(quotes);
  assertFreshOracleStamp(quote.base_stamp);
  return quote;
}

function parsePriceContracts(events: unknown[]): PriceContract[] {
  return events
    .filter((event) => {
      if (!isNostrEvent(event)) {
        return false;
      }
      const verificationError = verify_event(event as Parameters<typeof verify_event>[0]);
      if (verificationError) {
        logger.warn('[OracleService] Ignoring invalid oracle price contract event', {
          error: verificationError,
          eventId: event.id,
        });
        return false;
      }
      return true;
    })
    .map((event) => {
      const content = (event as { content?: unknown })?.content;
      return typeof content === 'string'
        ? parse_content(content, SHARED.price.contract)
        : { ok: false };
    })
    .filter((parsed): parsed is { ok: true; result: PriceContract } => parsed.ok === true)
    .map((parsed) => parsed.result);
}

async function fetchRecentRelayPriceContracts(
  oraclePubkey: string,
  quote: PriceQuote,
  options: FetchPriceQuoteOptions
): Promise<PriceContract[]> {
  const events = await queryOracleRelay(
    {
      kinds: [30000],
      authors: [oraclePubkey],
      since: Math.max(0, quote.base_stamp - 10),
    },
    options,
    'price contracts'
  );

  const nowSeconds = Math.floor(Date.now() / 1000);
  return parsePriceContracts(events).filter(
    (contract) =>
      contract.base_stamp === quote.base_stamp &&
      contract.base_price === quote.base_price &&
      contract.chain_network === quote.chain_network &&
      contract.oracle_pubkey === quote.oracle_pubkey &&
      nowSeconds - contract.base_stamp <= MAX_QUOTE_AGE_SECONDS
  );
}

function toLegacyPriceQuote(quote: PriceQuote, contracts: PriceContract[]): LegacyPriceQuote {
  return {
    ...quote,
    contracts,
    price_contracts: contracts,
    latest_price: quote.base_price,
    latest_stamp: quote.base_stamp,
    quote_price: quote.base_price,
    quote_stamp: quote.base_stamp,
  } as LegacyPriceQuote;
}

async function fetchRelayPriceQuote(
  options: FetchPriceQuoteOptions,
  cacheKey: string
): Promise<LegacyPriceQuote> {
  const proto = await fetchProtocolContract();
  const oraclePubkey = getOraclePubkey(proto);
  const includeContracts = options.includeContracts !== false;
  const relayKey = `${cacheKey}:${oraclePubkey}:${API.RELAY_WS}:${includeContracts ? 'contracts' : 'quote-only'}`;
  const now = Date.now();

  if (
    options.cache !== false &&
    cachedRelayQuote?.key === relayKey &&
    cachedRelayQuote.expiresAt > now
  ) {
    return cachedRelayQuote.quote;
  }

  if (options.dedupe !== false && inFlightRelayQuote?.key === relayKey) {
    return inFlightRelayQuote.promise;
  }

  const promise = (async () => {
    const quote = await fetchLatestRelayQuote(oraclePubkey, options);
    if (!includeContracts) {
      const legacyQuote = toLegacyPriceQuote(quote, []);
      cachedRelayQuote = {
        key: relayKey,
        expiresAt: Date.now() + PRICE_CONTRACT_CACHE_TTL_MS,
        quote: legacyQuote,
      };
      return legacyQuote;
    }

    const contracts = await fetchRecentRelayPriceContracts(oraclePubkey, quote, options);

    if (contracts.length === 0) {
      throw new Error('Oracle price contracts are temporarily unavailable from the relay');
    }

    const legacyQuote = toLegacyPriceQuote(quote, contracts);
    cachedRelayQuote = {
      key: relayKey,
      expiresAt: Date.now() + PRICE_CONTRACT_CACHE_TTL_MS,
      quote: legacyQuote,
    };
    return legacyQuote;
  })().finally(() => {
    if (inFlightRelayQuote?.key === relayKey) {
      inFlightRelayQuote = null;
    }
  });

  inFlightRelayQuote = { key: relayKey, promise };
  return promise;
}

async function getOraclePubkeyForFetch(oraclePubkey?: string): Promise<string> {
  if (oraclePubkey) {
    return oraclePubkey;
  }

  const proto = await fetchProtocolContract();
  return getOraclePubkey(proto);
}

function isFreshPriceContract(contract: PriceContract, nowSeconds: number): boolean {
  return (
    typeof contract.base_stamp === 'number' &&
    nowSeconds - contract.base_stamp <= MAX_QUOTE_AGE_SECONDS
  );
}

export async function fetchPriceContractsByCommitHashes(
  commitHashes: string[],
  options: FetchPriceQuoteOptions = {},
  oraclePubkey?: string
): Promise<PriceContract[]> {
  if (commitHashes.length === 0) {
    return [];
  }

  const resolvedOraclePubkey = await getOraclePubkeyForFetch(oraclePubkey);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const events = await queryOracleRelay(
    {
      kinds: [30000],
      authors: [resolvedOraclePubkey],
      '#h': commitHashes,
      since: nowSeconds - MAX_QUOTE_AGE_SECONDS,
    },
    options,
    'price contracts'
  );

  return parsePriceContracts(events).filter(
    (contract) =>
      commitHashes.includes(contract.commit_hash) &&
      contract.oracle_pubkey === resolvedOraclePubkey &&
      isFreshPriceContract(contract, nowSeconds)
  );
}

export async function fetchPriceContractsByBucketTag(
  baseStamp: number,
  bucketRate: number,
  options: FetchPriceQuoteOptions = {},
  oraclePubkey?: string
): Promise<PriceContract[]> {
  if (!Number.isFinite(baseStamp) || !Number.isFinite(bucketRate) || bucketRate <= 0) {
    return [];
  }

  const resolvedOraclePubkey = await getOraclePubkeyForFetch(oraclePubkey);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const events = await queryOracleRelay(
    {
      kinds: [30000],
      authors: [resolvedOraclePubkey],
      '#d': [`${baseStamp}-${bucketRate}`],
      since: nowSeconds - MAX_QUOTE_AGE_SECONDS,
    },
    options,
    'price contracts'
  );

  return parsePriceContracts(events).filter(
    (contract) =>
      contract.base_stamp === baseStamp &&
      contract.oracle_pubkey === resolvedOraclePubkey &&
      isFreshPriceContract(contract, nowSeconds)
  );
}

/**
 * Fetches a price quote from the Oracle API
 * @param liquidationPrice - The liquidation threshold price
 * @returns Price quote with oracle signature
 */
export async function fetchPriceQuote(
  liquidationPrice: number,
  options: FetchPriceQuoteOptions = {}
): Promise<SdkPriceQuote> {
  const thresholdPrice = Math.floor(liquidationPrice);
  // Ensure minimum threshold of 1
  const safeThreshold = thresholdPrice === 0 ? 1 : thresholdPrice;
  const quoteKey = `oracle-price-quote-${safeThreshold}`;

  logger.debug(`[OracleService] Fetching price quote for threshold: ${safeThreshold}`);

  try {
    const quote = await fetchRelayPriceQuote(options, quoteKey);

    assertFreshOracleStamp(quote.latest_stamp);

    logger.debug('[OracleService] Price quote received:', {
      base_price: quote.base_price,
      base_stamp: quote.base_stamp,
      contractCount: quote.contracts.length,
    });
    return quote;
  } catch (error) {
    logger.error('[OracleService] Failed to fetch price quote:', { error });
    if (error instanceof Error) {
      if (error.name === 'AbortError' || /abort|timed out/i.test(error.message)) {
        throw new Error('Timed out fetching oracle price quote. Please try again.');
      }
      if (isTemporaryOracleQuoteGap(error)) {
        throw new Error(
          'Oracle price quote is temporarily unavailable. Please try again in a minute.'
        );
      }
      throw error;
    }
    throw new Error('Failed to fetch price quote from Oracle');
  }
}

/**
 * Fetches the current Bitcoin price from the Oracle API
 * @returns Current BTC price in USD
 */
export async function fetchCurrentPrice(): Promise<number> {
  try {
    const proto = await fetchProtocolContract();
    const price = (await fetchLatestRelayQuote(getOraclePubkey(proto), {})).base_price;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 10_000_000) {
      throw new Error(`Invalid oracle price: ${price}`);
    }
    return price;
  } catch (error) {
    logger.error('[OracleService] Failed to fetch current price:', { error });
    throw new Error('Failed to fetch current Bitcoin price');
  }
}

export async function fetchBreachedPriceContracts(pageSize = 300): Promise<PriceContract[]> {
  try {
    const url = new URL(`${API.VALIDATOR}/api/price/history`);
    url.searchParams.set('breached', 'true');
    url.searchParams.set('page_size', String(pageSize));

    const data = await getJSON<ValidatorPriceHistoryResponse>(url.toString(), {
      timeout: 8000,
      retryOptions: { maxRetries: 1 },
      dedupeKey: `validator-breached-prices-${pageSize}`,
      cacheKey: `validator-breached-prices-${pageSize}`,
      cacheTtlMs: 30_000,
      circuitKey: 'validator-breached-prices',
    });

    return data.data ?? [];
  } catch (error) {
    logger.error('[OracleService] Failed to fetch breached price contracts:', { error });
    return [];
  }
}
