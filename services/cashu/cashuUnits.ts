export type CashuUnit = 'unit' | 'sat';

export const CASHU_UNIT_UNIT: CashuUnit = 'unit';
export const CASHU_UNIT_SAT: CashuUnit = 'sat';
export const DEFAULT_CASHU_UNIT: CashuUnit = CASHU_UNIT_UNIT;

export const CASHU_UNITS: readonly CashuUnit[] = [CASHU_UNIT_UNIT, CASHU_UNIT_SAT];

export const normalizeCashuUnit = (
  unit: string | undefined | null,
  fallback?: CashuUnit
): CashuUnit => {
  if (unit === CASHU_UNIT_UNIT || unit === CASHU_UNIT_SAT) {
    return unit;
  }
  if (!unit) {
    return fallback ?? DEFAULT_CASHU_UNIT;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Unsupported Cashu unit: ${unit}`);
};

export const isCashuUnit = (unit: string | undefined | null): unit is CashuUnit =>
  unit === CASHU_UNIT_UNIT || unit === CASHU_UNIT_SAT;

export const cashuUnitDisplayName = (unit: CashuUnit): string =>
  unit === CASHU_UNIT_SAT ? 'Turbo BTC' : 'Turbo UNIT';

export const cashuUnitTokenSymbol = (unit: CashuUnit): string =>
  unit === CASHU_UNIT_SAT ? 'BTC' : 'UNIT';

export const cashuUnitShortDisplayName = (unit: CashuUnit): string =>
  unit === CASHU_UNIT_SAT ? 'tBTC' : 'tUNIT';

export const cashuUnitAssetType = (unit: CashuUnit): 'BTC' | 'UNIT' =>
  unit === CASHU_UNIT_SAT ? 'BTC' : 'UNIT';
