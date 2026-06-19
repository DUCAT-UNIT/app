import { TOPICS } from '../const.js';
export type MessageEnvelope = [type: MessageType, id: string, topic: string, data: unknown, code?: number];
export type MessageTopic = typeof TOPICS;
export type MessageType = 'request' | 'reject' | 'result' | 'info' | 'status';
export type SubscriptionResult<T = unknown> = SubscriptionData<T> | SubscriptionError;
export interface MessageConfig<T = unknown> {
    data: T;
    id?: string;
    topic: string;
}
export interface MessageData<T = unknown> extends MessageConfig<T> {
    id: string;
    type: MessageType;
    code?: number;
}
export interface SubscriptionData<T = unknown> {
    ok: true;
    data: T;
}
export interface SubscriptionError {
    ok: false;
    reason: unknown;
}
export interface SubscriptionEventMap<T = unknown> extends Record<string, any[]> {
    message: [MessageData];
    bounced: [reason: string, data: unknown];
    info: [string];
    reject: [unknown];
    result: [T];
    status: [string];
}
export interface WebSocketEventMap extends Record<string, any[]> {
    bounced: [reason: string, data: unknown];
    close: [undefined];
    error: [string];
    message: [MessageData];
    ready: [undefined];
}
