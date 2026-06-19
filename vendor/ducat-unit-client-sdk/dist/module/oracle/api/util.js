import { is_oracle_event_fresh } from '@ducat-unit/core/lib';
export const DEFAULT_ORACLE_MAX_AGE_SEC = 5 * 60;
export function now_seconds() {
    return Math.floor(Date.now() / 1000);
}
export function filter_fresh_events(events, max_age_sec, now_sec = now_seconds()) {
    if (max_age_sec === 0)
        return events;
    return events.filter(e => is_oracle_event_fresh(e, max_age_sec, now_sec));
}
