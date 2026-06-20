/**
 * Mobile Wallet API
 * Creates the WalletConnectAPI interface for VaultWallet
 */

import type { RuneUtxo, VaultWallet, WalletConnectAPI } from '@ducat-unit/client-sdk';
import { OracleAPI } from '@ducat-unit/client-sdk';
import { TX, PSBT, hash160, taptweak_pubkey } from '@ducat-unit/client-sdk/util';
import { API, getAddressUtxoUrl, getOrdAddressUrl, getOrdOutputUrl } from '../../utils/constants';
import { getJsonWithNativeTimeout } from '../../utils/nativeHttp';
import { logger } from '../../utils/logger';
import { withVaultBuildTimeout } from '../vault/operationTimeout';
import {
  signPsbtWithSdkObject,
  patchPreProcessFields,
  patchPostProcessFields,
} from '../signing';
import { getExpectedVaultPsbtTemplates } from './signingContext';

const RUNE_ADDRESS_FETCH_TIMEOUT_MS = 8_000;
const RUNE_OUTPUT_FETCH_TIMEOUT_MS = 8_000;
const RUNE_OUTPUT_BATCH_SIZE = 4;
const SATS_UTXO_FETCH_TIMEOUT_MS = 8_000;

type LegacyResolve<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

interface OrdAddressResponse {
  outputs?: string[];
}

interface OrdRuneRecord {
  amount: number | string;
  divisibility: number;
  symbol: string;
}

interface OrdOutputResponse {
  inscriptions?: string[];
  runes?: Record<string, OrdRuneRecord> | null;
  script_pubkey?: string;
  spent?: boolean;
  transaction?: string;
  value?: number;
}

interface EsploraUtxoResponse {
  txid: string;
  vout: number;
  value: number;
}

function parseOutpoint(output: string): { txid: string; vout: number } {
  const [txid, voutRaw] = output.split(':');
  const vout = Number(voutRaw);
  if (!txid || !Number.isInteger(vout)) {
    throw new Error(`Invalid ord outpoint: ${output}`);
  }
  return { txid, vout };
}

function getHttpStatusFromError(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = /^HTTP\s+(\d+)/.exec(error.message);
  return match ? Number(match[1]) : null;
}

async function fetchRuneOutput(output: string): Promise<RuneUtxo | null> {
  const { txid, vout } = parseOutpoint(output);
  let data: OrdOutputResponse;
  try {
    data = await getJsonWithNativeTimeout<OrdOutputResponse>(getOrdOutputUrl(output), {
      timeout: RUNE_OUTPUT_FETCH_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    logger.debug('[VaultWalletService] Skipping UNIT output with failed ord response', {
      outpoint: output,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (data.spent || data.runes === null || data.runes === undefined) {
    return null;
  }

  const script = data.script_pubkey;
  const value = data.value;
  if (!script || typeof value !== 'number') {
    logger.debug('[VaultWalletService] Skipping UNIT output with incomplete ord data', {
      outpoint: output,
      hasScript: !!script,
      hasValue: typeof value === 'number',
    });
    return null;
  }

  const runes = new Map(
    Object.entries(data.runes).map(([rune, record]) => [
      rune,
      {
        amount: Number(record.amount),
        divisibility: record.divisibility,
        symbol: record.symbol,
      },
    ])
  );

  return {
    records: data.inscriptions ?? [],
    runes,
    script,
    script_pk: script,
    txid: data.transaction ?? txid,
    value,
    vout,
  };
}

async function fetchRuneUtxoMap(address: string): Promise<Map<string, RuneUtxo>> {
  const startedAt = Date.now();
  let addressData: OrdAddressResponse;
  try {
    addressData = await getJsonWithNativeTimeout<OrdAddressResponse>(getOrdAddressUrl(address), {
      timeout: RUNE_ADDRESS_FETCH_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timed out fetching UNIT UTXOs. Please try again.');
    }

    const status = getHttpStatusFromError(error);
    if (status !== null) {
      throw new Error(`Failed to fetch UNIT UTXOs (${status})`);
    }

    throw error;
  }

  const outputs = addressData.outputs ?? [];
  const utxos = new Map<string, RuneUtxo>();

  for (let startIndex = 0; startIndex < outputs.length; startIndex += RUNE_OUTPUT_BATCH_SIZE) {
    const batch = outputs.slice(startIndex, startIndex + RUNE_OUTPUT_BATCH_SIZE);
    const results = await Promise.all(batch.map(fetchRuneOutput));

    for (let idx = 0; idx < results.length; idx++) {
      const utxo = results[idx];
      if (utxo === null) continue;
      const outpoint = batch[idx];
      if (outpoint === undefined) continue;
      utxos.set(outpoint, utxo);
    }
  }

  logger.info('[VaultWalletService] UNIT UTXO map fetched', {
    durationMs: Date.now() - startedAt,
    outputCount: outputs.length,
    runeUtxoCount: utxos.size,
  });

  return utxos;
}

async function fetchSatsUtxos(
  address: string
): Promise<Array<{ txid: string; vout: number; value: number; script: string; script_pk: string }>> {
  const startedAt = Date.now();
  const data = await getJsonWithNativeTimeout<EsploraUtxoResponse[]>(getAddressUtxoUrl(address), {
    timeout: SATS_UTXO_FETCH_TIMEOUT_MS,
    headers: { Accept: 'application/json' },
  });

  if (!Array.isArray(data)) {
    throw new Error('Invalid BTC UTXO response');
  }

  const script = TX.parse_address(address).hex;
  const utxos = data.map((utxo) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value,
    script,
    script_pk: script,
  }));

  logger.info('[VaultWalletService] BTC UTXOs fetched', {
    durationMs: Date.now() - startedAt,
    count: utxos.length,
  });

  return utxos;
}

/**
 * Creates a WalletConnectAPI for the mobile wallet
 */
export function createMobileWalletAPI(segwitAddress: string): WalletConnectAPI {
  return {
    fetch: {
      balance: (_client: VaultWallet) => async () => {
        const res = await withVaultBuildTimeout(
          OracleAPI.wallet.fetch_address_bal(API.ORD_URL, segwitAddress),
          'Timed out fetching vault wallet balance. Please try again.'
        ) as LegacyResolve<unknown>;
        if (!res.ok) throw new Error(res.error ?? 'Failed to fetch vault wallet balance');
        return res.data;
      },

      sats_utxos: (client: VaultWallet) => async () => {
        const addr = client.acct.sats.address;
        return withVaultBuildTimeout(
          fetchSatsUtxos(addr),
          'Timed out fetching BTC UTXOs. Please try again.'
        );
      },

      rune_utxos: (client: VaultWallet) => async (cache?: Map<string, RuneUtxo>) => {
        const addr = client.acct.runes.address;
        const utxos = await withVaultBuildTimeout(
          fetchRuneUtxoMap(addr),
          'Timed out fetching UNIT UTXOs. Please try again.'
        );
        if (cache) {
          for (const [outpoint, utxo] of utxos.entries()) {
            cache.set(outpoint, utxo);
          }
          return cache;
        }
        return utxos;
      },

      vault_tokens: (client: VaultWallet) => async () => {
        const address = client.acct.vault.address;
        const postage = client.config.postage.vault;
        const res = await withVaultBuildTimeout(
          OracleAPI.wallet.fetch_vault_tokens(API.ESPLORA_URL, API.ORD_URL, address, postage),
          'Timed out fetching vault tokens. Please try again.'
        ) as LegacyResolve<Map<string, unknown>>;
        if (!res.ok) throw new Error(res.error ?? 'Failed to fetch vault tokens');
        return res.data;
      },
    },

    sign: {
      psbt: (client: VaultWallet) => async (psbt: string, manifest: Record<string, number[]>) => {
        const startedAt = Date.now();
        logger.info('[VaultWalletService] Signing PSBT', {
          manifestAddresses: Object.keys(manifest).length,
          inputCount: Object.values(manifest).reduce((sum, inputs) => sum + inputs.length, 0),
        });
        logger.debug('[VaultWalletService] Signing PSBT with pre/post processing...');
        logger.debug('[VaultWalletService] Manifest:', JSON.stringify(manifest));

        // Pre-process the PSBT (same as frontend sign_psbt_api)
        const decodeStartedAt = Date.now();
        const pre_pdata = PSBT.decode(psbt);
        logger.info('[VaultWalletService] PSBT decoded for signing', {
          durationMs: Date.now() - decodeStartedAt,
          inputs: pre_pdata.inputsLength,
        });
        logger.debug('[VaultWalletService] PSBT decoded, inputs:', pre_pdata.inputsLength);

        // Log input details
        for (let i = 0; i < pre_pdata.inputsLength; i++) {
          const txin = pre_pdata.getInput(i);
          const prevout = txin.witnessUtxo;
          if (prevout) {
            // SDK type mismatch: script is Uint8Array but SDK expects string | Bytes
            const scriptMeta = TX.parse_script_meta(
              prevout.script as Parameters<typeof TX.parse_script_meta>[0]
            );
            logger.debug(
              `[VaultWalletService] Input ${i}: type=${scriptMeta.type}, hasTapLeafScript=${!!txin.tapLeafScript}`
            );
          }
        }

        const preprocessStartedAt = Date.now();
        const preProcessedPsbt = patchPreProcessFields(psbt, client, manifest);
        logger.info('[VaultWalletService] PSBT preprocessed for signing', {
          durationMs: Date.now() - preprocessStartedAt,
        });

        const expectedPsbtTemplates = getExpectedVaultPsbtTemplates();
        const intent = {
          recipient: client.acct.vault.address,
          change: client.acct.sats.address,
          minAmountSats: 0,
          allowOpReturn: true,
          expectedPsbtTemplates,
        };
        const rawSignStartedAt = Date.now();
        const signedPsbt = await signPsbtWithSdkObject(
          PSBT.decode(preProcessedPsbt),
          manifest,
          preProcessedPsbt,
          intent
        );
        logger.info('[VaultWalletService] PSBT raw signing complete', {
          durationMs: Date.now() - rawSignStartedAt,
        });

        // Post-process the signed PSBT (same as frontend sign_psbt_api)
        const postprocessStartedAt = Date.now();
        const finalPsbt = patchPostProcessFields(signedPsbt, client, manifest);
        logger.info('[VaultWalletService] PSBT postprocessed after signing', {
          durationMs: Date.now() - postprocessStartedAt,
        });

        logger.info('[VaultWalletService] PSBT signed and post-processed', {
          durationMs: Date.now() - startedAt,
        });
        return finalPsbt;
      },

      utxos: (client: VaultWallet) => async (psbt: string) => {
        const satsAddr = client.acct.sats.address;
        const runesAddr = client.acct.runes.address;
        const sats_pkh = hash160(client.acct.sats.pubkey);
        const runes_tpk = taptweak_pubkey(client.acct.runes.pubkey);

        // Build manifest by analyzing the PSBT
        const pdata = PSBT.decode(psbt);
        const manifest: Record<string, number[]> = {
          [satsAddr]: [],
          [runesAddr]: [],
        };

        for (let i = 0; i < pdata.inputsLength; i++) {
          const txinput = pdata.getInput(i);
          const prevout = txinput.witnessUtxo;

          if (prevout === undefined) continue;

          // SDK type mismatch: script is Uint8Array but SDK expects string | Bytes
          const meta = TX.parse_script_meta(
            prevout.script as Parameters<typeof TX.parse_script_meta>[0]
          );
          if (meta.key === undefined) continue;

          if (meta.type === 'p2w-pkh' && meta.key.hex === sats_pkh) {
            manifest[satsAddr].push(i);
          }

          if (meta.type === 'p2tr' && meta.key.hex === runes_tpk) {
            manifest[runesAddr].push(i);
          }
        }

        logger.debug('[VaultWalletService] Signing UTXOs...');

        // Pre-process
        const preProcessedPsbt = patchPreProcessFields(psbt, client, manifest);

        const expectedPsbtTemplates = getExpectedVaultPsbtTemplates();
        // Sign
        const intent = {
          recipient: client.acct.vault.address,
          change: client.acct.sats.address,
          minAmountSats: 0,
          allowOpReturn: true,
          expectedPsbtTemplates,
        };
        const signedPsbt = await signPsbtWithSdkObject(
          PSBT.decode(preProcessedPsbt),
          manifest,
          preProcessedPsbt,
          intent
        );

        // Post-process
        const finalPsbt = patchPostProcessFields(signedPsbt, client, manifest);
        logger.debug('[VaultWalletService] UTXOs signed');
        return finalPsbt;
      },

      batch: (client: VaultWallet) => async (psbts: [string, Record<string, number[]>][]) => {
        const startedAt = Date.now();
        logger.info('[VaultWalletService] Batch signing PSBTs', {
          count: psbts.length,
        });
        logger.debug(`[VaultWalletService] Batch signing ${psbts.length} PSBTs...`);

        // Process each PSBT using binary patching to preserve OP_RETURN outputs
        // Both bitcoinjs-lib and @scure/btc-signer corrupt OP_RETURN during encode
        const signedPsbts: string[] = [];

        for (let psbtIndex = 0; psbtIndex < psbts.length; psbtIndex++) {
          const [originalPsbt, signInputs] = psbts[psbtIndex];
          const psbtStartedAt = Date.now();
          logger.info('[VaultWalletService] Batch signing PSBT item', {
            index: psbtIndex + 1,
            total: psbts.length,
          });
          logger.debug(`[VaultWalletService] Processing PSBT ${psbtIndex + 1}/${psbts.length}`);
          logger.debug(`[VaultWalletService] Manifest: ${JSON.stringify(signInputs)}`);

          // Step 1: Pre-process to add fields needed for signing (redeemScript, tapInternalKey)
          const preProcessedPsbt = patchPreProcessFields(originalPsbt, client, signInputs);

          // Step 2: Sign using binary patching (preserves OP_RETURN outputs)
          const pre_pdata = PSBT.decode(preProcessedPsbt);
          const expectedPsbtTemplates = getExpectedVaultPsbtTemplates();
          const intent = {
            recipient: client.acct.vault.address,
            change: client.acct.sats.address,
            minAmountSats: 0,
            allowOpReturn: true,
            expectedPsbtTemplates,
          };
          const signedPsbt = await signPsbtWithSdkObject(
            pre_pdata,
            signInputs,
            preProcessedPsbt,
            intent
          );

          // Step 3: Post-process (finalize witnesses) - only first 2 PSBTs
          let finalPsbt = signedPsbt;
          if (psbtIndex < 2) {
            finalPsbt = patchPostProcessFields(signedPsbt, client, signInputs);
          }

          signedPsbts.push(finalPsbt);
          logger.info('[VaultWalletService] Batch PSBT item signed', {
            index: psbtIndex + 1,
            total: psbts.length,
            durationMs: Date.now() - psbtStartedAt,
          });
        }

        logger.info('[VaultWalletService] Batch signing complete', {
          durationMs: Date.now() - startedAt,
        });
        return signedPsbts;
      },
    },
  };
}
