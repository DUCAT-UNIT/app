import { BridgeCoordinator } from '../service';

describe('BridgeCoordinator', () => {
  it('creates intents and fulfills exact-match deposits into USDC by default', () => {
    const service = new BridgeCoordinator();
    service.seedLiquidity('1000', '1000');

    const intent = service.createIntent({
      amount: '25',
      sepoliaRecipient: '0x1111111111111111111111111111111111111111',
      autoSwap: true,
    });

    const fulfilled = service.simulateDeposit(intent.id, '25', 'mutiny-1', 1);
    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.payoutAsset).toBe('USDC');
  });

  it('sends mismatched deposits into manual recovery instead of auto-crediting', () => {
    const service = new BridgeCoordinator();
    const intent = service.createIntent({
      amount: '10',
      sepoliaRecipient: '0x2222222222222222222222222222222222222222',
      autoSwap: true,
    });

    const result = service.simulateDeposit(intent.id, '9.5', 'mutiny-2', 1);
    expect(result.status).toBe('failed');
    expect(result.requiresManualRecovery).toBe(true);
  });

  it('falls back to raw wUNIT when the pool cannot safely auto-swap', () => {
    const service = new BridgeCoordinator();
    const intent = service.createIntent({
      amount: '50',
      sepoliaRecipient: '0x3333333333333333333333333333333333333333',
      autoSwap: true,
    });

    const result = service.simulateDeposit(intent.id, '50', 'mutiny-3', 1);
    expect(result.status).toBe('minted_no_swap');
    expect(result.payoutAsset).toBe('wUNIT');
  });

  it('tracks redemptions and reconciliation drift through release completion', () => {
    const service = new BridgeCoordinator();

    const intent = service.createIntent({
      amount: '100',
      sepoliaRecipient: '0x4444444444444444444444444444444444444444',
      autoSwap: false,
    });

    service.simulateDeposit(intent.id, '100', 'mutiny-4', 1);
    const pending = service.trackRedemption({
      id: 'release-1',
      requester: '0x4444444444444444444444444444444444444444',
      destinationTaprootAddress: 'tb1pdestination',
      amount: '60',
      sourceAsset: 'wUNIT',
      burnTxHash: '0xburn',
    });

    expect(pending.status).toBe('pending_release');
    expect(service.getReconciliation().isBacked).toBe(true);

    const released = service.completeRedemption('release-1', 'bitcoin-release');
    expect(released.status).toBe('released');
    expect(service.getReconciliation().pendingReleaseUnit).toBe('0');
  });
});
