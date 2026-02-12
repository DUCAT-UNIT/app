/**
 * Mobile Wallet API
 * Creates the WalletConnectAPI interface for VaultWallet
 */

import type {
  VaultWallet,
  WalletConnectAPI,
} from '@ducat-unit/client-sdk';
import { OracleAPI } from '@ducat-unit/client-sdk';
import { TX, PSBT, hash160, taptweak_pubkey } from '@ducat-unit/client-sdk/util';
import { API } from '../../utils/constants';
import { logger } from '../../utils/logger';
import {
  signPsbtRaw,
  signPsbtWithSdkObject,
  patchPreProcessFields,
  patchPostProcessFields,
  psbtPreProcess,
  psbtPostProcess,
} from '../signing';
import { extractOpReturnFromPsbt } from './psbtBinaryUtils';

/**
 * Creates a WalletConnectAPI for the mobile wallet
 */
export function createMobileWalletAPI(segwitAddress: string): WalletConnectAPI {
  return {
    fetch: {
      balance: (_client: VaultWallet) => async () => {
        const res = await OracleAPI.wallet.fetch_address_bal(API.ORD_URL, segwitAddress);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },

      sats_utxos: (client: VaultWallet) => async () => {
        const addr = client.acct.sats.address;
        const res = await OracleAPI.esplora.esplora_get_utxos(API.ESPLORA_URL, addr);
        if (!res.ok) throw new Error(res.error);

        // Parse address to get the locking script
        const script = TX.parse_address(addr).hex;
        return res.data.map((e: { txid: string; vout: number; value: number }) => ({
          txid: e.txid,
          vout: e.vout,
          value: e.value,
          script,
        }));
      },

      rune_utxos: (client: VaultWallet) => async () => {
        const addr = client.acct.runes.address;
        const res = await OracleAPI.wallet.fetch_rune_utxos(API.ORD_URL, addr);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },

      vault_tokens: (client: VaultWallet) => async () => {
        const address = client.acct.vault.address;
        const postage = client.config.postage.vault;
        const res = await OracleAPI.wallet.fetch_vault_tokens(
          API.ESPLORA_URL,
          API.ORD_URL,
          address,
          postage
        );
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
    },

    sign: {
      psbt: (client: VaultWallet) => async (psbt: string, manifest: Record<string, number[]>) => {
        logger.debug('[VaultWalletService] Signing PSBT with pre/post processing...');
        logger.debug('[VaultWalletService] Manifest:', JSON.stringify(manifest));

        // Pre-process the PSBT (same as frontend sign_psbt_api)
        const pre_pdata = PSBT.decode(psbt);
        logger.debug('[VaultWalletService] PSBT decoded, inputs:', pre_pdata.inputsLength);

        // Log input details
        for (let i = 0; i < pre_pdata.inputsLength; i++) {
          const txin = pre_pdata.getInput(i);
          const prevout = txin.witnessUtxo;
          if (prevout) {
            // SDK type mismatch: script is Uint8Array but SDK expects string | Bytes
            const scriptMeta = TX.parse_script_meta(prevout.script as Parameters<typeof TX.parse_script_meta>[0]);
            logger.debug(`[VaultWalletService] Input ${i}: type=${scriptMeta.type}, hasTapLeafScript=${!!txin.tapLeafScript}`);
          }
        }

        psbtPreProcess(client, pre_pdata, manifest);

        // Sign with the mobile wallet
        const prePsbt = PSBT.encode(pre_pdata);
        const intent = {
          recipient: client.acct.vault.address,
          change: client.acct.sats.address,
          minAmountSats: 0,
        };
        const signedPsbt = await signPsbtRaw(prePsbt, manifest, intent);

        // Post-process the signed PSBT (same as frontend sign_psbt_api)
        const post_pdata = PSBT.decode(signedPsbt);
        psbtPostProcess(client, post_pdata, manifest);

        logger.debug('[VaultWalletService] PSBT signed and post-processed');
        return PSBT.encode(post_pdata);
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
          const meta = TX.parse_script_meta(prevout.script as Parameters<typeof TX.parse_script_meta>[0]);
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
        psbtPreProcess(client, pdata, manifest);

        // Sign
        const prePsbt = PSBT.encode(pdata);
        const intent = {
          recipient: client.acct.vault.address,
          change: client.acct.sats.address,
          minAmountSats: 0,
        };
        const signedPsbt = await signPsbtRaw(prePsbt, manifest, intent);

        // Post-process
        const post_pdata = PSBT.decode(signedPsbt);
        psbtPostProcess(client, post_pdata, manifest);

        const finalPsbt = PSBT.encode(post_pdata);
        logger.debug('[VaultWalletService] UTXOs signed');
        return finalPsbt;
      },

      batch: (client: VaultWallet) => async (psbts: [string, Record<string, number[]>][]) => {
        logger.debug(`[VaultWalletService] Batch signing ${psbts.length} PSBTs...`);

        // Process each PSBT using binary patching to preserve OP_RETURN outputs
        // Both bitcoinjs-lib and @scure/btc-signer corrupt OP_RETURN during encode
        const signedPsbts: string[] = [];

        for (let psbtIndex = 0; psbtIndex < psbts.length; psbtIndex++) {
          const [originalPsbt, signInputs] = psbts[psbtIndex];
          logger.debug(`[VaultWalletService] Processing PSBT ${psbtIndex + 1}/${psbts.length}`);
          logger.debug(`[VaultWalletService] Manifest: ${JSON.stringify(signInputs)}`);

          // ===== DEBUG: Trace OP_RETURN through the signing process =====
          const originalOpReturn = extractOpReturnFromPsbt(originalPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} ORIGINAL OP_RETURN: ${originalOpReturn}`);

          // Step 1: Pre-process to add fields needed for signing (redeemScript, tapInternalKey)
          // We patch these into the original PSBT binary
          const preProcessedPsbt = patchPreProcessFields(originalPsbt, client, signInputs);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} pre-processed`);

          const preProcessedOpReturn = extractOpReturnFromPsbt(preProcessedPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} AFTER PRE-PROCESS OP_RETURN: ${preProcessedOpReturn}`);

          // Step 2: Sign using binary patching (preserves OP_RETURN outputs)
          const pre_pdata = PSBT.decode(preProcessedPsbt);
          const intent = {
            recipient: client.acct.vault.address,
            change: client.acct.sats.address,
            minAmountSats: 0,
          };
          const signedPsbt = await signPsbtWithSdkObject(pre_pdata, signInputs, preProcessedPsbt, intent);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} signed`);

          const signedOpReturn = extractOpReturnFromPsbt(signedPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} AFTER SIGNING OP_RETURN: ${signedOpReturn}`);

          // Step 3: Post-process (finalize witnesses) - only first 2 PSBTs
          let finalPsbt = signedPsbt;
          if (psbtIndex < 2) {
            finalPsbt = patchPostProcessFields(signedPsbt, client, signInputs);
            logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} post-processed`);

            const postProcessedOpReturn = extractOpReturnFromPsbt(finalPsbt);
            logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} AFTER POST-PROCESS OP_RETURN: ${postProcessedOpReturn}`);
          }

          // Final check
          const finalOpReturn = extractOpReturnFromPsbt(finalPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} FINAL OP_RETURN: ${finalOpReturn}`);
          // ===== END DEBUG =====

          signedPsbts.push(finalPsbt);
        }

        logger.debug('[VaultWalletService] Batch signing complete');
        return signedPsbts;
      },
    },
  };
}
