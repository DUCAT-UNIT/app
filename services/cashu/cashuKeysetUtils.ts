import type { MintKeyset, MintKeys } from './cashuMintClient';
import { CashuProof, selectProofsForAmount } from './crypto';

export const CASHU_DUCAT_UNIT = 'unit';

export interface SelectedProofsWithFees {
  selectedProofs: CashuProof[];
  selectedAmount: number;
  inputFees: number;
  requiredAmount: number;
}

const sumProofAmounts = (proofs: CashuProof[]): number =>
  proofs.reduce((sum, proof) => sum + proof.amount, 0);

export const selectActiveUnitKeyset = (keyData: MintKeys): MintKeyset => {
  const keysets = keyData.keysets ?? [];
  const keyset = keysets.find(
    (ks) => ks.unit === CASHU_DUCAT_UNIT && ks.active !== false && ks.keys
  );

  if (!keyset?.keys) {
    throw new Error('No active unit keyset available from mint');
  }

  return keyset;
};

export const findKeysetById = (keyData: MintKeys, keysetId: string): MintKeyset | undefined =>
  keyData.keysets?.find((ks) => ks.id === keysetId);

export const calculateInputFees = (proofs: CashuProof[], keyData: MintKeys): number => {
  const keysets = keyData.keysets ?? [];
  if (keysets.length === 0 || proofs.length === 0) {
    return 0;
  }

  const feePpkById = new Map<string, number>();
  for (const keyset of keysets) {
    feePpkById.set(keyset.id, keyset.input_fee_ppk ?? 0);
  }

  const feePpk = proofs.reduce(
    (sum, proof) => sum + (feePpkById.get(proof.id) ?? 0),
    0
  );

  return Math.floor((feePpk + 999) / 1000);
};

export const selectProofsForAmountIncludingFees = (
  proofs: CashuProof[],
  amount: number,
  keyData: MintKeys
): SelectedProofsWithFees => {
  let target = amount;

  for (let attempt = 0; attempt < 10; attempt++) {
    const selectedProofs = selectProofsForAmount(proofs, target);
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
