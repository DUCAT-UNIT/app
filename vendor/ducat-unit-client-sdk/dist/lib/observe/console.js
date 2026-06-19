const DEFAULT_OPTIONS = {
    include_time: true,
    json_indent: undefined,
    pretty: true,
    redact_sensitive: true
};
const LEVEL_ORDER = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
};
function stringify_json(event, json_indent) {
    if (typeof json_indent === 'number') {
        return JSON.stringify(event, null, json_indent);
    }
    return JSON.stringify(event);
}
function format_message(event, include_time) {
    const time = include_time ? `${event.time} ` : '';
    const text = event.message ?? event.name;
    return `${time}[${event.level}] ${text}`;
}
export function create_console_logger(options) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    return {
        enabled(level) {
            return LEVEL_ORDER[level] <= LEVEL_ORDER[config.level];
        },
        emit(event) {
            if (!this.enabled(event.level))
                return;
            if (event.level === 'debug' || event.level === 'trace') {
                const data = stringify_json(event, config.json_indent);
                console.log(data);
                return;
            }
            const message = format_message(event, config.include_time);
            if (event.level === 'warn') {
                console.warn(message);
                return;
            }
            if (event.level === 'error') {
                console.error(message);
                return;
            }
            console.log(message);
        }
    };
}
