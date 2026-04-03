/**
 * Transaction Signing Service
 * Handles all cryptographic signing operations for Bitcoin and Runes transactions
 * SECURITY-CRITICAL: Manages mnemonic exposure and key derivation
 */

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory, BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import { getDerivationPathForType, type WalletDerivationMode } from '../constants/bitcoin';
import { MUTINYNET_NETWORK } from '../utils/bitcoin';
import { withMnemonic } from './secureStorageService';
import { getWalletDerivationMode } from './walletDerivationService';
import { ERRORS } from '../utils/messages';
import { validateAndNormalizeAddress } from '../utils/bitcoin';
import { validateSighashType } from './signing/cryptoUtils';
import { RUNES_CONFIG } from '../utils/constants';
import { decodeRunestone } from '../utils/runestoneEncoder';

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
  recipient?: string;
  amount?: number;
  sourceAddress?: string;
  feeAddress?: string;
  inputs?: Array<{
    txid: string;
    vout: number;
  }>;
}

export interface SignedTransaction {
  signedTxHex: string;
  txid: string;
}

interface DecodedRunestoneEdict {
  id: {
    block: bigint;
    tx: bigint;
  };
  amount: bigint;
  output: bigint;
}

interface DecodedRunestone {
  edicts?: DecodedRunestoneEdict[];
}

function verifyUnitRunestone(
  psbt: bitcoin.Psbt,
  intent: TransactionIntent,
  recipientOutputIndexes: number[]
): void {
  const opReturnIndexes: number[] = [];

  psbt.txOutputs.forEach((output, index) => {
    if (output.script[0] === 0x6a) {
      opReturnIndexes.push(index);
    }
  });

  if (opReturnIndexes.length !== 1) {
    throw new Error('SECURITY: UNIT PSBT must contain exactly one runestone OP_RETURN output');
  }

  const runestoneOutput = psbt.txOutputs[opReturnIndexes[0]];
  const decoded = decodeRunestone(Buffer.from(runestoneOutput.script)) as DecodedRunestone | null;

  if (!decoded || !Array.isArray(decoded.edicts) || decoded.edicts.length !== 1) {
    throw new Error('SECURITY: UNIT PSBT has an invalid or unexpected runestone payload');
  }

  const [edict] = decoded.edicts;
  const expectedAmount = BigInt(intent.amount!);
  const expectedRuneId = RUNES_CONFIG.DUCAT_UNIT_RUNE_ID;

  if (
    edict.id.block !== expectedRuneId.block ||
    edict.id.tx !== expectedRuneId.tx
  ) {
    throw new Error('SECURITY: UNIT PSBT runestone does not match the approved rune ID');
  }

  if (edict.amount !== expectedAmount) {
    throw new Error('SECURITY: UNIT PSBT runestone amount does not match the approved amount');
  }

  if (!recipientOutputIndexes.includes(Number(edict.output))) {
    throw new Error('SECURITY: UNIT PSBT runestone points to an unapproved recipient output');
  }
}

function verifyPsbtMatchesIntent(intent: TransactionIntent, psbt: bitcoin.Psbt): void {
  const recipient = intent.recipient;
  const expectedAmount = intent.amount;
  const sourceAddress = intent.sourceAddress;
  const feeAddress = intent.feeAddress;

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
  const recipientOutputIndexes: number[] = [];

  psbt.txOutputs.forEach((output, index) => {
    if (output.script[0] === 0x6a) {
      if (intent.assetType !== 'UNIT') {
        throw new Error('SECURITY: BTC PSBT contains unexpected OP_RETURN output');
      }
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
      recipientOutputIndexes.push(index);
      return;
    }
    if (addr === normalizedChange || (normalizedFee && addr === normalizedFee)) {
      return;
    }

    throw new Error('SECURITY: PSBT contains outputs not reviewed by user');
  });

  if (intent.assetType === 'UNIT') {
    if (recipientOutputIndexes.length === 0) {
      throw new Error('SECURITY: UNIT PSBT is missing the reviewed recipient output');
    }

    verifyUnitRunestone(psbt, intent, recipientOutputIndexes);
    return;
  }

  if (recipientValue < BigInt(expectedAmount)) {
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
const deriveSigningKeys = (
  mnemonic: string,
  currentAccount: number,
  derivationMode: WalletDerivationMode
): DerivedKeys => {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

  return {
    segwitChild: root.derivePath(getDerivationPathForType('segwit', currentAccount, derivationMode)),
    taprootChild: root.derivePath(getDerivationPathForType('taproot', currentAccount, derivationMode)),
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

  const derivationMode = await getWalletDerivationMode();

  // SECURITY: Use withMnemonic to minimize mnemonic exposure to <100ms
  // This automatically wipes the mnemonic from memory after deriveSigningKeys returns
  const { segwitChild, taprootChild } = await withMnemonic(async (mnemonic: string) =>
    deriveSigningKeys(mnemonic, currentAccount, derivationMode)
  );

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

  // SECURITY: Validate sighash types on all inputs before signing
  for (let i = 0; i < psbt.data.inputs.length; i++) {
    const inp = psbt.data.inputs[i];
    const scriptHex = Buffer.from(inp.witnessUtxo!.script).toString('hex');
    const isTaproot = scriptHex.startsWith('5120');
    validateSighashType(inp.sighashType, isTaproot ? 'taproot' : 'segwit');
  }

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
