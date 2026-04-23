import { Buffer } from 'node:buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import { BRIDGE_CONFIG } from './config';
import { microsToMutinynetBaseUnits, mutinynetBaseUnitsToMicros } from './amounts';

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

const MUTINYNET_NETWORK: bitcoin.Network = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

const UNIT_RUNE_LABEL = BRIDGE_CONFIG.mutinynet.unitRuneLabel;

interface OrdAddressResponse {
  outputs?: string[];
}

interface OrdOutputResponse {
  transaction: string;
  value: number;
  address?: string;
  runes?: Record<string, { amount: string }>;
}

interface EsploraTxStatusResponse {
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
}

interface EsploraUtxo {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

interface FeeRecommendationResponse {
  fastestFee?: number;
  halfHourFee?: number;
  hourFee?: number;
  minimumFee?: number;
}

interface FaucetApiResponse {
  data?: {
    tx_id?: string;
    timeout?: number | null;
  };
}

interface SelectedRuneInput {
  txid: string;
  vout: number;
  value: number;
  amountRaw: bigint;
  addressIndex: number;
  address: string;
}

interface FeeInput {
  txid: string;
  vout: number;
  value: number;
}

interface ReleaseBuildParams {
  destinationTaprootAddress: string;
  amountMicros: bigint;
  knownDepositIndexes: number[];
}

export interface DetectedDeposit {
  txid: string;
  amountMicros: bigint;
  confirmations: number;
  exactMatch: boolean;
}

const DUMMY_CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX';
const FEE_AIRDROP_COOLDOWN_MS = 5 * 60 * 1000;
let lastFeeAirdropRequestAt = 0;

function deriveRoot(): ReturnType<typeof bip32.fromSeed> {
  if (!BRIDGE_CONFIG.mutinynet.bridgeMnemonic) {
    throw new Error('UNIT_BRIDGE_MUTINYNET_MNEMONIC is not configured');
  }

  const seed = bip39.mnemonicToSeedSync(BRIDGE_CONFIG.mutinynet.bridgeMnemonic);
  return bip32.fromSeed(seed, MUTINYNET_NETWORK);
}

function taprootChild(index: number) {
  const root = deriveRoot();
  return root.derivePath(`m/86'/1'/${BRIDGE_CONFIG.mutinynet.bridgeAccount}'/0/${index}`);
}

function segwitChild(index: number) {
  const root = deriveRoot();
  return root.derivePath(`m/84'/1'/${BRIDGE_CONFIG.mutinynet.bridgeAccount}'/0/${index}`);
}

function encodeRunestone(edictAmount: bigint): Buffer {
  const payload: number[] = [];
  const pushVarint = (value: bigint) => {
    let current = BigInt(value);
    while (current >= 128n) {
      payload.push(Number(current & 127n) | 128);
      current >>= 7n;
    }
    payload.push(Number(current));
  };

  pushVarint(0n);
  pushVarint(1527352n);
  pushVarint(1n);
  pushVarint(edictAmount);
  pushVarint(1n);

  const payloadBuffer = Buffer.from(payload);
  return Buffer.concat([
    Buffer.from([0x6a, 0x5d, payloadBuffer.length]),
    payloadBuffer,
  ]);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json() as Promise<T>;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function requestFeeAirdropIfNeeded(address: string): Promise<boolean> {
  if (!BRIDGE_CONFIG.mutinynet.faucetUrl) {
    return false;
  }

  const now = Date.now();
  if (now - lastFeeAirdropRequestAt < FEE_AIRDROP_COOLDOWN_MS) {
    return false;
  }

  lastFeeAirdropRequestAt = now;

  try {
    const response = await fetch(BRIDGE_CONFIG.mutinynet.faucetUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        captchaToken: DUMMY_CAPTCHA,
        network: 'mutinynet',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = (await response.json()) as FaucetApiResponse;
    return Boolean(json.data?.tx_id);
  } catch {
    return false;
  }
}

export function deriveDepositAddress(index: number): string {
  const child = taprootChild(index);
  const payment = bitcoin.payments.p2tr({
    internalPubkey: child.publicKey.slice(1, 33),
    network: MUTINYNET_NETWORK,
  });
  if (!payment.address) {
    throw new Error(`Failed to derive deposit address for index ${index}`);
  }
  return payment.address;
}

export function deriveFeeAddress(index = BRIDGE_CONFIG.mutinynet.feeAddressIndex): string {
  const child = segwitChild(index);
  const payment = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: MUTINYNET_NETWORK,
  });
  if (!payment.address) {
    throw new Error(`Failed to derive fee address for index ${index}`);
  }
  return payment.address;
}

export async function detectDepositForAddress(
  address: string,
  expectedMicros: bigint,
): Promise<DetectedDeposit | null> {
  const addressData = await fetchJson<OrdAddressResponse>(`${BRIDGE_CONFIG.mutinynet.ordBaseUrl}/address/${address}`, {
    headers: { Accept: 'application/json' },
  });
  const outputs = addressData.outputs || [];
  if (outputs.length === 0) {
    return null;
  }

  const matchedOutputs: DetectedDeposit[] = [];
  for (const output of outputs) {
    const [txid, voutRaw] = output.split(':');
    const outputData = await fetchJson<OrdOutputResponse>(`${BRIDGE_CONFIG.mutinynet.ordBaseUrl}/output/${output}`, {
      headers: { Accept: 'application/json' },
    });
    const runeAmountRaw = BigInt(outputData.runes?.[UNIT_RUNE_LABEL]?.amount || '0');
    if (runeAmountRaw === 0n) {
      continue;
    }

    const txStatus = await fetchJson<EsploraTxStatusResponse>(`${BRIDGE_CONFIG.mutinynet.esploraBaseUrl}/tx/${txid}`);
    const confirmations = txStatus.status.confirmed ? BRIDGE_CONFIG.confirmationThreshold : 0;
    matchedOutputs.push({
      txid,
      amountMicros: mutinynetBaseUnitsToMicros(runeAmountRaw),
      confirmations,
      exactMatch: mutinynetBaseUnitsToMicros(runeAmountRaw) === expectedMicros,
    });

    if (Number(voutRaw) < 0) {
      throw new Error(`Invalid ord output reference ${output}`);
    }
  }

  if (matchedOutputs.length === 0) {
    return null;
  }

  if (matchedOutputs.length > 1) {
    const totalMicros = matchedOutputs.reduce((sum, deposit) => sum + deposit.amountMicros, 0n);
    return {
      txid: matchedOutputs.map((deposit) => deposit.txid).join(','),
      amountMicros: totalMicros,
      confirmations: Math.min(...matchedOutputs.map((deposit) => deposit.confirmations)),
      exactMatch: false,
    };
  }

  return matchedOutputs[0];
}

async function getRecommendedFeeRate(): Promise<number> {
  try {
    const data = await fetchJson<FeeRecommendationResponse>(BRIDGE_CONFIG.mutinynet.feeRecommendationsUrl);
    return Math.max(1, Math.ceil(data.halfHourFee || data.hourFee || data.minimumFee || 1));
  } catch {
    return 1;
  }
}

async function selectRuneInputs(indexes: number[], targetMicros: bigint): Promise<SelectedRuneInput[]> {
  const requiredRaw = microsToMutinynetBaseUnits(targetMicros);
  const selected: SelectedRuneInput[] = [];
  let totalRaw = 0n;

  for (const index of indexes) {
    const address = deriveDepositAddress(index);
    const addressData = await fetchJson<OrdAddressResponse>(`${BRIDGE_CONFIG.mutinynet.ordBaseUrl}/address/${address}`, {
      headers: { Accept: 'application/json' },
    });

    for (const output of addressData.outputs || []) {
      const [txid, voutRaw] = output.split(':');
      const outputData = await fetchJson<OrdOutputResponse>(`${BRIDGE_CONFIG.mutinynet.ordBaseUrl}/output/${output}`, {
        headers: { Accept: 'application/json' },
      });
      const amountRaw = BigInt(outputData.runes?.[UNIT_RUNE_LABEL]?.amount || '0');
      if (amountRaw === 0n) {
        continue;
      }

      const spendData = await fetchJson<{ spent: boolean }>(`${BRIDGE_CONFIG.mutinynet.esploraBaseUrl}/tx/${txid}/outspend/${voutRaw}`);
      if (spendData.spent) {
        continue;
      }

      const txStatus = await fetchJson<EsploraTxStatusResponse>(`${BRIDGE_CONFIG.mutinynet.esploraBaseUrl}/tx/${txid}`);
      if (!txStatus.status.confirmed) {
        continue;
      }

      selected.push({
        txid,
        vout: Number(voutRaw),
        value: outputData.value,
        amountRaw,
        addressIndex: index,
        address,
      });
      totalRaw += amountRaw;
      if (totalRaw >= requiredRaw) {
        return selected;
      }
    }
  }

  throw new Error('Insufficient confirmed custody UNIT for release');
}

async function selectFeeInput(): Promise<FeeInput> {
  const feeAddress = deriveFeeAddress();
  const utxos = await fetchJson<EsploraUtxo[]>(`${BRIDGE_CONFIG.mutinynet.esploraBaseUrl}/address/${feeAddress}/utxo`);
  const confirmed = utxos.filter((utxo) => utxo.status.confirmed);
  const selected = confirmed.sort((left, right) => right.value - left.value)[0];
  if (!selected) {
    if (utxos.some((utxo) => !utxo.status.confirmed)) {
      throw new Error('BTC fee UTXO is awaiting confirmation for custody releases');
    }

    const requested = await requestFeeAirdropIfNeeded(feeAddress);
    if (requested) {
      throw new Error('Requested BTC fee UTXO for custody releases; waiting for confirmation');
    }

    throw new Error('No confirmed BTC fee UTXO is available for custody releases');
  }
  return {
    txid: selected.txid,
    vout: selected.vout,
    value: selected.value,
  };
}

function estimateFeeSats(runeInputCount: number, hasChange: boolean, feeRate: number): number {
  const outputs = hasChange ? 4 : 3;
  const vbytes = 10 + 68 + (runeInputCount * 58) + (outputs * 43) + 20;
  return Math.ceil(vbytes * feeRate);
}

export async function buildAndBroadcastReleaseTransaction(params: ReleaseBuildParams): Promise<string> {
  const runeInputs = await selectRuneInputs(params.knownDepositIndexes, params.amountMicros);
  const feeInput = await selectFeeInput();
  const feeRate = await getRecommendedFeeRate();

  const runeAmountRaw = microsToMutinynetBaseUnits(params.amountMicros);
  const totalRuneValue = runeInputs.reduce((sum, input) => sum + input.value, 0);
  const totalRuneRaw = runeInputs.reduce((sum, input) => sum + input.amountRaw, 0n);
  const feeEstimate = estimateFeeSats(runeInputs.length, true, feeRate);

  const recipientPostage = 10_000;
  const runeReturnPostage = 10_000;
  const totalInput = feeInput.value + totalRuneValue;
  const provisionalChange = totalInput - recipientPostage - runeReturnPostage - feeEstimate;
  const hasChange = provisionalChange >= 546;
  const fee = estimateFeeSats(runeInputs.length, hasChange, feeRate);
  const change = totalInput - recipientPostage - runeReturnPostage - fee;

  if (change < 0) {
    throw new Error('Insufficient BTC to cover release transaction fees');
  }

  const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });
  const feeTxHex = await fetchText(`${BRIDGE_CONFIG.mutinynet.esploraBaseUrl}/tx/${feeInput.txid}/hex`);
  const feeTx = bitcoin.Transaction.fromHex(feeTxHex);
  psbt.addInput({
    hash: feeInput.txid,
    index: feeInput.vout,
    witnessUtxo: {
      script: feeTx.outs[feeInput.vout].script,
      value: BigInt(feeInput.value),
    },
  });

  for (const input of runeInputs) {
    const inputTxHex = await fetchText(`${BRIDGE_CONFIG.mutinynet.esploraBaseUrl}/tx/${input.txid}/hex`);
    const inputTx = bitcoin.Transaction.fromHex(inputTxHex);
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: {
        script: inputTx.outs[input.vout].script,
        value: BigInt(input.value),
      },
      tapInternalKey: taprootChild(input.addressIndex).publicKey.slice(1, 33),
    });
  }

  const returnAddress = runeInputs[0]?.address || deriveDepositAddress(0);
  psbt.addOutput({ address: returnAddress, value: BigInt(runeReturnPostage) });
  psbt.addOutput({ address: params.destinationTaprootAddress, value: BigInt(recipientPostage) });
  if (change >= 546) {
    psbt.addOutput({ address: deriveFeeAddress(), value: BigInt(change) });
  }
  psbt.addOutput({ script: encodeRunestone(runeAmountRaw), value: 0n });

  const feeSigner = segwitChild(BRIDGE_CONFIG.mutinynet.feeAddressIndex);
  psbt.signInput(0, feeSigner);

  for (let index = 0; index < runeInputs.length; index += 1) {
    const child = taprootChild(runeInputs[index].addressIndex);
    const tweakedSigner = child.tweak(bitcoin.crypto.taggedHash('TapTweak', child.publicKey.slice(1, 33)));
    psbt.signInput(index + 1, tweakedSigner);
  }

  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  const txid = await fetchText(`${BRIDGE_CONFIG.mutinynet.esploraBaseUrl}/tx`, {
    method: 'POST',
    body: txHex,
  });

  const spentRaw = totalRuneRaw - runeAmountRaw;
  if (spentRaw < 0n) {
    throw new Error('Release transaction consumed fewer runes than requested');
  }

  return txid.trim();
}
