/**
 * Tests for executeLiquidation
 *
 * Covers every branch of the 9-step liquidation execution flow:
 *   1. Oracle price quote
 *   2. Create VaultWallet + fetch contract
 *   3. Fetch vault history + build VaultProfile
 *   4. Compute deposit_amount
 *   5. Build liquidation context
 *   6. Build vault repo context
 *   7. Fetch & select UTXOs
 *   8. Create PSBTs, batch sign, build request
 *   9. Submit to Guardian
 */

import { executeLiquidation } from '../execution';
import type { LiquidationExecutionParams } from '../execution';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../utils/vaultUtils');
jest.mock('../../oracleService');
jest.mock('../../guardianService');
jest.mock('../../transactionHistoryService');
jest.mock('../../vaultWallet');
jest.mock('../../vaultWallet/signingContext');
jest.mock('../../vault/utils');
jest.mock('../../vaultService');
jest.mock('../calculations');
jest.mock('../swapService', () => ({
  fetchSwapPsbt: jest.fn().mockResolvedValue(null),
  createSwapPayload: jest.fn((payload) => ({
    utxos: payload.extraUtxos ? [payload.changeUtxo, ...payload.extraUtxos] : [],
    amt_to_transfer: payload.swapBtcAmount,
    unit_amt: Math.round(payload.swapClaimedUnit * 100),
    payment_address: payload.paymentAddress,
    ordinals_address: payload.ordinalsAddress,
    btc_price: payload.btcPrice,
    vault_id: payload.vaultTxId,
  })),
  calculateSwapBtcAmount: jest.fn(() => 0.001),
  finalizeSwapPsbt: jest.fn(() => 'swap_tx_hex'),
  validateSwapPsbtUnitPayout: jest.fn(),
}));

jest.mock('@ducat-unit/client-sdk', () => ({
  CONST: {
    TXMAP: {
      repo: {
        vault_tx: {
          vin: { vault: 0, conn: 1 },
        },
      },
    },
  },
  VaultAPI: {
    repo: {
      liquidation: {
        get_ctx: jest.fn(),
      },
      create_psbt1: jest.fn(),
      create_psbt2: jest.fn(),
      create_req: jest.fn(),
    },
  },
  select_sat_utxos: jest.fn(),
}));

// Required because vaultWallet/signingContext.ts → vaultWallet/walletApi.ts imports this
jest.mock('@ducat-unit/client-sdk/util', () => ({
  TX: {
    parse_address: jest.fn(() => ({ hex: '001400112233' })),
    parse_script_meta: jest.fn(() => ({ type: 'p2w-pkh', key: { hex: 'abc123' } })),
    get_txid: jest.fn((txhex: string) => {
      if (txhex === 'signed_liquid_txhex') return 'signed_liquid_txid';
      if (txhex === 'signed_vault_txhex') return 'signed_vault_txid';
      if (txhex === 'normalized_liquid_txhex') return 'normalized_liquid_txid';
      if (txhex === 'normalized_vault_txhex') return 'normalized_vault_txid';
      return 'mock_txid';
    }),
  },
  PSBT: {
    decode: jest.fn(),
    encode: jest.fn(),
    parse: jest.fn(() => ({})),
    get: {
      txhex: jest.fn((psbt: string) => {
        if (psbt === 'signed_psbt1_base64') return 'signed_liquid_txhex';
        if (psbt === 'signed_psbt2_base64') return 'signed_vault_txhex';
        if (psbt === 'liquid_psbt_needs_normalizing') return 'normalized_liquid_txhex';
        if (psbt === 'vault_psbt_needs_normalizing') return 'normalized_vault_txhex';
        return 'mock_txhex';
      }),
    },
    extract: {
      utxo: jest.fn(() => ({
        txid: 'change-txid-001',
        vout: 1,
        value: 200_000,
        script: '0014change',
      })),
    },
  },
  hash160: jest.fn(() => 'abc123'),
  taptweak_pubkey: jest.fn(() => 'def456'),
}));

// Required by vaultWallet/index.ts and walletApi.ts (transitive deps of signingContext mock path)
jest.mock('../../../utils/constants', () => ({
  API: {
    GUARDIAN_WS: 'wss://test-guardian',
    ESPLORA_URL: 'https://test-esplora',
    ORD_URL: 'https://test-ord',
    QUOTE_SERVER: 'https://test-quote',
  },
  VAULT_CONFIG: {
    TX_TIMEOUT: 30_000,
    LIQUIDATION_RATE: 1.3,
    VIN_ALLOWANCE: 1000,
  },
}));

// Required by vaultWallet/signingContext.ts → utils/bitcoin
jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: { messagePrefix: 'test', bech32: 'tb', pubKeyHash: 0x6f },
}));

// Required by vaultWallet/walletApi.ts → services/signing
jest.mock('../../signing', () => ({
  signPsbtRaw: jest.fn(),
  signPsbtWithSdkObject: jest.fn(),
  patchPreProcessFields: jest.fn((psbt) => psbt),
  patchPostProcessFields: jest.fn((psbt) => psbt),
  psbtPreProcess: jest.fn(),
  psbtPostProcess: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// ─── Import mocked modules after jest.mock declarations ────────────────────────

import { computeLiquidationPrice } from '../../../utils/vaultUtils';
import { fetchPriceQuote } from '../../oracleService';
import { getGuardianClient, withGuardianTimeout, disconnectGuardian } from '../../guardianService';
import { registerLiquidationTxid } from '../../transactionHistoryService';
import { createVaultWallet, fetchProtocolContract } from '../../vaultWallet';
import {
  setPendingVaultSigningOperation,
  clearPendingVaultSigningOperation,
} from '../../vaultWallet/signingContext';
import {
  buildVaultProfile,
  computeVaultPrevoutFromTx,
  resolveLatestUnspentVaultPrevout,
} from '../../vault/utils';
import {
  fetchVaultHistory,
  selectLatestUsableVaultHistoryTransaction,
} from '../../vaultService';
import { signPsbtRaw } from '../../signing';
import { getAvailableCollateralBtc } from '../calculations';
import { fetchSwapPsbt, finalizeSwapPsbt } from '../swapService';
import { VaultAPI, select_sat_utxos } from '@ducat-unit/client-sdk';
import { PSBT, TX } from '@ducat-unit/client-sdk/util';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal mock liquid vault profile */
function makeLiquidVault(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vault_id: 'vault-abc',
    liquid_quote: {
      sats_balance: 200_000,
      taxable_sats: 10_000,
      unit_balance: 5000,
      coin_price: 80_000,
      subsidy_rate: 0.01,
      deficit_sats: 5000,
      profit_margin: 0.05,
    },
    ...overrides,
  };
}

/** Minimal vault history transaction */
function makeHistoryTx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    transaction_id: 'txid-history-001',
    utxo: 'txid-history-001:0',
    utxo_script: '00144444444444444444444444444444444444444444',
    liquidation_hash: 'aabbcc',
    liquidation_threshold: 70_000,
    amount_borrowed: 100,
    oracle_price: 80_000,
    timestamp: 1_700_000_000,
    action: 'Open',
    vault_amount: 1_000_000,
    ...overrides,
  };
}

/** Factory for the mock wallet object used throughout tests */
function makeMockWallet(
  overrides: {
    repoCtxReturn?: unknown;
    repoQuoteReturn?: unknown;
    satsUtxosReturn?: unknown;
    signBatchReturn?: unknown;
  } = {}
) {
  const mockVaultCtx = { deposit_amount: 0, tx_feerate: 10, _tag: 'vaultCtx' };
  const mockLiquidVaults = [makeLiquidVault()];

  const wallet = {
    acct: {
      sats: { address: 'tb1qsegwit000000000000000000000000000000' },
      vault: { address: 'tb1ptaproot00000000000000000000000000000' },
    },
    contract_id: 'test_contract_id',
    network: 'mutiny',
    vault: {
      repo: {
        ctx: jest.fn().mockReturnValue(overrides.repoCtxReturn ?? mockVaultCtx),
        quote: jest.fn().mockReturnValue(overrides.repoQuoteReturn ?? { total_cost: 5000 }),
      },
    },
    fetch: {
      sats_utxos: jest.fn().mockResolvedValue(
        overrides.satsUtxosReturn ?? [
          { txid: 'utxo-txid-001', vout: 0, value: 100_000, script: '0014abc' },
          { txid: 'utxo-txid-002', vout: 1, value: 200_000, script: '0014def' },
        ]
      ),
    },
    sign: {
      batch: jest
        .fn()
        .mockResolvedValue(
          overrides.signBatchReturn ?? ['signed_psbt1_base64', 'signed_psbt2_base64']
        ),
    },
    _mockLiquidVaults: mockLiquidVaults,
  };

  return wallet;
}

/** Minimal guardian subscription mock */
function makeGuardianSub(resolveWith: unknown = { vault_txid: 'guardian-txid-001' }) {
  return {
    on: jest.fn(),
    resolve: jest.fn().mockResolvedValue(resolveWith),
  };
}

/** Base valid params used across most tests */
function makeParams(
  overrides: Partial<LiquidationExecutionParams> = {}
): LiquidationExecutionParams {
  return {
    liquidVaults: [makeLiquidVault()] as unknown as LiquidationExecutionParams['liquidVaults'],
    walletInfo: {
      segwitAddress: 'tb1qsegwit000000000000000000000000000000',
      segwitPubkey: 'pubkey_segwit_hex',
      taprootAddress: 'tb1ptaproot00000000000000000000000000000',
      taprootPubkey: 'pubkey_taproot_hex',
    },
    vaultPubkey: 'vault_pubkey_hex',
    btcInVault: 0.1,
    unitDebt: 5000,
    feeRate: 10,
    vaultInfo: {
      creation_account: 'acct_id_hex',
      guard_pubkey: 'guard_pubkey_hex',
      master_id: 'master_id_hex',
    },
    deficitAmountBtc: 0.01,
    ...overrides,
  };
}

// ─── Setup default mocks ───────────────────────────────────────────────────────

const mockComputeLiquidationPrice = computeLiquidationPrice as jest.MockedFunction<
  typeof computeLiquidationPrice
>;
const mockFetchPriceQuote = fetchPriceQuote as jest.MockedFunction<typeof fetchPriceQuote>;
const mockGetGuardianClient = getGuardianClient as jest.MockedFunction<typeof getGuardianClient>;
const mockWithGuardianTimeout = withGuardianTimeout as jest.MockedFunction<
  typeof withGuardianTimeout
>;
const mockDisconnectGuardian = disconnectGuardian as jest.MockedFunction<typeof disconnectGuardian>;
const mockRegisterLiquidationTxid = registerLiquidationTxid as jest.MockedFunction<
  typeof registerLiquidationTxid
>;
const mockCreateVaultWallet = createVaultWallet as jest.MockedFunction<typeof createVaultWallet>;
const mockFetchProtocolContract = fetchProtocolContract as jest.MockedFunction<
  typeof fetchProtocolContract
>;
const mockSetPendingVaultSigningOperation = setPendingVaultSigningOperation as jest.MockedFunction<
  typeof setPendingVaultSigningOperation
>;
const mockClearPendingVaultSigningOperation =
  clearPendingVaultSigningOperation as jest.MockedFunction<
    typeof clearPendingVaultSigningOperation
  >;
const mockBuildVaultProfile = buildVaultProfile as jest.MockedFunction<typeof buildVaultProfile>;
const mockComputeVaultPrevoutFromTx = computeVaultPrevoutFromTx as jest.MockedFunction<
  typeof computeVaultPrevoutFromTx
>;
const mockResolveLatestUnspentVaultPrevout =
  resolveLatestUnspentVaultPrevout as jest.MockedFunction<
    typeof resolveLatestUnspentVaultPrevout
  >;
const mockFetchVaultHistory = fetchVaultHistory as jest.MockedFunction<typeof fetchVaultHistory>;
const mockSelectLatestUsableVaultHistoryTransaction =
  selectLatestUsableVaultHistoryTransaction as jest.MockedFunction<
    typeof selectLatestUsableVaultHistoryTransaction
  >;
const mockSignPsbtRaw = signPsbtRaw as jest.MockedFunction<typeof signPsbtRaw>;
const mockGetAvailableCollateralBtc = getAvailableCollateralBtc as jest.MockedFunction<
  typeof getAvailableCollateralBtc
>;
const mockFetchSwapPsbt = fetchSwapPsbt as jest.MockedFunction<typeof fetchSwapPsbt>;
const mockFinalizeSwapPsbt = finalizeSwapPsbt as jest.MockedFunction<typeof finalizeSwapPsbt>;
const mockSelectSatUtxos = select_sat_utxos as jest.MockedFunction<typeof select_sat_utxos>;
const mockVaultApiRepoLiquidGetCtx = VaultAPI.repo.liquidation.get_ctx as jest.MockedFunction<
  typeof VaultAPI.repo.liquidation.get_ctx
>;
const mockVaultApiRepoCreatePsbt1 = VaultAPI.repo.create_psbt1 as jest.MockedFunction<
  typeof VaultAPI.repo.create_psbt1
>;
const mockVaultApiRepoCreatePsbt2 = VaultAPI.repo.create_psbt2 as jest.MockedFunction<
  typeof VaultAPI.repo.create_psbt2
>;
const mockVaultApiRepoCreateReq = VaultAPI.repo.create_req as jest.MockedFunction<
  typeof VaultAPI.repo.create_req
>;
const mockPsbtGetTxhex = PSBT.get.txhex as jest.MockedFunction<typeof PSBT.get.txhex>;
const mockTxGetTxid = TX.get_txid as jest.MockedFunction<typeof TX.get_txid>;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('executeLiquidation', () => {
  let mockWallet: ReturnType<typeof makeMockWallet>;
  let mockGuardianSub: ReturnType<typeof makeGuardianSub>;
  let mockGuardian: { req: { vault: { repo: jest.Mock } } };
  const mockPrevout = { rdata: { is_locked: false }, utxo: { txid: 'txid-001', vout: 0 } };
  const mockVaultProfile = { vault_pk: 'vault_pubkey_hex', acct_id: 'acct', guard_pk: 'guard' };
  const mockLiquidCtx = {
    vault_count: 1,
    claimed_sats: 5000,
    claimed_unit: 100,
    liquid_vaults: [{}],
  };
  const mockContract = { contract_id: 'master_contract' };
  const mockOracleQuote = {
    latest_price: 80_000,
    latest_stamp: Math.floor(Date.now() / 1000) - 10,
    thold_price: 70_000,
    thold_hash: 'aabbcc',
    thold_key: 'thold_key_hex',
    req_id: 'req_001',
    req_sig: 'sig_001',
    srv_pubkey: 'srv_pk',
    srv_network: 'mutiny',
    quote_origin: 'origin',
    quote_price: 80_000,
    quote_stamp: Math.floor(Date.now() / 1000),
    latest_origin: 'origin',
    event_origin: null,
    event_price: null,
    event_stamp: null,
    event_type: 'latest',
    is_expired: false,
  };
  const mockSelectedUtxos = [{ txid: 'utxo-txid-001', vout: 0, value: 100_000, script: '0014abc' }];

  beforeEach(() => {
    jest.clearAllMocks();

    mockWallet = makeMockWallet();
    mockGuardianSub = makeGuardianSub({ vault_txid: 'guardian-txid-001' });
    mockGuardian = {
      req: {
        vault: {
          repo: jest.fn().mockReturnValue(mockGuardianSub),
        },
      },
    };

    // Default happy-path mocks
    mockComputeLiquidationPrice.mockReturnValue(70_000);
    mockFetchPriceQuote.mockResolvedValue(
      mockOracleQuote as unknown as ReturnType<typeof fetchPriceQuote> extends Promise<infer T>
        ? T
        : never
    );
    mockCreateVaultWallet.mockResolvedValue(
      mockWallet as unknown as ReturnType<typeof createVaultWallet> extends Promise<infer T>
        ? T
        : never
    );
    mockFetchProtocolContract.mockResolvedValue(
      mockContract as unknown as ReturnType<typeof fetchProtocolContract> extends Promise<infer T>
        ? T
        : never
    );
    mockFetchVaultHistory.mockResolvedValue([makeHistoryTx()] as unknown as ReturnType<
      typeof fetchVaultHistory
    > extends Promise<infer T>
      ? T
      : never);
    mockComputeVaultPrevoutFromTx.mockReturnValue(
      mockPrevout as unknown as ReturnType<typeof computeVaultPrevoutFromTx>
    );
    mockResolveLatestUnspentVaultPrevout.mockResolvedValue({
      prevout: mockPrevout,
      replaced: false,
      hopCount: 0,
      sourceTxids: ['txid-001'],
    } as unknown as Awaited<ReturnType<typeof resolveLatestUnspentVaultPrevout>>);
    mockBuildVaultProfile.mockReturnValue(
      mockVaultProfile as unknown as ReturnType<typeof buildVaultProfile>
    );
    mockSelectLatestUsableVaultHistoryTransaction.mockImplementation((history) => {
      return history.reduce((latest, tx) => (
        !latest || tx.timestamp > latest.timestamp ? tx : latest
      ), undefined as (typeof history)[number] | undefined);
    });
    mockGetAvailableCollateralBtc.mockReturnValue(0.005);
    mockVaultApiRepoLiquidGetCtx.mockReturnValue(
      mockLiquidCtx as unknown as ReturnType<typeof VaultAPI.repo.liquidation.get_ctx>
    );
    mockSelectSatUtxos.mockReturnValue(
      mockSelectedUtxos as unknown as ReturnType<typeof select_sat_utxos>
    );
    mockVaultApiRepoCreatePsbt1.mockReturnValue('raw_psbt1_base64');
    mockVaultApiRepoCreatePsbt2.mockReturnValue('raw_psbt2_base64');
    mockVaultApiRepoCreateReq.mockReturnValue({
      liquid_psbt: 'signed_psbt1_base64',
      liquid_txhex: 'stale_liquid_txhex',
      liquid_txid: 'stale_liquid_txid',
      vault_psbt: 'signed_psbt2_base64',
      vault_txhex: 'stale_vault_txhex',
      vault_txid: 'stale_vault_txid',
    } as unknown as ReturnType<typeof VaultAPI.repo.create_req>);
    mockFetchSwapPsbt.mockResolvedValue(null);
    mockSignPsbtRaw.mockResolvedValue('signed_swap_psbt_base64');
    mockFinalizeSwapPsbt.mockReturnValue('swap_tx_hex');
    mockSetPendingVaultSigningOperation.mockImplementation(() => undefined);
    mockClearPendingVaultSigningOperation.mockImplementation(() => undefined);
    mockGetGuardianClient.mockResolvedValue(
      mockGuardian as unknown as ReturnType<typeof getGuardianClient> extends Promise<infer T>
        ? T
        : never
    );
    mockWithGuardianTimeout.mockImplementation((op) => op);
    mockDisconnectGuardian.mockResolvedValue(undefined as never);
    mockRegisterLiquidationTxid.mockResolvedValue(undefined);
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('should complete the full 9-step flow and return success with txid', async () => {
      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(true);
      expect(result.txid).toBe('guardian-txid-001');
      expect(result.vaultTxid).toBe('guardian-txid-001');
      expect(result.error).toBeUndefined();
    });

    it('should call computeLiquidationPrice with correct unitDebt and btcInVault', async () => {
      await executeLiquidation(makeParams({ unitDebt: 5000, btcInVault: 0.1 }));

      expect(mockComputeLiquidationPrice).toHaveBeenCalledWith(5000, 0.1);
    });

    it('should pass the liquidation price from computeLiquidationPrice to fetchPriceQuote', async () => {
      mockComputeLiquidationPrice.mockReturnValue(72_500);

      await executeLiquidation(makeParams());

      expect(mockFetchPriceQuote).toHaveBeenCalledWith(72_500);
    });

    it('should call createVaultWallet with the walletInfo from params', async () => {
      const params = makeParams();
      await executeLiquidation(params);

      expect(mockCreateVaultWallet).toHaveBeenCalledWith(params.walletInfo);
    });

    it('should call fetchVaultHistory with vaultPubkey', async () => {
      await executeLiquidation(makeParams({ vaultPubkey: 'my_vault_pubkey' }));

      expect(mockFetchVaultHistory).toHaveBeenCalledWith('my_vault_pubkey', {});
    });

    it('should pass vault id to fetchVaultHistory when available', async () => {
      await executeLiquidation(makeParams({
        vaultInfo: {
          vault_id: 'vault-id-123',
          creation_account: 'acct_id_hex',
          guard_pubkey: 'guard_pubkey_hex',
          master_id: 'master_id_hex',
        },
      }));

      expect(mockFetchVaultHistory).toHaveBeenCalledWith('vault_pubkey_hex', {
        vaultId: 'vault-id-123',
      });
    });

    it('should build the user vault profile from the latest usable history entry', async () => {
      const oldHistoryTx = makeHistoryTx({ transaction_id: 'old-tx-001', timestamp: 1000 });
      const latestHistoryTx = makeHistoryTx({ transaction_id: 'latest-tx-001', timestamp: 2000 });
      mockFetchVaultHistory.mockResolvedValue(
        [oldHistoryTx, latestHistoryTx] as unknown as ReturnType<
          typeof fetchVaultHistory
        > extends Promise<infer T>
          ? T
          : never
      );

      await executeLiquidation(makeParams());

      expect(mockSelectLatestUsableVaultHistoryTransaction).toHaveBeenCalledWith([
        oldHistoryTx,
        latestHistoryTx,
      ]);
      expect(mockComputeVaultPrevoutFromTx).toHaveBeenCalledWith(latestHistoryTx);
    });

    it('should resolve the latest unspent vault prevout before building the profile', async () => {
      const resolvedPrevout = {
        rdata: { is_locked: false },
        utxo: { txid: 'resolved-latest-vault-tx', vout: 0 },
      };
      mockResolveLatestUnspentVaultPrevout.mockResolvedValue({
        prevout: resolvedPrevout,
        replaced: true,
        hopCount: 1,
        sourceTxids: ['txid-001', 'resolved-latest-vault-tx'],
      } as unknown as Awaited<ReturnType<typeof resolveLatestUnspentVaultPrevout>>);
      const params = makeParams();

      await executeLiquidation(params);

      expect(mockResolveLatestUnspentVaultPrevout).toHaveBeenCalledWith(mockPrevout);
      expect(mockBuildVaultProfile).toHaveBeenCalledWith(
        params.vaultPubkey,
        params.vaultInfo,
        resolvedPrevout
      );
    });

    it('should call getAvailableCollateralBtc with oracle price, btcInVault, unitDebt', async () => {
      await executeLiquidation(makeParams({ btcInVault: 0.1, unitDebt: 5000 }));

      expect(mockGetAvailableCollateralBtc).toHaveBeenCalledWith(80_000, 0.1, 5000);
    });

    it('should compute depositAmountSats = 0 when availableCollateral > deficitAmountBtc', async () => {
      // availableCollateral (0.02) > deficitAmountBtc (0.01) → depositAmountBtc = 0 → sats = 0
      mockGetAvailableCollateralBtc.mockReturnValue(0.02);

      await executeLiquidation(makeParams({ deficitAmountBtc: 0.01 }));

      expect(mockWallet.vault.repo.ctx).toHaveBeenCalledWith(mockOracleQuote, mockVaultProfile, {
        deposit_amount: 0,
        tx_feerate: 10,
      });
    });

    it('should compute correct depositAmountSats when deficitAmountBtc > availableCollateral', async () => {
      // availableCollateral = 0.005, deficitAmountBtc = 0.02
      // depositAmountBtc = 0.02 - 0.005 = 0.015 → floor(0.015 * 1e8) = 1_500_000 sats
      mockGetAvailableCollateralBtc.mockReturnValue(0.005);

      await executeLiquidation(makeParams({ deficitAmountBtc: 0.02 }));

      expect(mockWallet.vault.repo.ctx).toHaveBeenCalledWith(mockOracleQuote, mockVaultProfile, {
        deposit_amount: 1_500_000,
        tx_feerate: 10,
      });
    });

    it('should call VaultAPI.repo.liquidation.get_ctx with liquidVaults and contract', async () => {
      const params = makeParams();
      await executeLiquidation(params);

      expect(mockVaultApiRepoLiquidGetCtx).toHaveBeenCalledWith(params.liquidVaults, mockContract);
    });

    it('should call wallet.vault.repo.quote with vaultCtx and liquidVaults.length', async () => {
      const params = makeParams();
      // liquidVaults has 1 entry
      await executeLiquidation(params);

      expect(mockWallet.vault.repo.quote).toHaveBeenCalledWith(
        expect.anything(), // vaultCtx
        1
      );
    });

    it('should call wallet.fetch.sats_utxos to retrieve all UTXOs', async () => {
      await executeLiquidation(makeParams());

      expect(mockWallet.fetch.sats_utxos).toHaveBeenCalled();
    });

    it('should call select_sat_utxos with all UTXOs and total_cost from quote', async () => {
      mockWallet.vault.repo.quote.mockReturnValue({ total_cost: 7500 });

      await executeLiquidation(makeParams());

      expect(mockSelectSatUtxos).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ txid: 'utxo-txid-001' })]),
        7500
      );
    });

    it('should call VaultAPI.repo.create_psbt1 and create_psbt2 with correct contexts', async () => {
      await executeLiquidation(makeParams());

      expect(mockVaultApiRepoCreatePsbt1).toHaveBeenCalledWith(
        mockLiquidCtx,
        expect.anything(), // vaultCtx
        mockSelectedUtxos
      );
      expect(mockVaultApiRepoCreatePsbt2).toHaveBeenCalledWith(
        mockLiquidCtx,
        expect.anything(), // vaultCtx
        'raw_psbt1_base64'
      );
    });

    it('should call setPendingVaultSigningOperation before wallet.sign.batch', async () => {
      const callOrder: string[] = [];
      mockSetPendingVaultSigningOperation.mockImplementation(() => {
        callOrder.push('setPending');
      });
      mockWallet.sign.batch.mockImplementation(async () => {
        callOrder.push('signBatch');
        return ['signed_psbt1_base64', 'signed_psbt2_base64'];
      });

      await executeLiquidation(makeParams());

      expect(callOrder.indexOf('setPending')).toBeLessThan(callOrder.indexOf('signBatch'));
    });

    it('should call setPendingVaultSigningOperation with repo action and correct context', async () => {
      await executeLiquidation(makeParams());

      expect(mockSetPendingVaultSigningOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'repo',
          liquidCtx: mockLiquidCtx,
          satsUtxos: mockSelectedUtxos,
        })
      );
    });

    it('should call clearPendingVaultSigningOperation after signing', async () => {
      await executeLiquidation(makeParams());

      expect(mockClearPendingVaultSigningOperation).toHaveBeenCalled();
    });

    it('should call wallet.sign.batch with the two PSBT manifests', async () => {
      await executeLiquidation(makeParams());

      expect(mockWallet.sign.batch).toHaveBeenCalledWith([
        ['raw_psbt1_base64', { tb1qsegwit000000000000000000000000000000: expect.any(Array) }],
        ['raw_psbt2_base64', { tb1ptaproot00000000000000000000000000000: [0, 1] }],
      ]);
    });

    it('should build utxoManifest keyed by sats address with correct input indices', async () => {
      // liquid_vaults.length = 1, so vinFundIdx = 1; 2 UTXOs → inputs at [1, 2]
      mockWallet.fetch.sats_utxos.mockResolvedValue([
        { txid: 'u1', vout: 0, value: 50_000, script: '0014aa' },
        { txid: 'u2', vout: 0, value: 50_000, script: '0014bb' },
      ]);
      mockSelectSatUtxos.mockReturnValue([
        { txid: 'u1', vout: 0, value: 50_000, script: '0014aa' },
        { txid: 'u2', vout: 0, value: 50_000, script: '0014bb' },
      ] as unknown as ReturnType<typeof select_sat_utxos>);

      await executeLiquidation(makeParams());

      const batchCallArg = mockWallet.sign.batch.mock.calls[0][0];
      const [, utxoManifest] = batchCallArg[0];

      // liquid_vaults has 1 entry → vinFundIdx = 1; 2 UTXOs → indices [1, 2]
      expect(utxoManifest['tb1qsegwit000000000000000000000000000000']).toEqual([1, 2]);
    });

    it('should call VaultAPI.repo.create_req with correct signed PSBTs', async () => {
      await executeLiquidation(makeParams());

      expect(mockVaultApiRepoCreateReq).toHaveBeenCalledWith(
        mockLiquidCtx,
        expect.anything(), // vaultCtx
        'signed_psbt1_base64',
        'signed_psbt2_base64'
      );
    });

    it('should sign swap PSBTs with bounded external spend validation', async () => {
      mockFetchSwapPsbt.mockResolvedValue({
        psbt: 'swap_psbt_base64',
        message: 'ok',
        inputs: {},
        outputs: {},
        user_input_indices: [0],
      } as unknown as Awaited<ReturnType<typeof fetchSwapPsbt>>);

      const result = await executeLiquidation(makeParams());

      expect(mockSignPsbtRaw).toHaveBeenCalledWith(
        'swap_psbt_base64',
        { tb1qsegwit000000000000000000000000000000: [0] },
        {
          recipient: 'tb1qsegwit000000000000000000000000000000',
          allowOpReturn: true,
          externalSpend: {
            returnAddresses: [
              'tb1qsegwit000000000000000000000000000000',
              'tb1ptaproot00000000000000000000000000000',
            ],
            requiredOutputAddresses: ['tb1ptaproot00000000000000000000000000000'],
            maxSpendSats: 110_000,
          },
        }
      );
      expect(mockFinalizeSwapPsbt).toHaveBeenCalledWith(
        'signed_swap_psbt_base64',
        'tb1ptaproot00000000000000000000000000000'
      );
      expect(result.swapPsbtHex).toBe('swap_tx_hex');
    });

    it('should select extra swap UTXOs when change covers swap amount but not fee buffer', async () => {
      const repoUtxo = { txid: 'repo-utxo', vout: 0, value: 100_000, script: '0014repo' };
      const extraUtxo = { txid: 'extra-utxo', vout: 1, value: 25_000, script: '0014extra' };
      const changeUtxo = { txid: 'change-utxo', vout: 1, value: 104_000, script: '0014change' };
      mockWallet.fetch.sats_utxos.mockResolvedValue([repoUtxo, extraUtxo]);
      mockSelectSatUtxos.mockImplementation((_utxos, amount) => {
        if (amount === 5000) {
          return [repoUtxo] as unknown as ReturnType<typeof select_sat_utxos>;
        }
        if (amount === 6000) {
          return [extraUtxo] as unknown as ReturnType<typeof select_sat_utxos>;
        }
        return [] as unknown as ReturnType<typeof select_sat_utxos>;
      });
      (PSBT.extract.utxo as jest.Mock).mockReturnValueOnce(changeUtxo);

      await executeLiquidation(makeParams());

      expect(mockSelectSatUtxos).toHaveBeenCalledWith([extraUtxo], 6000);
      expect(mockFetchSwapPsbt).toHaveBeenCalledWith(
        expect.objectContaining({
          utxos: [changeUtxo, extraUtxo],
        })
      );
    });

    it('should attach contract_id and network from wallet to the request', async () => {
      await executeLiquidation(makeParams());

      const guardianRepoCall = mockGuardian.req.vault.repo.mock.calls[0][0];
      expect(guardianRepoCall).toMatchObject({
        contract_id: 'test_contract_id',
        network: 'mutiny',
      });
    });

    it('normalizes repo transaction ids from the signed PSBTs before guardian submission', async () => {
      mockVaultApiRepoCreateReq.mockReturnValue({
        liquid_psbt: 'liquid_psbt_needs_normalizing',
        liquid_txhex: 'wrong_liquid_txhex',
        liquid_txid: 'wrong_liquid_txid',
        vault_psbt: 'vault_psbt_needs_normalizing',
        vault_txhex: 'wrong_vault_txhex',
        vault_txid: 'wrong_vault_txid',
      } as unknown as ReturnType<typeof VaultAPI.repo.create_req>);

      await executeLiquidation(makeParams());

      const guardianRepoCall = mockGuardian.req.vault.repo.mock.calls[0][0];
      expect(guardianRepoCall).toMatchObject({
        liquid_psbt: 'liquid_psbt_needs_normalizing',
        liquid_txhex: 'normalized_liquid_txhex',
        liquid_txid: 'normalized_liquid_txid',
        vault_psbt: 'vault_psbt_needs_normalizing',
        vault_txhex: 'normalized_vault_txhex',
        vault_txid: 'normalized_vault_txid',
      });
      expect(mockPsbtGetTxhex).toHaveBeenCalledWith('liquid_psbt_needs_normalizing');
      expect(mockPsbtGetTxhex).toHaveBeenCalledWith('vault_psbt_needs_normalizing');
      expect(mockTxGetTxid).toHaveBeenCalledWith('normalized_liquid_txhex');
      expect(mockTxGetTxid).toHaveBeenCalledWith('normalized_vault_txhex');
    });

    it('persists the signed repo request before connecting to the guardian', async () => {
      const callOrder: string[] = [];
      const onRequestCreated = jest.fn(async () => {
        callOrder.push('persist');
      });
      mockGetGuardianClient.mockImplementation(async () => {
        callOrder.push('guardian');
        return mockGuardian as unknown as ReturnType<typeof getGuardianClient> extends Promise<infer T>
          ? T
          : never;
      });

      await executeLiquidation(makeParams({ onRequestCreated }));

      expect(onRequestCreated).toHaveBeenCalledWith({
        txid: 'signed_vault_txid',
        vaultTxid: 'signed_vault_txid',
        request: expect.objectContaining({
          liquid_txid: 'signed_liquid_txid',
          vault_txid: 'signed_vault_txid',
          contract_id: 'test_contract_id',
          network: 'mutiny',
        }),
      });
      expect(callOrder).toEqual(['persist', 'guardian']);
    });

    it('includes the finalized swap transaction in the pre-submit recovery callback', async () => {
      mockFetchSwapPsbt.mockResolvedValue({
        psbt: 'swap_psbt_base64',
        message: 'ok',
        inputs: {},
        outputs: {},
        user_input_indices: [0],
      } as unknown as Awaited<ReturnType<typeof fetchSwapPsbt>>);
      const onRequestCreated = jest.fn().mockResolvedValue(undefined);

      await executeLiquidation(makeParams({ onRequestCreated }));

      expect(onRequestCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          txid: 'signed_vault_txid',
          vaultTxid: 'signed_vault_txid',
          swapPsbtHex: 'swap_tx_hex',
        })
      );
      expect(mockGetGuardianClient).toHaveBeenCalled();
    });

    it('aborts before guardian submission when repo request recovery cannot be persisted', async () => {
      const onRequestCreated = jest.fn().mockRejectedValue(new Error('persist failed'));

      const result = await executeLiquidation(makeParams({ onRequestCreated }));

      expect(result).toMatchObject({ success: false, error: 'persist failed' });
      expect(mockGetGuardianClient).not.toHaveBeenCalled();
      expect(mockGuardian.req.vault.repo).not.toHaveBeenCalled();
    });

    it('should call getGuardianClient with vaultPubkey', async () => {
      await executeLiquidation(makeParams({ vaultPubkey: 'my_vault_pubkey' }));

      expect(mockGetGuardianClient).toHaveBeenCalledWith('my_vault_pubkey');
    });

    it('should call withGuardianTimeout wrapping guardSub.resolve(60000)', async () => {
      await executeLiquidation(makeParams());

      expect(mockWithGuardianTimeout).toHaveBeenCalledWith(expect.anything(), 70_000);
      expect(mockGuardianSub.resolve).toHaveBeenCalledWith(60_000);
    });

    it('should register the txid when guardian returns vault_txid', async () => {
      mockGuardianSub.resolve.mockResolvedValue({ vault_txid: 'register-this-txid' });

      await executeLiquidation(makeParams());

      expect(mockRegisterLiquidationTxid).toHaveBeenCalledWith('register-this-txid');
    });

    it('should register the txid when guardian returns repo_txid (no vault_txid)', async () => {
      mockGuardianSub.resolve.mockResolvedValue({ repo_txid: 'repo-txid-999' });
      mockWithGuardianTimeout.mockImplementation((op) => op);

      await executeLiquidation(makeParams());

      expect(mockRegisterLiquidationTxid).toHaveBeenCalledWith('repo-txid-999');
      expect((await executeLiquidation(makeParams())).txid).toBe('repo-txid-999');
    });

    it('should use liquid_txid fallback when neither vault_txid nor repo_txid present', async () => {
      mockGuardianSub.resolve.mockResolvedValue({ liquid_txid: 'liquid-txid-888' });

      const result = await executeLiquidation(makeParams());

      expect(result.txid).toBe('liquid-txid-888');
      expect(mockRegisterLiquidationTxid).toHaveBeenCalledWith('liquid-txid-888');
    });

    it('should return empty string txid when guardian response has no known txid field', async () => {
      mockGuardianSub.resolve.mockResolvedValue({ other_field: 'something' });

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(true);
      expect(result.txid).toBe('');
    });

    it('should NOT call registerLiquidationTxid when txid is empty string', async () => {
      mockGuardianSub.resolve.mockResolvedValue({});

      await executeLiquidation(makeParams());

      expect(mockRegisterLiquidationTxid).not.toHaveBeenCalled();
    });

    it('should call disconnectGuardian on successful completion', async () => {
      await executeLiquidation(makeParams());

      expect(mockDisconnectGuardian).toHaveBeenCalled();
    });

    it('should listen to guardian info events', async () => {
      await executeLiquidation(makeParams());

      expect(mockGuardianSub.on).toHaveBeenCalledWith('info', expect.any(Function));
    });
  });

  // ─── Progress callback ───────────────────────────────────────────────────────

  describe('progress callback', () => {
    it('should call onProgress with all expected messages in order', async () => {
      const messages: string[] = [];
      const onProgress = jest.fn((msg: string) => messages.push(msg));

      await executeLiquidation(makeParams({ onProgress }));

      expect(messages).toEqual([
        'Fetching oracle price...',
        'Creating wallet context...',
        'Building vault profile...',
        'Building liquidation context...',
        'Preparing transaction...',
        'Fetching available funds...',
        'Building transactions...',
        'Preparing swap...',
        'Signing transaction...',
        'Submitting to network...',
        'Liquidation complete!',
      ]);
    });

    it('should not throw when onProgress is undefined', async () => {
      const params = makeParams();
      delete params.onProgress;

      await expect(executeLiquidation(params)).resolves.toMatchObject({ success: true });
    });

    it('should log each progress message via logger.info', async () => {
      const { logger } = jest.requireMock('../../../utils/logger');

      await executeLiquidation(makeParams());

      const infoCalls = logger.info.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(infoCalls.some((m: string) => m.includes('Fetching oracle price...'))).toBe(true);
      expect(infoCalls.some((m: string) => m.includes('Liquidation complete!'))).toBe(true);
    });
  });

  // ─── Step 1: Oracle failure ──────────────────────────────────────────────────

  describe('oracle failure (step 1)', () => {
    it('should return success:false with error message when fetchPriceQuote rejects', async () => {
      mockFetchPriceQuote.mockRejectedValue(new Error('Oracle API error: connection refused'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Oracle API error: connection refused');
    });

    it('should not call createVaultWallet if oracle step fails', async () => {
      mockFetchPriceQuote.mockRejectedValue(new Error('Oracle failed'));

      await executeLiquidation(makeParams());

      expect(mockCreateVaultWallet).not.toHaveBeenCalled();
    });

    it('should handle string errors thrown by oracle service', async () => {
      mockFetchPriceQuote.mockRejectedValue('oracle string error');

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('oracle string error');
    });

    it('should handle object errors thrown by oracle service', async () => {
      mockFetchPriceQuote.mockRejectedValue({ code: 'NETWORK_ERROR', detail: 'timeout' });

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toContain('NETWORK_ERROR');
    });
  });

  // ─── Step 2: createVaultWallet failure ──────────────────────────────────────

  describe('createVaultWallet failure (step 2)', () => {
    it('should return success:false when createVaultWallet rejects', async () => {
      mockCreateVaultWallet.mockRejectedValue(new Error('Failed to fetch protocol: 503'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch protocol: 503');
    });

    it('should not call fetchVaultHistory if wallet creation fails', async () => {
      mockCreateVaultWallet.mockRejectedValue(new Error('wallet error'));

      await executeLiquidation(makeParams());

      expect(mockFetchVaultHistory).not.toHaveBeenCalled();
    });
  });

  // ─── Step 3: Vault history failures ─────────────────────────────────────────

  describe('vault history failures (step 3)', () => {
    it('should return error "No vault history found" when fetchVaultHistory returns null', async () => {
      mockFetchVaultHistory.mockResolvedValue(
        null as unknown as ReturnType<typeof fetchVaultHistory> extends Promise<infer T> ? T : never
      );

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('No vault history found');
    });

    it('should return error "No vault history found" when fetchVaultHistory returns empty array', async () => {
      mockFetchVaultHistory.mockResolvedValue(
        [] as unknown as ReturnType<typeof fetchVaultHistory> extends Promise<infer T> ? T : never
      );

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('No vault history found');
    });

    it('should return error when no usable vault history transaction exists', async () => {
      mockSelectLatestUsableVaultHistoryTransaction.mockReturnValue(undefined);

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('No usable vault history transaction found');
      expect(mockComputeVaultPrevoutFromTx).not.toHaveBeenCalled();
    });

    it('should return error "Failed to compute vault prevout" when computeVaultPrevoutFromTx returns null', async () => {
      mockComputeVaultPrevoutFromTx.mockReturnValue(null);

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to compute vault prevout');
    });

    it('should return error when latest on-chain vault prevout resolution fails', async () => {
      mockResolveLatestUnspentVaultPrevout.mockRejectedValue(
        new Error('Timed out verifying current vault outpoint')
      );

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timed out verifying current vault outpoint');
      expect(mockBuildVaultProfile).not.toHaveBeenCalled();
    });

    it('should not call buildVaultProfile when prevout is null', async () => {
      mockComputeVaultPrevoutFromTx.mockReturnValue(null);

      await executeLiquidation(makeParams());

      expect(mockBuildVaultProfile).not.toHaveBeenCalled();
    });

    it('should return error when fetchVaultHistory rejects', async () => {
      mockFetchVaultHistory.mockRejectedValue(new Error('Network timeout fetching history'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout fetching history');
    });
  });

  // ─── Step 7: UTXO failures ───────────────────────────────────────────────────

  describe('UTXO failures (step 7)', () => {
    it('should return error "Insufficient funds for liquidation" when select_sat_utxos returns empty array', async () => {
      mockSelectSatUtxos.mockReturnValue([] as unknown as ReturnType<typeof select_sat_utxos>);

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds for liquidation');
    });

    it('should return insufficient funds when select_sat_utxos returns null', async () => {
      mockSelectSatUtxos.mockReturnValue(null as unknown as ReturnType<typeof select_sat_utxos>);

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds for liquidation');
    });

    it('should not call setPendingVaultSigningOperation when UTXOs are insufficient', async () => {
      mockSelectSatUtxos.mockReturnValue([] as unknown as ReturnType<typeof select_sat_utxos>);

      await executeLiquidation(makeParams());

      expect(mockSetPendingVaultSigningOperation).not.toHaveBeenCalled();
    });

    it('should return error when wallet.fetch.sats_utxos rejects', async () => {
      mockWallet.fetch.sats_utxos.mockRejectedValue(new Error('UTXO fetch failed'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('UTXO fetch failed');
    });
  });

  // ─── Step 8: Signing failures ────────────────────────────────────────────────

  describe('signing failures (step 8)', () => {
    it('should return error when wallet.sign.batch rejects', async () => {
      mockWallet.sign.batch.mockRejectedValue(new Error('User rejected signing'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('User rejected signing');
    });

    it('should call clearPendingVaultSigningOperation even when sign.batch rejects (finally block)', async () => {
      mockWallet.sign.batch.mockRejectedValue(new Error('signing error'));

      await executeLiquidation(makeParams());

      expect(mockClearPendingVaultSigningOperation).toHaveBeenCalled();
    });

    it('should call clearPendingVaultSigningOperation even after VaultAPI.repo.create_req throws', async () => {
      mockWallet.sign.batch.mockResolvedValue(['psbt1', 'psbt2']);
      mockVaultApiRepoCreateReq.mockImplementation(() => {
        throw new Error('create_req failed');
      });

      await executeLiquidation(makeParams());

      expect(mockClearPendingVaultSigningOperation).toHaveBeenCalled();
    });
  });

  // ─── Step 9: Guardian failures ──────────────────────────────────────────────

  describe('guardian failures (step 9)', () => {
    it('should return success:false when getGuardianClient rejects', async () => {
      mockGetGuardianClient.mockRejectedValue(new Error('Guardian connection timeout'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Guardian connection timeout');
    });

    it('should return success:false when guardSub.resolve rejects', async () => {
      mockGuardianSub.resolve.mockRejectedValue(new Error('Guardian operation timeout'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Guardian operation timeout');
    });

    it('should return success:false when withGuardianTimeout rejects', async () => {
      mockWithGuardianTimeout.mockRejectedValue(new Error('Guardian operation timeout'));

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Guardian operation timeout');
    });

    it('should call disconnectGuardian on guardian failure when guardian was obtained', async () => {
      // Guardian was obtained successfully, but resolve fails
      mockGuardianSub.resolve.mockRejectedValue(new Error('Guardian failed mid-way'));

      await executeLiquidation(makeParams());

      expect(mockDisconnectGuardian).toHaveBeenCalled();
    });

    it('should NOT call disconnectGuardian in catch block when guardian was never assigned', async () => {
      // Fail before getGuardianClient is called (e.g. oracle step fails)
      mockFetchPriceQuote.mockRejectedValue(new Error('oracle error'));

      await executeLiquidation(makeParams());

      // disconnectGuardian should not be called at all (guardian is null)
      expect(mockDisconnectGuardian).not.toHaveBeenCalled();
    });

    it('should attempt disconnectGuardian even if disconnect itself throws', async () => {
      mockGuardianSub.resolve.mockRejectedValue(new Error('guardian failed'));
      mockDisconnectGuardian.mockRejectedValue(new Error('disconnect also failed') as never);

      // Should not propagate the disconnect error
      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('guardian failed');
    });
  });

  // ─── Error type handling ─────────────────────────────────────────────────────

  describe('error type handling', () => {
    it('should handle Error instances by using error.message', async () => {
      mockFetchPriceQuote.mockRejectedValue(new Error('specific error message'));

      const result = await executeLiquidation(makeParams());

      expect(result.error).toBe('specific error message');
    });

    it('should handle plain string errors', async () => {
      mockFetchPriceQuote.mockRejectedValue('plain string error');

      const result = await executeLiquidation(makeParams());

      expect(result.error).toBe('plain string error');
    });

    it('should handle object errors via JSON.stringify', async () => {
      mockFetchPriceQuote.mockRejectedValue({ code: 500, message: 'server error' });

      const result = await executeLiquidation(makeParams());

      expect(result.error).toBe(JSON.stringify({ code: 500, message: 'server error' }));
    });

    it('should handle null error via String(null)', async () => {
      mockFetchPriceQuote.mockRejectedValue(null);

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('null');
    });

    it('should handle undefined error via String(undefined)', async () => {
      mockFetchPriceQuote.mockRejectedValue(undefined);

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('undefined');
    });

    it('should handle numeric errors via String(number)', async () => {
      mockFetchPriceQuote.mockRejectedValue(42);

      const result = await executeLiquidation(makeParams());

      expect(result.success).toBe(false);
      expect(result.error).toBe('42');
    });
  });

  // ─── deposit_amount edge cases ───────────────────────────────────────────────

  describe('deposit_amount edge cases (step 4)', () => {
    it('should set depositAmountSats=0 when availableCollateral exactly equals deficitAmountBtc', async () => {
      mockGetAvailableCollateralBtc.mockReturnValue(0.01);

      await executeLiquidation(makeParams({ deficitAmountBtc: 0.01 }));

      expect(mockWallet.vault.repo.ctx).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ deposit_amount: 0 })
      );
    });

    it('should round depositAmountSats up to avoid underfunding by one sat', async () => {
      // deficit = 0.015, available = 0.005 → depositBtc = 0.01
      // Due to IEEE-754 floating point: 0.015 - 0.005 = 0.009999999999999998
      mockGetAvailableCollateralBtc.mockReturnValue(0.005);

      await executeLiquidation(makeParams({ deficitAmountBtc: 0.015 }));

      expect(mockWallet.vault.repo.ctx).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ deposit_amount: 1_000_000 })
      );
    });

    it('should produce exact sats when values are exact powers of ten', async () => {
      // deficit = 0.1, available = 0 → depositBtc = 0.1 → 10_000_000 sats
      mockGetAvailableCollateralBtc.mockReturnValue(0);

      await executeLiquidation(makeParams({ deficitAmountBtc: 0.1 }));

      expect(mockWallet.vault.repo.ctx).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ deposit_amount: 10_000_000 })
      );
    });

    it('should pass feeRate from params as tx_feerate in vaultConfig', async () => {
      await executeLiquidation(makeParams({ feeRate: 25 }));

      expect(mockWallet.vault.repo.ctx).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ tx_feerate: 25 })
      );
    });
  });

  // ─── Multiple liquidVaults ────────────────────────────────────────────────────

  describe('multiple liquidVaults', () => {
    it('should pass correct vinFundIdx when there are multiple liquid vaults', async () => {
      const threeVaults = [makeLiquidVault(), makeLiquidVault(), makeLiquidVault()];
      // liquid_vaults.length = 3, so vinFundIdx = 3
      mockVaultApiRepoLiquidGetCtx.mockReturnValue({
        ...mockLiquidCtx,
        liquid_vaults: threeVaults,
      } as unknown as ReturnType<typeof VaultAPI.repo.liquidation.get_ctx>);

      const allUtxos = [{ txid: 'u1', vout: 0, value: 50_000, script: '0014' }];
      mockWallet.fetch.sats_utxos.mockResolvedValue(
        allUtxos as unknown as ReturnType<typeof mockWallet.fetch.sats_utxos> extends Promise<
          infer T
        >
          ? T
          : never
      );
      mockSelectSatUtxos.mockReturnValue(
        allUtxos as unknown as ReturnType<typeof select_sat_utxos>
      );

      await executeLiquidation(
        makeParams({
          liquidVaults: threeVaults as unknown as LiquidationExecutionParams['liquidVaults'],
        })
      );

      const batchCallArg = mockWallet.sign.batch.mock.calls[0][0];
      const [, utxoManifest] = batchCallArg[0];
      // 3 liquid vaults → vinFundIdx = 3; 1 UTXO → index [3]
      expect(utxoManifest['tb1qsegwit000000000000000000000000000000']).toEqual([3]);
    });

    it('should pass liquidVaults.length to wallet.vault.repo.quote', async () => {
      const fiveVaults = Array.from({ length: 5 }, () => makeLiquidVault());

      await executeLiquidation(
        makeParams({
          liquidVaults: fiveVaults as unknown as LiquidationExecutionParams['liquidVaults'],
        })
      );

      expect(mockWallet.vault.repo.quote).toHaveBeenCalledWith(expect.anything(), 5);
    });
  });

  // ─── registerLiquidationTxid ──────────────────────────────────────────────────

  describe('registerLiquidationTxid', () => {
    it('should be called on success with the resolved txid', async () => {
      mockGuardianSub.resolve.mockResolvedValue({ vault_txid: 'my-final-txid' });

      await executeLiquidation(makeParams());

      expect(mockRegisterLiquidationTxid).toHaveBeenCalledTimes(1);
      expect(mockRegisterLiquidationTxid).toHaveBeenCalledWith('my-final-txid');
    });

    it('should not be called when the execution fails before the guardian step', async () => {
      mockFetchPriceQuote.mockRejectedValue(new Error('early failure'));

      await executeLiquidation(makeParams());

      expect(mockRegisterLiquidationTxid).not.toHaveBeenCalled();
    });

    it('should not be called when guardian returns no txid fields', async () => {
      mockGuardianSub.resolve.mockResolvedValue({ status: 'ok' });

      await executeLiquidation(makeParams());

      expect(mockRegisterLiquidationTxid).not.toHaveBeenCalled();
    });
  });

  // ─── Concurrent / isolation ───────────────────────────────────────────────────

  describe('concurrent calls', () => {
    it('should handle two concurrent executions independently', async () => {
      const makeGuardianSubWith = (txid: string) => ({
        on: jest.fn(),
        resolve: jest.fn().mockResolvedValue({ vault_txid: txid }),
      });
      const sub1 = makeGuardianSubWith('txid-concurrent-1');
      const sub2 = makeGuardianSubWith('txid-concurrent-2');

      let callCount = 0;
      mockGetGuardianClient.mockImplementation(async () => {
        callCount++;
        return {
          req: {
            vault: {
              repo: jest.fn().mockReturnValue(callCount === 1 ? sub1 : sub2),
            },
          },
        } as unknown as ReturnType<typeof getGuardianClient> extends Promise<infer T> ? T : never;
      });

      const [r1, r2] = await Promise.all([
        executeLiquidation(makeParams()),
        executeLiquidation(makeParams()),
      ]);

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
    });
  });
});
