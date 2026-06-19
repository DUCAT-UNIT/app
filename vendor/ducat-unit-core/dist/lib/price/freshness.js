import { Assert } from '@vbyte/util';
export function is_oracle_event_fresh(event, max_age_seconds, now_seconds) {
    Assert.ok(max_age_seconds >= 0, `is_oracle_event_fresh: max_age_seconds must be non-negative (got ${max_age_seconds})`);
    if (event.base_stamp > now_seconds)
        return false;
    return (now_seconds - event.base_stamp) <= max_age_seconds;
}
