/**
 * Liquidation Swap Service
 * Handles BTC→UNIT swap after a liquidation claim.
 * Requests a swap PSBT from the faucet, finalizes it, and broadcasts.
 */

import * as bitcoin from 'bitcoinjs-lib';
import type { BaseUtxo } from '@ducat-unit/client-sdk';
import { logger } from '../../utils/logger';
import { postJSON } from '../../utils/apiClient';
import { broadcastTransaction } from '../transactionBroadcastService';
import { API } from '../../utils/constants';
import { FAUCET_SWAP_URL, UNIT_TO_BTC_RATE } from './constants';
import type {
  SwapUtxo,
  SwapPsbtPayload,
  SwapPsbtResponse,
  SwapPsbtData,
} from './types';

// ============================================================
// UTXO Conversion
// ============================================================

/** Convert SDK BaseUtxo to swap API format */
export function toSwapUtxo(utxo: BaseUtxo): SwapUtxo {
  return {
    tx: utxo.txid,
    output: utxo.vout,
    value: utxo.value,
  };
}

// ============================================================
// Swap PSBT API
// ============================================================

/**
 * Request a swap PSBT from the faucet API.
 * The API returns an unsigned PSBT that the user must sign at `user_input_indices`.
 */
export async function fetchSwapPsbt(payload: SwapPsbtPayload): Promise<SwapPsbtData | null> {
  try {
    logger.debug('[SwapService] Requesting swap PSBT', {
      amt_to_transfer: payload.amt_to_transfer,
      unit_amt: payload.unit_amt,
      utxo_count: payload.utxos.length,
      payment_address: payload.payment_address,
      ordinals_address: payload.ordinals_address,
      btc_price: payload.btc_price,
      vault_id: payload.vault_id?.substring(0, 16),
      utxos: JSON.stringify(payload.utxos.slice(0, 3)),
    });

    const response = await postJSON<SwapPsbtResponse>(FAUCET_SWAP_URL, payload, {
      description: 'Fetch swap PSBT',
      timeout: 15000,
    });

    if (!response.success || !response.data) {
      logger.warn('[SwapService] Swap PSBT request failed', {
        error: response.error,
        rawResponse: JSON.stringify(response).substring(0, 300),
      });
      return null;
    }

    logger.debug('[SwapService] Swap PSBT received', {
      user_inputs: response.data.user_input_indices.length,
    });
    return response.data;
  } catch (err: unknown) {
    logger.warn('[SwapService] Failed to fetch swap PSBT', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ============================================================
// PSBT Finalization + Broadcast
// ============================================================

/**
 * Finalize a signed swap PSBT and extract the raw transaction hex.
 */
export function finalizeSwapPsbt(signedPsbtBase64: string): string {
  const psbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  return tx.toHex();
}

/**
 * Broadcast a finalized swap transaction to the Bitcoin network via Esplora.
 */
export async function broadcastSwapTx(txHex: string): Promise<string | null> {
  try {
    logger.debug('[SwapService] Broadcasting swap TX');
    const txid = await broadcastTransaction(txHex);
    if (txid) {
      logger.info('[SwapService] Swap TX broadcast', { txid: txid.substring(0, 8) });
      return txid;
    }
    return null;
  } catch (err: unknown) {
    logger.warn('[SwapService] Swap broadcast failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ============================================================
// Payload Builder
// ============================================================

interface CreateSwapPayloadParams {
  changeUtxo: BaseUtxo;
  extraUtxos: BaseUtxo[];
  swapBtcAmount: number;
  swapClaimedUnit: number;
  btcPrice: number;
  paymentAddress: string;
  ordinalsAddress: string;
  vaultTxId: string;
}

/**
 * Build the swap PSBT request payload.
 * Mirrors the web frontend's `createSwapPsbt` logic.
 */
export function createSwapPayload({
  changeUtxo,
  extraUtxos,
  swapBtcAmount,
  swapClaimedUnit,
  btcPrice,
  paymentAddress,
  ordinalsAddress,
  vaultTxId,
}: CreateSwapPayloadParams): SwapPsbtPayload {
  const swapUtxos = [toSwapUtxo(changeUtxo), ...extraUtxos.map(toSwapUtxo)];

  return {
    utxos: swapUtxos,
    amt_to_transfer: swapBtcAmount,
    unit_amt: Math.round(swapClaimedUnit * 100), // Convert to cents
    payment_address: paymentAddress,
    ordinals_address: ordinalsAddress,
    btc_price: btcPrice,
    vault_id: vaultTxId,
  };
}

/**
 * Calculate the BTC amount needed for a UNIT swap.
 * Uses the protocol's swap rate (1.02x).
 */
export function calculateSwapBtcAmount(claimedUnit: number, btcPrice: number): number {
  return parseFloat(((claimedUnit / btcPrice) * UNIT_TO_BTC_RATE).toFixed(8));
}

/**
 * Poll Esplora for a transaction to appear in mempool.
 * Returns true when found, false on timeout.
 */
export async function waitForMempool(
  txid: string,
  maxAttempts = 30,
  intervalMs = 5000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API.BASE}/tx/${txid}`);
      if (response.ok) {
        logger.debug('[SwapService] TX found in mempool', { txid: txid.substring(0, 8) });
        return true;
      }
    } catch {
      // Not found yet, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  logger.warn('[SwapService] TX not found in mempool after timeout', { txid: txid.substring(0, 8) });
  return false;
}
