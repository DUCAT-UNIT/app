import { redact_observe_fields } from './redact.js';
const LEVEL_ORDER = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
};
const DEFAULT_MAX_EVENTS = 500;
const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_LEVEL = 'debug';
function approximate_size(event) {
    try {
        return JSON.stringify(event).length;
    }
    catch {
        return 0;
    }
}
export function create_ring_buffer_logger(options = {}) {
    const level = options.level ?? DEFAULT_LEVEL;
    const max_events = options.max_events ?? DEFAULT_MAX_EVENTS;
    const max_bytes = options.max_bytes ?? DEFAULT_MAX_BYTES;
    const redact_sensitive = options.redact_sensitive ?? true;
    const unsafe_payloads = options.unsafe_payloads ?? false;
    const events = [];
    const sizes = [];
    let total_bytes = 0;
    function evict_until_within_bounds() {
        while (events.length > max_events && events.length > 0) {
            events.shift();
            total_bytes -= sizes.shift() ?? 0;
        }
        while (total_bytes > max_bytes && events.length > 1) {
            events.shift();
            total_bytes -= sizes.shift() ?? 0;
        }
    }
    return {
        enabled(l) {
            return LEVEL_ORDER[l] <= LEVEL_ORDER[level];
        },
        emit(event) {
            if (LEVEL_ORDER[event.level] > LEVEL_ORDER[level])
                return;
            const safe_event = redact_sensitive
                ? {
                    ...event,
                    fields: event.fields !== undefined
                        ? redact_observe_fields(event.fields, true, unsafe_payloads)
                        : undefined
                }
                : event;
            const size = approximate_size(safe_event);
            events.push(safe_event);
            sizes.push(size);
            total_bytes += size;
            evict_until_within_bounds();
        },
        snapshot() {
            return events.slice();
        },
        clear() {
            events.length = 0;
            sizes.length = 0;
            total_bytes = 0;
        },
        size() {
            return { events: events.length, bytes: total_bytes };
        }
    };
}
