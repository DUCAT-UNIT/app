import { Buff } from '@vbyte/buff';
import { parse_error } from '@vbyte/util/helpers';
import { EventEmitter } from './emitter.js';
import { SUB_TIMEOUT } from '../const.js';
import { WebSocketError } from '../lib/errors/index.js';
import { child_observe_context, emit_debug, emit_error, emit_info, emit_warn, get_observe_context, } from '../lib/observe/index.js';
import * as SCHEMA from '../schema/index.js';
const MAX_BOUNCED_DATA_LENGTH = 500;
export function sanitize_bounced_data(data) {
    if (data === null || data === undefined) {
        return '[empty]';
    }
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        return '[binary data]';
    }
    const str = typeof data === 'string' ? data : String(data);
    if (str.length > MAX_BOUNCED_DATA_LENGTH) {
        return `${str.slice(0, MAX_BOUNCED_DATA_LENGTH)}...[truncated]`;
    }
    return str;
}
function get_socket_error_reason(err) {
    const reason = parse_error(err);
    if (typeof reason === 'string' && reason !== '[object ErrorEvent]') {
        return reason;
    }
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'object' && err !== null && 'error' in err) {
        return parse_error(err.error);
    }
    return 'websocket connection error';
}
function validate_socket_url(url, observe, options) {
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        throw new WebSocketError('Invalid WebSocket URL protocol. Expected ws:// or wss://');
    }
    const is_insecure = url.startsWith('ws://');
    const allow_insecure = options.allow_insecure_ws === true;
    if (is_insecure && !allow_insecure) {
        throw new WebSocketError('Insecure WebSocket connections (ws://) are not allowed. Use wss:// instead, '
            + 'or set allow_insecure_ws=true for local development/testing.');
    }
    if (is_insecure) {
        emit_warn(observe, 'guardian.socket.warning', 'insecure websocket connection enabled for local development', { socket_url: url });
    }
}
export class WebSocketClient extends EventEmitter {
    constructor(socket, options = {}) {
        super();
        this._url = typeof socket === 'string' ? socket : (socket.url || '');
        this._socket = typeof socket === 'string' ? new WebSocket(this._url) : socket;
        this._observe = get_observe_context(options.observability, {
            module: 'websocket',
            socket_url: this._url
        });
        const is_server_side = typeof socket !== 'string';
        const is_full_url = this._url.startsWith('ws://') || this._url.startsWith('wss://');
        if (is_full_url) {
            validate_socket_url(this._url, this.observe, options);
        }
        else if (!is_server_side && this._url) {
            validate_socket_url(this._url, this.observe, options);
        }
        emit_info(this.observe, 'guardian.socket.connect.start', 'opening websocket connection', { socket_url: this._url });
        this._socket.addEventListener('open', () => {
            emit_info(this.observe, 'guardian.socket.connect.ready', 'websocket connection ready');
            this.emit('ready', undefined);
        });
        this._socket.addEventListener('close', () => {
            emit_info(this.observe, 'guardian.socket.close', 'websocket connection closed');
            this.emit('close', undefined);
        });
        this._socket.addEventListener('error', (err) => {
            const reason = get_socket_error_reason(err);
            emit_error(this.observe, 'guardian.socket.error', 'websocket connection error', reason);
            this.emit('error', reason);
        });
        this._socket.addEventListener('message', (event) => {
            parse_message(event.data)
                .then(msg => {
                emit_debug(this.observe, 'guardian.socket.message.received', {
                    message_id: msg.id,
                    message_type: msg.type,
                    payload_length: sanitize_bounced_data(event.data).length,
                    topic: msg.topic
                });
                this.emit('message', msg);
            })
                .catch(err => {
                emit_warn(this.observe, 'guardian.socket.message.bounced', 'websocket message could not be parsed', {
                    payload_length: sanitize_bounced_data(event.data).length,
                    reason: parse_error(err)
                });
                this.emit('bounced', parse_error(err), sanitize_bounced_data(event.data));
            });
        });
    }
    get ready() {
        return this._socket.readyState === WebSocket.OPEN;
    }
    get url() {
        return this._url;
    }
    get observe() {
        return this._observe;
    }
    close() {
        this._socket.close();
    }
    send(message) {
        const msg = serialize_message(message);
        emit_debug(this.observe, 'guardian.socket.message.sent', {
            message_id: message.id,
            message_type: message.type,
            payload_length: msg.length,
            topic: message.topic
        });
        this._socket.send(msg);
    }
    subscribe(request) {
        return new SocketSubscription(this, request);
    }
}
export class SocketSubscription extends EventEmitter {
    constructor(socket, request) {
        super();
        this._request = {
            data: request.data,
            id: request.id ?? Buff.random(16).hex,
            topic: request.topic,
            type: 'request',
        };
        this._socket = socket;
        this.socket.on('message', (msg) => {
            try {
                if (this._filter(msg))
                    this.emit('message', msg);
            }
            catch (err) {
                emit_warn(child_observe_context(this.socket.observe, { request_id: this.id, topic: this.topic }), 'guardian.socket.subscription.bounced', 'subscription message bounced during handling', { reason: parse_error(err) });
                this.emit('bounced', parse_error(err), msg);
            }
        });
    }
    get id() {
        return this._request.id;
    }
    get socket() {
        return this._socket;
    }
    get topic() {
        return this._request.topic;
    }
    _connect(timeout = SUB_TIMEOUT) {
        return new Promise((resolve, reject) => {
            if (this.socket.ready)
                return resolve();
            const cleanup = () => {
                clearTimeout(timer);
                this.socket.off('ready', handle_ready);
                this.socket.off('error', handle_error);
                this.socket.off('close', handle_close);
            };
            const handle_ready = () => {
                cleanup();
                resolve();
            };
            const handle_error = (reason) => {
                cleanup();
                reject(new Error(reason));
            };
            const handle_close = () => {
                cleanup();
                reject(new Error('connection closed'));
            };
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('connection timed out'));
            }, timeout);
            this.socket.on('ready', handle_ready);
            this.socket.on('error', handle_error);
            this.socket.on('close', handle_close);
        });
    }
    _filter(msg) {
        return (msg.type !== 'request' &&
            msg.topic === this.topic &&
            msg.id === this.id);
    }
    _resolve(timeout) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve({ ok: false, reason: 'request timed out' }), timeout);
            this.socket.within('message', (msg) => {
                if (msg.id === this.id) {
                    if (msg.type === 'result') {
                        clearTimeout(timer);
                        resolve({ ok: true, data: msg.data });
                    }
                    else if (msg.type === 'reject') {
                        clearTimeout(timer);
                        resolve({ ok: false, reason: msg.data });
                    }
                }
            }, timeout);
        });
    }
    async send(timeout = SUB_TIMEOUT) {
        try {
            await this._connect(timeout);
        }
        catch (err) {
            const reason = get_socket_error_reason(err);
            return {
                ok: false,
                reason: reason.includes('connect') ? reason : `connect failed: ${reason}`
            };
        }
        const promise = this._resolve(timeout);
        this.socket.send(this._request);
        return promise;
    }
}
function serialize_message(msg) {
    const { id, topic, type, data } = msg;
    try {
        return JSON.stringify([type, id, topic, data]);
    }
    catch {
        throw new WebSocketError(`failed to serialize envelope:\n${msg.toString()}`);
    }
}
async function parse_message(payload) {
    let str_payload;
    if (typeof payload === 'string') {
        str_payload = payload;
    }
    else if (typeof payload === 'object' && payload !== null) {
        if ('text' in payload && typeof payload.text === 'function') {
            str_payload = await payload.text();
        }
        else if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
            str_payload = new Buff(payload).str;
        }
        else {
            throw new WebSocketError('invalid payload shape: expected a string, a {text()} blob, or a binary frame');
        }
    }
    else {
        throw new WebSocketError(`invalid payload type: ${typeof payload}`);
    }
    try {
        const json_payload = JSON.parse(str_payload);
        const parsed = await SCHEMA.ws.envelope.parseAsync(json_payload);
        const [type, id, topic, data, code] = parsed;
        return (code !== undefined) ? { id, type, topic, data, code } : { id, type, topic, data };
    }
    catch (err) {
        throw new WebSocketError(`failed to parse envelope: ${sanitize_bounced_data(str_payload)}`, { cause: err });
    }
}
