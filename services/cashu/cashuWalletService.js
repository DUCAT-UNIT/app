import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import {
  createMintQuote,
  checkMintQuote,
  mintTokens as mintTokensAPI,
  swapTokens as swapTokensAPI,
  createMeltQuote,
  meltTokens as meltTokensAPI,
  getKeys,
  MINT_URL,
} from './cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
  encodeToken,
  decodeToken,
} from './cashuCrypto';

/**
 * Cashu Wallet Service
 * High-level wallet operations for Cashu e-cash
 */

const STORAGE_KEY = 'cashu_proofs';
const KEYSETS_KEY = 'cashu_keysets';

/**
 * Load proofs from secure storage
 * @returns {Promise<Array>} Array of Cashu proofs
 */
export const loadProofs = async () => {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!stored) {
      logger.info('Loaded proofs from storage', { count: 0, source: 'empty' });
      return [];
    }

    const proofs = JSON.parse(stored);

    // Log stack trace to see who's calling this
    const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown';

    logger.info('Loaded proofs from storage', {
      count: proofs.length,
      caller: caller.substring(0, 100), // Truncate to avoid huge logs
    });

    return proofs;
  } catch (error) {
    logger.error('Failed to load proofs', { error: error.message });
    return [];
  }
};

/**
 * Save proofs to secure storage
 * @param {Array} proofs - Cashu proofs to save
 */
export const saveProofs = async (proofs) => {
  try {
    const serialized = JSON.stringify(proofs);

    // Delete first to force cache invalidation
    await SecureStore.deleteItemAsync(STORAGE_KEY);

    // Small delay to ensure delete completes
    await new Promise(resolve => setTimeout(resolve, 50));

    // Now write the new value
    await SecureStore.setItemAsync(STORAGE_KEY, serialized);

    // Verify the write succeeded
    const verification = await SecureStore.getItemAsync(STORAGE_KEY);
    const verified = JSON.parse(verification || '[]');

    if (verified.length !== proofs.length) {
      logger.error('SecureStore write verification failed!', {
        expected: proofs.length,
        actual: verified.length,
      });
      throw new Error('Failed to save proofs - verification failed');
    }

    logger.info('Saved proofs to storage', { count: proofs.length });
  } catch (error) {
    logger.error('Failed to save proofs', { error: error.message });
    throw error;
  }
};

/**
 * Add new proofs to wallet
 * @param {Array} newProofs - New proofs to add
 */
export const addProofs = async (newProofs) => {
  const existing = await loadProofs();
  const combined = [...existing, ...newProofs];
  await saveProofs(combined);
  logger.info('Added proofs', { added: newProofs.length, total: combined.length });
};

/**
 * Remove proofs from wallet (after spending)
 * @param {Array} proofsToRemove - Proofs to remove
 */
export const removeProofs = async (proofsToRemove) => {
  const existing = await loadProofs();
  const secretsToRemove = new Set(proofsToRemove.map((p) => p.secret));

  const remaining = existing.filter((p) => !secretsToRemove.has(p.secret));
  await saveProofs(remaining);

  logger.info('Removed proofs', {
    removed: proofsToRemove.length,
    remaining: remaining.length,
  });
};

/**
 * Get current balance
 * @returns {Promise<number>} Total balance in sats
 */
export const getBalance = async () => {
  const proofs = await loadProofs();
  return sumProofs(proofs);
};

/**
 * Get cached keyset or fetch from mint
 * @returns {Promise<Object>} Mint public keys
 */
const getOrFetchKeys = async () => {
  try {
    // Try to load from cache
    const cached = await SecureStore.getItemAsync(KEYSETS_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Check if it's the new format
        if (parsed.keysetData && parsed.timestamp) {
          // Cache for 1 hour
          if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
            return parsed.keysetData;
          }
        }
        // Old format or expired - will refetch below
      } catch (parseError) {
        logger.warn('Failed to parse cached keys, will refetch', { error: parseError.message });
      }
    }

    // Fetch fresh keys
    const keysetData = await getKeys();

    // Cache for next time
    await SecureStore.setItemAsync(
      KEYSETS_KEY,
      JSON.stringify({ keysetData, timestamp: Date.now() })
    );

    return keysetData;
  } catch (error) {
    logger.error('Failed to get keys', { error: error.message });
    throw error;
  }
};

/**
 * Request mint (deposit Runes to get Cashu tokens)
 * Step 1: Create quote and get deposit address
 *
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Quote with deposit address
 */
export const requestMint = async (amount) => {
  try {
    logger.info('Requesting mint', { amount });

    const quote = await createMintQuote(amount);

    return {
      quoteId: quote.quote,
      amount: quote.amount,
      depositAddress: quote.request, // Taproot address
      expiry: quote.expiry,
      state: quote.state,
    };
  } catch (error) {
    logger.error('Failed to request mint', { error: error.message });
    throw error;
  }
};

/**
 * Check if deposit has been paid
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Quote status
 */
export const checkMintStatus = async (quoteId) => {
  try {
    const quote = await checkMintQuote(quoteId);
    logger.info('Mint quote status checked', {
      quoteId: quote.quote,
      state: quote.state,
      fullQuote: quote
    });
    return {
      quoteId: quote.quote,
      state: quote.state,
      paid: quote.state === 'PAID' || quote.state === 'ISSUED',
    };
  } catch (error) {
    logger.error('Failed to check mint status', { error: error.message });
    throw error;
  }
};

/**
 * Mint tokens after deposit is confirmed
 * Step 2: Create blinded outputs and get signatures from mint
 *
 * @param {string} quoteId - Quote ID
 * @param {number} amount - Amount to mint
 * @returns {Promise<Array>} New Cashu proofs
 */
export const completeMint = async (quoteId, amount) => {
  try {
    logger.info('Completing mint', { quoteId, amount });

    // Get keys first to determine keyset ID
    const keyData = await getOrFetchKeys();
    logger.info('Fetched key data', {
      hasKeysets: !!keyData.keysets,
      keysetsCount: keyData.keysets?.length,
      firstKeysetId: keyData.keysets?.[0]?.id
    });

    // Extract keyset ID and keys from the response
    // Response format: { keysets: [{id, unit, keys}] }
    let keysetId;
    let keys;

    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      // Fallback for old format (should not happen after cache fix)
      keys = keyData.keys || keyData;
    }

    // Validate that we have a keyset ID
    if (!keysetId) {
      throw new Error('No keysets available from mint. Please clear Cashu cache in Settings and try again.');
    }

    logger.info('Using keyset ID', { keysetId });

    // Split into denominations
    logger.info('Amount received for splitting', { amount, type: typeof amount });
    const amounts = splitAmount(amount);
    logger.info('Split amounts', { amounts, total: amounts.reduce((a, b) => a + b, 0) });

    // Create blinded outputs with keyset ID
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);

    // Get blind signatures from mint
    const response = await mintTokensAPI(quoteId, outputs);

    // Unblind to create proofs
    const proofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    // Save to wallet
    await addProofs(proofs);

    logger.info('Mint completed', { proofCount: proofs.length });
    return proofs;
  } catch (error) {
    logger.error('Failed to complete mint', { error: error.message });
    throw error;
  }
};

/**
 * Receive Cashu token (from QR code or paste)
 * Validates proofs haven't been spent and swaps them to prevent double-spending
 * @param {string} tokenString - Encoded Cashu token
 * @returns {Promise<Object>} Received amount and proofs
 */
export const receiveToken = async (tokenString) => {
  try {
    logger.info('Receiving token');

    // Decode token
    const { mint, proofs, amount } = decodeToken(tokenString);

    // Verify mint matches
    if (mint !== MINT_URL) {
      throw new Error(`Token from different mint: ${mint}`);
    }

    // Check if we already have any of these proofs (prevent duplicate receives)
    const existingProofs = await loadProofs();
    const existingSecrets = new Set(existingProofs.map(p => p.secret));
    const hasDuplicate = proofs.some(p => existingSecrets.has(p.secret));

    if (hasDuplicate) {
      throw new Error('Token already received');
    }

    // Check if proofs have already been spent (NUT-07)
    logger.info('Checking if proofs have been spent');
    const { checkProofsSpent } = await import('./cashuMintClient.js');
    const stateResult = await checkProofsSpent(proofs);

    // Verify all proofs are unspent
    const spentProofs = stateResult.states.filter(s => s.state !== 'UNSPENT');
    if (spentProofs.length > 0) {
      throw new Error(`Token contains ${spentProofs.length} already-spent proof(s)`);
    }

    // Immediately swap received proofs to prevent sender from double-spending
    // This also provides additional validation and creates new proofs under our control
    logger.info('Swapping received proofs to prevent double-spend');

    const keyData = await getOrFetchKeys();
    let keys, keysetId;
    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      keys = keyData.keys || keyData;
    }

    // Create new blinded outputs for the same amounts
    const amounts = splitAmount(amount);
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);

    // Swap: give received proofs, get new proofs
    const response = await swapTokensAPI(proofs, outputs);

    // Unblind to create our new proofs
    const newProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    // Add swapped proofs to wallet
    await addProofs(newProofs);

    logger.info('Token received and swapped', { amount, proofCount: newProofs.length });

    return {
      amount,
      proofCount: newProofs.length,
    };
  } catch (error) {
    logger.error('Failed to receive token', { error: error.message });
    throw error;
  }
};

/**
 * Send Cashu token
 * Creates a token that can be shared via QR code or text
 *
 * @param {number} amount - Amount to send
 * @param {boolean} returnChange - Whether to create change proofs
 * @returns {Promise<Object>} Encoded token and remaining balance
 */
export const sendToken = async (amount, returnChange = true) => {
  try {
    logger.info('Sending token', { amount, returnChange });

    // Select proofs
    const allProofs = await loadProofs();
    const selectedProofs = selectProofsForAmount(allProofs, amount);
    const selectedAmount = sumProofs(selectedProofs);

    logger.info('Selected proofs', {
      selected: selectedAmount,
      needed: amount,
      proofCount: selectedProofs.length,
    });

    let proofsToSend = selectedProofs;
    let changeProofs = [];

    // If we need to create change
    if (returnChange && selectedAmount > amount) {
      const changeAmount = selectedAmount - amount;
      logger.info('Creating change', { changeAmount });

      // Get keys first to determine keyset ID
      const keyData = await getOrFetchKeys();
      let keys, keysetId;
      if (keyData.keysets && keyData.keysets.length > 0) {
        keysetId = keyData.keysets[0].id;
        keys = keyData.keysets[0].keys;
      } else {
        keys = keyData.keys || keyData;
      }

      // Split into send + change amounts
      const sendAmounts = splitAmount(amount);
      const changeAmounts = splitAmount(changeAmount);

      // Create blinded outputs for both
      const { outputs, blindingData } = await createBlindedOutputs([
        ...sendAmounts,
        ...changeAmounts,
      ], keysetId);

      // Swap with mint
      const response = await swapTokensAPI(selectedProofs, outputs);

      // Unblind all
      const allNewProofs = unblindSignatures(
        response.signatures,
        blindingData,
        keys,
        response.signatures[0]?.id || keysetId
      );

      // Split into send and change
      proofsToSend = allNewProofs.slice(0, sendAmounts.length);
      changeProofs = allNewProofs.slice(sendAmounts.length);

      logger.info('Swap completed', {
        sendProofs: proofsToSend.length,
        changeProofs: changeProofs.length,
      });
    }

    // Remove spent proofs, add change
    await removeProofs(selectedProofs);
    if (changeProofs.length > 0) {
      await addProofs(changeProofs);
    }

    // Encode token for sending
    const token = encodeToken(proofsToSend, MINT_URL);

    const newBalance = await getBalance();

    logger.info('Token created', { amount, newBalance });

    return {
      token,
      amount: sumProofs(proofsToSend),
      balance: newBalance,
    };
  } catch (error) {
    logger.error('Failed to send token', { error: error.message });
    throw error;
  }
};

/**
 * Redeem tokens for Runes (melt)
 * Step 1: Create melt quote
 *
 * @param {string} address - Taproot address to send Runes to
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Melt quote with fee
 */
export const requestMelt = async (address, amount) => {
  try {
    logger.info('Requesting melt', { address, amount });

    const quote = await createMeltQuote(address, amount);

    return {
      quoteId: quote.quote,
      amount: quote.amount,
      fee: quote.fee_reserve,
      total: quote.amount + quote.fee_reserve,
    };
  } catch (error) {
    logger.error('Failed to request melt', { error: error.message });
    throw error;
  }
};

/**
 * Complete melt (redeem tokens for Runes)
 * Step 2: Send proofs to mint and get Runes
 *
 * @param {string} quoteId - Melt quote ID
 * @param {number} totalAmount - Total amount including fee
 * @returns {Promise<Object>} Payment result with txid
 */
export const completeMelt = async (quoteId, totalAmount) => {
  try {
    logger.info('Completing melt', { quoteId, totalAmount });

    // Select proofs
    const allProofs = await loadProofs();

    // Debug: Log the proofs we're about to use
    logger.info('Proofs loaded for melt', {
      count: allProofs.length,
      proofIds: allProofs.map(p => ({ amount: p.amount, id: p.id, secretPreview: p.secret?.substring(0, 8) }))
    });

    const selectedProofs = selectProofsForAmount(allProofs, totalAmount);
    const selectedAmount = sumProofs(selectedProofs);

    // If we have change, swap first
    let proofsToMelt = selectedProofs;
    let changeProofs = null;

    if (selectedAmount > totalAmount) {
      const changeAmount = selectedAmount - totalAmount;
      logger.info('Creating change for melt', { changeAmount });

      // Get keys first to determine keyset ID
      const keyData = await getOrFetchKeys();
      let keys, keysetId;
      if (keyData.keysets && keyData.keysets.length > 0) {
        keysetId = keyData.keysets[0].id;
        keys = keyData.keysets[0].keys;
      } else {
        keys = keyData.keys || keyData;
      }

      const meltAmounts = splitAmount(totalAmount);
      const changeAmounts = splitAmount(changeAmount);

      const { outputs, blindingData } = await createBlindedOutputs([
        ...meltAmounts,
        ...changeAmounts,
      ], keysetId);

      const response = await swapTokensAPI(selectedProofs, outputs);

      const allNewProofs = unblindSignatures(
        response.signatures,
        blindingData,
        keys,
        response.signatures[0]?.id || keysetId
      );

      proofsToMelt = allNewProofs.slice(0, meltAmounts.length);
      changeProofs = allNewProofs.slice(meltAmounts.length);

      // DON'T remove/add proofs yet - wait for melt confirmation
    }

    // Melt tokens - this is the critical step that broadcasts the transaction
    const result = await meltTokensAPI(quoteId, proofsToMelt);

    // ONLY NOW that melt succeeded, remove the spent proofs
    if (changeProofs) {
      // Had change: remove old proofs, add change
      await removeProofs(selectedProofs);
      await addProofs(changeProofs);
      logger.info('Melt succeeded - removed old proofs and added change', {
        removedCount: selectedProofs.length,
        changeCount: changeProofs.length,
      });
    } else {
      // No change: just remove the proofs
      await removeProofs(selectedProofs);
      logger.info('Melt succeeded - removed spent proofs', { count: selectedProofs.length });
    }

    const newBalance = await getBalance();

    logger.info('Melt completed', {
      paid: result.paid,
      txid: result.payment_preimage,
      newBalance,
    });

    return {
      paid: result.paid,
      txid: result.payment_preimage,
      fee: result.fee_paid || 0,
      balance: newBalance,
    };
  } catch (error) {
    logger.error('Failed to complete melt', { error: error.message });
    throw error;
  }
};

/**
 * Clear all proofs (for testing or wallet reset)
 */
export const clearWallet = async () => {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  await SecureStore.deleteItemAsync(KEYSETS_KEY);
  logger.info('Wallet cleared');
};

/**
 * Send P2PK locked token (NUT-11)
 * Lock tokens to recipient's public key - only they can spend
 *
 * @param {number} amount - Amount to send
 * @param {string} recipientPubkey - Recipient's public key (hex)
 * @param {Object} options - Optional P2PK parameters
 * @returns {Promise<Object>} { token, amount, balance }
 */
export const sendP2PKToken = async (amount, recipientPubkey, options = {}) => {
  try {
    logger.info('Sending P2PK locked token', { amount, recipientPubkey: recipientPubkey.substring(0, 16) + '...' });

    const { createP2PKSecret } = await import('./cashuP2PK.js');

    // Select proofs
    const allProofs = await loadProofs();
    const selectedProofs = selectProofsForAmount(allProofs, amount);
    const selectedAmount = sumProofs(selectedProofs);

    // Get keys
    const keyData = await getOrFetchKeys();
    let keys, keysetId;
    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      keys = keyData.keys || keyData;
    }

    // Create P2PK secrets for the send amount
    const sendAmounts = splitAmount(amount);
    const p2pkSecrets = [];

    for (const amt of sendAmounts) {
      const p2pkSecret = await createP2PKSecret(recipientPubkey, options);
      p2pkSecrets.push(p2pkSecret);
    }

    // If we have change, create normal secrets for change
    let changeSecrets = [];
    if (selectedAmount > amount) {
      const changeAmount = selectedAmount - amount;
      const changeAmounts = splitAmount(changeAmount);

      for (const amt of changeAmounts) {
        const secret = await generateSecret();
        changeSecrets.push(secret);
      }
    }

    // Create blinded outputs using our custom secrets
    const allSecrets = [...p2pkSecrets, ...changeSecrets];
    const allAmounts = [...sendAmounts, ...(selectedAmount > amount ? splitAmount(selectedAmount - amount) : [])];
    const { outputs, blindingData } = await createBlindedOutputsWithSecrets(allSecrets, allAmounts, keysetId);

    // Swap with mint
    const response = await swapTokensAPI(selectedProofs, outputs);

    // Unblind all
    const allNewProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    // Split into send and change
    const proofsToSend = allNewProofs.slice(0, sendAmounts.length);
    const changeProofs = allNewProofs.slice(sendAmounts.length);

    // Remove spent proofs, add change
    await removeProofs(selectedProofs);
    if (changeProofs.length > 0) {
      await addProofs(changeProofs);
    }

    // Encode token for sending (P2PK locked)
    const token = encodeToken(proofsToSend, MINT_URL);

    const newBalance = await getBalance();

    logger.info('P2PK token created', { amount, locked: true, newBalance });

    return {
      token,
      amount: sumProofs(proofsToSend),
      balance: newBalance,
    };
  } catch (error) {
    logger.error('Failed to send P2PK token', { error: error.message });
    throw error;
  }
};

/**
 * Receive and spend P2PK locked token (NUT-11)
 * Provide your private key to unlock and claim the tokens
 *
 * @param {string} tokenString - Encoded P2PK token
 * @param {string} privateKey - Your private key to unlock the token (hex)
 * @returns {Promise<Object>} { amount, proofCount }
 */
export const receiveP2PKToken = async (tokenString, privateKey) => {
  try {
    logger.info('Receiving P2PK locked token');

    const { signP2PKSecret, isP2PKSecret } = await import('./cashuP2PK.js');

    // Decode token
    const { mint, proofs, amount } = decodeToken(tokenString);

    // Verify mint matches
    if (mint !== MINT_URL) {
      throw new Error(`Token from different mint: ${mint}`);
    }

    // Check if proofs are P2PK locked
    const p2pkProofs = proofs.filter(p => isP2PKSecret(p.secret));
    if (p2pkProofs.length === 0) {
      throw new Error('Token does not contain P2PK locked proofs');
    }

    logger.info('Signing P2PK proofs with private key', { proofCount: p2pkProofs.length });

    // Sign each P2PK proof with our private key
    const signedProofs = await Promise.all(
      proofs.map(async (proof) => {
        if (isP2PKSecret(proof.secret)) {
          // Create witness signature
          const witness = await signP2PKSecret(proof.secret, privateKey);
          return {
            ...proof,
            witness
          };
        } else {
          // Non-P2PK proof, no witness needed
          return proof;
        }
      })
    );

    // Get keys
    const keyData = await getOrFetchKeys();
    let keys, keysetId;
    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      keys = keyData.keys || keyData;
    }

    // Swap the P2PK proofs for regular proofs (this will verify the witness)
    const amounts = splitAmount(amount);
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);

    // Swap: give signed P2PK proofs, get regular proofs
    const response = await swapTokensAPI(signedProofs, outputs);

    // Unblind to create our new proofs
    const newProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    // Add to wallet
    await addProofs(newProofs);

    logger.info('P2PK token received and unlocked', { amount, proofCount: newProofs.length });

    return {
      amount,
      proofCount: newProofs.length,
    };
  } catch (error) {
    logger.error('Failed to receive P2PK token', { error: error.message });
    throw error;
  }
};

/**
 * Helper: Create blinded outputs with custom secrets (for P2PK)
 */
const createBlindedOutputsWithSecrets = async (secrets, amounts, keysetId) => {
  const { createBlindedMessage } = await import('./cashuCrypto.js');
  const outputs = [];
  const blindingData = [];

  if (secrets.length !== amounts.length) {
    throw new Error('Secrets and amounts length mismatch');
  }

  for (let i = 0; i < secrets.length; i++) {
    const secret = secrets[i];
    const amount = amounts[i];

    const blindedMsg = await createBlindedMessage(secret);

    const output = {
      amount,
      B_: blindedMsg.B_,
    };

    if (keysetId) {
      output.id = keysetId;
    }

    outputs.push(output);

    blindingData.push({
      amount,
      secret: secret,
      r: blindedMsg.r,
      B_: blindedMsg.B_,
    });
  }

  // Sort outputs by amount for privacy (NUT-03)
  const combined = outputs.map((output, i) => ({
    output,
    blindingData: blindingData[i]
  }));

  combined.sort((a, b) => a.output.amount - b.output.amount);

  return {
    outputs: combined.map(c => c.output),
    blindingData: combined.map(c => c.blindingData)
  };
};

export default {
  loadProofs,
  saveProofs,
  getBalance,
  requestMint,
  checkMintStatus,
  completeMint,
  receiveToken,
  sendToken,
  sendP2PKToken,
  receiveP2PKToken,
  requestMelt,
  completeMelt,
  clearWallet,
};
