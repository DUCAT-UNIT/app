import type { LiquidVaultProfile } from '@ducat-unit/client-sdk';
import { fetchWithTimeout } from '../../utils/api';
import { getTxOutspendUrl } from '../../utils/constants';
import { logger } from '../../utils/logger';
import type { LiquidVaultProfileWithMeta } from './types';

const LIQ_OUTSPEND_TIMEOUT_MS = 4_000;
const COIN_ID_PATTERN = /^([0-9a-f]{64}):(\d+)$/i;

type TxOutspendResponse = {
  spent?: boolean;
  txid?: string;
  vin?: number;
};

type ParsedCoinId = {
  coinId: string;
  txid: string;
  vout: number;
};

function parseLiquidationCoinId(profile: LiquidVaultProfile): ParsedCoinId | null {
  const coinId = typeof profile.coin_id === 'string' ? profile.coin_id : '';
  const match = COIN_ID_PATTERN.exec(coinId);
  if (!match) {
    return null;
  }

  const vout = Number(match[2]);
  if (!Number.isSafeInteger(vout) || vout < 0) {
    return null;
  }

  return {
    coinId,
    txid: match[1],
    vout,
  };
}

export async function isLiquidVaultProfileUnspent(
  profile: LiquidVaultProfile
): Promise<boolean> {
  const parsed = parseLiquidationCoinId(profile);
  if (!parsed) {
    logger.warn('[Liquidation] Filtering vault with invalid liquidation coin id', {
      vaultId: profile.root_txid,
      coinId: profile.coin_id,
    });
    return false;
  }

  try {
    const response = await fetchWithTimeout(
      getTxOutspendUrl(parsed.txid, parsed.vout),
      { headers: { Accept: 'application/json' } },
      LIQ_OUTSPEND_TIMEOUT_MS
    );

    if (response.status === 404) {
      logger.warn('[Liquidation] Filtering vault whose liquidation coin is missing', {
        vaultId: profile.root_txid,
        coinId: parsed.coinId,
      });
      return false;
    }

    if (!response.ok) {
      logger.warn('[Liquidation] Could not verify liquidation coin spend status', {
        vaultId: profile.root_txid,
        coinId: parsed.coinId,
        status: response.status,
      });
      return true;
    }

    const outspend = await response.json() as TxOutspendResponse;
    if (outspend.spent === true) {
      logger.debug('[Liquidation] Filtering spent liquidation vault', {
        vaultId: profile.root_txid,
        coinId: parsed.coinId,
        spendingTxid: outspend.txid,
        spendingVin: outspend.vin,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('[Liquidation] Could not verify liquidation coin spend status', {
      vaultId: profile.root_txid,
      coinId: parsed.coinId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

export async function filterUnspentLiquidVaultProfiles(
  profiles: LiquidVaultProfileWithMeta[]
): Promise<LiquidVaultProfileWithMeta[]> {
  if (profiles.length === 0) {
    return profiles;
  }

  const checked = await Promise.all(
    profiles.map(async (profile) => ({
      profile,
      unspent: await isLiquidVaultProfileUnspent(profile),
    }))
  );
  const unspent = checked.filter((item) => item.unspent).map((item) => item.profile);
  const filteredCount = checked.length - unspent.length;

  if (filteredCount > 0) {
    logger.debug('[Liquidation] Filtered spent liquidation vaults', {
      filteredCount,
      remainingCount: unspent.length,
      totalCount: checked.length,
    });
  }

  return unspent;
}

export async function assertLiquidVaultProfilesUnspent(
  profiles: LiquidVaultProfile[]
): Promise<void> {
  for (const profile of profiles) {
    const isUnspent = await isLiquidVaultProfileUnspent(profile);
    if (!isUnspent) {
      const parsed = parseLiquidationCoinId(profile);
      throw new Error(
        `Liquidation opportunity is stale; vault coin ${parsed?.coinId ?? profile.coin_id ?? 'unknown'} is already spent.`
      );
    }
  }
}
