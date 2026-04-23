import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { BRIDGE_CONFIG } from './config';
import type { BridgeStateSnapshot } from './service';

const EMPTY_STATE: BridgeStateSnapshot = {
  version: 1,
  nextDepositIndex: 0,
  intents: [],
  deposits: [],
  redemptions: [],
  custodyLockedMicros: '0',
  circulatingWunitMicros: '0',
  pendingReleaseMicros: '0',
  bridgePaused: false,
  poolState: {
    reserveWunitMicros: '0',
    reserveUsdcMicros: '0',
    amplification: 200,
    swapFeeBps: 4,
    totalLpSupplyMicros: '0',
    paused: false,
  },
  cursors: {
    sepoliaFromBlock: BRIDGE_CONFIG.sepolia.startBlock,
  },
};

export class BridgeStateStore {
  private readonly filePath = BRIDGE_CONFIG.stateFilePath;

  load(): BridgeStateSnapshot {
    if (!existsSync(this.filePath)) {
      return EMPTY_STATE;
    }

    const raw = readFileSync(this.filePath, 'utf8');
    const parsed = JSON.parse(raw) as BridgeStateSnapshot;
    return {
      ...EMPTY_STATE,
      ...parsed,
      poolState: {
        ...EMPTY_STATE.poolState,
        ...parsed.poolState,
      },
      cursors: {
        ...EMPTY_STATE.cursors,
        ...parsed.cursors,
      },
    };
  }

  save(snapshot: BridgeStateSnapshot): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2));
  }
}
