export declare const DEFAULT_ORACLE_MAX_AGE_SEC: number;
export declare function now_seconds(): number;
export declare function filter_fresh_events<T extends {
    base_stamp: number;
}>(events: T[], max_age_sec: number, now_sec?: number): T[];
