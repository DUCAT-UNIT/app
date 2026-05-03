type EventKey<S extends EventMap> = string & keyof S;
type EventMap = Record<string, any>;
export declare class EventEmitter<S extends EventMap = {}> {
    private readonly _events;
    constructor();
    private _getHandlers;
    has: (event: string) => boolean;
    on: <K extends EventKey<S>>(event: K, fn: (payload: S[K]) => void | Promise<void>) => void;
    once: <K extends EventKey<S>>(event: K, fn: (payload: S[K]) => void | Promise<void>) => void;
    within: <K extends EventKey<S>>(event: K, fn: (payload: S[K]) => void | Promise<void>, timeout: number) => void;
    emit: <K extends EventKey<S>>(event: K, payload?: S[K] | null) => void;
    remove: <K extends EventKey<S>>(event: K, fn: (payload: S[K]) => void) => void;
    clear: (event: string) => void;
}
export {};
