const POINTER_TYPES = {
    10101: 'repo_liquidation_thold',
    10102: 'repo_reserve_pubkey',
    10103: 'repo_reserve_sats_min',
    10104: 'repo_liquid_tax_rate',
    10105: 'repo_subsidy_inc_rate',
    10106: 'repo_subsidy_inc_thold',
    10107: 'vault_collateral_min',
    10108: 'vault_internal_key',
    10109: 'vault_sats_balance_min',
    10110: 'vault_unit_balance_min'
};
const POSTAGE_TYPES = {
    10001: 'master',
    10002: 'guard_hosts',
    10003: 'guard_group',
    10004: 'unit_account',
    10005: 'unit_reserve',
    10006: 'vault_terms',
    10007: 'vault_point',
    10008: 'oracle_hosts',
    10009: 'oracle_group',
    10010: 'repo_terms',
    10011: 'repo_point',
};
export var POINTER;
(function (POINTER) {
    POINTER.KEYS = Object.values(POINTER_TYPES);
    POINTER.RANGE = [10100, 10200];
    POINTER.TYPES = POINTER_TYPES;
    POINTER.GET_KEY = (type) => get_record_key(POINTER_TYPES, type);
    POINTER.GET_TYPE = (key) => get_record_type(POINTER_TYPES, key);
})(POINTER || (POINTER = {}));
export var POSTAGE;
(function (POSTAGE) {
    POSTAGE.KEYS = Object.values(POSTAGE_TYPES);
    POSTAGE.RANGE = [10001, 10100];
    POSTAGE.TYPES = POSTAGE_TYPES;
    POSTAGE.GET_KEY = (type) => get_record_key(POSTAGE_TYPES, type);
    POSTAGE.GET_TYPE = (key) => get_record_type(POSTAGE_TYPES, key);
})(POSTAGE || (POSTAGE = {}));
export default { POINTER, POSTAGE };
function get_record_key(map, type) {
    const ent = map[type];
    if (typeof ent !== 'string')
        throw new Error('value does not exist for type: ' + String(type));
    return ent;
}
function get_record_type(map, key) {
    const ent = Object.entries(map).find(e => e[1] === key);
    if (ent === undefined)
        throw new Error('type does not exist for key: ' + key);
    return Number(ent[0]);
}
