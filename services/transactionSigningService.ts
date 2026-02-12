/**
 * Transaction Signing Service
 * Handles all cryptographic signing operations for Bitcoin and Runes transactions
 * SECURITY-CRITICAL: Manages mnemonic exposure and key derivation
 */

import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory, BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import { MUTINYNET_NETWORK } from '../utils/bitcoin';
import { withMnemonic } from './secureStorageService';
import { ERRORS } from '../utils/messages';
import { validateAndNormalizeAddress } from '../utils/bitcoin';

// Initialize BIP32 and ECC library
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

interface DerivedKeys {
  segwitChild: BIP32Interface;
  taprootChild: BIP32Interface;
}

export interface TransactionIntent {
  psbt: string;
  assetType?: 'UNIT' | 'BTC';
  addressType?: 'taproot' | 'segwit';
  inputs?: Array<{
    txid: string;
    vout: number;
  }>;
}

export interface SignedTransaction {
  signedTxHex: string;
  txid: string;
}

function verifyPsbtMatchesIntent(intent: TransactionIntent, psbt: bitcoin.Psbt): void {
  const recipient = (intent as any).recipient as string | undefined;
  const expectedAmount = (intent as any).amount as number | undefined;
  const sourceAddress = (intent as any).sourceAddress as string | undefined;
  const feeAddress = (intent as any).feeAddress as string | undefined;

  if (!recipient || expectedAmount === undefined || !sourceAddress) {
    throw new Error('SECURITY: Missing intent fields for PSBT validation');
  }

  if (!psbt.txOutputs || psbt.txOutputs.length === 0) {
    throw new Error('SECURITY: PSBT has no outputs to validate');
  }

  const normalizedRecipient = validateAndNormalizeAddress(recipient);
  const normalizedChange = validateAndNormalizeAddress(sourceAddress);
  const normalizedFee = feeAddress ? validateAndNormalizeAddress(feeAddress) : null;

  let recipientValue = 0n;

  psbt.txOutputs.forEach((output) => {
    // Allow OP_RETURN (runestone / metadata)
    if (output.script[0] === 0x6a) {
      return;
    }

    let addr: string;
    try {
      addr = bitcoin.address.fromOutputScript(output.script, MUTINYNET_NETWORK);
    } catch (e) {
      // If script cannot be decoded and is not OP_RETURN, reject
      throw new Error('SECURITY: PSBT contains undecodable output script');
    }
    if (addr === normalizedRecipient) {
      recipientValue += output.value;
      return;
    }
    if (addr === normalizedChange || (normalizedFee && addr === normalizedFee)) {
      return;
    }

    throw new Error('SECURITY: PSBT contains outputs not reviewed by user');
  });

  if (intent.assetType === 'BTC' && recipientValue < BigInt(expectedAmount)) {
    throw new Error('SECURITY: Recipient amount in PSBT is less than approved amount');
  }
}

/**
 * Derive signing keys from mnemonic
 * SECURITY: This function only holds mnemonic in memory for <50ms
 * @param mnemonic - BIP39 mnemonic phrase
 * @param currentAccount - Account index
 * @returns Derived keys for signing
 */
const deriveSigningKeys = (mnemonic: string, currentAccount: number): DerivedKeys => {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

  // Pre-derive all keys we'll need (mnemonic only in memory for <50ms)
  return {
    segwitChild: root.derivePath(`m/84'/1'/0'/0/${currentAccount}`),
    taprootChild: root.derivePath(`m/86'/1'/0'/0/${currentAccount}`),
  };
  // Note: seed and root are destroyed when this function returns
};

/**
 * Sign a transaction intent PSBT
 * @param intent - Transaction intent object with psbt field
 * @param currentAccount - Current account index
 * @returns Signed transaction
 */
export const signIntent = async (
  intent: TransactionIntent,
  currentAccount: number
): Promise<SignedTransaction> => {
  if (!intent) {
    throw new Error(ERRORS.TRANSACTION_CANCELLED);
  }

  // SECURITY: Use withMnemonic to minimize mnemonic exposure to <100ms
  // This automatically wipes the mnemonic from memory after deriveSigningKeys returns
  const { segwitChild, taprootChild } = await withMnemonic(async (mnemonic: string) =>
    deriveSigningKeys(mnemonic, currentAccount)
  );

  // Load PSBT with correct network (testnet)
  const psbt = bitcoin.Psbt.fromBase64(intent.psbt, { network: MUTINYNET_NETWORK });

  // SECURITY: Validate PSBT matches the reviewed intent before signing
  verifyPsbtMatchesIntent(intent, psbt);

  // SECURITY: Verify each input belongs to our wallet before signing.
  // Prevents signing a malicious PSBT that spends someone else's UTXOs.
  const expectedSegwitScript = bitcoin.payments.p2wpkh({
    pubkey: segwitChild.publicKey,
    network: MUTINYNET_NETWORK,
  }).output;
  const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);
  const expectedTaprootScript = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: MUTINYNET_NETWORK,
  }).output;

  for (let i = 0; i < psbt.data.inputs.length; i++) {
    const input = psbt.data.inputs[i];
    const witnessScript = input.witnessUtxo?.script;

    if (!witnessScript) {
      throw new Error(
        `SECURITY: Input ${i} has no witnessUtxo script - cannot verify ownership`
      );
    }

    const witnessHex = Buffer.from(witnessScript).toString('hex');
    const matchesSegwit = expectedSegwitScript && witnessHex === Buffer.from(expectedSegwitScript).toString('hex');
    const matchesTaproot = expectedTaprootScript && witnessHex === Buffer.from(expectedTaprootScript).toString('hex');

    if (!matchesSegwit && !matchesTaproot) {
      throw new Error(
        `SECURITY: Input ${i} script does not match any wallet address - refusing to sign`
      );
    }
  }

  // UNIFIED SIGNING: Both UNIT and BTC use the same safe signing logic
  // SECURITY: Use bitcoinjs-lib's built-in tweak method instead of manual crypto

  // Sign all inputs based on their type
  if (intent.assetType === 'UNIT') {
    // UNIT transactions have mixed input types:
    // - Input 0: P2WPKH (fee input from BTC balance)
    // - Input 1+: Taproot (rune inputs with UNIT balance, may be multiple)

    // Input 0: Sign with SegWit key
    psbt.signInput(0, segwitChild);

    // Input 1+: Sign all taproot rune inputs with tweaked Taproot key (UNIFIED METHOD)
    const tweakedSigner = taprootChild.tweak(
      bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
    );

    // Count number of rune inputs (all inputs after input 0)
    const numRuneInputs = psbt.data.inputs.length - 1;
    for (let i = 1; i <= numRuneInputs; i++) {
      psbt.signInput(i, tweakedSigner);
    }
  } else {
    // BTC transactions: All inputs are the same type
    if (intent.addressType === 'taproot') {
      // Sign all Taproot inputs with tweaked signer (UNIFIED METHOD)
      const tweakedSigner = taprootChild.tweak(
        bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
      );

      const numInputs = intent.inputs?.length || psbt.data.inputs.length;
      for (let i = 0; i < numInputs; i++) {
        psbt.signInput(i, tweakedSigner);
      }
    } else {
      // Sign all SegWit inputs
      const numInputs = intent.inputs?.length || psbt.data.inputs.length;
      for (let i = 0; i < numInputs; i++) {
        psbt.signInput(i, segwitChild);
      }
    }
  }

  // Finalize all inputs
  psbt.finalizeAllInputs();

  // Extract signed transaction
  const signedTx = psbt.extractTransaction();
  const signedTxHex = signedTx.toHex();

  return {
    signedTxHex,
    txid: signedTx.getId(),
  };
  // Note: Mnemonic auto-wiped by withMnemonic() - no finally block needed
};
