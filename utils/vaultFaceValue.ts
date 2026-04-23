import { formatFiat } from './formatters';

const FACE_VALUE_SCALE = 100;

function roundToFaceValue(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value ?? 0) * FACE_VALUE_SCALE) / FACE_VALUE_SCALE;
}

export function usdToProtocolUnitAmount(faceValueUsd: number | null | undefined): number {
  return roundToFaceValue(faceValueUsd);
}

export function protocolUnitToUsd(protocolUnitAmount: number | null | undefined): number {
  return roundToFaceValue(protocolUnitAmount);
}

export function smallestUnitAmountToUsd(
  smallestUnitAmount: number | bigint | null | undefined,
): number {
  if (smallestUnitAmount === null || smallestUnitAmount === undefined) {
    return 0;
  }

  const numericAmount =
    typeof smallestUnitAmount === 'bigint' ? Number(smallestUnitAmount) : smallestUnitAmount;

  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  return roundToFaceValue(numericAmount / FACE_VALUE_SCALE);
}

export function formatVaultUsd(
  faceValueUsd: number | null | undefined,
  decimals = 2,
): string {
  return `$${formatFiat(roundToFaceValue(faceValueUsd), decimals)}`;
}

export function formatVaultUsdFromSmallestUnits(
  smallestUnitAmount: number | bigint | null | undefined,
  decimals = 2,
): string {
  return formatVaultUsd(smallestUnitAmountToUsd(smallestUnitAmount), decimals);
}
