import {
  getDecodedToken,
  getEncodedToken,
  getTokenMetadata,
  normalizeProofAmounts,
  type AmountLike,
  type ProofLike,
  type Token,
} from '@cashu/cashu-ts';

import type { CashuProof } from './crypto/cryptoProofs';
import { DEFAULT_CASHU_UNIT, isCashuUnit, normalizeCashuUnit, type CashuUnit } from './cashuUnits';

export type CashuAmountLike = AmountLike;

const CASHU_TOKEN_PREFIX_V4 = /^cashuB/i;
// sat tokens are BTC/Lightning only and must not be decoded as Ducat UNIT tokens.

interface AmountObject {
  toBigInt?: () => bigint;
  toNumber?: () => number;
  toString?: () => string;
}

const isAmountObject = (value: unknown): value is AmountObject =>
  typeof value === 'object' &&
  value !== null &&
  (typeof (value as AmountObject).toBigInt === 'function' ||
    typeof (value as AmountObject).toNumber === 'function');

const bigintToSafeNumber = (value: bigint, context: string): number => {
  if (value < 0n) {
    throw new Error(`${context} must be non-negative`);
  }
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${context} exceeds JavaScript safe integer range`);
  }
  return Number(value);
};

export const normalizeCashuAmount = (
  value: CashuAmountLike | unknown,
  context = 'amount'
): number => {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${context} must be a non-negative safe integer`);
    }
    return value;
  }

  if (typeof value === 'bigint') {
    return bigintToSafeNumber(value, context);
  }

  if (typeof value === 'string') {
    if (!/^\d+$/.test(value)) {
      throw new Error(`${context} must be an integer string`);
    }
    return bigintToSafeNumber(BigInt(value), context);
  }

  if (isAmountObject(value)) {
    if (typeof value.toBigInt === 'function') {
      return bigintToSafeNumber(value.toBigInt(), context);
    }
    const amount = value.toNumber?.();
    if (typeof amount === 'number') {
      return normalizeCashuAmount(amount, context);
    }
  }

  throw new Error(`${context} is not a valid Cashu amount`);
};

export const normalizeOptionalCashuAmount = (
  value: CashuAmountLike | unknown,
  context = 'amount'
): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  return normalizeCashuAmount(value, context);
};

const normalizeWitness = (witness: unknown): string | undefined => {
  if (witness === undefined || witness === null) {
    return undefined;
  }
  return typeof witness === 'string' ? witness : JSON.stringify(witness);
};

export const normalizeCashuProof = (
  proof: ProofLike | CashuProof | unknown,
  context = 'proof'
): CashuProof => {
  if (!proof || typeof proof !== 'object') {
    throw new Error(`${context} must be an object`);
  }

  const raw = proof as Record<string, unknown>;
  if (typeof raw.secret !== 'string' || typeof raw.C !== 'string' || typeof raw.id !== 'string') {
    throw new Error(`${context} is missing required proof fields`);
  }

  const normalized: CashuProof = {
    ...(raw as unknown as CashuProof),
    id: raw.id,
    amount: normalizeCashuAmount(raw.amount, `${context}.amount`),
    secret: raw.secret,
    C: raw.C,
  };

  const witness = normalizeWitness(raw.witness);
  if (witness !== undefined) {
    normalized.witness = witness;
  } else {
    delete normalized.witness;
  }

  return normalized;
};

export const normalizeCashuProofs = (
  proofs: Array<ProofLike | CashuProof | unknown>,
  context = 'proofs'
): CashuProof[] => proofs.map((proof, index) => normalizeCashuProof(proof, `${context}[${index}]`));

export const getKeysetIdsFromMintKeys = (
  keyData: { keysets?: Array<{ id?: string }> } | null | undefined
): string[] =>
  (keyData?.keysets ?? [])
    .map((keyset) => keyset.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

export const keysetIdsMatch = (a: string | undefined, b: string | undefined): boolean => {
  if (!a || !b) {
    return false;
  }
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left === right || left.startsWith(right) || right.startsWith(left);
};

export interface DecodedCashuToken {
  mint: string;
  proofs: CashuProof[];
  amount: number;
  unit?: string;
}

export interface CashuTokenMetadata {
  mint: string;
  amount: number;
  unit?: string;
  proofs: Array<Partial<CashuProof> & Pick<CashuProof, 'amount' | 'secret' | 'C'>>;
}

export const assertSupportedCashuTokenUnit = (unit: string | undefined): CashuUnit => {
  if (unit === undefined) {
    throw new Error('Cashu token unit is required');
  }
  if (!isCashuUnit(unit)) {
    throw new Error(`Unsupported Cashu token unit: ${unit}`);
  }
  return normalizeCashuUnit(unit);
};

export const encodeCashuTokenV4 = (
  proofs: CashuProof[],
  mint: string,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): string => {
  const normalizedProofs = normalizeProofAmounts(normalizeCashuProofs(proofs));
  return getEncodedToken({
    mint,
    unit,
    proofs: normalizedProofs,
  } satisfies Token);
};

export const decodeCashuToken = (
  tokenString: string,
  keysetIds: readonly string[] = []
): DecodedCashuToken => {
  if (!CASHU_TOKEN_PREFIX_V4.test(tokenString)) {
    throw new Error('Unsupported Cashu token format: only cashuB tokens are supported');
  }

  const decoded = getDecodedToken(tokenString, keysetIds);
  const unit = assertSupportedCashuTokenUnit(decoded.unit);
  const proofs = normalizeCashuProofs(decoded.proofs);
  return {
    mint: decoded.mint,
    unit,
    proofs,
    amount: proofs.reduce((sum, proof) => sum + proof.amount, 0),
  };
};

export const decodeCashuTokenMetadata = (tokenString: string): CashuTokenMetadata => {
  if (!CASHU_TOKEN_PREFIX_V4.test(tokenString)) {
    throw new Error('Unsupported Cashu token format: only cashuB tokens are supported');
  }

  const metadata = getTokenMetadata(tokenString);
  const unit = assertSupportedCashuTokenUnit(metadata.unit);
  const proofs = metadata.incompleteProofs.map((proof, index) => {
    const raw = proof as Record<string, unknown>;
    if (typeof raw.secret !== 'string' || typeof raw.C !== 'string') {
      throw new Error(`token metadata proof ${index} is missing required fields`);
    }
    return {
      ...(raw as Partial<CashuProof>),
      amount: normalizeCashuAmount(raw.amount, `token metadata proofs[${index}].amount`),
      secret: raw.secret,
      C: raw.C,
    };
  });

  return {
    mint: metadata.mint,
    unit,
    amount: normalizeCashuAmount(metadata.amount, 'token metadata amount'),
    proofs,
  };
};
