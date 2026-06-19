import { Buff } from '@vbyte/buff';
export declare class SeekBuffer {
    private buffer;
    seekIndex: number;
    constructor(buffer: Buff);
    readUInt8(): number | undefined;
    isFinished(): boolean;
}
