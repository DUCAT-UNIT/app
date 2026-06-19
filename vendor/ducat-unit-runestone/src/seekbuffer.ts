/**
 * @fileoverview runestone-ts/src/seekbuffer.ts
 */

import { Buff } from '@vbyte/buff';

export class SeekBuffer {
  public seekIndex: number = 0;

  constructor(private buffer: Buff) {}

  readUInt8(): number | undefined {
    if (this.isFinished()) {
      return undefined;
    }

    return this.buffer[this.seekIndex++];
  }

  isFinished(): boolean {
    return this.seekIndex >= this.buffer.length;
  }
}
