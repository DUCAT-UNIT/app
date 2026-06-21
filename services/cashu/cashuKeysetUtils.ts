import type { MintKeyset, MintKeys } from './cashuMintClient';
import { CashuProof, selectProofsForAmount } from './crypto';
import { keysetIdsMatch, normalizeCashuAmount, normalizeCashuProofs } from './cashuTsCompat';
import { DEFAULT_CASHU_UNIT, type CashuUnit } from './cashuUnits';

export interface SelectedProofsWithFees {
  selectedProofs: CashuProof[];
  selectedAmount: number;
  inputFees: number;
  requiredAmount: number;
}

export interface FilterProofsForCashuUnitResult {
  proofs: CashuProof[];
  droppedUnknownKeyset: number;
  droppedWrongUnit: number;
}

const sumProofAmounts = (proofs: CashuProof[]): number =>
  proofs.reduce((sum, proof) => sum + normalizeCashuAmount(proof.amount, 'proof amount'), 0);

export const selectActiveCashuKeyset = (
  keyData: MintKeys,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): MintKeyset => {
  const keysets = keyData.keysets ?? [];
  const keyset = keysets.find((ks) => ks.unit === unit && ks.active !== false && ks.keys);

  if (!keyset?.keys) {
    throw new Error(`No active ${unit} keyset available from mint`);
  }

  return keyset;
};

export const findKeysetById = (keyData: MintKeys, keysetId: string): MintKeyset | undefined => {
  const keysets = keyData.keysets ?? [];
  const exact = keysets.find((ks) => ks.id.toLowerCase() === keysetId.toLowerCase());
  if (exact) {
    return exact;
  }

  const partialMatches = keysets.filter((ks) => keysetIdsMatch(ks.id, keysetId));
  return partialMatches.length === 1 ? partialMatches[0] : undefined;
};

export const assertResponseSignaturesUseExpectedKeyset = (
  signatures: Array<{ id?: string }>,
  expectedKeysetId: string,
  context: string
): string => {
  if (!Array.isArray(signatures) || signatures.length === 0) {
    throw new Error(`${context} returned no signatures`);
  }

  let signedKeysetId: string | undefined;
  for (const signature of signatures) {
    if (!signature.id) {
      continue;
    }
    if (!keysetIdsMatch(signature.id, expectedKeysetId)) {
      throw new Error(
        `${context} signed with unexpected keyset ${signature.id}; expected ${expectedKeysetId}`
      );
    }
    signedKeysetId ??= signature.id;
  }

  return signedKeysetId ?? expectedKeysetId;
};

export const resolveResponseSignatureKeysetForUnit = (
  signatures: Array<{ id?: string }>,
  keyData: MintKeys,
  expectedKeyset: MintKeyset,
  unit: CashuUnit = DEFAULT_CASHU_UNIT,
  context = 'Cashu response'
): { keysetId: string; keys: Record<number | string, string> } => {
  if (!Array.isArray(signatures) || signatures.length === 0) {
    throw new Error(`${context} returned no signatures`);
  }
  if (!expectedKeyset.keys) {
    throw new Error(`${context} expected keyset ${expectedKeyset.id} has no keys`);
  }

  let signedKeysetId: string | undefined;
  for (const signature of signatures) {
    if (!signature.id) {
      continue;
    }
    if (signedKeysetId && !keysetIdsMatch(signature.id, signedKeysetId)) {
      throw new Error(
        `${context} returned signatures from multiple keysets: ${signedKeysetId}, ${signature.id}`
      );
    }
    signedKeysetId ??= signature.id;
  }

  if (!signedKeysetId || keysetIdsMatch(signedKeysetId, expectedKeyset.id)) {
    if (!signedKeysetId || signedKeysetId.toLowerCase() === expectedKeyset.id.toLowerCase()) {
      return {
        keysetId: signedKeysetId ?? expectedKeyset.id,
        keys: expectedKeyset.keys,
      };
    }
  }

  const exactSignedKeyset = keyData.keysets?.find(
    (keyset) => keyset.id.toLowerCase() === signedKeysetId.toLowerCase()
  );
  if (exactSignedKeyset) {
    if (exactSignedKeyset.unit !== unit) {
      throw new Error(`${context} signed with ${exactSignedKeyset.unit} keyset in ${unit} flow`);
    }
    if (!exactSignedKeyset.keys) {
      throw new Error(`${context} signed keyset ${signedKeysetId} has no keys`);
    }
    return {
      keysetId: signedKeysetId,
      keys: exactSignedKeyset.keys,
    };
  }

  if (keysetIdsMatch(signedKeysetId, expectedKeyset.id)) {
    return {
      keysetId: signedKeysetId,
      keys: expectedKeyset.keys,
    };
  }

  const matchingKeysets = (keyData.keysets ?? []).filter((keyset) =>
    keysetIdsMatch(keyset.id, signedKeysetId)
  );
  if (matchingKeysets.length > 1) {
    throw new Error(`${context} signed keyset ${signedKeysetId} is ambiguous`);
  }

  const signedKeyset = matchingKeysets[0] ?? findKeysetById(keyData, signedKeysetId);
  if (!signedKeyset) {
    throw new Error(`${context} signed with unknown keyset ${signedKeysetId}`);
  }
  if (signedKeyset.unit !== unit) {
    throw new Error(`${context} signed with ${signedKeyset.unit} keyset in ${unit} flow`);
  }
  if (!signedKeyset.keys) {
    throw new Error(`${context} signed keyset ${signedKeysetId} has no keys`);
  }

  return {
    keysetId: signedKeysetId,
    keys: signedKeyset.keys,
  };
};

export const assertProofsMatchCashuUnit = (
  proofs: CashuProof[],
  keyData: MintKeys,
  unit: CashuUnit = DEFAULT_CASHU_UNIT,
  context = 'Cashu proofs'
): void => {
  for (const proof of proofs) {
    const keyset = findKeysetById(keyData, proof.id);
    if (!keyset) {
      throw new Error(`${context} reference unknown keyset ${proof.id}`);
    }
    if (keyset.unit !== unit) {
      throw new Error(`${context} contain ${keyset.unit} proof in ${unit} flow`);
    }
  }
};

export const filterProofsForCashuUnit = (
  proofs: CashuProof[],
  keyData: MintKeys,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): FilterProofsForCashuUnitResult => {
  const filtered: CashuProof[] = [];
  let droppedUnknownKeyset = 0;
  let droppedWrongUnit = 0;

  for (const proof of normalizeCashuProofs(proofs)) {
    const keyset = findKeysetById(keyData, proof.id);
    if (!keyset) {
      droppedUnknownKeyset += 1;
      continue;
    }
    if (keyset.unit !== unit) {
      droppedWrongUnit += 1;
      continue;
    }
    filtered.push(proof);
  }

  return {
    proofs: filtered,
    droppedUnknownKeyset,
    droppedWrongUnit,
  };
};

export const calculateInputFees = (proofs: CashuProof[], keyData: MintKeys): number => {
  if ((keyData.keysets ?? []).length === 0 || proofs.length === 0) {
    return 0;
  }

  const feePpk = proofs.reduce((sum, proof) => {
    const keyset = findKeysetById(keyData, proof.id);
    if (!keyset) {
      throw new Error(`Proof references unknown or ambiguous keyset ${proof.id}`);
    }
    return sum + normalizeCashuAmount(keyset?.input_fee_ppk ?? 0, 'input_fee_ppk');
  }, 0);

  return Math.floor((feePpk + 999) / 1000);
};

export const selectProofsForAmountIncludingFees = (
  proofs: CashuProof[],
  amount: number,
  keyData: MintKeys
): SelectedProofsWithFees => {
  const normalizedProofs = normalizeCashuProofs(proofs);
  let target = amount;

  for (let attempt = 0; attempt < 10; attempt++) {
    const selectedProofs = selectProofsForAmount(normalizedProofs, target);
    const selectedAmount = sumProofAmounts(selectedProofs);
    const inputFees = calculateInputFees(selectedProofs, keyData);
    const requiredAmount = amount + inputFees;

    if (selectedAmount >= requiredAmount) {
      return {
        selectedProofs,
        selectedAmount,
        inputFees,
        requiredAmount,
      };
    }

    target = requiredAmount;
  }

  throw new Error('Unable to select proofs that cover amount plus input fees');
};
