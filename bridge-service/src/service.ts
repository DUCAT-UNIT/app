import { randomUUID } from 'node:crypto';
import { BRIDGE_CONFIG } from './config';
import { formatUnits6, microsToMutinynetBaseUnits, parseUnits2, parseUnits6 } from './amounts';
import type {
  BridgeDeposit,
  BridgeIntent,
  CreateBridgeIntentRequest,
  PoolPosition,
  ReconciliationSnapshot,
  RedemptionRequest,
  TrackRedemptionRequest,
} from './types';

type BridgeResolution = 'credit_wunit' | 'retry_swap' | 'mark_failed';

interface BridgeIntentRecord extends BridgeIntent {
  amountMicros: bigint;
  receivedAmountMicros?: bigint;
  fulfilledAmountMicros?: bigint;
}

interface BridgeDepositRecord extends BridgeDeposit {
  amountMicros: bigint;
}

interface RedemptionRequestRecord extends RedemptionRequest {
  amountMicros: bigint;
}

interface PoolStateRecord {
  reserveWunitMicros: bigint;
  reserveUsdcMicros: bigint;
  amplification: number;
  swapFeeBps: number;
  totalLpSupplyMicros: bigint;
  paused: boolean;
}

export interface BridgeStateSnapshot {
  version: 1;
  nextDepositIndex: number;
  intents: Array<Omit<BridgeIntentRecord, 'amountMicros' | 'receivedAmountMicros' | 'fulfilledAmountMicros'> & {
    amountMicros: string;
    receivedAmountMicros?: string;
    fulfilledAmountMicros?: string;
  }>;
  deposits: Array<Omit<BridgeDepositRecord, 'amountMicros'> & { amountMicros: string }>;
  redemptions: Array<Omit<RedemptionRequestRecord, 'amountMicros'> & { amountMicros: string }>;
  custodyLockedMicros: string;
  circulatingWunitMicros: string;
  pendingReleaseMicros: string;
  bridgePaused: boolean;
  poolState: {
    reserveWunitMicros: string;
    reserveUsdcMicros: string;
    amplification: number;
    swapFeeBps: number;
    totalLpSupplyMicros: string;
    paused: boolean;
  };
  cursors: {
    sepoliaFromBlock: number;
    lastRuntimePollAt?: string;
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function isSepoliaAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function buildPlaceholderDepositAddress(index: number): string {
  return `tb1pbridge${index.toString(16).padStart(56, '0')}`.slice(0, 62);
}

function serializeIntent(record: BridgeIntentRecord): BridgeIntent {
  const { amountMicros: _amountMicros, receivedAmountMicros, fulfilledAmountMicros, ...rest } = record;
  return {
    ...rest,
    amount: formatUnits6(record.amountMicros),
    receivedAmount: receivedAmountMicros !== undefined
      ? formatUnits6(receivedAmountMicros)
      : rest.receivedAmount,
    fulfilledAmount: fulfilledAmountMicros !== undefined
      ? formatUnits6(fulfilledAmountMicros)
      : rest.fulfilledAmount,
  };
}

function serializeRedemption(record: RedemptionRequestRecord): RedemptionRequest {
  const { amountMicros: _amountMicros, ...rest } = record;
  return {
    ...rest,
    amount: formatUnits6(record.amountMicros),
  };
}

function createDefaultPoolState(): PoolStateRecord {
  return {
    reserveWunitMicros: 0n,
    reserveUsdcMicros: 0n,
    amplification: BRIDGE_CONFIG.defaultAmplification,
    swapFeeBps: BRIDGE_CONFIG.defaultSwapFeeBps,
    totalLpSupplyMicros: 0n,
    paused: false,
  };
}

export class BridgeCoordinator {
  private readonly intents = new Map<string, BridgeIntentRecord>();

  private readonly deposits = new Map<string, BridgeDepositRecord>();

  private readonly redemptions = new Map<string, RedemptionRequestRecord>();

  private nextDepositIndex = 0;

  private custodyLockedMicros = 0n;

  private circulatingWunitMicros = 0n;

  private pendingReleaseMicros = 0n;

  private bridgePaused = false;

  private poolState = createDefaultPoolState();

  private cursors = {
    sepoliaFromBlock: BRIDGE_CONFIG.sepolia.startBlock,
    lastRuntimePollAt: undefined as string | undefined,
  };

  constructor(snapshot?: BridgeStateSnapshot) {
    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  createIntent(input: CreateBridgeIntentRequest, explicitDepositAddress?: string): BridgeIntent {
    if (!isSepoliaAddress(input.sepoliaRecipient)) {
      throw new Error('Sepolia recipient must be a 0x-prefixed address');
    }

    if (input.clientRequestId) {
      const existing = this.findIntentByClientRequestId(input.clientRequestId);
      if (existing) {
        return serializeIntent(existing);
      }
    }

    const amountMicros = parseUnits6(input.amount);
    if (amountMicros <= 0n) {
      throw new Error('Amount must be greater than zero');
    }

    microsToMutinynetBaseUnits(amountMicros);

    const id = randomUUID();
    const timestamp = nowIso();
    const depositIndex = this.nextDepositIndex++;
    const record: BridgeIntentRecord = {
      id,
      clientRequestId: input.clientRequestId,
      createdAt: timestamp,
      updatedAt: timestamp,
      depositAddress: explicitDepositAddress || buildPlaceholderDepositAddress(depositIndex),
      depositIndex,
      sepoliaRecipient: input.sepoliaRecipient,
      amount: formatUnits6(amountMicros),
      amountMicros,
      autoSwap: input.autoSwap ?? true,
      status: 'pending',
    };

    this.intents.set(id, record);
    return serializeIntent(record);
  }

  getIntent(id: string): BridgeIntent | null {
    const record = this.intents.get(id);
    return record ? serializeIntent(record) : null;
  }

  getIntentByClientRequestId(clientRequestId: string): BridgeIntent | null {
    const record = this.findIntentByClientRequestId(clientRequestId);
    return record ? serializeIntent(record) : null;
  }

  listIntents(): BridgeIntent[] {
    return Array.from(this.intents.values()).map(serializeIntent).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  listPendingIntents(): BridgeIntent[] {
    return this.listIntents().filter((intent) => (
      intent.status === 'pending' ||
      intent.status === 'confirmed' ||
      intent.status === 'minted_no_swap'
    ));
  }

  expireUnusedIntents(maxAgeMs = BRIDGE_CONFIG.abandonedIntentExpiryMs): number {
    const now = Date.now();
    let expiredCount = 0;

    for (const intent of this.intents.values()) {
      if (intent.status !== 'pending') {
        continue;
      }

      if (intent.depositTxid || intent.receivedAmountMicros !== undefined || intent.confirmations) {
        continue;
      }

      if (now - new Date(intent.createdAt).getTime() <= maxAgeMs) {
        continue;
      }

      intent.updatedAt = nowIso();
      intent.status = 'failed';
      intent.error = 'Intent expired before funds were sent. Create a fresh bridge intent.';
      intent.requiresManualRecovery = false;
      expiredCount += 1;
    }

    return expiredCount;
  }

  listActiveIntentsForDepositScan(maxAgeMs = BRIDGE_CONFIG.activeIntentScanWindowMs): BridgeIntent[] {
    const now = Date.now();

    return Array.from(this.intents.values())
      .filter((intent) => {
        if (intent.status !== 'pending') {
          return false;
        }

        if (intent.depositTxid || intent.receivedAmountMicros !== undefined || intent.confirmations) {
          return true;
        }

        return now - new Date(intent.createdAt).getTime() <= maxAgeMs;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(serializeIntent);
  }

  getPendingReleaseRedemptions(): RedemptionRequest[] {
    return this.listRedemptions().filter((redemption) => redemption.status === 'pending_release');
  }

  setDerivedDepositAddress(intentId: string, depositAddress: string, depositIndex?: number): BridgeIntent {
    const intent = this.requireIntent(intentId);
    intent.depositAddress = depositAddress;
    if (depositIndex !== undefined) {
      intent.depositIndex = depositIndex;
    }
    intent.updatedAt = nowIso();
    return serializeIntent(intent);
  }

  observeDeposit(
    intentId: string,
    amount: string,
    txid: string,
    confirmations: number,
    exactMatchOverride?: boolean,
  ): BridgeIntent {
    const intent = this.requireIntent(intentId);
    const amountMicros = parseUnits6(amount);
    const timestamp = nowIso();
    const depositId = `${intentId}:${txid}`;
    const existingDeposit = this.deposits.get(depositId);

    if (!existingDeposit) {
      this.deposits.set(depositId, {
        id: depositId,
        intentId,
        txid,
        amount: formatUnits6(amountMicros),
        amountMicros,
        confirmations,
        observedAt: timestamp,
        custodyAddress: intent.depositAddress,
        exactMatch: exactMatchOverride ?? amountMicros === intent.amountMicros,
      });
      this.custodyLockedMicros += amountMicros;
    } else {
      existingDeposit.confirmations = confirmations;
      existingDeposit.observedAt = timestamp;
    }

    const exactMatch = exactMatchOverride ?? amountMicros === intent.amountMicros;
    const staleIntent = Date.now() - new Date(intent.createdAt).getTime() > BRIDGE_CONFIG.intentExpiryMs;

    intent.updatedAt = timestamp;
    intent.depositTxid = txid;
    intent.confirmations = confirmations;
    intent.receivedAmountMicros = amountMicros;

    if (confirmations < BRIDGE_CONFIG.confirmationThreshold) {
      intent.status = 'pending';
      return serializeIntent(intent);
    }

    if (!exactMatch) {
      intent.status = 'failed';
      intent.error = 'Deposit amount mismatch. Sent funds are held for manual recovery.';
      intent.requiresManualRecovery = true;
      return serializeIntent(intent);
    }

    if (staleIntent) {
      intent.status = 'failed';
      intent.error = 'Intent expired before funds arrived. Manual recovery required.';
      intent.requiresManualRecovery = true;
      return serializeIntent(intent);
    }

    intent.status = 'confirmed';
    delete intent.error;
    return serializeIntent(intent);
  }

  simulateDeposit(intentId: string, amount: string, txid = `mutiny-${randomUUID()}`, confirmations = 1): BridgeIntent {
    const observed = this.observeDeposit(intentId, amount, txid, confirmations);
    if (observed.status === 'confirmed') {
      return this.fulfillIntent(intentId);
    }
    return observed;
  }

  fulfillIntent(intentId: string, overrideAutoSwap?: boolean): BridgeIntent {
    const intent = this.requireIntent(intentId);
    if (this.bridgePaused) {
      throw new Error('Bridge is paused');
    }

    const autoSwap = overrideAutoSwap ?? intent.autoSwap;
    const timestamp = nowIso();
    intent.updatedAt = timestamp;
    if (intent.fulfilledAmountMicros === undefined) {
      intent.fulfilledAmountMicros = intent.amountMicros;
      this.circulatingWunitMicros += intent.amountMicros;
    }

    if (!autoSwap) {
      intent.status = 'fulfilled';
      intent.payoutAsset = 'wUNIT';
      intent.payoutAmount = formatUnits6(intent.amountMicros);
      return serializeIntent(intent);
    }

    if (this.poolState.paused || this.poolState.reserveUsdcMicros === 0n) {
      intent.status = 'minted_no_swap';
      intent.error = 'Auto-swap unavailable. Credited as raw wUNIT.';
      intent.payoutAsset = 'wUNIT';
      intent.payoutAmount = formatUnits6(intent.amountMicros);
      return serializeIntent(intent);
    }

    const quotedUsdcMicros = this.quotePoolSwapMicros('wUNIT', intent.amountMicros);
    if (quotedUsdcMicros <= 0n || quotedUsdcMicros > this.poolState.reserveUsdcMicros) {
      intent.status = 'minted_no_swap';
      intent.error = 'Auto-swap failed liquidity guards. Credited as raw wUNIT.';
      intent.payoutAsset = 'wUNIT';
      intent.payoutAmount = formatUnits6(intent.amountMicros);
      return serializeIntent(intent);
    }

    this.poolState.reserveWunitMicros += intent.amountMicros;
    this.poolState.reserveUsdcMicros -= quotedUsdcMicros;

    intent.status = 'fulfilled';
    intent.payoutAsset = 'USDC';
    intent.payoutAmount = formatUnits6(quotedUsdcMicros);
    return serializeIntent(intent);
  }

  recordFulfillment(
    intentId: string,
    params: {
      payoutAsset: 'USDC' | 'wUNIT';
      payoutAmount: string;
      sepoliaTxHash: string;
      autoSwapSucceeded: boolean;
      error?: string;
    },
  ): BridgeIntent {
    const intent = this.requireIntent(intentId);
    intent.updatedAt = nowIso();
    intent.sepoliaTxHash = params.sepoliaTxHash;
    intent.fulfilledAmountMicros = intent.amountMicros;
    intent.payoutAsset = params.payoutAsset;
    intent.payoutAmount = params.payoutAmount;
    intent.status = params.autoSwapSucceeded ? 'fulfilled' : 'minted_no_swap';
    if (params.error) {
      intent.error = params.error;
    } else {
      delete intent.error;
    }
    return serializeIntent(intent);
  }

  markIntentFailed(intentId: string, error: string, requiresManualRecovery = true): BridgeIntent {
    const intent = this.requireIntent(intentId);
    intent.updatedAt = nowIso();
    intent.status = 'failed';
    intent.error = error;
    intent.requiresManualRecovery = requiresManualRecovery;
    return serializeIntent(intent);
  }

  manualResolveIntent(intentId: string, resolution: BridgeResolution): BridgeIntent {
    const intent = this.requireIntent(intentId);
    intent.updatedAt = nowIso();
    intent.requiresManualRecovery = false;

    if (resolution === 'credit_wunit') {
      if (intent.fulfilledAmountMicros === undefined) {
        this.circulatingWunitMicros += intent.amountMicros;
        intent.fulfilledAmountMicros = intent.amountMicros;
      }
      intent.status = 'fulfilled';
      intent.payoutAsset = 'wUNIT';
      intent.payoutAmount = formatUnits6(intent.amountMicros);
      delete intent.error;
      return serializeIntent(intent);
    }

    if (resolution === 'retry_swap') {
      delete intent.error;
      return this.fulfillIntent(intentId, true);
    }

    intent.status = 'failed';
    intent.error = 'Intent marked failed after manual review.';
    return serializeIntent(intent);
  }

  replayIntent(intentId: string): BridgeIntent {
    const intent = this.requireIntent(intentId);
    if (intent.status !== 'failed' && intent.status !== 'minted_no_swap') {
      throw new Error('Only failed or fallback intents can be replayed');
    }
    return this.fulfillIntent(intentId, true);
  }

  trackRedemption(input: TrackRedemptionRequest): RedemptionRequest {
    const amountMicros = parseUnits6(input.amount);
    if (amountMicros <= 0n) {
      throw new Error('Redemption amount must be greater than zero');
    }

    const existing = this.redemptions.get(input.id);
    if (existing) {
      return serializeRedemption(existing);
    }

    const timestamp = nowIso();
    const record: RedemptionRequestRecord = {
      id: input.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      requester: input.requester,
      destinationTaprootAddress: input.destinationTaprootAddress,
      amount: formatUnits6(amountMicros),
      amountMicros,
      sourceAsset: input.sourceAsset,
      burnTxHash: input.burnTxHash,
      status: 'pending_release',
    };

    this.redemptions.set(record.id, record);
    this.pendingReleaseMicros += amountMicros;
    this.circulatingWunitMicros = this.circulatingWunitMicros >= amountMicros
      ? this.circulatingWunitMicros - amountMicros
      : 0n;

    return serializeRedemption(record);
  }

  getRedemption(id: string): RedemptionRequest | null {
    const record = this.redemptions.get(id);
    return record ? serializeRedemption(record) : null;
  }

  listRedemptions(): RedemptionRequest[] {
    return Array.from(this.redemptions.values()).map(serializeRedemption).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  completeRedemption(id: string, releaseTxid = `release-${randomUUID()}`): RedemptionRequest {
    const record = this.requireRedemption(id);
    record.updatedAt = nowIso();
    record.releaseTxid = releaseTxid;
    record.status = 'released';
    this.pendingReleaseMicros = this.pendingReleaseMicros >= record.amountMicros
      ? this.pendingReleaseMicros - record.amountMicros
      : 0n;
    this.custodyLockedMicros = this.custodyLockedMicros >= record.amountMicros
      ? this.custodyLockedMicros - record.amountMicros
      : 0n;

    return serializeRedemption(record);
  }

  replayRedemption(id: string): RedemptionRequest {
    const record = this.requireRedemption(id);
    record.updatedAt = nowIso();
    record.status = 'pending_release';
    delete record.error;
    delete record.releaseTxid;
    return serializeRedemption(record);
  }

  markRedemptionFailed(id: string, error: string): RedemptionRequest {
    const record = this.requireRedemption(id);
    record.updatedAt = nowIso();
    record.status = 'failed';
    record.error = error;
    return serializeRedemption(record);
  }

  getPoolPosition(): PoolPosition {
    return {
      reserveWunit: formatUnits6(this.poolState.reserveWunitMicros),
      reserveUsdc: formatUnits6(this.poolState.reserveUsdcMicros),
      amplification: this.poolState.amplification,
      swapFeeBps: this.poolState.swapFeeBps,
      totalLpSupply: formatUnits6(this.poolState.totalLpSupplyMicros),
      virtualPrice: this.poolState.totalLpSupplyMicros === 0n
        ? '1'
        : formatUnits6(
          ((this.poolState.reserveWunitMicros + this.poolState.reserveUsdcMicros) * 1_000_000n)
          / this.poolState.totalLpSupplyMicros,
        ),
      paused: this.poolState.paused,
    };
  }

  seedLiquidity(wunitAmount: string, usdcAmount: string): PoolPosition {
    const wunitMicros = parseUnits6(wunitAmount);
    const usdcMicros = parseUnits6(usdcAmount);
    if (this.poolState.totalLpSupplyMicros !== 0n) {
      throw new Error('Pool already seeded');
    }
    if (wunitMicros <= 0n || usdcMicros <= 0n) {
      throw new Error('Bootstrap amounts must both be positive');
    }

    this.poolState.reserveWunitMicros = wunitMicros;
    this.poolState.reserveUsdcMicros = usdcMicros;
    this.poolState.totalLpSupplyMicros = wunitMicros + usdcMicros;
    this.circulatingWunitMicros += wunitMicros;
    return this.getPoolPosition();
  }

  addLiquidity(wunitAmount: string, usdcAmount: string): PoolPosition {
    const wunitMicros = parseUnits6(wunitAmount);
    const usdcMicros = parseUnits6(usdcAmount);
    this.poolState.reserveWunitMicros += wunitMicros;
    this.poolState.reserveUsdcMicros += usdcMicros;
    this.poolState.totalLpSupplyMicros += wunitMicros + usdcMicros;
    this.circulatingWunitMicros += wunitMicros;
    return this.getPoolPosition();
  }

  removeLiquidity(share: string): PoolPosition {
    const shareBps = Number(share);
    if (!Number.isFinite(shareBps) || shareBps <= 0 || shareBps > 10_000) {
      throw new Error('Liquidity removal share must be in basis points');
    }

    const wunitOut = (this.poolState.reserveWunitMicros * BigInt(shareBps)) / 10_000n;
    const usdcOut = (this.poolState.reserveUsdcMicros * BigInt(shareBps)) / 10_000n;
    const lpOut = (this.poolState.totalLpSupplyMicros * BigInt(shareBps)) / 10_000n;

    this.poolState.reserveWunitMicros -= wunitOut;
    this.poolState.reserveUsdcMicros -= usdcOut;
    this.poolState.totalLpSupplyMicros -= lpOut;
    return this.getPoolPosition();
  }

  setBridgePaused(paused: boolean): void {
    this.bridgePaused = paused;
  }

  setPoolPaused(paused: boolean): void {
    this.poolState.paused = paused;
  }

  syncOnchainPool(pool: {
    reserveWunit: bigint;
    reserveUsdc: bigint;
    amplification: number;
    swapFeeBps: number;
    totalLpSupply: bigint;
    paused: boolean;
  }): void {
    this.poolState = {
      reserveWunitMicros: pool.reserveWunit,
      reserveUsdcMicros: pool.reserveUsdc,
      amplification: pool.amplification,
      swapFeeBps: pool.swapFeeBps,
      totalLpSupplyMicros: pool.totalLpSupply,
      paused: pool.paused,
    };
  }

  syncCirculatingSupply(circulatingMicros: bigint): void {
    this.circulatingWunitMicros = circulatingMicros;
  }

  getReconciliation(): ReconciliationSnapshot {
    const availableBackingMicros = this.custodyLockedMicros - this.pendingReleaseMicros;
    const driftMicros = availableBackingMicros - this.circulatingWunitMicros;
    return {
      asOf: nowIso(),
      lockedUnit: formatUnits6(this.custodyLockedMicros),
      circulatingWunit: formatUnits6(this.circulatingWunitMicros),
      pendingReleaseUnit: formatUnits6(this.pendingReleaseMicros),
      availableBacking: formatUnits6(availableBackingMicros),
      isBacked: driftMicros >= 0n,
      drift: formatUnits6(driftMicros),
      alert: driftMicros < 0n
        ? 'Backing deficit detected: locked UNIT is below circulating wUNIT after pending releases.'
        : undefined,
    };
  }

  getAdminState(): {
    bridgePaused: boolean;
    poolPaused: boolean;
    intents: BridgeIntent[];
    redemptions: RedemptionRequest[];
    failedIntents: BridgeIntent[];
    reconciliation: ReconciliationSnapshot;
    pool: PoolPosition;
    cursors: { sepoliaFromBlock: number; lastRuntimePollAt?: string };
  } {
    const intents = this.listIntents();
    return {
      bridgePaused: this.bridgePaused,
      poolPaused: this.poolState.paused,
      intents,
      redemptions: this.listRedemptions(),
      failedIntents: intents.filter((intent) => intent.status === 'failed'),
      reconciliation: this.getReconciliation(),
      pool: this.getPoolPosition(),
      cursors: { ...this.cursors },
    };
  }

  setSepoliaCursor(blockNumber: number): void {
    this.cursors.sepoliaFromBlock = blockNumber;
  }

  setLastRuntimePollAt(timestamp = nowIso()): void {
    this.cursors.lastRuntimePollAt = timestamp;
  }

  exportSnapshot(): BridgeStateSnapshot {
    return {
      version: 1,
      nextDepositIndex: this.nextDepositIndex,
      intents: Array.from(this.intents.values()).map((intent) => ({
        ...intent,
        amountMicros: intent.amountMicros.toString(),
        receivedAmountMicros: intent.receivedAmountMicros?.toString(),
        fulfilledAmountMicros: intent.fulfilledAmountMicros?.toString(),
      })),
      deposits: Array.from(this.deposits.values()).map((deposit) => ({
        ...deposit,
        amountMicros: deposit.amountMicros.toString(),
      })),
      redemptions: Array.from(this.redemptions.values()).map((redemption) => ({
        ...redemption,
        amountMicros: redemption.amountMicros.toString(),
      })),
      custodyLockedMicros: this.custodyLockedMicros.toString(),
      circulatingWunitMicros: this.circulatingWunitMicros.toString(),
      pendingReleaseMicros: this.pendingReleaseMicros.toString(),
      bridgePaused: this.bridgePaused,
      poolState: {
        reserveWunitMicros: this.poolState.reserveWunitMicros.toString(),
        reserveUsdcMicros: this.poolState.reserveUsdcMicros.toString(),
        amplification: this.poolState.amplification,
        swapFeeBps: this.poolState.swapFeeBps,
        totalLpSupplyMicros: this.poolState.totalLpSupplyMicros.toString(),
        paused: this.poolState.paused,
      },
      cursors: { ...this.cursors },
    };
  }

  private loadSnapshot(snapshot: BridgeStateSnapshot): void {
    this.intents.clear();
    this.deposits.clear();
    this.redemptions.clear();
    this.nextDepositIndex = snapshot.nextDepositIndex || 0;

    for (const intent of snapshot.intents || []) {
      this.intents.set(intent.id, {
        ...intent,
        amountMicros: BigInt(intent.amountMicros),
        receivedAmountMicros: intent.receivedAmountMicros !== undefined ? BigInt(intent.receivedAmountMicros) : undefined,
        fulfilledAmountMicros: intent.fulfilledAmountMicros !== undefined ? BigInt(intent.fulfilledAmountMicros) : undefined,
      });
    }

    for (const deposit of snapshot.deposits || []) {
      this.deposits.set(deposit.id, {
        ...deposit,
        amountMicros: BigInt(deposit.amountMicros),
      });
    }

    for (const redemption of snapshot.redemptions || []) {
      this.redemptions.set(redemption.id, {
        ...redemption,
        amountMicros: BigInt(redemption.amountMicros),
      });
    }

    this.custodyLockedMicros = BigInt(snapshot.custodyLockedMicros || '0');
    this.circulatingWunitMicros = BigInt(snapshot.circulatingWunitMicros || '0');
    this.pendingReleaseMicros = BigInt(snapshot.pendingReleaseMicros || '0');
    this.bridgePaused = Boolean(snapshot.bridgePaused);
    this.poolState = {
      reserveWunitMicros: BigInt(snapshot.poolState?.reserveWunitMicros || '0'),
      reserveUsdcMicros: BigInt(snapshot.poolState?.reserveUsdcMicros || '0'),
      amplification: snapshot.poolState?.amplification ?? BRIDGE_CONFIG.defaultAmplification,
      swapFeeBps: snapshot.poolState?.swapFeeBps ?? BRIDGE_CONFIG.defaultSwapFeeBps,
      totalLpSupplyMicros: BigInt(snapshot.poolState?.totalLpSupplyMicros || '0'),
      paused: Boolean(snapshot.poolState?.paused),
    };
    this.cursors = {
      sepoliaFromBlock: snapshot.cursors?.sepoliaFromBlock ?? BRIDGE_CONFIG.sepolia.startBlock,
      lastRuntimePollAt: snapshot.cursors?.lastRuntimePollAt,
    };
  }

  private requireIntent(intentId: string): BridgeIntentRecord {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Bridge intent ${intentId} was not found`);
    }
    return intent;
  }

  private findIntentByClientRequestId(clientRequestId: string): BridgeIntentRecord | undefined {
    for (const intent of this.intents.values()) {
      if (intent.clientRequestId === clientRequestId) {
        return intent;
      }
    }
    return undefined;
  }

  private requireRedemption(id: string): RedemptionRequestRecord {
    const record = this.redemptions.get(id);
    if (!record) {
      throw new Error(`Redemption ${id} was not found`);
    }
    return record;
  }

  private quotePoolSwapMicros(tokenIn: 'wUNIT' | 'USDC', amountMicros: bigint): bigint {
    if (amountMicros <= 0n) {
      return 0n;
    }

    const reserveIn = tokenIn === 'wUNIT' ? this.poolState.reserveWunitMicros : this.poolState.reserveUsdcMicros;
    const reserveOut = tokenIn === 'wUNIT' ? this.poolState.reserveUsdcMicros : this.poolState.reserveWunitMicros;

    if (reserveIn <= 0n || reserveOut <= 0n) {
      return 0n;
    }

    const feeAdjusted = (amountMicros * BigInt(10_000 - this.poolState.swapFeeBps)) / 10_000n;
    const amplifiedIn = reserveIn * BigInt(this.poolState.amplification);
    const amplifiedOut = reserveOut * BigInt(this.poolState.amplification);
    const amountOut = (feeAdjusted * amplifiedOut) / (amplifiedIn + feeAdjusted);
    return amountOut > reserveOut ? reserveOut : amountOut;
  }
}

export function normalizeMutinynetAmountInput(amount: string): string {
  return formatUnits6(parseUnits2(amount) * 10_000n);
}
