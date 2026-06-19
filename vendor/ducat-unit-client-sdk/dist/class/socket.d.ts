import { EventEmitter } from './emitter.js';
import type { MessageConfig, MessageData, SubscriptionEventMap, SubscriptionResult, WebSocketEventMap } from '../types/index.js';
import type { ObserveContext, ObservabilityOptions } from '../lib/observe/index.js';
export interface WebSocketClientOptions {
    allow_insecure_ws?: boolean;
    observability?: ObservabilityOptions | ObserveContext;
}
export declare function sanitize_bounced_data(data: unknown): string;
export declare class WebSocketClient extends EventEmitter<WebSocketEventMap> {
    private readonly _observe;
    private readonly _socket;
    private readonly _url;
    constructor(socket: string | WebSocket, options?: WebSocketClientOptions);
    get ready(): boolean;
    get url(): string;
    get observe(): ObserveContext;
    close(): void;
    send(message: MessageData): void;
    subscribe<T = unknown>(request: MessageConfig): SocketSubscription<T>;
}
export declare class SocketSubscription<T> extends EventEmitter<SubscriptionEventMap<T>> {
    private readonly _request;
    private readonly _socket;
    constructor(socket: WebSocketClient, request: MessageConfig);
    get id(): string;
    get socket(): WebSocketClient;
    get topic(): string;
    _connect(timeout?: number): Promise<void>;
    _filter(msg: MessageData): boolean;
    _resolve(timeout: number): Promise<SubscriptionResult<T>>;
    send(timeout?: number): Promise<SubscriptionResult<T>>;
}
