/**
 * Liquidation Swap Service
 * Handles BTC→UNIT swap after a liquidation claim.
 * Requests a swap PSBT from the faucet, finalizes it, and broadcasts.
 */

import * as bitcoin from 'bitcoinjs-lib';
import type { BaseUtxo } from '@ducat-unit/client-sdk';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { getWithRetry, postJSON } from '../../utils/apiClient';
import { broadcastTransaction } from '../transactionBroadcastService';
import { API } from '../../utils/constants';
import { FAUCET_SWAP_URL, UNIT_TO_BTC_RATE } from './constants';
import { useSwapDiagnosticsStore } from '../../stores/swapDiagnosticsStore';
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
      utxo_count_logged: Math.min(payload.utxos.length, 3),
    });

    const response = await postJSON<SwapPsbtResponse>(FAUCET_SWAP_URL, payload, {
      description: 'Fetch swap PSBT',
      timeout: 15000,
    });

    if (!response.success || !response.data) {
      logger.warn('[SwapService] Swap PSBT request failed', {
        error: response.error,
        success: response.success,
        hasData: Boolean(response.data),
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
 * Optionally validates that at least one output pays to the expected address.
 */
export function finalizeSwapPsbt(
  signedPsbtBase64: string,
  expectedPaymentAddress?: string
): string {
  const psbt = bitcoin.Psbt.fromBase64(signedPsbtBase64, { network: MUTINYNET_NETWORK });

  // Basic validation: ensure all inputs are properly signed
  psbt.finalizeAllInputs();

  const tx = psbt.extractTransaction();

  // If expected payment address provided, verify at least one output pays to it
  if (expectedPaymentAddress) {
    const hasExpectedOutput = tx.outs.some(out => {
      try {
        const addr = bitcoin.address.fromOutputScript(out.script, MUTINYNET_NETWORK);
        return addr === expectedPaymentAddress;
      } catch {
        return false;
      }
    });
    if (!hasExpectedOutput) {
      throw new Error('Swap PSBT does not pay to expected address');
    }
  }

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
  const pollId = useSwapDiagnosticsStore.getState().startPoll({
    id: `liquidation-mempool:${txid}`,
    kind: 'liquidation_mempool',
    label: 'Liquidation repo mempool wait',
    subject: txid,
    intervalMs,
    timeoutMs: maxAttempts * intervalMs,
  });

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await getWithRetry(`${API.BASE}/tx/${txid}`, {
        timeout: 8000,
        retryOptions: { maxRetries: 0 },
        dedupeKey: `liquidation-mempool:${txid}`,
        circuitKey: 'liquidation-mempool',
      });
      const httpStatus = typeof response.status === 'number' ? response.status : null;
      useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
        lastStatus: response.ok ? 'found' : httpStatus ? `http_${httpStatus}` : 'not_found',
        metadata: {
          httpStatus,
          attempt: i + 1,
          maxAttempts,
        },
      });
      if (response.ok) {
        logger.debug('[SwapService] TX found in mempool', { txid: txid.substring(0, 8) });
        useSwapDiagnosticsStore.getState().completePoll(pollId, {
          status: 'success',
          lastStatus: 'found',
          lastMessage: 'Repo transaction found in mempool',
        });
        return true;
      }
    } catch (error: unknown) {
      useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
        lastStatus: 'network_error',
        lastError: error instanceof Error ? error.message : String(error),
        metadata: {
          attempt: i + 1,
          maxAttempts,
        },
      });
      // Not found yet, keep polling
    }
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      (timer as { unref?: () => void }).unref?.();
    });
  }
  useSwapDiagnosticsStore.getState().completePoll(pollId, {
    status: 'timeout',
    lastMessage: 'Repo transaction was not found in mempool',
  });
  logger.warn('[SwapService] TX not found in mempool after timeout', { txid: txid.substring(0, 8) });
  return false;
}
