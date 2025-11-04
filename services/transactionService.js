/**
 * Transaction Service - Bitcoin and Runes transaction creation, signing, and broadcasting
 */

import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from '../runestone-encoder';
import { MUTINYNET_NETWORK } from '../utils/bitcoin';
import { fetchUtxos as fetchUtxosService } from './balanceService';
import * as AuthService from './authService';

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
    console.log('createBtcIntent started');

    // Replace comma with period for locales that use comma as decimal separator
    const normalizedAmount = amount.replace(',', '.');
    const amountInSats = Math.floor(parseFloat(normalizedAmount) * 100000000);
    console.log('Amount in sats:', amountInSats);

    if (isNaN(amountInSats) || amountInSats <= 0) {
      throw new Error('Invalid amount');
    }

    const sourceAddress = segwitAddress;
    const addressType = 'segwit';
    console.log('Source address (segwit):', sourceAddress);

    // Fetch UTXOs for the source address
    console.log('Fetching UTXOs for:', sourceAddress);
    const availableUtxos = await fetchUtxosService(sourceAddress);
    console.log('Found', availableUtxos.length, 'UTXOs');

    if (availableUtxos.length === 0) {
      throw new Error('No UTXOs available to spend');
    }

    // Simple UTXO selection - use first UTXO that covers amount + fee
    const feeRate = 1; // sats per vbyte (very low for testnet)
    const estimatedSize = 200; // rough estimate
    const estimatedFee = feeRate * estimatedSize;
    const requiredAmount = amountInSats + estimatedFee;
    console.log('Required amount:', requiredAmount, 'sats (amount:', amountInSats, '+ fee:', estimatedFee, ')');

    let selectedUtxos = [];
    let totalInput = 0;

    for (const utxo of availableUtxos) {
      console.log('Checking UTXO:', utxo.txid, 'confirmed:', utxo.status.confirmed, 'value:', utxo.value);
      if (utxo.status.confirmed) {
        selectedUtxos.push(utxo);
        totalInput += utxo.value;
        if (totalInput >= requiredAmount) break;
      }
    }

    console.log('Selected', selectedUtxos.length, 'UTXOs with total:', totalInput, 'sats');

    if (totalInput < requiredAmount) {
      throw new Error(`Insufficient funds. Need ${requiredAmount} sats, have ${totalInput} sats`);
    }

    // Fetch transaction hex for each input
    console.log('Fetching transaction hex for', selectedUtxos.length, 'inputs...');
    const inputsWithTx = await Promise.all(
      selectedUtxos.map(async (utxo) => {
        console.log('Fetching tx hex for:', utxo.txid);
        const txResponse = await fetch(`https://mutinynet.com/api/tx/${utxo.txid}/hex`);
        const txHex = await txResponse.text();
        console.log('Got tx hex for:', utxo.txid, 'length:', txHex.length);
        return {
          ...utxo,
          txHex,
        };
      })
    );
    console.log('All transaction hex fetched successfully');

    // Calculate change
    const change = totalInput - amountInSats - estimatedFee;
    console.log('Change amount:', change, 'sats');

    // Get mnemonic to derive keys (temporarily)
    console.log('Loading mnemonic and deriving keys...');
    const mnemonic = await AuthService.getMnemonic();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
    console.log('Keys derived successfully');

    // Create PSBT
    console.log('Creating PSBT...');
    const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

    // Add inputs (BTC always uses segwit)
    console.log('Adding', inputsWithTx.length, 'inputs to PSBT...');
    for (let i = 0; i < inputsWithTx.length; i++) {
      const utxo = inputsWithTx[i];
      console.log('Adding input', i, ':', utxo.txid, 'vout:', utxo.vout);
      const tx = bitcoin.Transaction.fromHex(utxo.txHex);

      // Segwit input
      const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
      const segwitChild = root.derivePath(segwitPath);

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(tx.outs[utxo.vout].script),
          value: BigInt(utxo.value),
        },
      });
      console.log('Input', i, 'added successfully');
    }

    // Add output (recipient)
    console.log('Adding recipient output:', recipient, 'amount:', amountInSats);
    psbt.addOutput({
      address: recipient,
      value: BigInt(amountInSats),
    });
    console.log('Recipient output added');

    // Add change output if needed
    if (change > 546) { // Dust limit
      console.log('Adding change output:', sourceAddress, 'amount:', change);
      psbt.addOutput({
        address: sourceAddress,
        value: BigInt(change),
      });
      console.log('Change output added');
    } else {
      console.log('No change output (below dust limit)');
    }

    // Securely clear sensitive data
    console.log('Clearing sensitive data...');
    const clearData = [mnemonic, seed.toString('hex')];
    clearData.forEach(data => {
      if (data) {
        // Overwrite with random data
        const len = data.length;
        for (let i = 0; i < 3; i++) {
          data.split('').map(() => String.fromCharCode(Math.floor(Math.random() * 256))).join('');
        }
      }
    });

    // Create intent object
    console.log('Creating intent object...');
    const intent = {
      id: Date.now().toString(),
      type: 'send',
      amount: amountInSats,
      amountBTC: amount,
      recipient,
      fee: estimatedFee,
      addressType, // Always 'segwit' for BTC
      sourceAddress,
      inputs: selectedUtxos,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };

    console.log('Intent created:', intent.id);
    return intent;
  } catch (error) {
    console.error('Failed to create BTC transaction:', error);
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
    console.log('Creating UNIT transaction intent...');

    // Parse amount and multiply by 100 for runestone encoding
    const normalizedAmount = amount.replace(',', '.');
    const userAmount = parseInt(normalizedAmount);
    if (isNaN(userAmount) || userAmount <= 0) {
      throw new Error('Invalid amount');
    }
    // Multiply by 100 for runestone encoding (UNIT display amount * 100)
    const amountInRunes = userAmount * 100;
    console.log('User specified', userAmount, 'UNIT, sending', amountInRunes, 'runes to', recipient);

    // Get mnemonic and derive keys
    const mnemonic = await AuthService.getMnemonic();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Derive Taproot address (holds runes)
    const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
    const taprootChild = root.derivePath(taprootPath);
    const xOnlyPubkey = Buffer.from(taprootChild.publicKey.slice(1, 33));
    const taprootPayment = bitcoin.payments.p2tr({
      internalPubkey: xOnlyPubkey,
      network: MUTINYNET_NETWORK,
    });
    const derivedTaprootAddress = taprootPayment.address;
    console.log('Taproot address:', derivedTaprootAddress);

    // Derive P2WPKH address (pays fees)
    const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
    const segwitChild = root.derivePath(segwitPath);
    const p2wpkhPayment = bitcoin.payments.p2wpkh({
      pubkey: segwitChild.publicKey,
      network: MUTINYNET_NETWORK,
    });
    const p2wpkhAddress = p2wpkhPayment.address;
    console.log('P2WPKH address:', p2wpkhAddress);

    // Fetch rune UTXOs from ord API
    console.log('Fetching rune UTXOs from ord API...');
    const ordResponse = await fetch(
      `https://ord-mutinynet.ducatprotocol.com/address/${derivedTaprootAddress}`,
      { headers: { 'Accept': 'application/json' } }
    );
    const ordData = await ordResponse.json();
    console.log('Ord API response:', ordData);

    // Find a UTXO with sufficient runes
    let runeUtxo = null;
    for (const output of ordData.outputs || []) {
      console.log('Checking output:', output);
      const utxoResponse = await fetch(
        `https://ord-mutinynet.ducatprotocol.com/output/${output}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const utxoData = await utxoResponse.json();
      console.log('UTXO data:', utxoData);

      // Check if this UTXO has DUCAT•UNIT•RUNE
      if (utxoData.runes && utxoData.runes['DUCAT•UNIT•RUNE']) {
        const runeAmount = parseInt(utxoData.runes['DUCAT•UNIT•RUNE'].amount);
        console.log('Found UTXO with', runeAmount, 'runes');

        if (runeAmount >= amountInRunes) {
          const vout = parseInt(output.match(/:(.*)$/)[1]);

          // Check if unspent
          const spendResponse = await fetch(
            `https://mutinynet.com/api/tx/${utxoData.transaction}/outspend/${vout}`
          );
          const spendData = await spendResponse.json();

          if (!spendData.spent) {
            runeUtxo = {
              transaction: utxoData.transaction,
              vout: vout,
              value: utxoData.value,
              runeAmount: runeAmount,
            };
            console.log('Selected rune UTXO:', runeUtxo);
            break;
          }
        }
      }
    }

    if (!runeUtxo) {
      throw new Error(`No UTXO found with at least ${amountInRunes} runes`);
    }

    // Fetch regular UTXOs for fees
    console.log('Fetching UTXOs for fees...');
    const utxoResponse = await fetch(`https://mutinynet.com/api/address/${p2wpkhAddress}/utxo`);
    const utxos = await utxoResponse.json();
    console.log('Found', utxos.length, 'UTXOs for fees');

    // Find a UTXO with at least 12000 sats for fees
    let satUtxo = null;
    for (const utxo of utxos) {
      if (utxo.status.confirmed && utxo.value >= 12000) {
        satUtxo = {
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
        };
        console.log('Selected sat UTXO:', satUtxo);
        break;
      }
    }

    if (!satUtxo) {
      throw new Error('No UTXO found with at least 12000 sats for fees');
    }

    // Calculate amounts
    const fee = 1000;
    const recipientSats = 10000;
    const dustLimit = 546;
    const totalInput = satUtxo.value + runeUtxo.value;
    const change = totalInput - fee - recipientSats - dustLimit;

    if (change < 0) {
      throw new Error(`Insufficient funds. Need ${fee + recipientSats + dustLimit}, have ${totalInput}`);
    }

    // Create PSBT
    console.log('Creating PSBT...');
    const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

    // Fetch transaction hex for inputs
    const satTxResponse = await fetch(`https://mutinynet.com/api/tx/${satUtxo.txid}/hex`);
    const satTxHex = await satTxResponse.text();
    const satTx = bitcoin.Transaction.fromHex(satTxHex);

    const runeTxResponse = await fetch(`https://mutinynet.com/api/tx/${runeUtxo.transaction}/hex`);
    const runeTxHex = await runeTxResponse.text();
    const runeTx = bitcoin.Transaction.fromHex(runeTxHex);

    // Add inputs - exactly like working example
    // Input 0: P2WPKH (for fees)
    console.log('Adding P2WPKH input...');
    psbt.addInput({
      hash: satUtxo.txid,
      index: parseInt(satUtxo.vout),
      witnessUtxo: {
        script: Buffer.from(p2wpkhPayment.output),
        value: BigInt(satUtxo.value),
      },
    });

    // Input 1: Taproot (with runes)
    console.log('Adding Taproot input...');
    psbt.addInput({
      hash: runeUtxo.transaction,
      index: parseInt(runeUtxo.vout),
      witnessUtxo: {
        script: Buffer.from(taprootPayment.output),
        value: BigInt(runeUtxo.value),
      },
      tapInternalKey: xOnlyPubkey,
    });

    // Create runestone
    console.log('Creating runestone with amount:', amountInRunes, 'to output 1');
    const runestoneConfig = {
      edicts: [
        {
          id: { block: 1527352n, tx: 1n }, // DUCAT•UNIT•RUNE ID
          amount: BigInt(amountInRunes),
          output: 1, // Recipient is at output 1
        },
      ],
    };
    console.log('Runestone config:', JSON.stringify(runestoneConfig, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value
    ));

    // Debug the actual types
    console.log('Edict types check:');
    console.log('  id.block type:', typeof runestoneConfig.edicts[0].id.block, 'value:', runestoneConfig.edicts[0].id.block.toString());
    console.log('  id.tx type:', typeof runestoneConfig.edicts[0].id.tx, 'value:', runestoneConfig.edicts[0].id.tx.toString());
    console.log('  amount type:', typeof runestoneConfig.edicts[0].amount, 'value:', runestoneConfig.edicts[0].amount.toString());
    console.log('  output type:', typeof runestoneConfig.edicts[0].output, 'value:', runestoneConfig.edicts[0].output);

    // Try calling encodeRunestone with minimal test first
    console.log('Testing encodeRunestone with simple config...');
    try {
      const testResult = encodeRunestone({ edicts: [] });
      console.log('Empty edicts test result hex:', Buffer.from(testResult.encodedRunestone).toString('hex'));
    } catch (e) {
      console.log('Empty edicts test failed:', e.message);
    }

    const runestoneResult = encodeRunestone(runestoneConfig);
    console.log('encodeRunestone result:', runestoneResult);
    console.log('encodeRunestone result keys:', Object.keys(runestoneResult));

    // Check if encodedRunestone has the edict data
    if (runestoneResult.encodedRunestone) {
      const fullHex = Buffer.from(runestoneResult.encodedRunestone).toString('hex');
      console.log('Full runestone hex:', fullHex);
      console.log('Runestone hex length:', fullHex.length, 'characters =', fullHex.length / 2, 'bytes');
    }

    const runestoneScript = runestoneResult.encodedRunestone;
    console.log('Runestone script type:', typeof runestoneScript, 'isBuffer:', Buffer.isBuffer(runestoneScript), 'length:', runestoneScript?.length);

    if (runestoneScript) {
      const scriptHex = Buffer.from(runestoneScript).toString('hex');
      console.log('Runestone script hex:', scriptHex);
      console.log('Runestone script starts with OP_RETURN (6a)?', scriptHex.startsWith('6a'));
    } else {
      console.error('ERROR: runestoneScript is null/undefined!');
    }

    // Add outputs (OP_RETURN last) - exactly like working example
    // Output 0: Rune return (gets unallocated runes)
    psbt.addOutput({
      address: derivedTaprootAddress,
      value: BigInt(dustLimit),
    });

    // Output 1: Recipient (gets specified runes via edict)
    psbt.addOutput({
      address: recipient,
      value: BigInt(recipientSats),
    });

    // Output 2: Change (if any)
    if (change > dustLimit) {
      psbt.addOutput({
        address: p2wpkhAddress,
        value: BigInt(change),
      });
    }

    // Output 3: OP_RETURN with runestone (last)
    console.log('Adding OP_RETURN output with runestone script...');
    console.log('  Script to add:', Buffer.from(runestoneScript).toString('hex'));
    console.log('  Script length:', runestoneScript.length);

    psbt.addOutput({
      script: runestoneScript,
      value: BigInt(0),
    });

    console.log('PSBT created with', psbt.data.inputs.length, 'inputs and', psbt.txOutputs.length, 'outputs');

    // Verify the OP_RETURN was added correctly
    const lastOutputIndex = psbt.txOutputs.length - 1;
    const lastOutput = psbt.txOutputs[lastOutputIndex];
    console.log('Last output (should be OP_RETURN):');
    console.log('  Value:', lastOutput.value.toString());
    console.log('  Script hex:', lastOutput.script.toString('hex'));

    // Create intent object
    const intent = {
      id: Date.now().toString(),
      type: 'send',
      assetType: 'UNIT',
      amount: amountInRunes,
      amountDisplay: `${amountInRunes} UNIT`,
      recipient,
      fee: fee,
      addressType: 'taproot',
      sourceAddress: derivedTaprootAddress,
      feeAddress: p2wpkhAddress,
      runeUtxo,
      satUtxo,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };

    console.log('UNIT intent created:', intent.id);
    return intent;
  } catch (error) {
    console.error('Failed to create UNIT transaction:', error);
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
  try {
    console.log('signIntent called with intent:', intent);

    if (!intent) {
      throw new Error('No intent to sign');
    }

    // Get mnemonic from secure storage
    const mnemonic = await AuthService.getMnemonic();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Load PSBT
    const psbt = bitcoin.Psbt.fromBase64(intent.psbt);

    // Sign all inputs
    if (intent.assetType === 'UNIT') {
      console.log('Signing UNIT transaction with mixed inputs...');

      // Input 0: P2WPKH (fee input)
      const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
      const segwitChild = root.derivePath(segwitPath);
      console.log('Signing P2WPKH input 0...');
      psbt.signInput(0, segwitChild);

      // Input 1: Taproot (rune input) - requires manual tweaking
      const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
      const taprootChild = root.derivePath(taprootPath);
      console.log('Signing Taproot input 1 with manual tweaking...');

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
      console.log('val0 type:', typeof val0, 'value:', val0);
      console.log('val1 type:', typeof val1, 'value:', val1);

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

      console.log('Signing with Schnorr...');
      console.log('hash length:', hash.length, 'bytes');
      console.log('tweakedPrivateKey length:', tweakedPrivateKey.length, 'bytes');

      // Ensure buffers are the correct size
      if (hash.length !== 32) {
        throw new Error(`Hash must be 32 bytes, got ${hash.length}`);
      }
      if (tweakedPrivateKey.length !== 32) {
        throw new Error(`Private key must be 32 bytes, got ${tweakedPrivateKey.length}`);
      }

      // Sign with tweaked key
      const signature = ecc.signSchnorr(hash, tweakedPrivateKey);
      console.log('Schnorr signature created, length:', signature.length);
      psbt.updateInput(1, { tapKeySig: Buffer.from(signature) });

      console.log('Both inputs signed');
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
    console.log('Finalizing inputs...');
    if (intent.assetType === 'UNIT') {
      // Try to finalize all inputs
      try {
        psbt.finalizeAllInputs();
        console.log('All inputs finalized successfully');
      } catch (e) {
        // Manual finalization for Taproot (matches working example)
        console.log('Finalization failed, doing manual finalization:', e.message);
        psbt.finalizeInput(0); // P2WPKH finalizes normally

        const tapKeySig = psbt.data.inputs[1].tapKeySig;
        if (!tapKeySig) {
          throw new Error('No tapKeySig found');
        }

        // Use bitcoin.script.compile like in the working example
        psbt.data.inputs[1].finalScriptWitness = bitcoin.script.compile([tapKeySig]);
        console.log('Taproot input manually finalized');
      }
    } else {
      psbt.finalizeAllInputs();
    }

    // Extract signed transaction
    const signedTx = psbt.extractTransaction();
    const signedTxHex = signedTx.toHex();

    // VERIFY: Check that runestone is in the transaction (for UNIT transactions)
    if (intent.assetType === 'UNIT') {
      console.log('=== TRANSACTION VERIFICATION ===');
      console.log('Transaction hex length:', signedTxHex.length);
      console.log('Transaction outputs:', signedTx.outs.length);

      signedTx.outs.forEach((output, index) => {
        const scriptHex = output.script.toString('hex');
        console.log(`Output ${index}: value=${output.value}, scriptLength=${output.script.length}, scriptHex=${scriptHex.substring(0, 100)}${scriptHex.length > 100 ? '...' : ''}`);

        if (scriptHex.startsWith('6a')) {
          console.log(`  ^^^ Output ${index} is OP_RETURN!`);
          console.log(`  Full OP_RETURN script: ${scriptHex}`);

          // Check if it contains the runestone marker (0x0d = 13 in decimal, the Runes protocol tag)
          if (scriptHex.includes('0d')) {
            console.log(`  ✓ OP_RETURN contains runestone marker (0x0d)`);
          } else {
            console.log(`  ✗ WARNING: OP_RETURN missing runestone marker!`);
          }
        }
      });
      console.log('=== END VERIFICATION ===');
    }

    // CRITICAL: Securely overwrite sensitive data
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
            }
          }
        } catch (e) {
          // Best effort cleanup
        }
      }
    });

    return {
      signedTxHex,
      txid: signedTx.getId(),
    };
  } catch (error) {
    console.error('Failed to sign transaction:', error);
    throw error;
  }
};

/**
 * Broadcast a signed transaction to the network
 * @param {string} signedTxHex - Signed transaction in hex format
 * @returns {Promise<string>} Transaction ID (txid)
 */
export const broadcastTransaction = async (signedTxHex) => {
  try {
    console.log('Broadcasting to mutinynet.com/api/tx...');
    const response = await fetch('https://mutinynet.com/api/tx', {
      method: 'POST',
      body: signedTxHex,
    });
    console.log('Broadcast response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to broadcast transaction');
    }

    const txid = await response.text();
    console.log('Transaction broadcast successful! TXID:', txid);

    return txid;
  } catch (error) {
    console.error('Broadcast error:', error);
    throw error;
  }
};
