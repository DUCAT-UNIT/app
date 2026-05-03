import { Buff } from '@cmdcode/buff';
import { EventEmitter } from './emitter.js';
import { parse_error } from '../util/helpers.js';
import Schema from '../schema/index.js';
const VERBOSE = process.env['VERBOSE'] === 'true';
export class WebSocketClient extends EventEmitter {
    constructor(socket) {
        super();
        this._url = (typeof socket !== 'string')
            ? socket.url
            : socket;
        this._socket = (typeof socket !== 'string')
            ? socket
            : new WebSocket(this._url);
        this._socket.addEventListener('open', () => this.emit('ready', this));
        this._socket.addEventListener('close', () => this.emit('close', this));
        this._socket.addEventListener('error', () => this.emit('error', 'socket error'));
        this._socket.addEventListener('message', (event) => {
            try {
                const msg = parse_message(event.data);
                this.emit('message', msg);
            }
            catch (err) {
                this.emit('bounced', [parse_error(err), event.data]);
            }
        });
    }
    get ready() {
        return this._socket.OPEN === 1;
    }
    get url() {
        return this._url;
    }
    send(config) {
        const id = config.id ?? Buff.random(16).hex;
        const env = serialize_message({ ...config, id });
        if (VERBOSE)
            console.log('[ websocket ] sending request:', env);
        this._socket.send(env);
    }
}
export class SocketSubscription extends EventEmitter {
    constructor(client, topic, identifier) {
        super();
        this._outbox = null;
        this._client = client;
        this._id = identifier ?? Buff.random(16).hex;
        this._topic = topic;
        this._client.on('message', (msg) => {
            if (this._filter(msg))
                this.emit('msg', msg);
        });
    }
    get client() {
        return this._client;
    }
    get id() {
        return this._id;
    }
    _filter(msg) {
        return (msg.type !== 'req' &&
            msg.topic === this._topic &&
            msg.id === this._id);
    }
    _resolve(timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject('timeout'), timeout);
            this.within('msg', (msg) => {
                if (VERBOSE)
                    console.log('[ subscription ] received message:', msg);
                switch (msg.type) {
                    case 'res':
                        clearTimeout(timer);
                        resolve(msg.data);
                        break;
                    case 'rej':
                        clearTimeout(timer);
                        reject(msg.data);
                        break;
                }
            }, timeout);
        });
    }
    _send() {
        if (this._outbox !== null) {
            this._client.send(this._outbox);
            this._outbox = null;
        }
        else {
            throw new Error('no message in outbox');
        }
    }
    register(handler) {
        this._client.on('message', (msg) => {
            if (this._filter(msg))
                handler(this, msg);
        });
    }
    resolve(timeout = 5000) {
        const res = this._resolve(timeout);
        this._send();
        return res;
    }
    send(data) {
        this._outbox = {
            id: this._id,
            topic: this._topic,
            type: 'req',
            data
        };
    }
}
function serialize_message(msg) {
    const { id, topic, type, data } = msg;
    try {
        return JSON.stringify([type, id, topic, data]);
    }
    catch {
        throw new Error('failed to serialize envelope:\n' + msg.toString());
    }
}
function parse_message(payload) {
    if (typeof payload === 'object') {
        payload = payload.text();
    }
    try {
        payload = JSON.parse(payload);
        const schema = Schema.ws.envelope;
        const parsed = schema.parse(payload);
        const [type, id, topic, data] = parsed;
        return { id, type, topic, data };
    }
    catch {
        throw new Error('failed to parse envelope: ' + payload);
    }
}
