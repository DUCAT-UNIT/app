export interface SignedEvent {
    content: string;
    id: string;
    kind: number;
    pubkey: string;
    sig: string;
    stamp: number;
    tags: string[][];
}
