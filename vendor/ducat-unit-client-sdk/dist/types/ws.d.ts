import type { SocketSubscription, WebSocketClient } from '../class/socket.js';
export type EventMap = Record<string, any>;
export type EventType = 'req' | 'rej' | 'res' | 'info';
export type MessageEnvelope = [type: EventType, id: string, topic: string, data: any];
export type SubscriptionHandler<T extends SubscriptionEventMap> = (sub: SocketSubscription<T>, msg: MessageData<T>) => void;
export interface MessageConfig {
    data: any;
    id: string;
    topic: string;
    type: EventType;
}
export interface MessageData<T = any> {
    data: T;
    id: string;
    topic: string;
    type: EventType;
}
export interface SocketEventMap {
    bounced: [reason: string, data: any];
    close: WebSocketClient;
    error: string;
    message: MessageData;
    ready: WebSocketClient;
}
export interface SubscriptionEventMap<T = any> extends Record<string, any> {
    'err': string;
    'info': string;
    'msg': MessageData;
    'rej': string;
    'res': T;
}
