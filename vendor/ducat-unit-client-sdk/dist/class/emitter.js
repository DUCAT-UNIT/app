export class EventEmitter {
    constructor() {
        this._getHandlers = (event) => {
            let events = this._events.get(event);
            if (events === undefined) {
                events = new Set();
                this._events.set(event, events);
            }
            return events;
        };
        this.has = (event) => {
            const res = this._events.get(event);
            return (res instanceof Set && res.size > 0);
        };
        this.on = (event, fn) => {
            void this._getHandlers(event).add(fn);
        };
        this.once = (event, fn) => {
            const onceFn = (payload) => {
                this.remove(event, onceFn);
                void fn.apply(this, [payload]);
            };
            this.on(event, onceFn);
        };
        this.within = (event, fn, timeout) => {
            const withinFn = (payload) => {
                void fn.apply(this, [payload]);
            };
            setTimeout(() => { this.remove(event, withinFn); }, timeout);
            this.on(event, withinFn);
        };
        this.emit = (event, payload) => {
            const methods = [];
            this._getHandlers(event).forEach((fn) => {
                methods.push(fn.apply(this, [payload]));
            });
            this._getHandlers('*').forEach((fn) => {
                methods.push(fn.apply(this, [event, payload]));
            });
            void Promise.allSettled(methods);
        };
        this.remove = (event, fn) => {
            this._getHandlers(event).delete(fn);
        };
        this.clear = (event) => {
            this._events.delete(event);
        };
        this._events = new Map();
    }
}
