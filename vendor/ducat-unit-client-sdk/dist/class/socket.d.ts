import { EventEmitter } from './emitter.js';
import type { MessageConfig, MessageData, SocketEventMap, SubscriptionEventMap, SubscriptionHandler } from '../types/index.js';
export declare class WebSocketClient extends EventEmitter<SocketEventMap> {
    private readonly _url;
    private readonly _socket;
    constructor(socket: string | WebSocket);
    get ready(): boolean;
    get url(): string;
    send(config: MessageConfig): void;
}
export declare class SocketSubscription<T extends SubscriptionEventMap> extends EventEmitter<T> {
    private readonly _client;
    private readonly _id;
    private readonly _topic;
    private _outbox;
    constructor(client: WebSocketClient, topic: string, identifier?: string);
    get client(): WebSocketClient;
    get id(): string;
    _filter(msg: MessageData): boolean;
    _resolve(timeout: number): Promise<T['res']>;
    _send(): void;
    register(handler: SubscriptionHandler<T>): void;
    resolve(timeout?: number): Promise<T["res"]>;
    send(data: any): void;
}
