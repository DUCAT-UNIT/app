import type {
  CoinUtxo,
  PriceContract,
  PriceQuote,
  RuneUtxo,
  VaultActionConfig,
  VaultActionQuote,
} from '@ducat-unit/client-sdk';
import {
  create_vault_action_quote,
  get_adjusted_quote_price,
  get_price_bucket_rate,
  get_price_commit_hashes,
  get_unit_asset_id,
} from '@ducat-unit/client-sdk/lib';
import { calc_collateral_ratio } from '@ducat-unit/core/lib';
import { logger } from '../../utils/logger';
import {
  fetchPriceContractsByBucketTag,
  fetchPriceContractsByCommitHashes,
} from '../oracleService';
import { withVaultBuildTimeout } from './operationTimeout';
import type { Utxo } from './utils';

const PRICE_CONTRACT_FETCH_TIMEOUT_MS = 15_000;

type PriceQuoteWithContracts = PriceQuote & {
  contracts?: PriceContract[];
  price_contracts?: PriceContract[];
};

type UnitAssetInput = {
  asset_id: string;
  asset_balance: number;
  asset_reserve: number;
  coin_id: string;
  coin_script?: string;
  coin_value: number;
};

export type CompatVaultActionCtx = {
  __base_config?: (overrides?: Record<string, unknown>) => VaultActionConfig;
};

export interface ResolveVaultActionPriceQuoteOptions<TQuote extends PriceQuote> {
  actionName: string;
  vaultCtx: CompatVaultActionCtx;
  oracleQuote: TQuote;
  fundUtxos?: Utxo[];
  unitUtxos?: RuneUtxo[];
}

function hasPriceContracts(oracleQuote: PriceQuote): boolean {
  const quote = oracleQuote as PriceQuoteWithContracts;
  return Boolean(
    (Array.isArray(quote.contracts) && quote.contracts.length > 0) ||
      (Array.isArray(quote.price_contracts) && quote.price_contracts.length > 0)
  );
}

function withPriceContracts<TQuote extends PriceQuote>(
  oracleQuote: TQuote,
  priceContracts: PriceContract[]
): TQuote {
  return {
    ...oracleQuote,
    contracts: priceContracts,
    price_contracts: priceContracts,
  } as TQuote;
}

function toCoinUtxos(utxos: Utxo[]): CoinUtxo[] {
  return utxos.map((utxo) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value,
    script: utxo.script,
    script_pk: utxo.script,
  }));
}

function getRuneAmount(utxo: RuneUtxo, assetId: string): number {
  if (utxo.runes instanceof Map) {
    return utxo.runes.get(assetId)?.amount ?? [...utxo.runes.values()][0]?.amount ?? 0;
  }

  const legacyAmount = (utxo as RuneUtxo & { amount?: unknown }).amount;
  return typeof legacyAmount === 'number' ? legacyAmount : 0;
}

function toUnitAssetInputs(unitUtxos: RuneUtxo[] | undefined, config: VaultActionConfig) {
  if (!unitUtxos || unitUtxos.length === 0) {
    return undefined;
  }

  const assetId = get_unit_asset_id(config.proto_profile);
  return unitUtxos.map(
    (utxo): UnitAssetInput => ({
      asset_id: assetId,
      asset_balance: getRuneAmount(utxo, assetId),
      asset_reserve: 0,
      coin_id: `${utxo.txid}:${utxo.vout}`,
      coin_script: utxo.script ?? utxo.script_pk,
      coin_value: utxo.value,
    })
  );
}

function getVaultActionQuote(
  vaultCtx: CompatVaultActionCtx,
  fundUtxos?: Utxo[],
  unitUtxos?: RuneUtxo[]
): { actionConfig: VaultActionConfig; actionQuote: VaultActionQuote } | null {
  if (typeof vaultCtx.__base_config !== 'function') {
    return null;
  }

  const overrides: Record<string, unknown> = {};
  if (fundUtxos) {
    overrides.fund_inputs = toCoinUtxos(fundUtxos);
  }

  let actionConfig = vaultCtx.__base_config(overrides);
  const assetInputs = toUnitAssetInputs(unitUtxos, actionConfig);
  if (assetInputs) {
    actionConfig = vaultCtx.__base_config({
      ...overrides,
      asset_inputs: assetInputs,
    });
  }

  return {
    actionConfig,
    actionQuote: create_vault_action_quote(actionConfig),
  };
}

function getBucketRate(
  actionConfig: VaultActionConfig,
  actionQuote: VaultActionQuote,
  oracleQuote: PriceQuote
): number {
  const unitPrice = get_adjusted_quote_price(actionConfig.proto_profile, oracleQuote);
  const collateralRatio = calc_collateral_ratio(
    actionQuote.vault_balance,
    actionQuote.unit_balance,
    unitPrice
  );
  return get_price_bucket_rate(oracleQuote, collateralRatio);
}

export async function resolveVaultActionPriceQuote<TQuote extends PriceQuote>({
  actionName,
  vaultCtx,
  oracleQuote,
  fundUtxos,
  unitUtxos,
}: ResolveVaultActionPriceQuoteOptions<TQuote>): Promise<TQuote> {
  if (hasPriceContracts(oracleQuote)) {
    return oracleQuote;
  }

  const action = getVaultActionQuote(vaultCtx, fundUtxos, unitUtxos);
  if (!action || action.actionQuote.unit_balance <= 0) {
    return oracleQuote;
  }

  const { actionConfig, actionQuote } = action;
  const commitHashes = get_price_commit_hashes(actionConfig.proto_profile, actionQuote, [
    oracleQuote,
  ]);
  if (commitHashes.length === 0) {
    return oracleQuote;
  }

  const oraclePubkey = oracleQuote.oracle_pubkey;
  const startedAt = Date.now();
  let priceContracts = await withVaultBuildTimeout(
    fetchPriceContractsByCommitHashes(commitHashes, { timeout: 8_000 }, oraclePubkey),
    'Timed out fetching oracle price contracts. Please try again.',
    PRICE_CONTRACT_FETCH_TIMEOUT_MS
  );

  if (priceContracts.length === 0) {
    const bucketRate = getBucketRate(actionConfig, actionQuote, oracleQuote);
    logger.warn('[VaultOps] No price contracts by commit hash; trying oracle bucket tag', {
      actionName,
      commitHashes,
      baseStamp: oracleQuote.base_stamp,
      bucketRate,
    });
    priceContracts = await withVaultBuildTimeout(
      fetchPriceContractsByBucketTag(
        oracleQuote.base_stamp,
        bucketRate,
        { timeout: 8_000 },
        oraclePubkey
      ),
      'Timed out fetching oracle price contracts. Please try again.',
      PRICE_CONTRACT_FETCH_TIMEOUT_MS
    );
  }

  if (priceContracts.length === 0) {
    throw new Error(
      'Oracle price contracts are temporarily unavailable. Please try again in a minute.'
    );
  }

  logger.info('[VaultOps] Oracle price contracts ready', {
    actionName,
    durationMs: Date.now() - startedAt,
    contractCount: priceContracts.length,
    commitHashCount: commitHashes.length,
  });

  return withPriceContracts(oracleQuote, priceContracts);
}
