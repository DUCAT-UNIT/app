export class EventEmitter {
    constructor() {
        this.eventMap = new Map();
    }
    getEventHandlers(eventName) {
        const handlers = this.eventMap.get(eventName);
        if (!handlers) {
            const newHandlers = new Set();
            this.eventMap.set(eventName, newHandlers);
            return newHandlers;
        }
        return handlers;
    }
    has(eventName) {
        const handlers = this.eventMap.get(eventName);
        return handlers !== undefined && handlers.size > 0;
    }
    on(eventName, handler) {
        this.getEventHandlers(eventName).add(handler);
    }
    once(eventName, handler) {
        const oneTimeHandler = (...args) => {
            this.off(eventName, oneTimeHandler);
            void handler(...args);
        };
        this.on(eventName, oneTimeHandler);
    }
    within(eventName, handler, timeoutMs) {
        const timeoutHandler = (...args) => {
            void handler(...args);
        };
        setTimeout(() => {
            this.off(eventName, timeoutHandler);
        }, timeoutMs);
        this.on(eventName, timeoutHandler);
    }
    emit(eventName, ...args) {
        const promises = [];
        this.getEventHandlers(eventName).forEach(handler => {
            const result = handler(...args);
            if (result instanceof Promise) {
                promises.push(result);
            }
        });
        this.getEventHandlers('*').forEach(handler => {
            const result = handler(eventName, ...args);
            if (result instanceof Promise) {
                promises.push(result);
            }
        });
        void Promise.allSettled(promises);
    }
    off(eventName, handler) {
        this.getEventHandlers(eventName).delete(handler);
    }
    clear(eventName) {
        this.eventMap.delete(eventName);
    }
}
