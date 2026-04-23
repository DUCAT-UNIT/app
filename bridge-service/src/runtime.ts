import { BRIDGE_CONFIG, isLiveBridgeRuntimeConfigured } from './config';
import { formatUnits6, parseUnits6 } from './amounts';
import { BridgeCoordinator } from './service';
import { BridgeStateStore } from './stateStore';
import { buildAndBroadcastReleaseTransaction, deriveDepositAddress, detectDepositForAddress } from './mutinynet';
import { fetchRedemptionEvents, fulfillSepoliaIntent, syncSepoliaState } from './sepolia';

export class BridgeRuntime {
  private readonly store = new BridgeStateStore();

  readonly coordinator: BridgeCoordinator;

  private pollTimer: NodeJS.Timeout | null = null;

  private running = false;

  constructor() {
    this.coordinator = new BridgeCoordinator(this.store.load());
  }

  save(): void {
    this.store.save(this.coordinator.exportSnapshot());
  }

  createIntent(input: Parameters<BridgeCoordinator['createIntent']>[0]) {
    const snapshot = this.coordinator.exportSnapshot();
    const depositIndex = snapshot.nextDepositIndex;
    const depositAddress = isLiveBridgeRuntimeConfigured()
      ? deriveDepositAddress(depositIndex)
      : undefined;
    const intent = this.coordinator.createIntent(input, depositAddress);
    this.save();
    return intent;
  }

  start(): void {
    if (!BRIDGE_CONFIG.runtimeEnabled || this.pollTimer) {
      return;
    }

    this.poll().catch(() => undefined);
    this.pollTimer = setInterval(() => {
      this.poll().catch(() => undefined);
    }, BRIDGE_CONFIG.pollIntervalMs);
    this.pollTimer.unref();
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async poll(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      if (isLiveBridgeRuntimeConfigured()) {
        await this.syncSepolia();
        await this.scanDeposits();
        await this.fulfillConfirmedIntents();
        await this.syncRedemptions();
        await this.executePendingReleases();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown runtime error';
      process.stderr.write(`[unit-bridge-runtime] ${message}\n`);
    } finally {
      this.coordinator.setLastRuntimePollAt();
      this.save();
      this.running = false;
    }
  }

  private isRetryableReleaseError(message: string): boolean {
    return (
      message.includes('No confirmed BTC fee UTXO is available for custody releases')
      || message.includes('Requested BTC fee UTXO for custody releases; waiting for confirmation')
      || message.includes('BTC fee UTXO is awaiting confirmation for custody releases')
    );
  }

  private async syncSepolia(): Promise<void> {
    const onchain = await syncSepoliaState();
    this.coordinator.syncCirculatingSupply(onchain.supply);
    this.coordinator.syncOnchainPool(onchain.pool);
  }

  private async scanDeposits(): Promise<void> {
    const expiredCount = this.coordinator.expireUnusedIntents();
    if (expiredCount > 0) {
      this.save();
    }

    const intents = this.coordinator.listActiveIntentsForDepositScan();
    for (const intent of intents) {
      const detected = await detectDepositForAddress(intent.depositAddress, parseUnits6(intent.amount));
      if (!detected) {
        continue;
      }

      this.coordinator.observeDeposit(
        intent.id,
        formatUnits6(detected.amountMicros),
        detected.txid,
        detected.confirmations,
        detected.exactMatch,
      );
      this.save();
    }
  }

  private async fulfillConfirmedIntents(): Promise<void> {
    const intents = this.coordinator.listIntents();
    for (const intent of intents) {
      if (intent.status !== 'confirmed') {
        continue;
      }

      try {
        const result = await fulfillSepoliaIntent({
          id: intent.id,
          sepoliaRecipient: intent.sepoliaRecipient,
          amount: intent.amount,
          autoSwap: intent.autoSwap,
        });
        this.coordinator.recordFulfillment(intent.id, {
          payoutAsset: result.payoutAsset,
          payoutAmount: result.payoutAmount,
          sepoliaTxHash: result.txHash,
          autoSwapSucceeded: result.autoSwapSucceeded,
          error: result.autoSwapSucceeded ? undefined : 'Auto-swap failed liquidity guards. Credited as raw wUNIT.',
        });
      } catch (error) {
        this.coordinator.markIntentFailed(
          intent.id,
          error instanceof Error ? error.message : 'Sepolia fulfillment failed',
          true,
        );
      }
      this.save();
    }
  }

  private async syncRedemptions(): Promise<void> {
    const adminState = this.coordinator.getAdminState();
    const { events, nextBlock } = await fetchRedemptionEvents(adminState.cursors.sepoliaFromBlock);
    for (const event of events) {
      this.coordinator.trackRedemption({
        id: event.releaseId,
        requester: event.requester,
        destinationTaprootAddress: event.destinationTaprootAddress,
        amount: event.amount,
        sourceAsset: 'wUNIT',
        burnTxHash: event.burnTxHash,
      });
    }
    this.coordinator.setSepoliaCursor(nextBlock);
  }

  private async executePendingReleases(): Promise<void> {
    const snapshot = this.coordinator.exportSnapshot();
    const knownIndexes = snapshot.intents
      .filter((intent) => (
        typeof intent.depositIndex === 'number'
        && Boolean(intent.depositTxid)
        && (intent.confirmations ?? 0) >= BRIDGE_CONFIG.confirmationThreshold
      ))
      .map((intent) => intent.depositIndex)
      .filter((value): value is number => typeof value === 'number');

    for (const redemption of this.coordinator.getPendingReleaseRedemptions()) {
      try {
        process.stderr.write(
          `[unit-bridge-runtime] executing release ${redemption.id} using ${knownIndexes.length} funded custody indexes\n`,
        );
        const txid = await buildAndBroadcastReleaseTransaction({
          destinationTaprootAddress: redemption.destinationTaprootAddress,
          amountMicros: parseUnits6(redemption.amount),
          knownDepositIndexes: knownIndexes,
        });
        process.stderr.write(
          `[unit-bridge-runtime] release ${redemption.id} broadcast ${txid}\n`,
        );
        this.coordinator.completeRedemption(redemption.id, txid);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Mutinynet release failed';
        process.stderr.write(`[unit-bridge-runtime] release ${redemption.id} ${message}\n`);
        if (!this.isRetryableReleaseError(message)) {
          this.coordinator.markRedemptionFailed(redemption.id, message);
        }
      }
      this.save();
    }
  }
}
