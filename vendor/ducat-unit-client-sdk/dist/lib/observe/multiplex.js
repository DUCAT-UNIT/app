export function create_multiplex_logger(options) {
    const sinks = options.sinks;
    const on_sink_error = options.on_sink_error;
    return {
        enabled(level) {
            for (const sink of sinks) {
                if (sink.enabled(level))
                    return true;
            }
            return false;
        },
        emit(event) {
            for (let i = 0; i < sinks.length; i++) {
                const sink = sinks[i];
                if (!sink.enabled(event.level))
                    continue;
                try {
                    sink.emit(event);
                }
                catch (error) {
                    if (on_sink_error !== undefined) {
                        on_sink_error(error, i, event);
                    }
                }
            }
        }
    };
}
