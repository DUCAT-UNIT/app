/**
 * Mint Quotes API - deposit UNIT Runes and receive Cashu UNIT tokens
 */

import { getJSON, postJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import {
  normalizeOptionalCashuAmount,
  type CashuAmountLike,
} from '../cashuTsCompat';
import { CASHU_UNIT_UNIT, DEFAULT_CASHU_UNIT, type CashuUnit } from '../cashuUnits';
import { MINT_URL, RUNE_ID } from './mintConfig';
import { assertOnchainCashuMintSupport } from './mintInfo';

export interface MintQuote {
  quote: string;
  request: string;
  paid?: boolean;
  state?: string;
  unit?: string;
  expiry?: number;
  amount?: number;
  amount_paid?: number;
  amount_issued?: number;
  pubkey?: string;
}

type MintQuoteWire = Omit<MintQuote, 'amount' | 'amount_paid' | 'amount_issued'> & {
  amount?: CashuAmountLike | null;
  amount_paid?: CashuAmountLike | null;
  amount_issued?: CashuAmountLike | null;
};

export interface BlindedOutput {
  amount: number;
  B_: string;
  id?: string;
}

export interface MintResponse {
  signatures: Array<{
    C_: string;
    id?: string;
    amount?: number | CashuAmountLike;
  }>;
  error?: string;
}

export const getMintQuoteAvailableAmount = (quote: Pick<MintQuote, 'amount_paid' | 'amount_issued'>): number => {
  const amountPaid = quote.amount_paid ?? 0;
  const amountIssued = quote.amount_issued ?? 0;
  return Math.max(0, amountPaid - amountIssued);
};

export const deriveMintQuoteState = (quote: Pick<MintQuote, 'state' | 'amount_paid' | 'amount_issued' | 'paid'>): string => {
  if (quote.state) {
    return quote.state;
  }
  if (getMintQuoteAvailableAmount(quote) > 0 || quote.paid === true) {
    return 'PAID';
  }
  if ((quote.amount_paid ?? 0) > 0 && (quote.amount_issued ?? 0) >= (quote.amount_paid ?? 0)) {
    return 'ISSUED';
  }
  return 'UNPAID';
};

const normalizeMintQuote = (quote: MintQuoteWire): MintQuote => {
  const normalized: MintQuote = {
    ...quote,
    amount: normalizeOptionalCashuAmount(quote.amount, 'mint quote amount'),
    amount_paid: normalizeOptionalCashuAmount(quote.amount_paid, 'mint quote amount_paid'),
    amount_issued: normalizeOptionalCashuAmount(quote.amount_issued, 'mint quote amount_issued'),
  };

  return {
    ...normalized,
    state: deriveMintQuoteState(normalized),
  };
};

/**
 * Create a mint quote for the advertised onchain/unit Cashu method.
 * @param pubkey - Compressed secp256k1 wallet public key for quote signing
 * @returns Quote with ID and deposit request
 */
export const createMintQuote = async (
  pubkey: string,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<MintQuote> => {
  try {
    logger.info('Creating mint quote', { pubkey: pubkey.substring(0, 10), unit });

    await assertOnchainCashuMintSupport(unit);

    const body = {
      unit,
      pubkey,
      ...(unit === CASHU_UNIT_UNIT ? { rune_id: RUNE_ID } : {}),
    };

    const quote = normalizeMintQuote(await postJSON<MintQuoteWire>(`${MINT_URL}/v1/mint/quote/onchain`, body, {
      timeout: 10000,
      description: 'Create mint quote',
    }));

    logger.info('Mint quote created', {
      quoteId: quote.quote,
      depositAddress: quote.request
    });

    return quote;
  } catch (error: unknown) {
    logger.error('Failed to create mint quote', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Check mint quote status
 * @param quoteId - Quote ID
 * @returns Quote status (UNPAID/PAID/ISSUED)
 */
export const checkMintQuote = async (quoteId: string): Promise<MintQuote> => {
  try {
    const quote = normalizeMintQuote(await getJSON<MintQuoteWire>(`${MINT_URL}/v1/mint/quote/onchain/${quoteId}`, {
      timeout: 5000,
      description: 'Check mint quote',
    }));
    return quote;
  } catch (error: unknown) {
    logger.error('Failed to check mint quote', { error: (error as Error).message, quoteId });
    throw error;
  }
};

/**
 * Mint tokens after deposit is confirmed
 * @param quoteId - Quote ID
 * @param outputs - Blinded messages for amounts to mint
 * @returns Blind signatures from mint
 */
export const mintTokens = async (
  quoteId: string,
  outputs: BlindedOutput[],
  signature: string
): Promise<MintResponse> => {
  try {
    logger.info('Minting tokens', { quoteId, outputCount: outputs.length });

    const response = await postJSON<MintResponse>(`${MINT_URL}/v1/mint/onchain`, {
      quote: quoteId,
      outputs,
      signature,
    }, {
      timeout: 10000,
      description: 'Mint tokens',
    });

    // Check if response contains an error
    if (response.error) {
      throw new Error(`Mint failed: ${response.error}`);
    }

    // Validate response has signatures
    if (!response.signatures || !Array.isArray(response.signatures)) {
      throw new Error('Invalid mint response: missing signatures');
    }

    logger.info('Tokens minted', { signatureCount: response.signatures.length });
    return response;
  } catch (error: unknown) {
    logger.error('Failed to mint tokens', { error: (error as Error).message, quoteId });
    throw error;
  }
};
