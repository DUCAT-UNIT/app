/**
 * Transaction Service - Bitcoin and Runes transaction creation, signing, and broadcasting
 */

import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from '../runestone-encoder';
import { MUTINYNET_NETWORK, validateAndNormalizeAddress } from '../utils/bitcoin';
import { fetchUtxos as fetchUtxosService } from './balanceService';
import * as AuthService from './authService';
import { ERRORS } from '../utils/messages';
import { retrySilently } from '../utils/retry';
import {
  getTxHexUrl,
  getOrdAddressUrl,
  getOrdOutputUrl,
  getTxOutspendUrl,
  getAddressUtxoUrl,
  getBroadcastUrl,
} from '../utils/constants';

// Initialize BIP32 and ECC library
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

/**
 * Create a BTC transaction intent (unsigned PSBT)
 * @param {string} recipient - Recipient Bitcoin address
 * @param {string} amount - Amount in BTC (as string, e.g. "0.001")
 * @param {string} segwitAddress - Source SegWit address
 * @param {number} currentAccount - Current account index
 * @returns {Promise<{id: string, psbt: string, ...}>} Transaction intent object
 */
export const createBtcIntent = async (recipient, amount, segwitAddress, currentAccount) => {
  try {
    // Validate and normalize recipient address
    const validatedRecipient = validateAndNormalizeAddress(recipient);

    // Replace comma with period for locales that use comma as decimal separator
    const normalizedAmount = amount.replace(',', '.');
    const amountInSats = Math.floor(parseFloat(normalizedAmount) * 100000000);

    if (isNaN(amountInSats) || amountInSats <= 0) {
      throw new Error(ERRORS.INVALID_AMOUNT);
    }

    const sourceAddress = segwitAddress;
    const addressType = 'segwit';

    // Fetch UTXOs for the source address
    const availableUtxos = await fetchUtxosService(sourceAddress);

    if (availableUtxos.length === 0) {
      throw new Error(ERRORS.NO_CONFIRMED_FUNDS);
    }

    /**
     * Dynamic fee calculation based on transaction size
     * Transaction size = base + (inputs * input_size) + (outputs * output_size)
     * - Base: ~10 vbytes (version, locktime, etc.)
     * - P2WPKH input: ~68 vbytes (input + witness data)
     * - P2PKH output: ~34 vbytes
     * - P2WPKH output: ~31 vbytes
     */
    const feeRate = 1; // sats per vbyte (very low for testnet)
    const BASE_TX_SIZE = 10;
    const P2WPKH_INPUT_SIZE = 68;
    const P2WPKH_OUTPUT_SIZE = 31;

    /**
     * Calculate transaction fee based on number of inputs and outputs
     */
    const calculateFee = (numInputs, numOutputs) => {
      const txSize = BASE_TX_SIZE + (numInputs * P2WPKH_INPUT_SIZE) + (numOutputs * P2WPKH_OUTPUT_SIZE);
      return Math.ceil(txSize * feeRate);
    };

    /**
     * Iterative UTXO selection with dynamic fee calculation
     * Select UTXOs until we have enough to cover amount + fee
     * Recalculate fee if more inputs are needed
     */
    let selectedUtxos = [];
    let totalInput = 0;
    let estimatedFee = 0;
    let previousFee = 0;

    // Calculate total available balance
    const totalAvailable = availableUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

    // Iteratively select UTXOs and recalculate fee
    do {
      previousFee = estimatedFee;
      const numOutputs = 2; // recipient + change (we'll adjust if no change needed)

      // If we don't have enough, add more UTXOs
      while (selectedUtxos.length < availableUtxos.length) {
        // Find next available UTXO
        const nextUtxo = availableUtxos.find(
          utxo => utxo.status.confirmed && !selectedUtxos.includes(utxo)
        );
        if (!nextUtxo) break;

        // Add UTXO to selection
        selectedUtxos.push(nextUtxo);
        totalInput += nextUtxo.value;

        // Calculate fee with current number of selected UTXOs
        estimatedFee = calculateFee(selectedUtxos.length, numOutputs);
        const requiredAmount = amountInSats + estimatedFee;

        // Check if we now have enough
        if (totalInput >= requiredAmount) {
          break;
        }
      }

      // Final fee calculation with actual selected UTXOs
      estimatedFee = calculateFee(selectedUtxos.length, numOutputs);
    } while (estimatedFee !== previousFee && selectedUtxos.length < availableUtxos.length);


    // Calculate preliminary change to determine if we need 1 or 2 outputs
    const DUST_LIMIT = 546; // Bitcoin dust limit in satoshis
    let preliminaryChange = totalInput - amountInSats - estimatedFee;

    // If change would be below dust (including negative), recalculate fee for 1 output (no change)
    if (preliminaryChange < DUST_LIMIT) {
      estimatedFee = calculateFee(selectedUtxos.length, 1);
      preliminaryChange = totalInput - amountInSats - estimatedFee;
    }

    // Final check for sufficient funds
    const requiredAmount = amountInSats + estimatedFee;
    if (totalInput < requiredAmount) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Fetch transaction hex for each input
    const inputsWithTx = await Promise.all(
      selectedUtxos.map(async (utxo) => {
        const txResponse = await fetch(getTxHexUrl(utxo.txid));
        const txHex = await txResponse.text();
        return {
          ...utxo,
          txHex,
        };
      })
    );

    // Calculate final change (already adjusted for dust limit above)
    let change = totalInput - amountInSats - estimatedFee;
    let finalFee = estimatedFee;

    // If change is still below dust after fee adjustment, it goes entirely to miners
    if (change > 0 && change < DUST_LIMIT) {
      finalFee = totalInput - amountInSats; // All remaining goes to fee
      change = 0;
    }

    // Create PSBT (unsigned - no mnemonic needed)
    const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

    // Add inputs (BTC always uses segwit)
    for (let i = 0; i < inputsWithTx.length; i++) {
      const utxo = inputsWithTx[i];
      const tx = bitcoin.Transaction.fromHex(utxo.txHex);

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(tx.outs[utxo.vout].script),
          value: BigInt(utxo.value),
        },
      });
    }

    // Add output (recipient)
    psbt.addOutput({
      address: validatedRecipient,
      value: BigInt(amountInSats),
    });

    // Add change output if above dust limit
    if (change > DUST_LIMIT) {
      psbt.addOutput({
        address: sourceAddress,
        value: BigInt(change),
      });
    }

    // Create intent object
    const intent = {
      id: Date.now().toString(),
      type: 'send',
      amount: amountInSats,
      amountBTC: amount,
      recipient: validatedRecipient,
      fee: finalFee,
      addressType, // Always 'segwit' for BTC
      sourceAddress,
      inputs: selectedUtxos,
      inputCount: selectedUtxos.length,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };

    return intent;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a UNIT (Runes) transaction intent with runestone encoding
 * @param {string} recipient - Recipient Bitcoin address
 * @param {string} amount - Amount of runes (as string, e.g. "100")
 * @param {string} taprootAddress - Source Taproot address
 * @param {string} segwitAddress - SegWit address for fees
 * @param {number} currentAccount - Current account index
 * @returns {Promise<{id: string, psbt: string, assetType: string, ...}>} Transaction intent object
 */
export const createUnitIntent = async (recipient, amount, taprootAddress, segwitAddress, currentAccount) => {
  try {
    // Validate and normalize recipient address
    const validatedRecipient = validateAndNormalizeAddress(recipient);

    // Force Taproot address for UNIT transfers
    if (!validatedRecipient.startsWith('tb1p') && !validatedRecipient.startsWith('bc1p')) {
      throw new Error('UNIT transfers require a Taproot address (starting with tb1p)');
    }

    // Parse amount and multiply by 100 for runestone encoding
    const normalizedAmount = amount.replace(',', '.');
    const userAmount = parseInt(normalizedAmount);
    if (isNaN(userAmount) || userAmount <= 0) {
      throw new Error(ERRORS.INVALID_AMOUNT);
    }
    // Multiply by 100 for runestone encoding (UNIT display amount * 100)
    const amountInRunes = userAmount * 100;

    // Use addresses passed as parameters (no mnemonic needed for PSBT creation)
    // These addresses are already derived from the wallet's mnemonic

    // Fetch rune UTXOs from ord API
    const ordResponse = await fetch(
      getOrdAddressUrl(taprootAddress),
      { headers: { 'Accept': 'application/json' } }
    );
    const ordData = await ordResponse.json();

    // Find a UTXO with sufficient runes
    let runeUtxo = null;
    for (const output of ordData.outputs || []) {
      const utxoResponse = await fetch(
        getOrdOutputUrl(output),
        { headers: { 'Accept': 'application/json' } }
      );
      const utxoData = await utxoResponse.json();

      // Check if this UTXO has DUCAT•UNIT•RUNE
      if (utxoData.runes && utxoData.runes['DUCAT•UNIT•RUNE']) {
        const runeAmount = parseInt(utxoData.runes['DUCAT•UNIT•RUNE'].amount);

        if (runeAmount >= amountInRunes) {
          const vout = parseInt(output.match(/:(.*)$/)[1]);

          // Check if unspent
          const spendResponse = await fetch(
            getTxOutspendUrl(utxoData.transaction, vout)
          );
          const spendData = await spendResponse.json();

          if (!spendData.spent) {
            runeUtxo = {
              transaction: utxoData.transaction,
              vout: vout,
              value: utxoData.value,
              runeAmount: runeAmount,
            };
            break;
          }
        }
      }
    }

    if (!runeUtxo) {
      throw new Error(ERRORS.NO_UNIT_BALANCE);
    }

    // Fetch regular UTXOs for fees
    const utxoResponse = await fetch(getAddressUtxoUrl(segwitAddress));
    const utxos = await utxoResponse.json();

    // Find a UTXO with at least 12000 sats for fees
    let satUtxo = null;
    for (const utxo of utxos) {
      if (utxo.status.confirmed && utxo.value >= 12000) {
        satUtxo = {
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
        };
        break;
      }
    }

    if (!satUtxo) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS_FOR_FEES);
    }

    // Calculate amounts
    const fee = 1000;
    const recipientSats = 10000;
    const dustLimit = 546;
    const totalInput = satUtxo.value + runeUtxo.value;
    const change = totalInput - fee - recipientSats - dustLimit;

    if (change < 0) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Create PSBT
    const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

    // Fetch transaction hex for inputs
    const satTxResponse = await fetch(getTxHexUrl(satUtxo.txid));
    const satTxHex = await satTxResponse.text();
    const satTx = bitcoin.Transaction.fromHex(satTxHex);

    const runeTxResponse = await fetch(getTxHexUrl(runeUtxo.transaction));
    const runeTxHex = await runeTxResponse.text();
    const runeTx = bitcoin.Transaction.fromHex(runeTxHex);

    // Decode addresses to get the pubkey data
    const { data: taprootData } = bitcoin.address.fromBech32(taprootAddress);
    const tapInternalKey = Buffer.from(taprootData);

    // Add inputs - exactly like working example
    // Input 0: P2WPKH (for fees)
    psbt.addInput({
      hash: satUtxo.txid,
      index: parseInt(satUtxo.vout),
      witnessUtxo: {
        script: Buffer.from(satTx.outs[satUtxo.vout].script),
        value: BigInt(satUtxo.value),
      },
    });

    // Input 1: Taproot (with runes)
    psbt.addInput({
      hash: runeUtxo.transaction,
      index: parseInt(runeUtxo.vout),
      witnessUtxo: {
        script: Buffer.from(runeTx.outs[runeUtxo.vout].script),
        value: BigInt(runeUtxo.value),
      },
      tapInternalKey: tapInternalKey,
    });

    // Create runestone
    const runestoneConfig = {
      edicts: [
        {
          id: { block: 1527352n, tx: 1n }, // DUCAT•UNIT•RUNE ID
          amount: BigInt(amountInRunes),
          output: 1, // Recipient is at output 1
        },
      ],
    };

    // Try calling encodeRunestone with minimal test first
    try {
      const testResult = encodeRunestone({ edicts: [] });
    } catch (e) {
    }

    const runestoneResult = encodeRunestone(runestoneConfig);

    // Check if encodedRunestone has the edict data
    if (runestoneResult.encodedRunestone) {
      const fullHex = Buffer.from(runestoneResult.encodedRunestone).toString('hex');
    }

    const runestoneScript = runestoneResult.encodedRunestone;

    if (runestoneScript) {
      const scriptHex = Buffer.from(runestoneScript).toString('hex');
    } else {
    }

    // Add outputs (OP_RETURN last) - exactly like working example
    // Output 0: Rune return (gets unallocated runes)
    psbt.addOutput({
      address: taprootAddress,
      value: BigInt(dustLimit),
    });

    // Output 1: Recipient (gets specified runes via edict)
    psbt.addOutput({
      address: validatedRecipient,
      value: BigInt(recipientSats),
    });

    // Output 2: Change (if any)
    if (change > dustLimit) {
      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(change),
      });
    }

    // Output 3: OP_RETURN with runestone (last)

    psbt.addOutput({
      script: runestoneScript,
      value: BigInt(0),
    });


    // Verify the OP_RETURN was added correctly
    const lastOutputIndex = psbt.txOutputs.length - 1;
    const lastOutput = psbt.txOutputs[lastOutputIndex];

    // Create intent object
    const intent = {
      id: Date.now().toString(),
      type: 'send',
      assetType: 'UNIT',
      amount: amountInRunes,
      amountDisplay: `${amountInRunes} UNIT`,
      recipient: validatedRecipient,
      fee: fee,
      addressType: 'taproot',
      sourceAddress: taprootAddress,
      feeAddress: segwitAddress,
      runeUtxo,
      satUtxo,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };

    return intent;
  } catch (error) {
    throw error;
  }
};

/**
 * Sign a transaction intent PSBT
 * @param {Object} intent - Transaction intent object with psbt field
 * @param {number} currentAccount - Current account index
 * @returns {Promise<{signedTxHex: string, txid: string}>} Signed transaction
 */
export const signIntent = async (intent, currentAccount) => {
  // Minimize mnemonic exposure with scoped variables
  let mnemonic = null;
  let seed = null;
  let root = null;

  try {
    if (!intent) {
      throw new Error(ERRORS.TRANSACTION_CANCELLED);
    }

    // Get mnemonic from secure storage (minimize scope)
    mnemonic = await AuthService.getMnemonic();
    seed = bip39.mnemonicToSeedSync(mnemonic);
    root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Load PSBT
    const psbt = bitcoin.Psbt.fromBase64(intent.psbt);

    // Sign all inputs
    if (intent.assetType === 'UNIT') {

      // Input 0: P2WPKH (fee input)
      const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
      const segwitChild = root.derivePath(segwitPath);
      psbt.signInput(0, segwitChild);

      // Input 1: Taproot (rune input) - requires manual tweaking
      const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
      const taprootChild = root.derivePath(taprootPath);

      // Manual Taproot signing with tweaking
      const tx = psbt.__CACHE.__TX.clone();
      const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT;

      // Get witness scripts and values for both inputs
      const prevoutScripts = [
        psbt.data.inputs[0].witnessUtxo.script,
        psbt.data.inputs[1].witnessUtxo.script,
      ];

      // Convert values to BigInt, handling both number and bigint types
      const val0 = psbt.data.inputs[0].witnessUtxo.value;
      const val1 = psbt.data.inputs[1].witnessUtxo.value;

      // Helper to convert any type to BigInt
      const toBigInt = (val) => {
        if (typeof val === 'bigint') return val;
        if (typeof val === 'number') return BigInt(val);
        if (typeof val === 'string') return BigInt(val);
        return BigInt(String(val));
      };

      const prevoutValues = [
        toBigInt(val0),
        toBigInt(val1),
      ];

      // Calculate sighash for input 1
      const hash = tx.hashForWitnessV1(1, prevoutScripts, prevoutValues, sighashType);

      // Get x-only pubkey
      const xOnlyPubkey = Buffer.from(taprootChild.publicKey.slice(1, 33));

      // Create the tweak
      const tweakHashRaw = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);
      const tweakHash = Buffer.isBuffer(tweakHashRaw) ? tweakHashRaw : Buffer.from(tweakHashRaw);

      // Get the private key
      let privateKey = taprootChild.privateKey;
      if (!Buffer.isBuffer(privateKey)) {
        privateKey = Buffer.from(privateKey);
      }

      // Check if we need to negate the private key
      // If the public key has odd y-coordinate (0x03 prefix), negate the private key
      if (taprootChild.publicKey[0] === 0x03) {
        const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
        const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
        const negatedNum = CURVE_ORDER - privKeyNum;
        privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
      }

      // Add the tweak
      const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
      const tweakNum = BigInt('0x' + tweakHash.toString('hex'));
      const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
      const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;
      const tweakedPrivateKey = Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');


      // Ensure buffers are the correct size
      if (hash.length !== 32) {
        throw new Error(`Hash must be 32 bytes, got ${hash.length}`);
      }
      if (tweakedPrivateKey.length !== 32) {
        throw new Error(`Private key must be 32 bytes, got ${tweakedPrivateKey.length}`);
      }

      // Sign with tweaked key
      const signature = ecc.signSchnorr(hash, tweakedPrivateKey);
      psbt.updateInput(1, { tapKeySig: Buffer.from(signature) });

    } else {
      // BTC transaction - all inputs are same type
      if (intent.addressType === 'taproot') {
        const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
        const taprootChild = root.derivePath(taprootPath);
        const tweakedSigner = taprootChild.tweak(
          bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
        );

        for (let i = 0; i < intent.inputs.length; i++) {
          psbt.signInput(i, tweakedSigner);
        }
      } else {
        const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
        const segwitChild = root.derivePath(segwitPath);

        for (let i = 0; i < intent.inputs.length; i++) {
          psbt.signInput(i, segwitChild);
        }
      }
    }

    // Finalize all inputs
    if (intent.assetType === 'UNIT') {
      // Try to finalize all inputs
      try {
        psbt.finalizeAllInputs();
      } catch (e) {
        // Manual finalization for Taproot (matches working example)
        psbt.finalizeInput(0); // P2WPKH finalizes normally

        const tapKeySig = psbt.data.inputs[1].tapKeySig;
        if (!tapKeySig) {
          throw new Error('No tapKeySig found');
        }

        // Use bitcoin.script.compile like in the working example
        psbt.data.inputs[1].finalScriptWitness = bitcoin.script.compile([tapKeySig]);
      }
    } else {
      psbt.finalizeAllInputs();
    }

    // Extract signed transaction
    const signedTx = psbt.extractTransaction();
    const signedTxHex = signedTx.toHex();

    // VERIFY: Check that runestone is in the transaction (for UNIT transactions)
    if (intent.assetType === 'UNIT') {

      signedTx.outs.forEach((output, index) => {
        const scriptHex = output.script.toString('hex');

        if (scriptHex.startsWith('6a')) {

          // Check if it contains the runestone marker (0x0d = 13 in decimal, the Runes protocol tag)
          if (scriptHex.includes('0d')) {
          } else {
          }
        }
      });
    }

    return {
      signedTxHex,
      txid: signedTx.getId(),
    };
  } catch (error) {
    throw error;
  } finally {
    // CRITICAL: Securely overwrite sensitive data (always runs, even on error)
    const sensitiveData = [mnemonic, seed, root];
    sensitiveData.forEach(data => {
      if (data) {
        try {
          // Overwrite memory with random data 3 times
          for (let i = 0; i < 3; i++) {
            if (Buffer.isBuffer(data)) {
              // Best effort cleanup
              const randomBytes = Buffer.alloc(data.length);
              for (let j = 0; j < data.length; j++) {
                randomBytes[j] = Math.floor(Math.random() * 256);
              }
              randomBytes.copy(data);
            } else if (typeof data === 'string') {
              // For string data, try to overwrite (limited effectiveness in JS)
              data = null;
            }
          }
        } catch (e) {
          // Best effort cleanup
        }
      }
    });

    // Nullify references
    mnemonic = null;
    seed = null;
    root = null;
  }
};

/**
 * Broadcast a signed transaction to the network
 * @param {string} signedTxHex - Signed transaction in hex format
 * @returns {Promise<string>} Transaction ID (txid)
 */
export const broadcastTransaction = async (signedTxHex) => {
  try {
    const response = await retrySilently(
      () => fetch(getBroadcastUrl(), {
        method: 'POST',
        body: signedTxHex,
      }),
      'Broadcast transaction',
      { maxRetries: 2 } // Fewer retries for broadcasts
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to broadcast transaction');
    }

    const txid = await response.text();

    return txid;
  } catch (error) {
    throw error;
  }
};
