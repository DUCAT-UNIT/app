'use strict';

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
var POINTER$1;
(function (POINTER) {
    POINTER.KEYS = Object.values(POINTER_TYPES);
    POINTER.RANGE = [10100, 10200];
    POINTER.TYPES = POINTER_TYPES;
    POINTER.GET_KEY = (type) => get_record_key$1(POINTER_TYPES, type);
    POINTER.GET_TYPE = (key) => get_record_type$1(POINTER_TYPES, key);
})(POINTER$1 || (POINTER$1 = {}));
var POSTAGE$2;
(function (POSTAGE) {
    POSTAGE.KEYS = Object.values(POSTAGE_TYPES);
    POSTAGE.RANGE = [10001, 10100];
    POSTAGE.TYPES = POSTAGE_TYPES;
    POSTAGE.GET_KEY = (type) => get_record_key$1(POSTAGE_TYPES, type);
    POSTAGE.GET_TYPE = (key) => get_record_type$1(POSTAGE_TYPES, key);
})(POSTAGE$2 || (POSTAGE$2 = {}));
var POSTMAP = { POINTER: POINTER$1, POSTAGE: POSTAGE$2 };
function get_record_key$1(map, type) {
    const ent = map[type];
    if (typeof ent !== 'string')
        throw new Error('value does not exist for type: ' + String(type));
    return ent;
}
function get_record_type$1(map, key) {
    const ent = Object.entries(map).find(e => e[1] === key);
    if (ent === undefined)
        throw new Error('type does not exist for key: ' + key);
    return Number(ent[0]);
}

const TOPICS = {
    UNIT_ACCT: '/unit/reserve',
    VAULT_OPEN: '/vault/open',
    VAULT_BORROW: '/vault/borrow',
    VAULT_REPAY: '/vault/repay',
    VAULT_REPO: '/vault/repo',
    VAULT_DEPOSIT: '/vault/deposit',
    VAULT_WITHDRAW: '/vault/withdraw'
};

const TX_BASE_SIZE = 12;
const VIN_BASE_SIZE = 41;
const VOUT_P2SH_BASE = 33;
const VOUT_P2WK_SIZE = 31;
const VOUT_P2TR_SIZE = 43;
const RUNE_RETURN_SIZE = 40;
const VDATA_RETURN_SIZE = 50;
const WIT_P2SH_VSIZE = 131;
const WIT_P2WK_VSIZE = 28;
const WIT_P2TR_VSIZE = 17;
const VAULT_VTKN_WIT = 137;
const VAULT_SIGN_WIT = 67;
const VAULT_REPO_WIT = 56;
const VIN_P2SH_SPEND = VIN_BASE_SIZE + WIT_P2SH_VSIZE;
const VIN_P2WK_SPEND = VIN_BASE_SIZE + WIT_P2WK_VSIZE;
const VIN_P2TR_SPEND = VIN_BASE_SIZE + WIT_P2TR_VSIZE;
const RUNE_CHANGE_VOUT = VOUT_P2TR_SIZE;
const SATS_CHANGE_VOUT = VOUT_P2TR_SIZE;
const VAULT_CONN_VOUT = VOUT_P2TR_SIZE;
const LIQUID_TAX_VOUT = VOUT_P2TR_SIZE;
const GUARD_ACCT_TXIO_SIZE = VIN_BASE_SIZE + WIT_P2TR_VSIZE + VOUT_P2TR_SIZE;
const VAULT_VTKN_TXIO_SIZE = VIN_BASE_SIZE + VAULT_VTKN_WIT + VOUT_P2TR_SIZE;
const VAULT_SPND_TXIO_SIZE = VIN_BASE_SIZE + VAULT_SIGN_WIT + VOUT_P2TR_SIZE;
const VAULT_CONN_TXIO_SIZE = VIN_BASE_SIZE + VAULT_SIGN_WIT + VOUT_P2TR_SIZE;
const LIQUID_VAULT_TXIO_SIZE = VIN_BASE_SIZE + VAULT_REPO_WIT + VOUT_P2TR_SIZE;
const GUARD_ACCOUNT_TX = TX_BASE_SIZE +
    GUARD_ACCT_TXIO_SIZE +
    VAULT_CONN_VOUT +
    RUNE_CHANGE_VOUT +
    SATS_CHANGE_VOUT +
    RUNE_RETURN_SIZE;
const VAULT_OPEN_TX = TX_BASE_SIZE +
    GUARD_ACCT_TXIO_SIZE +
    VAULT_VTKN_TXIO_SIZE +
    VOUT_P2TR_SIZE +
    SATS_CHANGE_VOUT +
    VDATA_RETURN_SIZE;
const VAULT_CONN_TX = TX_BASE_SIZE +
    VAULT_SPND_TXIO_SIZE +
    VAULT_CONN_TXIO_SIZE +
    VDATA_RETURN_SIZE;
const VAULT_UPDATE_TX = TX_BASE_SIZE +
    VAULT_SPND_TXIO_SIZE +
    SATS_CHANGE_VOUT +
    VDATA_RETURN_SIZE;
const VAULT_LIQUID_TX = TX_BASE_SIZE +
    VAULT_CONN_VOUT +
    LIQUID_TAX_VOUT +
    VDATA_RETURN_SIZE;
var TXSIZE = {
    ACTION: {
        VAULT_OPEN: GUARD_ACCOUNT_TX + VAULT_OPEN_TX,
        VAULT_BORROW: GUARD_ACCOUNT_TX + VAULT_CONN_TX,
        VAULT_REPAY: GUARD_ACCOUNT_TX + VAULT_CONN_TX,
        VAULT_LIQUID: VAULT_LIQUID_TX + VAULT_CONN_TX,
        VAULT_DEPOSIT: VAULT_UPDATE_TX,
        VAULT_WITHDRAW: VAULT_UPDATE_TX,
    },
    BASE: {
        TX: TX_BASE_SIZE,
        TXIN: VIN_BASE_SIZE,
        TXOUT: VOUT_P2SH_BASE,
    },
    RETURN: {
        RUNE: RUNE_RETURN_SIZE,
        VDATA: VDATA_RETURN_SIZE,
    },
    WITNESS: {
        P2SH: WIT_P2SH_VSIZE,
        P2WPKH: WIT_P2WK_VSIZE,
        P2TR: WIT_P2TR_VSIZE,
        VAULT_VTKN: VAULT_VTKN_WIT,
        VAULT_SIGN: VAULT_SIGN_WIT,
        VAULT_REPO: VAULT_REPO_WIT,
    },
    TX: {
        GUARD_ACCOUNT: GUARD_ACCOUNT_TX,
        VAULT_OPEN: VAULT_OPEN_TX,
        VAULT_CONN: VAULT_CONN_TX,
        VAULT_UPDATE: VAULT_UPDATE_TX,
        VAULT_LIQUID: VAULT_LIQUID_TX
    },
    TXIN: {
        P2SH: VIN_P2SH_SPEND,
        P2WK: VIN_P2WK_SPEND,
        P2TR: VIN_P2TR_SPEND,
    },
    TXOUT: {
        P2SH: VOUT_P2SH_BASE,
        P2WK: VOUT_P2WK_SIZE,
        P2TR: VOUT_P2TR_SIZE,
        RUNE_CHANGE: RUNE_CHANGE_VOUT,
        SATS_CHANGE: SATS_CHANGE_VOUT,
        VAULT_CONN: VAULT_CONN_VOUT,
    },
    TXIO: {
        GUARD_ACCOUNT: GUARD_ACCT_TXIO_SIZE,
        LIQUID_VAULT: LIQUID_VAULT_TXIO_SIZE,
        VAULT_VTKN: VAULT_VTKN_TXIO_SIZE,
        VAULT_SPND: VAULT_SPND_TXIO_SIZE,
        VAULT_CONN: VAULT_CONN_TXIO_SIZE,
    },
};

var open$1 = {
	acct_tx: {
		vin: {
			acct: 0
		},
		vout: {
			acct: 0,
			conn: 1,
			unit: 2,
			stone: 3
		}
	},
	vault_tx: {
		vin: {
			acct: 0,
			conn: 1
		},
		vout: {
			acct: 0,
			token: 1,
			vault: 2,
			change: 3,
			vdata: 4
		}
	}
};
var borrow$1 = {
	acct_tx: {
		vin: {
			acct: 0
		},
		vout: {
			acct: 0,
			conn: 1,
			unit: 2,
			stone: 3
		}
	},
	vault_tx: {
		vin: {
			vault: 0,
			conn: 1
		},
		vout: {
			vault: 0,
			change: 1,
			vdata: 2
		}
	}
};
var repay$1 = {
	acct_tx: {
		vin: {
			acct: 0
		},
		vout: {
			acct: 0,
			conn: 1,
			unit: 2,
			stone: 3
		}
	},
	vault_tx: {
		vin: {
			vault: 0,
			conn: 1
		},
		vout: {
			vault: 0,
			change: 1,
			vdata: 2
		}
	}
};
var deposit$1 = {
	vault_tx: {
		vin: {
			vault: 0
		},
		vout: {
			vault: 0,
			change: 1,
			vdata: 2
		}
	}
};
var withdraw$1 = {
	vault_tx: {
		vin: {
			vault: 0
		},
		vout: {
			vault: 0,
			change: 1,
			vdata: 2
		}
	}
};
var repo$1 = {
	vault_tx: {
		vin: {
			vault: 0,
			conn: 1
		},
		vout: {
			vault: 0,
			change: 1,
			vdata: 2
		}
	}
};
var liquidate = {
	vault_tx: {
		vin: {
			vault: 0
		},
		vout: {
			vault: 0,
			conn: 1,
			vdata: 2
		}
	}
};
var TXMAP$1 = {
	open: open$1,
	borrow: borrow$1,
	repay: repay$1,
	deposit: deposit$1,
	withdraw: withdraw$1,
	repo: repo$1,
	liquidate: liquidate
};

const BLOCK_DURATION = 600;
const DEFAULT_POSTAGE = 10000;
const ACCOUNT_POSTAGE = 10004;
const DUST_LIMIT = 546;
const FETCH_IVAL$3 = 50;
const FLOAT_PREC$3 = 4;
const COIN_SIZE$1 = 100_000_000;
const MIN_VAULT_BAL$1 = 10_000;
const UNIT_RUNE_LBL = 'RTEST•UNIT•RUNE';
const UNSPENDABLE_KEY = '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0';
const VDATA_MIN_SIZE$1 = 14;
const VDATA_MAX_SIZE$1 = 38;
const VAULT_VERSION = 1;
const BIGINT = { _0: BigInt(0) };
var CONST = {
    ...POSTMAP,
    ACCOUNT_POSTAGE,
    BIGINT,
    COIN_SIZE: COIN_SIZE$1,
    FETCH_IVAL: FETCH_IVAL$3,
    FLOAT_PREC: FLOAT_PREC$3,
    BLOCK_DURATION,
    DEFAULT_POSTAGE,
    DUST_LIMIT,
    MIN_VAULT_BAL: MIN_VAULT_BAL$1,
    TOPICS,
    TXMAP: TXMAP$1,
    UNIT_RUNE_LBL,
    UNSPENDABLE_KEY,
    VAULT_VERSION,
    VDATA_MAX_SIZE: VDATA_MAX_SIZE$1,
    VDATA_MIN_SIZE: VDATA_MIN_SIZE$1,
    TXSIZE
};

var util;
(function (util) {
    util.assertEqual = (_) => { };
    function assertIs(_arg) { }
    util.assertIs = assertIs;
    function assertNever(_x) {
        throw new Error();
    }
    util.assertNever = assertNever;
    util.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
            obj[item] = item;
        }
        return obj;
    };
    util.getValidEnumValues = (obj) => {
        const validKeys = util.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
            filtered[k] = obj[k];
        }
        return util.objectValues(filtered);
    };
    util.objectValues = (obj) => {
        return util.objectKeys(obj).map(function (e) {
            return obj[e];
        });
    };
    util.objectKeys = typeof Object.keys === "function" // eslint-disable-line ban/ban
        ? (obj) => Object.keys(obj) // eslint-disable-line ban/ban
        : (object) => {
            const keys = [];
            for (const key in object) {
                if (Object.prototype.hasOwnProperty.call(object, key)) {
                    keys.push(key);
                }
            }
            return keys;
        };
    util.find = (arr, checker) => {
        for (const item of arr) {
            if (checker(item))
                return item;
        }
        return undefined;
    };
    util.isInteger = typeof Number.isInteger === "function"
        ? (val) => Number.isInteger(val) // eslint-disable-line ban/ban
        : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
        return array.map((val) => (typeof val === "string" ? `'${val}'` : val)).join(separator);
    }
    util.joinValues = joinValues;
    util.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
})(util || (util = {}));
var objectUtil;
(function (objectUtil) {
    objectUtil.mergeShapes = (first, second) => {
        return {
            ...first,
            ...second, // second overwrites first
        };
    };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set",
]);
const getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
        case "undefined":
            return ZodParsedType.undefined;
        case "string":
            return ZodParsedType.string;
        case "number":
            return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
            return ZodParsedType.boolean;
        case "function":
            return ZodParsedType.function;
        case "bigint":
            return ZodParsedType.bigint;
        case "symbol":
            return ZodParsedType.symbol;
        case "object":
            if (Array.isArray(data)) {
                return ZodParsedType.array;
            }
            if (data === null) {
                return ZodParsedType.null;
            }
            if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
                return ZodParsedType.promise;
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
                return ZodParsedType.map;
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
                return ZodParsedType.set;
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
                return ZodParsedType.date;
            }
            return ZodParsedType.object;
        default:
            return ZodParsedType.unknown;
    }
};

const ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite",
]);
class ZodError extends Error {
    get errors() {
        return this.issues;
    }
    constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
            this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
            this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            // eslint-disable-next-line ban/ban
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
    }
    format(_mapper) {
        const mapper = _mapper ||
            function (issue) {
                return issue.message;
            };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
            for (const issue of error.issues) {
                if (issue.code === "invalid_union") {
                    issue.unionErrors.map(processError);
                }
                else if (issue.code === "invalid_return_type") {
                    processError(issue.returnTypeError);
                }
                else if (issue.code === "invalid_arguments") {
                    processError(issue.argumentsError);
                }
                else if (issue.path.length === 0) {
                    fieldErrors._errors.push(mapper(issue));
                }
                else {
                    let curr = fieldErrors;
                    let i = 0;
                    while (i < issue.path.length) {
                        const el = issue.path[i];
                        const terminal = i === issue.path.length - 1;
                        if (!terminal) {
                            curr[el] = curr[el] || { _errors: [] };
                            // if (typeof el === "string") {
                            //   curr[el] = curr[el] || { _errors: [] };
                            // } else if (typeof el === "number") {
                            //   const errorArray: any = [];
                            //   errorArray._errors = [];
                            //   curr[el] = curr[el] || errorArray;
                            // }
                        }
                        else {
                            curr[el] = curr[el] || { _errors: [] };
                            curr[el]._errors.push(mapper(issue));
                        }
                        curr = curr[el];
                        i++;
                    }
                }
            }
        };
        processError(this);
        return fieldErrors;
    }
    static assert(value) {
        if (!(value instanceof ZodError)) {
            throw new Error(`Not a ZodError: ${value}`);
        }
    }
    toString() {
        return this.message;
    }
    get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
        return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
            if (sub.path.length > 0) {
                const firstEl = sub.path[0];
                fieldErrors[firstEl] = fieldErrors[firstEl] || [];
                fieldErrors[firstEl].push(mapper(sub));
            }
            else {
                formErrors.push(mapper(sub));
            }
        }
        return { formErrors, fieldErrors };
    }
    get formErrors() {
        return this.flatten();
    }
}
ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
};

const errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
        case ZodIssueCode.invalid_type:
            if (issue.received === ZodParsedType.undefined) {
                message = "Required";
            }
            else {
                message = `Expected ${issue.expected}, received ${issue.received}`;
            }
            break;
        case ZodIssueCode.invalid_literal:
            message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
            break;
        case ZodIssueCode.unrecognized_keys:
            message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
            break;
        case ZodIssueCode.invalid_union:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_union_discriminator:
            message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
            break;
        case ZodIssueCode.invalid_enum_value:
            message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
            break;
        case ZodIssueCode.invalid_arguments:
            message = `Invalid function arguments`;
            break;
        case ZodIssueCode.invalid_return_type:
            message = `Invalid function return type`;
            break;
        case ZodIssueCode.invalid_date:
            message = `Invalid date`;
            break;
        case ZodIssueCode.invalid_string:
            if (typeof issue.validation === "object") {
                if ("includes" in issue.validation) {
                    message = `Invalid input: must include "${issue.validation.includes}"`;
                    if (typeof issue.validation.position === "number") {
                        message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                    }
                }
                else if ("startsWith" in issue.validation) {
                    message = `Invalid input: must start with "${issue.validation.startsWith}"`;
                }
                else if ("endsWith" in issue.validation) {
                    message = `Invalid input: must end with "${issue.validation.endsWith}"`;
                }
                else {
                    util.assertNever(issue.validation);
                }
            }
            else if (issue.validation !== "regex") {
                message = `Invalid ${issue.validation}`;
            }
            else {
                message = "Invalid";
            }
            break;
        case ZodIssueCode.too_small:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "bigint")
                message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.too_big:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "bigint")
                message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.custom:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_intersection_types:
            message = `Intersection results could not be merged`;
            break;
        case ZodIssueCode.not_multiple_of:
            message = `Number must be a multiple of ${issue.multipleOf}`;
            break;
        case ZodIssueCode.not_finite:
            message = "Number must be finite";
            break;
        default:
            message = _ctx.defaultError;
            util.assertNever(issue);
    }
    return { message };
};

let overrideErrorMap = errorMap;
function getErrorMap() {
    return overrideErrorMap;
}

const makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...(issueData.path || [])];
    const fullIssue = {
        ...issueData,
        path: fullPath,
    };
    if (issueData.message !== undefined) {
        return {
            ...issueData,
            path: fullPath,
            message: issueData.message,
        };
    }
    let errorMessage = "";
    const maps = errorMaps
        .filter((m) => !!m)
        .slice()
        .reverse();
    for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
        ...issueData,
        path: fullPath,
        message: errorMessage,
    };
};
function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
        issueData: issueData,
        data: ctx.data,
        path: ctx.path,
        errorMaps: [
            ctx.common.contextualErrorMap, // contextual error map is first priority
            ctx.schemaErrorMap, // then schema-bound map if available
            overrideMap, // then global override map
            overrideMap === errorMap ? undefined : errorMap, // then global default map
        ].filter((x) => !!x),
    });
    ctx.common.issues.push(issue);
}
class ParseStatus {
    constructor() {
        this.value = "valid";
    }
    dirty() {
        if (this.value === "valid")
            this.value = "dirty";
    }
    abort() {
        if (this.value !== "aborted")
            this.value = "aborted";
    }
    static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
            if (s.status === "aborted")
                return INVALID;
            if (s.status === "dirty")
                status.dirty();
            arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
                key,
                value,
            });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
            const { key, value } = pair;
            if (key.status === "aborted")
                return INVALID;
            if (value.status === "aborted")
                return INVALID;
            if (key.status === "dirty")
                status.dirty();
            if (value.status === "dirty")
                status.dirty();
            if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
                finalObject[key.value] = value.value;
            }
        }
        return { status: status.value, value: finalObject };
    }
}
const INVALID = Object.freeze({
    status: "aborted",
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

var errorUtil;
(function (errorUtil) {
    errorUtil.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    // biome-ignore lint:
    errorUtil.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

class ParseInputLazyPath {
    constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
    }
    get path() {
        if (!this._cachedPath.length) {
            if (Array.isArray(this._key)) {
                this._cachedPath.push(...this._path, ...this._key);
            }
            else {
                this._cachedPath.push(...this._path, this._key);
            }
        }
        return this._cachedPath;
    }
}
const handleResult = (ctx, result) => {
    if (isValid(result)) {
        return { success: true, data: result.value };
    }
    else {
        if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
        }
        return {
            success: false,
            get error() {
                if (this._error)
                    return this._error;
                const error = new ZodError(ctx.common.issues);
                this._error = error;
                return this._error;
            },
        };
    }
};
function processCreateParams(params) {
    if (!params)
        return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap)
        return { errorMap: errorMap, description };
    const customMap = (iss, ctx) => {
        const { message } = params;
        if (iss.code === "invalid_enum_value") {
            return { message: message ?? ctx.defaultError };
        }
        if (typeof ctx.data === "undefined") {
            return { message: message ?? required_error ?? ctx.defaultError };
        }
        if (iss.code !== "invalid_type")
            return { message: ctx.defaultError };
        return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
}
class ZodType {
    get description() {
        return this._def.description;
    }
    _getType(input) {
        return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
        return (ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent,
        });
    }
    _processInputParams(input) {
        return {
            status: new ParseStatus(),
            ctx: {
                common: input.parent.common,
                data: input.data,
                parsedType: getParsedType(input.data),
                schemaErrorMap: this._def.errorMap,
                path: input.path,
                parent: input.parent,
            },
        };
    }
    _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
            throw new Error("Synchronous parse encountered promise.");
        }
        return result;
    }
    _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
    }
    parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    safeParse(data, params) {
        const ctx = {
            common: {
                issues: [],
                async: params?.async ?? false,
                contextualErrorMap: params?.errorMap,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
    }
    "~validate"(data) {
        const ctx = {
            common: {
                issues: [],
                async: !!this["~standard"].async,
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        if (!this["~standard"].async) {
            try {
                const result = this._parseSync({ data, path: [], parent: ctx });
                return isValid(result)
                    ? {
                        value: result.value,
                    }
                    : {
                        issues: ctx.common.issues,
                    };
            }
            catch (err) {
                if (err?.message?.toLowerCase()?.includes("encountered")) {
                    this["~standard"].async = true;
                }
                ctx.common = {
                    issues: [],
                    async: true,
                };
            }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result)
            ? {
                value: result.value,
            }
            : {
                issues: ctx.common.issues,
            });
    }
    async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    async safeParseAsync(data, params) {
        const ctx = {
            common: {
                issues: [],
                contextualErrorMap: params?.errorMap,
                async: true,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
    }
    refine(check, message) {
        const getIssueProperties = (val) => {
            if (typeof message === "string" || typeof message === "undefined") {
                return { message };
            }
            else if (typeof message === "function") {
                return message(val);
            }
            else {
                return message;
            }
        };
        return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
                code: ZodIssueCode.custom,
                ...getIssueProperties(val),
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
                return result.then((data) => {
                    if (!data) {
                        setError();
                        return false;
                    }
                    else {
                        return true;
                    }
                });
            }
            if (!result) {
                setError();
                return false;
            }
            else {
                return true;
            }
        });
    }
    refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
            if (!check(val)) {
                ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
                return false;
            }
            else {
                return true;
            }
        });
    }
    _refinement(refinement) {
        return new ZodEffects({
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "refinement", refinement },
        });
    }
    superRefine(refinement) {
        return this._refinement(refinement);
    }
    constructor(def) {
        /** Alias of safeParseAsync */
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: (data) => this["~validate"](data),
        };
    }
    optional() {
        return ZodOptional.create(this, this._def);
    }
    nullable() {
        return ZodNullable.create(this, this._def);
    }
    nullish() {
        return this.nullable().optional();
    }
    array() {
        return ZodArray.create(this);
    }
    promise() {
        return ZodPromise.create(this, this._def);
    }
    or(option) {
        return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
        return new ZodEffects({
            ...processCreateParams(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "transform", transform },
        });
    }
    default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
            ...processCreateParams(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodDefault,
        });
    }
    brand() {
        return new ZodBranded({
            typeName: ZodFirstPartyTypeKind.ZodBranded,
            type: this,
            ...processCreateParams(this._def),
        });
    }
    catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
            ...processCreateParams(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodCatch,
        });
    }
    describe(description) {
        const This = this.constructor;
        return new This({
            ...this._def,
            description,
        });
    }
    pipe(target) {
        return ZodPipeline.create(this, target);
    }
    readonly() {
        return ZodReadonly.create(this);
    }
    isOptional() {
        return this.safeParse(undefined).success;
    }
    isNullable() {
        return this.safeParse(null).success;
    }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
// const uuidRegex =
//   /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
// from https://stackoverflow.com/a/46181/1550155
// old version: too slow, didn't support unicode
// const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
//old email regex
// const emailRegex = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@((?!-)([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{1,})[^-<>()[\].,;:\s@"]$/i;
// eslint-disable-next-line
// const emailRegex =
//   /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\])|(\[IPv6:(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))\])|([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])*(\.[A-Za-z]{2,})+))$/;
// const emailRegex =
//   /^[a-zA-Z0-9\.\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// const emailRegex =
//   /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
// const emailRegex =
//   /^[a-z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9\-]+)*$/i;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
// faster, simpler, safer
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
// const ipv6Regex =
// /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
// https://base64.guru/standards/base64url
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
// simple
// const dateRegexSource = `\\d{4}-\\d{2}-\\d{2}`;
// no leap year validation
// const dateRegexSource = `\\d{4}-((0[13578]|10|12)-31|(0[13-9]|1[0-2])-30|(0[1-9]|1[0-2])-(0[1-9]|1\\d|2\\d))`;
// with leap year validation
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
        secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    }
    else if (args.precision == null) {
        secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?"; // require seconds if precision is nonzero
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
        opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
        return true;
    }
    return false;
}
function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
        return false;
    try {
        const [header] = jwt.split(".");
        if (!header)
            return false;
        // Convert base64url to base64
        const base64 = header
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(header.length + ((4 - (header.length % 4)) % 4), "=");
        const decoded = JSON.parse(atob(base64));
        if (typeof decoded !== "object" || decoded === null)
            return false;
        if ("typ" in decoded && decoded?.typ !== "JWT")
            return false;
        if (!decoded.alg)
            return false;
        if (alg && decoded.alg !== alg)
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
        return true;
    }
    return false;
}
class ZodString extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.string,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.length < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.length > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "length") {
                const tooBig = input.data.length > check.value;
                const tooSmall = input.data.length < check.value;
                if (tooBig || tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    if (tooBig) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_big,
                            maximum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    else if (tooSmall) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_small,
                            minimum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    status.dirty();
                }
            }
            else if (check.kind === "email") {
                if (!emailRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "email",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "emoji") {
                if (!emojiRegex) {
                    emojiRegex = new RegExp(_emojiRegex, "u");
                }
                if (!emojiRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "emoji",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "uuid") {
                if (!uuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "uuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "nanoid") {
                if (!nanoidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "nanoid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid") {
                if (!cuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid2") {
                if (!cuid2Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid2",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ulid") {
                if (!ulidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ulid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "url") {
                try {
                    new URL(input.data);
                }
                catch {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "regex") {
                check.regex.lastIndex = 0;
                const testResult = check.regex.test(input.data);
                if (!testResult) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "regex",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "trim") {
                input.data = input.data.trim();
            }
            else if (check.kind === "includes") {
                if (!input.data.includes(check.value, check.position)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { includes: check.value, position: check.position },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "toLowerCase") {
                input.data = input.data.toLowerCase();
            }
            else if (check.kind === "toUpperCase") {
                input.data = input.data.toUpperCase();
            }
            else if (check.kind === "startsWith") {
                if (!input.data.startsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { startsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "endsWith") {
                if (!input.data.endsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { endsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "datetime") {
                const regex = datetimeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "datetime",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "date") {
                const regex = dateRegex;
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "date",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "time") {
                const regex = timeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "time",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "duration") {
                if (!durationRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "duration",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ip") {
                if (!isValidIP(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ip",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "jwt") {
                if (!isValidJWT(input.data, check.alg)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "jwt",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cidr") {
                if (!isValidCidr(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cidr",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64") {
                if (!base64Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64url") {
                if (!base64urlRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
            validation,
            code: ZodIssueCode.invalid_string,
            ...errorUtil.errToObj(message),
        });
    }
    _addCheck(check) {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return this._addCheck({
            kind: "base64url",
            ...errorUtil.errToObj(message),
        });
    }
    jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "datetime",
                precision: null,
                offset: false,
                local: false,
                message: options,
            });
        }
        return this._addCheck({
            kind: "datetime",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            offset: options?.offset ?? false,
            local: options?.local ?? false,
            ...errorUtil.errToObj(options?.message),
        });
    }
    date(message) {
        return this._addCheck({ kind: "date", message });
    }
    time(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "time",
                precision: null,
                message: options,
            });
        }
        return this._addCheck({
            kind: "time",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            ...errorUtil.errToObj(options?.message),
        });
    }
    duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
        return this._addCheck({
            kind: "regex",
            regex: regex,
            ...errorUtil.errToObj(message),
        });
    }
    includes(value, options) {
        return this._addCheck({
            kind: "includes",
            value: value,
            position: options?.position,
            ...errorUtil.errToObj(options?.message),
        });
    }
    startsWith(value, message) {
        return this._addCheck({
            kind: "startsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    endsWith(value, message) {
        return this._addCheck({
            kind: "endsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    min(minLength, message) {
        return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil.errToObj(message),
        });
    }
    max(maxLength, message) {
        return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil.errToObj(message),
        });
    }
    length(len, message) {
        return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil.errToObj(message),
        });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "trim" }],
        });
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toLowerCase" }],
        });
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toUpperCase" }],
        });
    }
    get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodString.create = (params) => {
    return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params),
    });
};
// https://stackoverflow.com/questions/3966484/why-does-modulus-operator-return-fractional-number-in-javascript/31711034#31711034
function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / 10 ** decCount;
}
class ZodNumber extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.number,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "int") {
                if (!util.isInteger(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_type,
                        expected: "integer",
                        received: "float",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (floatSafeRemainder(input.data, check.value) !== 0) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "finite") {
                if (!Number.isFinite(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_finite,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    int(message) {
        return this._addCheck({
            kind: "int",
            message: errorUtil.toString(message),
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value: value,
            message: errorUtil.toString(message),
        });
    }
    finite(message) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil.toString(message),
        });
    }
    safe(message) {
        return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil.toString(message),
        })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
    get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || (ch.kind === "multipleOf" && util.isInteger(ch.value)));
    }
    get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
                return true;
            }
            else if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
            else if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return Number.isFinite(min) && Number.isFinite(max);
    }
}
ZodNumber.create = (params) => {
    return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params),
    });
};
class ZodBigInt extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
    }
    _parse(input) {
        if (this._def.coerce) {
            try {
                input.data = BigInt(input.data);
            }
            catch {
                return this._getInvalidInput(input);
            }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
            return this._getInvalidInput(input);
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        type: "bigint",
                        minimum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        type: "bigint",
                        maximum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (input.data % check.value !== BigInt(0)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.bigint,
            received: ctx.parsedType,
        });
        return INVALID;
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodBigInt.create = (params) => {
    return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params),
    });
};
class ZodBoolean extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.boolean,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodBoolean.create = (params) => {
    return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params),
    });
};
class ZodDate extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.date,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_date,
            });
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.getTime() < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        minimum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.getTime() > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        maximum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: new Date(input.data.getTime()),
        };
    }
    _addCheck(check) {
        return new ZodDate({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    min(minDate, message) {
        return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    max(maxDate, message) {
        return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min != null ? new Date(min) : null;
    }
    get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max != null ? new Date(max) : null;
    }
}
ZodDate.create = (params) => {
    return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params),
    });
};
class ZodSymbol extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.symbol,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodSymbol.create = (params) => {
    return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params),
    });
};
class ZodUndefined extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.undefined,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodUndefined.create = (params) => {
    return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params),
    });
};
class ZodNull extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.null,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodNull.create = (params) => {
    return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params),
    });
};
class ZodAny extends ZodType {
    constructor() {
        super(...arguments);
        // to prevent instances of other classes from extending ZodAny. this causes issues with catchall in ZodObject.
        this._any = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodAny.create = (params) => {
    return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params),
    });
};
class ZodUnknown extends ZodType {
    constructor() {
        super(...arguments);
        // required
        this._unknown = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodUnknown.create = (params) => {
    return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params),
    });
};
class ZodNever extends ZodType {
    _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.never,
            received: ctx.parsedType,
        });
        return INVALID;
    }
}
ZodNever.create = (params) => {
    return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params),
    });
};
class ZodVoid extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.void,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodVoid.create = (params) => {
    return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params),
    });
};
class ZodArray extends ZodType {
    _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
                addIssueToContext(ctx, {
                    code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
                    minimum: (tooSmall ? def.exactLength.value : undefined),
                    maximum: (tooBig ? def.exactLength.value : undefined),
                    type: "array",
                    inclusive: true,
                    exact: true,
                    message: def.exactLength.message,
                });
                status.dirty();
            }
        }
        if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.minLength.message,
                });
                status.dirty();
            }
        }
        if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.maxLength.message,
                });
                status.dirty();
            }
        }
        if (ctx.common.async) {
            return Promise.all([...ctx.data].map((item, i) => {
                return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
            })).then((result) => {
                return ParseStatus.mergeArray(status, result);
            });
        }
        const result = [...ctx.data].map((item, i) => {
            return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
    }
    get element() {
        return this._def.type;
    }
    min(minLength, message) {
        return new ZodArray({
            ...this._def,
            minLength: { value: minLength, message: errorUtil.toString(message) },
        });
    }
    max(maxLength, message) {
        return new ZodArray({
            ...this._def,
            maxLength: { value: maxLength, message: errorUtil.toString(message) },
        });
    }
    length(len, message) {
        return new ZodArray({
            ...this._def,
            exactLength: { value: len, message: errorUtil.toString(message) },
        });
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodArray.create = (schema, params) => {
    return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params),
    });
};
function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
        const newShape = {};
        for (const key in schema.shape) {
            const fieldSchema = schema.shape[key];
            newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
        }
        return new ZodObject({
            ...schema._def,
            shape: () => newShape,
        });
    }
    else if (schema instanceof ZodArray) {
        return new ZodArray({
            ...schema._def,
            type: deepPartialify(schema.element),
        });
    }
    else if (schema instanceof ZodOptional) {
        return ZodOptional.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodNullable) {
        return ZodNullable.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodTuple) {
        return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    }
    else {
        return schema;
    }
}
class ZodObject extends ZodType {
    constructor() {
        super(...arguments);
        this._cached = null;
        /**
         * @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
         * If you want to pass through unknown properties, use `.passthrough()` instead.
         */
        this.nonstrict = this.passthrough;
        // extend<
        //   Augmentation extends ZodRawShape,
        //   NewOutput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
        //       ? Augmentation[k]["_output"]
        //       : k extends keyof Output
        //       ? Output[k]
        //       : never;
        //   }>,
        //   NewInput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
        //       ? Augmentation[k]["_input"]
        //       : k extends keyof Input
        //       ? Input[k]
        //       : never;
        //   }>
        // >(
        //   augmentation: Augmentation
        // ): ZodObject<
        //   extendShape<T, Augmentation>,
        //   UnknownKeys,
        //   Catchall,
        //   NewOutput,
        //   NewInput
        // > {
        //   return new ZodObject({
        //     ...this._def,
        //     shape: () => ({
        //       ...this._def.shape(),
        //       ...augmentation,
        //     }),
        //   }) as any;
        // }
        /**
         * @deprecated Use `.extend` instead
         *  */
        this.augment = this.extend;
    }
    _getCached() {
        if (this._cached !== null)
            return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
    }
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
                if (!shapeKeys.includes(key)) {
                    extraKeys.push(key);
                }
            }
        }
        const pairs = [];
        for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
                key: { status: "valid", value: key },
                value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (this._def.catchall instanceof ZodNever) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
                for (const key of extraKeys) {
                    pairs.push({
                        key: { status: "valid", value: key },
                        value: { status: "valid", value: ctx.data[key] },
                    });
                }
            }
            else if (unknownKeys === "strict") {
                if (extraKeys.length > 0) {
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.unrecognized_keys,
                        keys: extraKeys,
                    });
                    status.dirty();
                }
            }
            else if (unknownKeys === "strip") ;
            else {
                throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
        }
        else {
            // run catchall validation
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
                const value = ctx.data[key];
                pairs.push({
                    key: { status: "valid", value: key },
                    value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key) //, ctx.child(key), value, getParsedType(value)
                    ),
                    alwaysSet: key in ctx.data,
                });
            }
        }
        if (ctx.common.async) {
            return Promise.resolve()
                .then(async () => {
                const syncPairs = [];
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    syncPairs.push({
                        key,
                        value,
                        alwaysSet: pair.alwaysSet,
                    });
                }
                return syncPairs;
            })
                .then((syncPairs) => {
                return ParseStatus.mergeObjectSync(status, syncPairs);
            });
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get shape() {
        return this._def.shape();
    }
    strict(message) {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...(message !== undefined
                ? {
                    errorMap: (issue, ctx) => {
                        const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
                        if (issue.code === "unrecognized_keys")
                            return {
                                message: errorUtil.errToObj(message).message ?? defaultError,
                            };
                        return {
                            message: defaultError,
                        };
                    },
                }
                : {}),
        });
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip",
        });
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough",
        });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...augmentation,
            }),
        });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
        const merged = new ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...merging._def.shape(),
            }),
            typeName: ZodFirstPartyTypeKind.ZodObject,
        });
        return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
        return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
        return new ZodObject({
            ...this._def,
            catchall: index,
        });
    }
    pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
            if (mask[key] && this.shape[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
            if (!mask[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    /**
     * @deprecated
     */
    deepPartial() {
        return deepPartialify(this);
    }
    partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
                newShape[key] = fieldSchema;
            }
            else {
                newShape[key] = fieldSchema.optional();
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
            if (mask && !mask[key]) {
                newShape[key] = this.shape[key];
            }
            else {
                const fieldSchema = this.shape[key];
                let newField = fieldSchema;
                while (newField instanceof ZodOptional) {
                    newField = newField._def.innerType;
                }
                newShape[key] = newField;
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    keyof() {
        return createZodEnum(util.objectKeys(this.shape));
    }
}
ZodObject.create = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
class ZodUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
            // return first issue-free validation if it exists
            for (const result of results) {
                if (result.result.status === "valid") {
                    return result.result;
                }
            }
            for (const result of results) {
                if (result.result.status === "dirty") {
                    // add issues from dirty option
                    ctx.common.issues.push(...result.ctx.common.issues);
                    return result.result;
                }
            }
            // return invalid
            const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return Promise.all(options.map(async (option) => {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                return {
                    result: await option._parseAsync({
                        data: ctx.data,
                        path: ctx.path,
                        parent: childCtx,
                    }),
                    ctx: childCtx,
                };
            })).then(handleResults);
        }
        else {
            let dirty = undefined;
            const issues = [];
            for (const option of options) {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                const result = option._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: childCtx,
                });
                if (result.status === "valid") {
                    return result;
                }
                else if (result.status === "dirty" && !dirty) {
                    dirty = { result, ctx: childCtx };
                }
                if (childCtx.common.issues.length) {
                    issues.push(childCtx.common.issues);
                }
            }
            if (dirty) {
                ctx.common.issues.push(...dirty.ctx.common.issues);
                return dirty.result;
            }
            const unionErrors = issues.map((issues) => new ZodError(issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
    }
    get options() {
        return this._def.options;
    }
}
ZodUnion.create = (types, params) => {
    return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params),
    });
};
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//////////                                 //////////
//////////      ZodDiscriminatedUnion      //////////
//////////                                 //////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
const getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
    }
    else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
    }
    else if (type instanceof ZodLiteral) {
        return [type.value];
    }
    else if (type instanceof ZodEnum) {
        return type.options;
    }
    else if (type instanceof ZodNativeEnum) {
        // eslint-disable-next-line ban/ban
        return util.objectValues(type.enum);
    }
    else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
    }
    else if (type instanceof ZodUndefined) {
        return [undefined];
    }
    else if (type instanceof ZodNull) {
        return [null];
    }
    else if (type instanceof ZodOptional) {
        return [undefined, ...getDiscriminator(type.unwrap())];
    }
    else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
    }
    else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
    }
    else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
    }
    else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
    }
    else {
        return [];
    }
};
class ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union_discriminator,
                options: Array.from(this.optionsMap.keys()),
                path: [discriminator],
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
        else {
            return option._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
    }
    get discriminator() {
        return this._def.discriminator;
    }
    get options() {
        return this._def.options;
    }
    get optionsMap() {
        return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
        // Get all the valid discriminator values
        const optionsMap = new Map();
        // try {
        for (const type of options) {
            const discriminatorValues = getDiscriminator(type.shape[discriminator]);
            if (!discriminatorValues.length) {
                throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
            }
            for (const value of discriminatorValues) {
                if (optionsMap.has(value)) {
                    throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
                }
                optionsMap.set(value, type);
            }
        }
        return new ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
            discriminator,
            options,
            optionsMap,
            ...processCreateParams(params),
        });
    }
}
function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
        const bKeys = util.objectKeys(b);
        const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
        if (a.length !== b.length) {
            return { valid: false };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
        return { valid: true, data: a };
    }
    else {
        return { valid: false };
    }
}
class ZodIntersection extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted(parsedLeft) || isAborted(parsedRight)) {
                return INVALID;
            }
            const merged = mergeValues(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.invalid_intersection_types,
                });
                return INVALID;
            }
            if (isDirty(parsedLeft) || isDirty(parsedRight)) {
                status.dirty();
            }
            return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
            return Promise.all([
                this._def.left._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
                this._def.right._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
            ]).then(([left, right]) => handleParsed(left, right));
        }
        else {
            return handleParsed(this._def.left._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }), this._def.right._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }));
        }
    }
}
ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
        left: left,
        right: right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params),
    });
};
// type ZodTupleItems = [ZodTypeAny, ...ZodTypeAny[]];
class ZodTuple extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            status.dirty();
        }
        const items = [...ctx.data]
            .map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema)
                return null;
            return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        })
            .filter((x) => !!x); // filter nulls
        if (ctx.common.async) {
            return Promise.all(items).then((results) => {
                return ParseStatus.mergeArray(status, results);
            });
        }
        else {
            return ParseStatus.mergeArray(status, items);
        }
    }
    get items() {
        return this._def.items;
    }
    rest(rest) {
        return new ZodTuple({
            ...this._def,
            rest,
        });
    }
}
ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params),
    });
};
class ZodRecord extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
            pairs.push({
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
                value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (ctx.common.async) {
            return ParseStatus.mergeObjectAsync(status, pairs);
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get element() {
        return this._def.valueType;
    }
    static create(first, second, third) {
        if (second instanceof ZodType) {
            return new ZodRecord({
                keyType: first,
                valueType: second,
                typeName: ZodFirstPartyTypeKind.ZodRecord,
                ...processCreateParams(third),
            });
        }
        return new ZodRecord({
            keyType: ZodString.create(),
            valueType: first,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(second),
        });
    }
}
class ZodMap extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.map,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
            return {
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
                value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"])),
            };
        });
        if (ctx.common.async) {
            const finalMap = new Map();
            return Promise.resolve().then(async () => {
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    if (key.status === "aborted" || value.status === "aborted") {
                        return INVALID;
                    }
                    if (key.status === "dirty" || value.status === "dirty") {
                        status.dirty();
                    }
                    finalMap.set(key.value, value.value);
                }
                return { status: status.value, value: finalMap };
            });
        }
        else {
            const finalMap = new Map();
            for (const pair of pairs) {
                const key = pair.key;
                const value = pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                    return INVALID;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                    status.dirty();
                }
                finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
        }
    }
}
ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params),
    });
};
class ZodSet extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.set,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.minSize.message,
                });
                status.dirty();
            }
        }
        if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.maxSize.message,
                });
                status.dirty();
            }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements) {
            const parsedSet = new Set();
            for (const element of elements) {
                if (element.status === "aborted")
                    return INVALID;
                if (element.status === "dirty")
                    status.dirty();
                parsedSet.add(element.value);
            }
            return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
            return Promise.all(elements).then((elements) => finalizeSet(elements));
        }
        else {
            return finalizeSet(elements);
        }
    }
    min(minSize, message) {
        return new ZodSet({
            ...this._def,
            minSize: { value: minSize, message: errorUtil.toString(message) },
        });
    }
    max(maxSize, message) {
        return new ZodSet({
            ...this._def,
            maxSize: { value: maxSize, message: errorUtil.toString(message) },
        });
    }
    size(size, message) {
        return this.min(size, message).max(size, message);
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodSet.create = (valueType, params) => {
    return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params),
    });
};
class ZodLazy extends ZodType {
    get schema() {
        return this._def.getter();
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
}
ZodLazy.create = (getter, params) => {
    return new ZodLazy({
        getter: getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params),
    });
};
class ZodLiteral extends ZodType {
    _parse(input) {
        if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_literal,
                expected: this._def.value,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
    get value() {
        return this._def.value;
    }
}
ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
        value: value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params),
    });
};
function createZodEnum(values, params) {
    return new ZodEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodEnum,
        ...processCreateParams(params),
    });
}
class ZodEnum extends ZodType {
    _parse(input) {
        if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (!this._cache) {
            this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get options() {
        return this._def.values;
    }
    get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    extract(values, newDef = this._def) {
        return ZodEnum.create(values, {
            ...this._def,
            ...newDef,
        });
    }
    exclude(values, newDef = this._def) {
        return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
            ...this._def,
            ...newDef,
        });
    }
}
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
    _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (!this._cache) {
            this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get enum() {
        return this._def.values;
    }
}
ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
        values: values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params),
    });
};
class ZodPromise extends ZodType {
    unwrap() {
        return this._def.type;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.promise,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
            return this._def.type.parseAsync(data, {
                path: ctx.path,
                errorMap: ctx.common.contextualErrorMap,
            });
        }));
    }
}
ZodPromise.create = (schema, params) => {
    return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params),
    });
};
class ZodEffects extends ZodType {
    innerType() {
        return this._def.schema;
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects
            ? this._def.schema.sourceType()
            : this._def.schema;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
            addIssue: (arg) => {
                addIssueToContext(ctx, arg);
                if (arg.fatal) {
                    status.abort();
                }
                else {
                    status.dirty();
                }
            },
            get path() {
                return ctx.path;
            },
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.async) {
                return Promise.resolve(processed).then(async (processed) => {
                    if (status.value === "aborted")
                        return INVALID;
                    const result = await this._def.schema._parseAsync({
                        data: processed,
                        path: ctx.path,
                        parent: ctx,
                    });
                    if (result.status === "aborted")
                        return INVALID;
                    if (result.status === "dirty")
                        return DIRTY(result.value);
                    if (status.value === "dirty")
                        return DIRTY(result.value);
                    return result;
                });
            }
            else {
                if (status.value === "aborted")
                    return INVALID;
                const result = this._def.schema._parseSync({
                    data: processed,
                    path: ctx.path,
                    parent: ctx,
                });
                if (result.status === "aborted")
                    return INVALID;
                if (result.status === "dirty")
                    return DIRTY(result.value);
                if (status.value === "dirty")
                    return DIRTY(result.value);
                return result;
            }
        }
        if (effect.type === "refinement") {
            const executeRefinement = (acc) => {
                const result = effect.refinement(acc, checkCtx);
                if (ctx.common.async) {
                    return Promise.resolve(result);
                }
                if (result instanceof Promise) {
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                }
                return acc;
            };
            if (ctx.common.async === false) {
                const inner = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inner.status === "aborted")
                    return INVALID;
                if (inner.status === "dirty")
                    status.dirty();
                // return value is ignored
                executeRefinement(inner.value);
                return { status: status.value, value: inner.value };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
                    if (inner.status === "aborted")
                        return INVALID;
                    if (inner.status === "dirty")
                        status.dirty();
                    return executeRefinement(inner.value).then(() => {
                        return { status: status.value, value: inner.value };
                    });
                });
            }
        }
        if (effect.type === "transform") {
            if (ctx.common.async === false) {
                const base = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (!isValid(base))
                    return INVALID;
                const result = effect.transform(base.value, checkCtx);
                if (result instanceof Promise) {
                    throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
                }
                return { status: status.value, value: result };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
                    if (!isValid(base))
                        return INVALID;
                    return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                        status: status.value,
                        value: result,
                    }));
                });
            }
        }
        util.assertNever(effect);
    }
}
ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params),
    });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params),
    });
};
class ZodOptional extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
            return OK(undefined);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodOptional.create = (type, params) => {
    return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params),
    });
};
class ZodNullable extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
            return OK(null);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodNullable.create = (type, params) => {
    return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params),
    });
};
class ZodDefault extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
            data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    removeDefault() {
        return this._def.innerType;
    }
}
ZodDefault.create = (type, params) => {
    return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params),
    });
};
class ZodCatch extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        // newCtx is used to not collect issues from inner types in ctx
        const newCtx = {
            ...ctx,
            common: {
                ...ctx.common,
                issues: [],
            },
        };
        const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
                ...newCtx,
            },
        });
        if (isAsync(result)) {
            return result.then((result) => {
                return {
                    status: "valid",
                    value: result.status === "valid"
                        ? result.value
                        : this._def.catchValue({
                            get error() {
                                return new ZodError(newCtx.common.issues);
                            },
                            input: newCtx.data,
                        }),
                };
            });
        }
        else {
            return {
                status: "valid",
                value: result.status === "valid"
                    ? result.value
                    : this._def.catchValue({
                        get error() {
                            return new ZodError(newCtx.common.issues);
                        },
                        input: newCtx.data,
                    }),
            };
        }
    }
    removeCatch() {
        return this._def.innerType;
    }
}
ZodCatch.create = (type, params) => {
    return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params),
    });
};
class ZodNaN extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.nan,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
}
ZodNaN.create = (params) => {
    return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params),
    });
};
class ZodBranded extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    unwrap() {
        return this._def.type;
    }
}
class ZodPipeline extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
            const handleAsync = async () => {
                const inResult = await this._def.in._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inResult.status === "aborted")
                    return INVALID;
                if (inResult.status === "dirty") {
                    status.dirty();
                    return DIRTY(inResult.value);
                }
                else {
                    return this._def.out._parseAsync({
                        data: inResult.value,
                        path: ctx.path,
                        parent: ctx,
                    });
                }
            };
            return handleAsync();
        }
        else {
            const inResult = this._def.in._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
            if (inResult.status === "aborted")
                return INVALID;
            if (inResult.status === "dirty") {
                status.dirty();
                return {
                    status: "dirty",
                    value: inResult.value,
                };
            }
            else {
                return this._def.out._parseSync({
                    data: inResult.value,
                    path: ctx.path,
                    parent: ctx,
                });
            }
        }
    }
    static create(a, b) {
        return new ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind.ZodPipeline,
        });
    }
}
class ZodReadonly extends ZodType {
    _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
            if (isValid(data)) {
                data.value = Object.freeze(data.value);
            }
            return data;
        };
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params),
    });
};
////////////////////////////////////////
////////////////////////////////////////
//////////                    //////////
//////////      z.custom      //////////
//////////                    //////////
////////////////////////////////////////
////////////////////////////////////////
function cleanParams(params, data) {
    const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
    const p2 = typeof p === "string" ? { message: p } : p;
    return p2;
}
function custom(check, _params = {}, 
/**
 * @deprecated
 *
 * Pass `fatal` into the params object instead:
 *
 * ```ts
 * z.string().custom((val) => val.length > 5, { fatal: false })
 * ```
 *
 */
fatal) {
    if (check)
        return ZodAny.create().superRefine((data, ctx) => {
            const r = check(data);
            if (r instanceof Promise) {
                return r.then((r) => {
                    if (!r) {
                        const params = cleanParams(_params, data);
                        const _fatal = params.fatal ?? fatal ?? true;
                        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
                    }
                });
            }
            if (!r) {
                const params = cleanParams(_params, data);
                const _fatal = params.fatal ?? fatal ?? true;
                ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
            return;
        });
    return ZodAny.create();
}
var ZodFirstPartyTypeKind;
(function (ZodFirstPartyTypeKind) {
    ZodFirstPartyTypeKind["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const instanceOfType = (
// const instanceOfType = <T extends new (...args: any[]) => any>(
cls, params = {
    message: `Input not instance of ${cls.name}`,
}) => custom((data) => data instanceof cls, params);
const stringType = ZodString.create;
const numberType = ZodNumber.create;
const bigIntType = ZodBigInt.create;
const booleanType = ZodBoolean.create;
const dateType = ZodDate.create;
const nullType = ZodNull.create;
const anyType = ZodAny.create;
const arrayType = ZodArray.create;
const objectType = ZodObject.create;
const unionType = ZodUnion.create;
const discriminatedUnionType = ZodDiscriminatedUnion.create;
const tupleType = ZodTuple.create;
const recordType = ZodRecord.create;
const mapType = ZodMap.create;
const lazyType = ZodLazy.create;
const literalType = ZodLiteral.create;
const enumType = ZodEnum.create;

const big = bigIntType(), bool = booleanType(), date = dateType(), num$7 = numberType(), uint = numberType().max(Number.MAX_SAFE_INTEGER), str$6 = stringType(), stamp = numberType().min(500_000_000).max(Number.MAX_SAFE_INTEGER), any = anyType();
const sats = bigIntType().max(100000000n * 21000000n);
const hex$4 = stringType()
    .regex(/^[0-9a-fA-F]*$/)
    .refine(e => e.length % 2 === 0);
const literal$2 = unionType([
    stringType(), numberType(), booleanType(), nullType()
]);
const json$1 = lazyType(() => unionType([literal$2, arrayType(json$1), recordType(json$1)]));
const hash32$3 = hex$4.refine((e) => e.length === 64);
const hash20 = hex$4.refine((e) => e.length === 40);
const hash64$1 = hex$4.refine((e) => e.length === 128);
const pubkey = hex$4.refine((e) => e.length === 64 || e.length === 66);
const cpubkey = hex$4.refine((e) => e.length === 66);
const xpubkey = hex$4.refine((e) => e.length === 64);
const base58$2 = stringType().regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
const base64$1 = stringType().regex(/^[a-zA-Z0-9+/]+={0,2}$/);
const base64url = stringType().regex(/^[a-zA-Z0-9\-_]+={0,2}$/);
const bech32$4 = stringType().regex(/^[a-z]+1[023456789acdefghjklmnpqrstuvwxyz]+$/);
var base = {
    any,
    base58: base58$2,
    base64: base64$1,
    base64url,
    bech32: bech32$4,
    big,
    bool,
    date,
    hash20,
    hash32: hash32$3,
    hash64: hash64$1,
    hex: hex$4,
    json: json$1,
    literal: literal$2,
    num: num$7,
    pubkey,
    cpubkey,
    xpubkey,
    sats,
    str: str$6,
    stamp,
    uint
};

const { str: str$5 } = base;
const inscribe_id = str$5.regex(/^[a-fA-F0-9]{64}i[0-9]+$/);
const outpoint = str$5.regex(/^[a-fA-F0-9]{64}:[0-9]+$/);
const rune_id = str$5.regex(/^[0-9]+\:[0-9]+$/);
const satpoint = str$5.regex(/^[a-fA-F0-9]{64}:[0-9]+:[0-9]+$/);
var ord$1 = {
    inscribe_id,
    outpoint,
    rune_id,
    satpoint
};

const liquid_terms = objectType({
    liquidation_thold: base.num,
    reserve_pubkey: base.hash32,
    reserve_sats_min: base.num,
    liquid_tax_rate: base.num,
    subsidy_inc_rate: base.num,
    subsidy_inc_thold: base.num
});
const vault_terms = objectType({
    collateral_min: base.num,
    internal_key: base.hash32,
    sats_balance_min: base.num,
    unit_balance_min: base.num
});
const vault_action = unionType([
    literalType('open'),
    literalType('borrow'),
    literalType('repay'),
    literalType('deposit'),
    literalType('withdraw'),
    literalType('repo'),
    literalType('liquidate'),
]);
const vault_flag = unionType([
    literalType('o'),
    literalType('b'),
    literalType('r'),
    literalType('d'),
    literalType('w'),
    literalType('x'),
    literalType('l'),
]);
var proto$2 = {
    liquid_terms,
    vault_terms,
    vault_action,
    vault_flag
};

const { hash32: hash32$2, hex: hex$3, num: num$6, base58: base58$1, bech32: bech32$3 } = base;
const btc_address = unionType([base58$1, bech32$3]);
const network$1 = enumType(['main', 'testnet3', 'testnet4', 'mutiny', 'regtest', 'signet']);
const txout$1 = objectType({
    value: num$6,
    scriptPubKey: hex$3
});
const txin$1 = objectType({
    txid: hash32$2,
    vout: num$6,
    prevout: txout$1,
    script_sig: hex$3.array().optional(),
    sequence: num$6.optional(),
    witness: hex$3.array().optional()
});
const utxo = objectType({
    txid: hash32$2,
    vout: num$6,
    value: num$6,
    script: hex$3
});
const signed_utxo = utxo.extend({
    sighash: hash32$2.optional(),
    witness: hex$3.array()
});
const tx = {
    version: num$6,
    vin: txin$1.array(),
    vout: txout$1.array(),
    locktime: num$6
};
var tx$1 = { btc_address, network: network$1, tx, txin: txin$1, txout: txout$1, utxo, signed_utxo };

const { hex: hex$2, json, str: str$4 } = base;
const data = unionType([recordType(json), arrayType(json), str$4]);
const topic = stringType().regex(/^[a-zA-Z0-9_\/]+$/);
const type = unionType([
    literalType('req'),
    literalType('res'),
    literalType('info'),
    literalType('rej')
]);
const identifier = hex$2.refine((e) => e.length === 32);
const envelope = tupleType([type, identifier, topic, data]);
var ws = { data, envelope, identifier, topic, type };

const { bech32: bech32$2, num: num$5, str: str$3 } = base;
const acct_profile = objectType({
    acct_id: ord$1.inscribe_id,
    balance: base.num,
    issued: base.num,
    utxo: tx$1.utxo
});
const mint_profile = objectType({
    address: bech32$2,
    divisor: num$5,
    issued: num$5,
    label: str$3,
    mint_id: ord$1.inscribe_id,
    rune_id: ord$1.rune_id,
    symbol: str$3,
    utxo: tx$1.utxo
});
var mint$1 = {
    acct_profile,
    mint_profile
};

const { hash64, hex: hex$1, num: num$4, str: str$2 } = base;
const actions = enumType(['open', 'borrow', 'repay', 'deposit', 'withdraw', 'repo', 'liquidate']);
const flags = enumType(['o', 'b', 'r', 'd', 'w', 'x', 'l']);
const base_return = objectType({
    unit_balance: base.num,
    unit_price: base.num,
    unit_stamp: base.num,
    vault_action: flags
});
const locked_return_data = base_return.extend({
    is_locked: literalType(true),
    thold_hash: base.hash20,
    thold_price: base.num
});
const cleared_return_data = base_return.extend({
    is_locked: literalType(false)
});
const return_data = discriminatedUnionType('is_locked', [locked_return_data, cleared_return_data]);
const token_data = objectType({
    rev: num$4,
    tag: str$2,
    ver: num$4
});
const open_witness = tupleType([hash64, hex$1, hex$1]);
const update_witness = tupleType([hash64, hash64, hex$1, hex$1]);
var vdata = {
    actions,
    flags,
    open_witness,
    return_data,
    token_data,
    update_witness
};

const base_config = objectType({
    sats_address: base.str,
    tx_feerate: base.num
});
const open_config$1 = base_config.extend({
    borrow_amount: base.num,
    deposit_amount: base.num,
    token_address: base.bech32,
    token_data: vdata.token_data,
    token_postage: base.num,
    unit_address: base.bech32,
    unit_postage: base.num,
    vault_pubkey: base.hash32,
});
const borrow_config$1 = base_config.extend({
    borrow_amount: base.num,
    deposit_amount: base.num,
    unit_address: base.bech32,
    unit_postage: base.num
});
const repay_config$1 = base_config.extend({
    deposit_amount: base.num,
    repay_amount: base.num,
    unit_address: base.bech32,
    unit_postage: base.num
});
const repo_config$1 = base_config.extend({
    deposit_amount: base.num,
});
const deposit_config$1 = base_config.extend({
    deposit_amount: base.num
});
const withdraw_config$1 = base_config.extend({
    change_amount: base.num
});
var config$1 = {
    borrow_config: borrow_config$1,
    deposit_config: deposit_config$1,
    open_config: open_config$1,
    repay_config: repay_config$1,
    repo_config: repo_config$1,
    withdraw_config: withdraw_config$1
};

const base_quote = objectType({
    event_origin: base.str.nullable(),
    event_price: base.num.nullable(),
    event_stamp: base.stamp.nullable(),
    event_type: base.str,
    latest_origin: base.str,
    latest_price: base.num,
    latest_stamp: base.stamp,
    quote_origin: base.str,
    quote_price: base.num,
    quote_stamp: base.stamp,
    req_id: base.hash32,
    req_sig: base.hex,
    srv_network: base.str,
    srv_pubkey: base.hex,
    thold_hash: base.hash20,
    thold_key: base.hash32.nullable(),
    thold_price: base.num
});
const active_quote = base_quote.extend({
    is_expired: literalType(false),
    event_origin: nullType(),
    event_price: nullType(),
    event_stamp: nullType(),
    thold_key: nullType()
});
const expired_quote = base_quote.extend({
    is_expired: literalType(true),
    event_origin: base.str,
    event_price: base.num,
    event_stamp: base.stamp,
    thold_key: base.hash32
});
const price_quote = discriminatedUnionType('is_expired', [active_quote, expired_quote]);
var quote$1 = { active_quote, expired_quote, price_quote };

const acct_input = objectType({
    acct_id: ord$1.inscribe_id,
    acct_utxo: tx$1.utxo
});
const liquid_input = tx$1.signed_utxo.extend({
    repo_portion: base.num,
    vault_pubkey: base.hash32
});
const proto_input = objectType({
    contract_id: ord$1.inscribe_id,
    guard_pubkey: base.hash32,
    unit_rune_id: ord$1.rune_id,
    unit_rune_lbl: base.str
});
const vault_input = objectType({
    vault_balance: base.num,
    vault_pubkey: base.hash32,
    vault_utxo: tx$1.utxo
});
var input = {
    acct_input,
    liquid_input,
    proto_input,
    vault_input
};

const base_ctx = objectType({
    sats_address: base.str,
    tx_feerate: base.num,
    vault_action: vdata.flags,
    vault_quote: quote$1.active_quote,
    vault_pubkey: base.hash32
});
const open_ctx = base_ctx
    .merge(config$1.open_config)
    .merge(input.acct_input)
    .merge(input.proto_input);
const borrow_ctx = base_ctx
    .merge(config$1.borrow_config)
    .merge(input.acct_input)
    .merge(input.proto_input)
    .merge(input.vault_input);
const repay_ctx = base_ctx
    .merge(config$1.repay_config)
    .merge(input.acct_input)
    .merge(input.proto_input)
    .merge(input.vault_input);
const repo_ctx = base_ctx
    .merge(config$1.repo_config)
    .merge(input.proto_input)
    .merge(input.vault_input);
const deposit_ctx = base_ctx
    .merge(config$1.deposit_config)
    .merge(input.proto_input)
    .merge(input.vault_input);
const withdraw_ctx = base_ctx
    .merge(config$1.withdraw_config)
    .merge(input.proto_input)
    .merge(input.vault_input);
var ctx = {
    open_ctx,
    borrow_ctx,
    repay_ctx,
    repo_ctx,
    deposit_ctx,
    withdraw_ctx
};

const base_req$1 = objectType({
    contract_id: ord$1.inscribe_id,
    tx_feerate: base.num,
    vault_action: vdata.flags,
    vault_psbt: base.base64.optional(),
    vault_txhex: base.hex.optional(),
    vault_txid: base.hash32,
    vault_pubkey: base.hash32,
    vault_quote: quote$1.price_quote
});
const open_req$1 = base_req$1.extend({
    acct_id: ord$1.inscribe_id,
    acct_utxo: tx$1.utxo,
    borrow_amount: base.num,
    connect_input: tx$1.signed_utxo,
    deposit_amount: base.num,
    sats_address: tx$1.btc_address,
    sats_inputs: tx$1.signed_utxo.array(),
    unit_address: base.bech32,
    unit_postage: base.num,
    token_address: base.bech32,
    token_data: vdata.token_data,
    token_postage: base.num,
    issue_psbt: base.base64.optional(),
    issue_txhex: base.hex.optional(),
    issue_txid: base.hex
});
const borrow_req$1 = base_req$1.extend({
    acct_id: ord$1.inscribe_id,
    acct_utxo: tx$1.utxo,
    borrow_amount: base.num,
    connect_input: tx$1.signed_utxo,
    deposit_amount: base.num,
    issue_psbt: base.base64.optional(),
    issue_txhex: base.hex.optional(),
    issue_txid: base.hex,
    sats_address: tx$1.btc_address,
    sats_inputs: tx$1.signed_utxo.array(),
    unit_address: base.bech32,
    unit_postage: base.num,
    vault_input: tx$1.signed_utxo
});
const repay_req$1 = base_req$1.extend({
    acct_id: ord$1.inscribe_id,
    acct_utxo: tx$1.utxo,
    connect_input: tx$1.signed_utxo,
    repay_amount: base.num,
    repay_psbt: base.base64.optional(),
    repay_txhex: base.hex.optional(),
    repay_txid: base.hex,
    sats_address: tx$1.btc_address,
    sats_inputs: tx$1.signed_utxo.array(),
    unit_inputs: tx$1.signed_utxo.array(),
    unit_address: base.bech32,
    unit_postage: base.num,
    vault_input: tx$1.signed_utxo
});
const repo_req$1 = base_req$1.extend({
    connect_input: tx$1.signed_utxo,
    deposit_amount: base.num,
    liquid_psbt: base.base64.optional(),
    liquid_txhex: base.hex.optional(),
    liquid_txid: base.hex,
    liquid_inputs: input.liquid_input.array(),
    repo_amount: base.num,
    sats_address: tx$1.btc_address,
    sats_inputs: tx$1.signed_utxo.array(),
    vault_input: tx$1.signed_utxo
});
const deposit_req$1 = base_req$1.extend({
    deposit_amount: base.num,
    sats_address: tx$1.btc_address,
    sats_inputs: tx$1.signed_utxo.array(),
    vault_input: tx$1.signed_utxo
});
const withdraw_req$1 = base_req$1.extend({
    change_amount: base.num,
    sats_address: tx$1.btc_address,
    vault_input: tx$1.signed_utxo
});
var req$1 = {
    borrow_req: borrow_req$1,
    deposit_req: deposit_req$1,
    open_req: open_req$1,
    repay_req: repay_req$1,
    repo_req: repo_req$1,
    withdraw_req: withdraw_req$1
};

var vault$2 = { base: vdata, config: config$1, ctx, input, req: req$1 };

const acct_reserve_config = objectType({
    unit_amount: base.num,
    vault_action: vault$2.base.actions,
    vault_pubkey: base.hash32
});
const acct_reserve_req = acct_reserve_config.extend({
    network: tx$1.network
});
const acct_reserve_res = objectType({
    mint_account: mint$1.acct_profile,
    vault_action: vault$2.base.actions,
    vault_pubkey: base.hash32
});
const vault_update_res = objectType({
    vault_txid: base.hash32,
    vault_pubkey: base.hash32
});
const vault_open_res = vault_update_res.extend({
    issue_txid: base.hash32
});
const vault_borrow_res = vault_update_res.extend({
    issue_txid: base.hash32
});
const vault_repay_res = vault_update_res.extend({
    repay_txid: base.hash32
});
const vault_repo_res = vault_update_res.extend({
    liquid_txid: base.hash32
});
var guard = {
    acct_reserve_config,
    acct_reserve_req,
    acct_reserve_res,
    vault_open_res,
    vault_borrow_res,
    vault_repay_res,
    vault_repo_res,
    vault_update_res
};

const { bech32: bech32$1, hash32: hash32$1, num: num$3 } = base;
const adr_ptr = tupleType([bech32$1, num$3]);
const rec_ptr = tupleType([bech32$1, ord$1.inscribe_id]);
const val_ptr = tupleType([num$3, num$3]);
const group_contract = objectType({ adr: bech32$1 });
const point_contract = group_contract.extend({ ptr: val_ptr.array() });
const quorum_contract = group_contract.extend({
    pub: hash32$1,
    thd: num$3
});
var contract$1 = {
    adr_ptr,
    group_contract,
    point_contract,
    quorum_contract,
    rec_ptr,
    val_ptr
};

const { literal: literal$1, num: num$2, str: str$1 } = base;
const group_map = mapType(str$1, ord$1.outpoint.array());
const term_map = mapType(str$1, literal$1.array());
const guard_contract = contract$1.quorum_contract;
const oracle_contract = contract$1.group_contract;
const terms_contract = contract$1.point_contract;
const master_contract = objectType({
    groups: objectType({
        guard: contract$1.adr_ptr,
        oracle: contract$1.adr_ptr
    }),
    runes: objectType({
        unit: contract$1.rec_ptr
    }),
    terms: objectType({
        repo: contract$1.adr_ptr,
        vault: contract$1.adr_ptr
    }),
    ver: num$2
});
const proto_profile = objectType({
    ctx: master_contract,
    groups: objectType({
        guard: guard_contract,
        oracle: oracle_contract
    }),
    master_id: ord$1.inscribe_id,
    points: objectType({
        repo: terms_contract,
        vault: terms_contract
    }),
    runes: objectType({
        unit: mint$1.mint_profile,
    }),
    terms: term_map
});
var proto$1 = {
    group_map,
    guard_contract,
    oracle_contract,
    master_contract,
    proto_profile,
    term_map,
    terms_contract
};

const { hash32, literal, num: num$1, str } = base;
const val_arr = tupleType([num$1]).rest(literal);
const acct_record = objectType({
    iss: num$1,
});
const host_record = objectType({
    pub: hash32,
    url: str.url()
});
const token_record = objectType({
    dat: anyType(),
    ref: ord$1.inscribe_id
});
var record$2 = {
    acct_record,
    host_record,
    token_record,
    val_arr
};

const prevout = objectType({
    rdata: vdata.return_data,
    utxo: tx$1.utxo
});
const profile = prevout.extend({
    acct_id: ord$1.inscribe_id,
    guard_pk: base.hash32,
    master_id: ord$1.inscribe_id,
    vault_pk: base.hash32
});
const record$1 = objectType({
    gpk: base.hash32,
    mid: ord$1.inscribe_id,
    vpk: base.hash32,
    ver: base.num
});
const token = objectType({
    data: vdata.token_data,
    ptr: base.num,
    utxo: tx$1.utxo,
    vid: ord$1.inscribe_id
});
var vault$1 = { prevout, profile, record: record$1, token };

var oracle = { contract: contract$1, mint: mint$1, proto: proto$1, quote: quote$1, record: record$2, vault: vault$1 };

const open_config = objectType({
    borrow_amount: base.num,
    deposit_amount: base.num,
    tx_feerate: base.num,
    vault_label: base.str,
});
const borrow_config = objectType({
    borrow_amount: base.num,
    deposit_amount: base.num,
    tx_feerate: base.num
});
const repay_config = objectType({
    deposit_amount: base.num,
    repay_amount: base.num,
    tx_feerate: base.num
});
const repo_config = objectType({
    deposit_amount: base.num,
    tx_feerate: base.num
});
const deposit_config = objectType({
    deposit_amount: base.num,
    tx_feerate: base.num
});
const withdraw_config = objectType({
    change_amount: base.num,
    tx_feerate: base.num
});
var config = {
    open_config,
    borrow_config,
    repay_config,
    repo_config,
    deposit_config,
    withdraw_config
};

const base_req = objectType({
    contract_id: ord$1.inscribe_id,
    network: tx$1.network
});
const open_req = vault$2.req.open_req.merge(base_req);
const borrow_req = vault$2.req.borrow_req.merge(base_req);
const repay_req = vault$2.req.repay_req.merge(base_req);
const repo_req = vault$2.req.repo_req.merge(base_req);
const deposit_req = vault$2.req.deposit_req.merge(base_req);
const withdraw_req = vault$2.req.withdraw_req.merge(base_req);
var req = {
    open_req,
    borrow_req,
    repay_req,
    repo_req,
    deposit_req,
    withdraw_req
};

var wallet$1 = { config, req };

var Schema = { base, guard, oracle, ord: ord$1, proto: proto$2, tx: tx$1, vault: vault$2, wallet: wallet$1, ws };

const crypto = typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;

/**
 * Utilities for hex, bytes, CSPRNG.
 * @module
 */
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
// node.js versions earlier than v19 don't declare it in global scope.
// For node.js, package.json#exports field mapping rewrites import
// from `crypto` to `cryptoNode`, which imports native module.
// Makes the utils un-importable in browsers without a bundler.
// Once node.js 18 is deprecated (2025-04-30), we can just drop the import.
/** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
function isBytes$3(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
/** Asserts something is positive integer. */
function anumber$1(n) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new Error('positive integer expected, got ' + n);
}
/** Asserts something is Uint8Array. */
function abytes$1(b, ...lengths) {
    if (!isBytes$3(b))
        throw new Error('Uint8Array expected');
    if (lengths.length > 0 && !lengths.includes(b.length))
        throw new Error('Uint8Array expected of length ' + lengths + ', got length=' + b.length);
}
/** Asserts something is hash */
function ahash(h) {
    if (typeof h !== 'function' || typeof h.create !== 'function')
        throw new Error('Hash should be wrapped by utils.createHasher');
    anumber$1(h.outputLen);
    anumber$1(h.blockLen);
}
/** Asserts a hash instance has not been destroyed / finished */
function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
/** Asserts output is properly-sized byte array */
function aoutput(out, instance) {
    abytes$1(out);
    const min = instance.outputLen;
    if (out.length < min) {
        throw new Error('digestInto() expects output buffer of length at least ' + min);
    }
}
/** Zeroize a byte array. Warning: JS provides no guarantees. */
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/** Create DataView of an array for easy byte-level manipulation. */
function createView$1(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/** The rotate right (circular right shift) operation for uint32 */
function rotr(word, shift) {
    return (word << (32 - shift)) | (word >>> shift);
}
/** The rotate left (circular left shift) operation for uint32 */
function rotl(word, shift) {
    return (word << shift) | ((word >>> (32 - shift)) >>> 0);
}
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
const hasHexBuiltin$1 = /* @__PURE__ */ (() => 
// @ts-ignore
typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
/**
 * Convert byte array to hex string. Uses built-in function, when available.
 * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
 */
function bytesToHex$1(bytes) {
    abytes$1(bytes);
    // @ts-ignore
    if (hasHexBuiltin$1)
        return bytes.toHex();
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}
// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
        return ch - asciis._0; // '2' => 50-48
    if (ch >= asciis.A && ch <= asciis.F)
        return ch - (asciis.A - 10); // 'B' => 66-(65-10)
    if (ch >= asciis.a && ch <= asciis.f)
        return ch - (asciis.a - 10); // 'b' => 98-(97-10)
    return;
}
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 */
function hexToBytes$1(hex) {
    if (typeof hex !== 'string')
        throw new Error('hex string expected, got ' + typeof hex);
    // @ts-ignore
    if (hasHexBuiltin$1)
        return Uint8Array.fromHex(hex);
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
        throw new Error('hex string expected, got unpadded hex of length ' + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === undefined || n2 === undefined) {
            const char = hex[hi] + hex[hi + 1];
            throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
    }
    return array;
}
/**
 * Converts string to bytes using UTF8 encoding.
 * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
 */
function utf8ToBytes(str) {
    if (typeof str !== 'string')
        throw new Error('string expected');
    return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
}
/**
 * Normalizes (non-hex) string or Uint8Array to Uint8Array.
 * Warning: when Uint8Array is passed, it would NOT get copied.
 * Keep in mind for future mutable operations.
 */
function toBytes(data) {
    if (typeof data === 'string')
        data = utf8ToBytes(data);
    abytes$1(data);
    return data;
}
/** Copies several Uint8Arrays into one. */
function concatBytes$2(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes$1(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
/** For runtime check if class implements interface */
class Hash {
}
/** Wraps hash function, creating an interface on top of it */
function createHasher(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
}
/** Cryptographically secure PRNG. Uses internal OS-level `crypto.getRandomValues`. */
function randomBytes(bytesLength = 32) {
    if (crypto && typeof crypto.getRandomValues === 'function') {
        return crypto.getRandomValues(new Uint8Array(bytesLength));
    }
    // Legacy Node.js compatibility
    if (crypto && typeof crypto.randomBytes === 'function') {
        return Uint8Array.from(crypto.randomBytes(bytesLength));
    }
    throw new Error('crypto.getRandomValues must be defined');
}

/**
 * Internal Merkle-Damgard hash utils.
 * @module
 */
/** Polyfill for Safari 14. https://caniuse.com/mdn-javascript_builtins_dataview_setbiguint64 */
function setBigUint64(view, byteOffset, value, isLE) {
    if (typeof view.setBigUint64 === 'function')
        return view.setBigUint64(byteOffset, value, isLE);
    const _32n = BigInt(32);
    const _u32_max = BigInt(0xffffffff);
    const wh = Number((value >> _32n) & _u32_max);
    const wl = Number(value & _u32_max);
    const h = isLE ? 4 : 0;
    const l = isLE ? 0 : 4;
    view.setUint32(byteOffset + h, wh, isLE);
    view.setUint32(byteOffset + l, wl, isLE);
}
/** Choice: a ? b : c */
function Chi(a, b, c) {
    return (a & b) ^ (~a & c);
}
/** Majority function, true if any two inputs is true. */
function Maj(a, b, c) {
    return (a & b) ^ (a & c) ^ (b & c);
}
/**
 * Merkle-Damgard hash construction base class.
 * Could be used to create MD5, RIPEMD, SHA1, SHA2.
 */
class HashMD extends Hash {
    constructor(blockLen, outputLen, padOffset, isLE) {
        super();
        this.finished = false;
        this.length = 0;
        this.pos = 0;
        this.destroyed = false;
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView$1(this.buffer);
    }
    update(data) {
        aexists(this);
        data = toBytes(data);
        abytes$1(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            // Fast path: we have at least one block in input, cast it to view and process
            if (take === blockLen) {
                const dataView = createView$1(data);
                for (; blockLen <= len - pos; pos += blockLen)
                    this.process(dataView, pos);
                continue;
            }
            buffer.set(data.subarray(pos, pos + take), this.pos);
            this.pos += take;
            pos += take;
            if (this.pos === blockLen) {
                this.process(view, 0);
                this.pos = 0;
            }
        }
        this.length += data.length;
        this.roundClean();
        return this;
    }
    digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        // Padding
        // We can avoid allocation of buffer for padding completely if it
        // was previously not allocated here. But it won't change performance.
        const { buffer, view, blockLen, isLE } = this;
        let { pos } = this;
        // append the bit '1' to the message
        buffer[pos++] = 0b10000000;
        clean(this.buffer.subarray(pos));
        // we have less than padOffset left in buffer, so we cannot put length in
        // current block, need process it and pad again
        if (this.padOffset > blockLen - pos) {
            this.process(view, 0);
            pos = 0;
        }
        // Pad until full block byte with zeros
        for (let i = pos; i < blockLen; i++)
            buffer[i] = 0;
        // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
        // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
        // So we just write lowest 64 bits of that value.
        setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
        this.process(view, 0);
        const oview = createView$1(out);
        const len = this.outputLen;
        // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
        if (len % 4)
            throw new Error('_sha2: outputLen should be aligned to 32bit');
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
            throw new Error('_sha2: outputLen bigger than state');
        for (let i = 0; i < outLen; i++)
            oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
    }
    _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
            to.buffer.set(buffer);
        return to;
    }
    clone() {
        return this._cloneInto();
    }
}
/**
 * Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
 * Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
 */
/** Initial SHA256 state. Bits 0..32 of frac part of sqrt of primes 2..19 */
const SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/**
 * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
 * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
 * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
 * [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
 * @module
 */
/**
 * Round constants:
 * First 32 bits of fractional parts of the cube roots of the first 64 primes 2..311)
 */
// prettier-ignore
const SHA256_K = /* @__PURE__ */ Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
/** Reusable temporary buffer. "W" comes straight from spec. */
const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
class SHA256 extends HashMD {
    constructor(outputLen = 32) {
        super(64, outputLen, 8, false);
        // We cannot use array here since array allows indexing by variable
        // which means optimizer/compiler cannot use registers.
        this.A = SHA256_IV[0] | 0;
        this.B = SHA256_IV[1] | 0;
        this.C = SHA256_IV[2] | 0;
        this.D = SHA256_IV[3] | 0;
        this.E = SHA256_IV[4] | 0;
        this.F = SHA256_IV[5] | 0;
        this.G = SHA256_IV[6] | 0;
        this.H = SHA256_IV[7] | 0;
    }
    get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
    }
    process(view, offset) {
        // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
        for (let i = 0; i < 16; i++, offset += 4)
            SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
            const W15 = SHA256_W[i - 15];
            const W2 = SHA256_W[i - 2];
            const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
            const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
            SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
        }
        // Compression function main loop, 64 rounds
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
            const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
            const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
            const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
            const T2 = (sigma0 + Maj(A, B, C)) | 0;
            H = G;
            G = F;
            F = E;
            E = (D + T1) | 0;
            D = C;
            C = B;
            B = A;
            A = (T1 + T2) | 0;
        }
        // Add the compressed chunk to the current hash value
        A = (A + this.A) | 0;
        B = (B + this.B) | 0;
        C = (C + this.C) | 0;
        D = (D + this.D) | 0;
        E = (E + this.E) | 0;
        F = (F + this.F) | 0;
        G = (G + this.G) | 0;
        H = (H + this.H) | 0;
        this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
        clean(SHA256_W);
    }
    destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean(this.buffer);
    }
}
/**
 * SHA2-256 hash function from RFC 4634.
 *
 * It is the fastest JS hash, even faster than Blake3.
 * To break sha256 using birthday attack, attackers need to try 2^128 hashes.
 * BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 */
const sha256$2 = /* @__PURE__ */ createHasher(() => new SHA256());

/**
 * SHA2-256 a.k.a. sha256. In JS, it is the fastest hash, even faster than Blake3.
 *
 * To break sha256 using birthday attack, attackers need to try 2^128 hashes.
 * BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 *
 * Check out [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
 * @module
 * @deprecated
 */
/** @deprecated Use import from `noble/hashes/sha2` module */
const sha256$1 = sha256$2;

function within_size(data, size) {
    if (data.length > size) {
        throw new TypeError(`Data is larger than array size: ${data.length} > ${size}`);
    }
}
function is_hex$2(hex) {
    if (hex.match(/[^a-fA-f0-9]/) !== null) {
        throw new TypeError('Invalid characters in hex string: ' + hex);
    }
    if (hex.length % 2 !== 0) {
        throw new Error(`Length of hex string is invalid: ${hex.length}`);
    }
}
function is_safe_num(num) {
    if (num > Number.MAX_SAFE_INTEGER) {
        throw new TypeError('Number exceeds safe bounds!');
    }
}
function is_prefix(actual, target) {
    if (actual !== target) {
        throw new TypeError(`Bech32 prefix does not match: ${actual} !== ${target}`);
    }
}

const ec = new TextEncoder();
const dc = new TextDecoder();
function strToBytes(str) {
    return ec.encode(str);
}
function bytesToStr(bytes) {
    return dc.decode(bytes);
}
function hex_size(hexstr, size) {
    is_hex$2(hexstr);
    const len = hexstr.length / 2;
    if (size === undefined)
        size = len;
    if (len > size) {
        throw new TypeError(`Hex string is larger than array size: ${len} > ${size}`);
    }
    return size;
}
function hexToBytes(hexstr, size, endian = 'le') {
    size = hex_size(hexstr, size);
    const use_le = (endian === 'le');
    const buffer = new ArrayBuffer(size);
    const dataView = new DataView(buffer);
    let offset = (use_le) ? 0 : size - 1;
    for (let i = 0; i < hexstr.length; i += 2) {
        const char = hexstr.substring(i, i + 2);
        const num = parseInt(char, 16);
        if (use_le) {
            dataView.setUint8(offset++, num);
        }
        else {
            dataView.setUint8(offset--, num);
        }
    }
    return new Uint8Array(buffer);
}
function bytesToHex(bytes) {
    let chars = '';
    for (let i = 0; i < bytes.length; i++) {
        chars += bytes[i].toString(16).padStart(2, '0');
    }
    return chars;
}

/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function isBytes$2(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
/** Asserts something is Uint8Array. */
function abytes(b, ...lengths) {
    if (!isBytes$2(b))
        throw new Error('Uint8Array expected');
    if (lengths.length > 0 && !lengths.includes(b.length))
        throw new Error('Uint8Array expected of length ' + lengths + ', got length=' + b.length);
}
function isArrayOf(isString, arr) {
    if (!Array.isArray(arr))
        return false;
    if (arr.length === 0)
        return true;
    if (isString) {
        return arr.every((item) => typeof item === 'string');
    }
    else {
        return arr.every((item) => Number.isSafeInteger(item));
    }
}
// no abytes: seems to have 10% slowdown. Why?!
function afn(input) {
    if (typeof input !== 'function')
        throw new Error('function expected');
    return true;
}
function astr(label, input) {
    if (typeof input !== 'string')
        throw new Error(`${label}: string expected`);
    return true;
}
function anumber(n) {
    if (!Number.isSafeInteger(n))
        throw new Error(`invalid integer: ${n}`);
}
function aArr(input) {
    if (!Array.isArray(input))
        throw new Error('array expected');
}
function astrArr(label, input) {
    if (!isArrayOf(true, input))
        throw new Error(`${label}: array of strings expected`);
}
function anumArr(label, input) {
    if (!isArrayOf(false, input))
        throw new Error(`${label}: array of numbers expected`);
}
/**
 * @__NO_SIDE_EFFECTS__
 */
function chain(...args) {
    const id = (a) => a;
    // Wrap call in closure so JIT can inline calls
    const wrap = (a, b) => (c) => a(b(c));
    // Construct chain of args[-1].encode(args[-2].encode([...]))
    const encode = args.map((x) => x.encode).reduceRight(wrap, id);
    // Construct chain of args[0].decode(args[1].decode(...))
    const decode = args.map((x) => x.decode).reduce(wrap, id);
    return { encode, decode };
}
/**
 * Encodes integer radix representation to array of strings using alphabet and back.
 * Could also be array of strings.
 * @__NO_SIDE_EFFECTS__
 */
function alphabet(letters) {
    // mapping 1 to "b"
    const lettersA = typeof letters === 'string' ? letters.split('') : letters;
    const len = lettersA.length;
    astrArr('alphabet', lettersA);
    // mapping "b" to 1
    const indexes = new Map(lettersA.map((l, i) => [l, i]));
    return {
        encode: (digits) => {
            aArr(digits);
            return digits.map((i) => {
                if (!Number.isSafeInteger(i) || i < 0 || i >= len)
                    throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${letters}`);
                return lettersA[i];
            });
        },
        decode: (input) => {
            aArr(input);
            return input.map((letter) => {
                astr('alphabet.decode', letter);
                const i = indexes.get(letter);
                if (i === undefined)
                    throw new Error(`Unknown letter: "${letter}". Allowed: ${letters}`);
                return i;
            });
        },
    };
}
/**
 * @__NO_SIDE_EFFECTS__
 */
function join(separator = '') {
    astr('join', separator);
    return {
        encode: (from) => {
            astrArr('join.decode', from);
            return from.join(separator);
        },
        decode: (to) => {
            astr('join.decode', to);
            return to.split(separator);
        },
    };
}
/**
 * Pad strings array so it has integer number of bits
 * @__NO_SIDE_EFFECTS__
 */
function padding(bits, chr = '=') {
    anumber(bits);
    astr('padding', chr);
    return {
        encode(data) {
            astrArr('padding.encode', data);
            while ((data.length * bits) % 8)
                data.push(chr);
            return data;
        },
        decode(input) {
            astrArr('padding.decode', input);
            let end = input.length;
            if ((end * bits) % 8)
                throw new Error('padding: invalid, string should have whole number of bytes');
            for (; end > 0 && input[end - 1] === chr; end--) {
                const last = end - 1;
                const byte = last * bits;
                if (byte % 8 === 0)
                    throw new Error('padding: invalid, string has too much padding');
            }
            return input.slice(0, end);
        },
    };
}
/**
 * @__NO_SIDE_EFFECTS__
 */
function normalize(fn) {
    afn(fn);
    return { encode: (from) => from, decode: (to) => fn(to) };
}
/**
 * Slow: O(n^2) time complexity
 */
function convertRadix(data, from, to) {
    // base 1 is impossible
    if (from < 2)
        throw new Error(`convertRadix: invalid from=${from}, base cannot be less than 2`);
    if (to < 2)
        throw new Error(`convertRadix: invalid to=${to}, base cannot be less than 2`);
    aArr(data);
    if (!data.length)
        return [];
    let pos = 0;
    const res = [];
    const digits = Array.from(data, (d) => {
        anumber(d);
        if (d < 0 || d >= from)
            throw new Error(`invalid integer: ${d}`);
        return d;
    });
    const dlen = digits.length;
    while (true) {
        let carry = 0;
        let done = true;
        for (let i = pos; i < dlen; i++) {
            const digit = digits[i];
            const fromCarry = from * carry;
            const digitBase = fromCarry + digit;
            if (!Number.isSafeInteger(digitBase) ||
                fromCarry / from !== carry ||
                digitBase - digit !== fromCarry) {
                throw new Error('convertRadix: carry overflow');
            }
            const div = digitBase / to;
            carry = digitBase % to;
            const rounded = Math.floor(div);
            digits[i] = rounded;
            if (!Number.isSafeInteger(rounded) || rounded * to + carry !== digitBase)
                throw new Error('convertRadix: carry overflow');
            if (!done)
                continue;
            else if (!rounded)
                pos = i;
            else
                done = false;
        }
        res.push(carry);
        if (done)
            break;
    }
    for (let i = 0; i < data.length - 1 && data[i] === 0; i++)
        res.push(0);
    return res.reverse();
}
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from, to) => from + (to - gcd(from, to));
const powers = /* @__PURE__ */ (() => {
    let res = [];
    for (let i = 0; i < 40; i++)
        res.push(2 ** i);
    return res;
})();
/**
 * Implemented with numbers, because BigInt is 5x slower
 */
function convertRadix2(data, from, to, padding) {
    aArr(data);
    if (from <= 0 || from > 32)
        throw new Error(`convertRadix2: wrong from=${from}`);
    if (to <= 0 || to > 32)
        throw new Error(`convertRadix2: wrong to=${to}`);
    if (radix2carry(from, to) > 32) {
        throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`);
    }
    let carry = 0;
    let pos = 0; // bitwise position in current element
    const max = powers[from];
    const mask = powers[to] - 1;
    const res = [];
    for (const n of data) {
        anumber(n);
        if (n >= max)
            throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
        carry = (carry << from) | n;
        if (pos + from > 32)
            throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
        pos += from;
        for (; pos >= to; pos -= to)
            res.push(((carry >> (pos - to)) & mask) >>> 0);
        const pow = powers[pos];
        if (pow === undefined)
            throw new Error('invalid carry');
        carry &= pow - 1; // clean carry, otherwise it will cause overflow
    }
    carry = (carry << (to - pos)) & mask;
    if (!padding && pos >= from)
        throw new Error('Excess padding');
    if (!padding && carry > 0)
        throw new Error(`Non-zero padding: ${carry}`);
    if (padding && pos > 0)
        res.push(carry >>> 0);
    return res;
}
/**
 * @__NO_SIDE_EFFECTS__
 */
function radix(num) {
    anumber(num);
    const _256 = 2 ** 8;
    return {
        encode: (bytes) => {
            if (!isBytes$2(bytes))
                throw new Error('radix.encode input should be Uint8Array');
            return convertRadix(Array.from(bytes), _256, num);
        },
        decode: (digits) => {
            anumArr('radix.decode', digits);
            return Uint8Array.from(convertRadix(digits, num, _256));
        },
    };
}
/**
 * If both bases are power of same number (like `2**8 <-> 2**64`),
 * there is a linear algorithm. For now we have implementation for power-of-two bases only.
 * @__NO_SIDE_EFFECTS__
 */
function radix2(bits, revPadding = false) {
    anumber(bits);
    if (bits <= 0 || bits > 32)
        throw new Error('radix2: bits should be in (0..32]');
    if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32)
        throw new Error('radix2: carry overflow');
    return {
        encode: (bytes) => {
            if (!isBytes$2(bytes))
                throw new Error('radix2.encode input should be Uint8Array');
            return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
        },
        decode: (digits) => {
            anumArr('radix2.decode', digits);
            return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
        },
    };
}
function unsafeWrapper(fn) {
    afn(fn);
    return function (...args) {
        try {
            return fn.apply(null, args);
        }
        catch (e) { }
    };
}
function checksum(len, fn) {
    anumber(len);
    afn(fn);
    return {
        encode(data) {
            if (!isBytes$2(data))
                throw new Error('checksum.encode: input should be Uint8Array');
            const sum = fn(data).slice(0, len);
            const res = new Uint8Array(data.length + len);
            res.set(data);
            res.set(sum, data.length);
            return res;
        },
        decode(data) {
            if (!isBytes$2(data))
                throw new Error('checksum.decode: input should be Uint8Array');
            const payload = data.slice(0, -len);
            const oldChecksum = data.slice(-len);
            const newChecksum = fn(payload).slice(0, len);
            for (let i = 0; i < len; i++)
                if (newChecksum[i] !== oldChecksum[i])
                    throw new Error('Invalid checksum');
            return payload;
        },
    };
}
// Built-in base64 conversion https://caniuse.com/mdn-javascript_builtins_uint8array_frombase64
// prettier-ignore
const hasBase64Builtin = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toBase64 === 'function' &&
    typeof Uint8Array.fromBase64 === 'function')();
const decodeBase64Builtin = (s, isUrl) => {
    astr('base64', s);
    const re = /^[A-Za-z0-9=+/]+$/;
    const alphabet = 'base64';
    if (s.length > 0 && !re.test(s))
        throw new Error('invalid base64');
    return Uint8Array.fromBase64(s, { alphabet, lastChunkHandling: 'strict' });
};
/**
 * base64 from RFC 4648. Padded.
 * Use `base64nopad` for unpadded version.
 * Also check out `base64url`, `base64urlnopad`.
 * Falls back to built-in function, when available.
 * @example
 * ```js
 * base64.encode(Uint8Array.from([0x12, 0xab]));
 * // => 'Eqs='
 * base64.decode('Eqs=');
 * // => Uint8Array.from([0x12, 0xab])
 * ```
 */
// prettier-ignore
const base64 = hasBase64Builtin ? {
    encode(b) { abytes(b); return b.toBase64(); },
    decode(s) { return decodeBase64Builtin(s); },
} : chain(radix2(6), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'), padding(6), join(''));
/**
 * base64 from RFC 4648, using URL-safe alphabet. No padding.
 * Use `base64url` for padded version.
 * @example
 * ```js
 * base64urlnopad.encode(Uint8Array.from([0x12, 0xab]));
 * // => 'Eqs'
 * base64urlnopad.decode('Eqs');
 * // => Uint8Array.from([0x12, 0xab])
 * ```
 */
const base64urlnopad = chain(radix2(6), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'), join(''));
// base58 code
// -----------
const genBase58 = /* @__NO_SIDE_EFFECTS__ */ (abc) => chain(radix(58), alphabet(abc), join(''));
/**
 * base58: base64 without ambigous characters +, /, 0, O, I, l.
 * Quadratic (O(n^2)) - so, can't be used on large inputs.
 * @example
 * ```js
 * base58.decode('01abcdef');
 * // => '3UhJW'
 * ```
 */
const base58 = genBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
/**
 * Method, which creates base58check encoder.
 * Requires function, calculating sha256.
 */
const createBase58check = (sha256) => chain(checksum(4, (data) => sha256(sha256(data))), base58);
/**
 * Use `createBase58check` instead.
 * @deprecated
 */
const base58check$1 = createBase58check;
const BECH_ALPHABET = chain(alphabet('qpzry9x8gf2tvdw0s3jn54khce6mua7l'), join(''));
const POLYMOD_GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
function bech32Polymod(pre) {
    const b = pre >> 25;
    let chk = (pre & 0x1ffffff) << 5;
    for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
        if (((b >> i) & 1) === 1)
            chk ^= POLYMOD_GENERATORS[i];
    }
    return chk;
}
function bechChecksum(prefix, words, encodingConst = 1) {
    const len = prefix.length;
    let chk = 1;
    for (let i = 0; i < len; i++) {
        const c = prefix.charCodeAt(i);
        if (c < 33 || c > 126)
            throw new Error(`Invalid prefix (${prefix})`);
        chk = bech32Polymod(chk) ^ (c >> 5);
    }
    chk = bech32Polymod(chk);
    for (let i = 0; i < len; i++)
        chk = bech32Polymod(chk) ^ (prefix.charCodeAt(i) & 0x1f);
    for (let v of words)
        chk = bech32Polymod(chk) ^ v;
    for (let i = 0; i < 6; i++)
        chk = bech32Polymod(chk);
    chk ^= encodingConst;
    return BECH_ALPHABET.encode(convertRadix2([chk % powers[30]], 30, 5, false));
}
/**
 * @__NO_SIDE_EFFECTS__
 */
function genBech32(encoding) {
    const ENCODING_CONST = encoding === 'bech32' ? 1 : 0x2bc830a3;
    const _words = radix2(5);
    const fromWords = _words.decode;
    const toWords = _words.encode;
    const fromWordsUnsafe = unsafeWrapper(fromWords);
    function encode(prefix, words, limit = 90) {
        astr('bech32.encode prefix', prefix);
        if (isBytes$2(words))
            words = Array.from(words);
        anumArr('bech32.encode', words);
        const plen = prefix.length;
        if (plen === 0)
            throw new TypeError(`Invalid prefix length ${plen}`);
        const actualLength = plen + 7 + words.length;
        if (limit !== false && actualLength > limit)
            throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
        const lowered = prefix.toLowerCase();
        const sum = bechChecksum(lowered, words, ENCODING_CONST);
        return `${lowered}1${BECH_ALPHABET.encode(words)}${sum}`;
    }
    function decode(str, limit = 90) {
        astr('bech32.decode input', str);
        const slen = str.length;
        if (slen < 8 || (limit !== false && slen > limit))
            throw new TypeError(`invalid string length: ${slen} (${str}). Expected (8..${limit})`);
        // don't allow mixed case
        const lowered = str.toLowerCase();
        if (str !== lowered && str !== str.toUpperCase())
            throw new Error(`String must be lowercase or uppercase`);
        const sepIndex = lowered.lastIndexOf('1');
        if (sepIndex === 0 || sepIndex === -1)
            throw new Error(`Letter "1" must be present between prefix and data only`);
        const prefix = lowered.slice(0, sepIndex);
        const data = lowered.slice(sepIndex + 1);
        if (data.length < 6)
            throw new Error('Data must be at least 6 characters long');
        const words = BECH_ALPHABET.decode(data).slice(0, -6);
        const sum = bechChecksum(prefix, words, ENCODING_CONST);
        if (!data.endsWith(sum))
            throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
        return { prefix, words };
    }
    const decodeUnsafe = unsafeWrapper(decode);
    function decodeToBytes(str) {
        const { prefix, words } = decode(str, false);
        return { prefix, words, bytes: fromWords(words) };
    }
    function encodeFromBytes(prefix, bytes) {
        return encode(prefix, toWords(bytes));
    }
    return {
        encode,
        decode,
        encodeFromBytes,
        decodeToBytes,
        decodeUnsafe,
        fromWords,
        fromWordsUnsafe,
        toWords,
    };
}
/**
 * bech32 from BIP 173. Operates on words.
 * For high-level, check out scure-btc-signer:
 * https://github.com/paulmillr/scure-btc-signer.
 */
const bech32 = genBech32('bech32');
/**
 * bech32m from BIP 350. Operates on words.
 * It was to mitigate `bech32` weaknesses.
 * For high-level, check out scure-btc-signer:
 * https://github.com/paulmillr/scure-btc-signer.
 */
const bech32m = genBech32('bech32m');
/**
 * UTF-8-to-byte decoder. Uses built-in TextDecoder / TextEncoder.
 * @example
 * ```js
 * const b = utf8.decode("hey"); // => new Uint8Array([ 104, 101, 121 ])
 * const str = utf8.encode(b); // "hey"
 * ```
 */
const utf8 = {
    encode: (data) => new TextDecoder().decode(data),
    decode: (str) => new TextEncoder().encode(str),
};
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
// prettier-ignore
const hasHexBuiltin = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toHex === 'function' &&
    typeof Uint8Array.fromHex === 'function')();
// prettier-ignore
const hexBuiltin = {
    encode(data) { abytes(data); return data.toHex(); },
    decode(s) { astr('hex', s); return Uint8Array.fromHex(s); },
};
/**
 * hex string decoder. Uses built-in function, when available.
 * @example
 * ```js
 * const b = hex.decode("0102ff"); // => new Uint8Array([ 1, 2, 255 ])
 * const str = hex.encode(b); // "0102ff"
 * ```
 */
const hex = hasHexBuiltin
    ? hexBuiltin
    : chain(radix2(4), alphabet('0123456789abcdef'), join(''), normalize((s) => {
        if (typeof s !== 'string' || s.length % 2 !== 0)
            throw new TypeError(`hex.decode: expected string, got ${typeof s} with length ${s.length}`);
        return s.toLowerCase();
    }));

const B58chk = {
    encode: (data) => base58check$1(sha256$1).encode(data),
    decode: (data) => base58check$1(sha256$1).decode(data)
};
const Base64 = {
    encode: (data) => base64.encode(data),
    decode: (data) => base64.decode(data)
};
const B64url = {
    encode: (data) => base64urlnopad.encode(data),
    decode: (data) => base64urlnopad.decode(data)
};
const Bech32$1 = {
    to_words: bech32.toWords,
    to_bytes: bech32.fromWords,
    encode: (prefix, words, limit = false) => {
        return bech32.encode(prefix, words, limit);
    },
    decode: (data, limit = false) => {
        const { prefix, words } = bech32.decode(data, limit);
        return { prefix, words };
    }
};
const Bech32m$1 = {
    to_words: bech32m.toWords,
    to_bytes: bech32m.fromWords,
    encode: (prefix, words, limit = false) => {
        return bech32m.encode(prefix, words, limit);
    },
    decode: (data, limit = false) => {
        const { prefix, words } = bech32m.decode(data, limit);
        return { prefix, words };
    }
};

const _0n$6 = BigInt(0);
const _255n = BigInt(255);
const _256n = BigInt(256);
function big_size(big) {
    if (big <= 0xffn)
        return 1;
    if (big <= 0xffffn)
        return 2;
    if (big <= 0xffffffffn)
        return 4;
    if (big <= 0xffffffffffffffffn)
        return 8;
    if (big <= 0xffffffffffffffffffffffffffffffffn)
        return 16;
    if (big <= 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn) {
        return 32;
    }
    throw new TypeError('Must specify a fixed buffer size for bigints greater than 32 bytes.');
}
function bigToBytes(big, size, endian = 'be') {
    if (size === undefined)
        size = big_size(big);
    const use_le = (endian === 'le');
    const buffer = new ArrayBuffer(size);
    const dataView = new DataView(buffer);
    let offset = (use_le) ? 0 : size - 1;
    while (big > _0n$6) {
        const byte = big & _255n;
        const num = Number(byte);
        if (use_le) {
            dataView.setUint8(offset++, num);
        }
        else {
            dataView.setUint8(offset--, num);
        }
        big = (big - byte) / _256n;
    }
    return new Uint8Array(buffer);
}
function bytesToBig(bytes) {
    let num = BigInt(0);
    for (let i = bytes.length - 1; i >= 0; i--) {
        num = (num * _256n) + BigInt(bytes[i]);
    }
    return BigInt(num);
}

function binToBytes(binary) {
    const bins = binary.split('').map(Number);
    if (bins.length % 8 !== 0) {
        throw new Error(`Binary array is invalid length: ${binary.length}`);
    }
    const bytes = new Uint8Array(bins.length / 8);
    for (let i = 0, ct = 0; i < bins.length; i += 8, ct++) {
        let byte = 0;
        for (let j = 0; j < 8; j++) {
            byte |= (bins[i + j] << (7 - j));
        }
        bytes[ct] = byte;
    }
    return bytes;
}
function bytesToBin(bytes) {
    const bin = new Array(bytes.length * 8);
    let count = 0;
    for (const num of bytes) {
        if (num > 255) {
            throw new Error(`Invalid byte value: ${num}. Byte values must be between 0 and 255.`);
        }
        for (let i = 7; i >= 0; i--, count++) {
            bin[count] = (num >> i) & 1;
        }
    }
    return bin.join('');
}

function num_size(num) {
    if (num <= 0xFF)
        return 1;
    if (num <= 0xFFFF)
        return 2;
    if (num <= 0xFFFFFFFF)
        return 4;
    throw new TypeError('Numbers larger than 4 bytes must specify a fixed size!');
}
function numToBytes(num, size, endian = 'be') {
    if (size === undefined)
        size = num_size(num);
    const use_le = (endian === 'le');
    const buffer = new ArrayBuffer(size);
    const dataView = new DataView(buffer);
    let offset = (use_le) ? 0 : size - 1;
    while (num > 0) {
        const byte = num & 255;
        if (use_le) {
            dataView.setUint8(offset++, num);
        }
        else {
            dataView.setUint8(offset--, num);
        }
        num = (num - byte) / 256;
    }
    return new Uint8Array(buffer);
}
function bytesToNum(bytes) {
    let num = 0;
    for (let i = bytes.length - 1; i >= 0; i--) {
        num = (num * 256) + bytes[i];
        is_safe_num(num);
    }
    return num;
}

function is_hex$1(input) {
    if (input.match(/[^a-fA-F0-9]/) === null &&
        input.length % 2 === 0) {
        return true;
    }
    return false;
}
function is_bytes$1(input) {
    if (typeof input === 'string' && is_hex$1(input)) {
        return true;
    }
    else if (typeof input === 'number' ||
        typeof input === 'bigint' ||
        input instanceof Uint8Array) {
        return true;
    }
    else if (Array.isArray(input) &&
        input.every(e => typeof e === 'number')) {
        return true;
    }
    else {
        return false;
    }
}
function set_buffer(data, size, endian = 'be') {
    if (size === undefined)
        size = data.length;
    within_size(data, size);
    const buffer = new Uint8Array(size).fill(0);
    const offset = (endian === 'be') ? 0 : size - data.length;
    buffer.set(data, offset);
    return buffer;
}
function join_array(arr) {
    let i, offset = 0;
    const size = arr.reduce((len, arr) => len + arr.length, 0);
    const buff = new Uint8Array(size);
    for (i = 0; i < arr.length; i++) {
        const a = arr[i];
        buff.set(a, offset);
        offset += a.length;
    }
    return buff;
}
function bigint_replacer(_, v) {
    return typeof v === 'bigint'
        ? `${v}n`
        : v;
}
function bigint_reviver(_, v) {
    return typeof v === 'string' && /^[0-9]+n$/.test(v)
        ? BigInt(v.slice(0, -1))
        : v;
}
function parse_data$1(data_blob, chunk_size, total_size) {
    const len = data_blob.length, count = total_size / chunk_size;
    if (total_size % chunk_size !== 0) {
        throw new TypeError(`Invalid parameters: ${total_size} % ${chunk_size} !== 0`);
    }
    if (len !== total_size) {
        throw new TypeError(`Invalid data stream: ${len} !== ${total_size}`);
    }
    if (len % chunk_size !== 0) {
        throw new TypeError(`Invalid data stream: ${len} % ${chunk_size} !== 0`);
    }
    const chunks = new Array(count);
    for (let i = 0; i < count; i++) {
        const idx = i * chunk_size;
        chunks[i] = data_blob.subarray(idx, idx + chunk_size);
    }
    return chunks;
}

function buffer_data(data, size, endian) {
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    else if (data instanceof Uint8Array) {
        return set_buffer(data, size, endian);
    }
    else if (Array.isArray(data)) {
        const bytes = data.map(e => buffer_data(e, size, endian));
        return join_array(bytes);
    }
    else if (typeof data === 'string') {
        return hexToBytes(data, size, endian);
    }
    else if (typeof data === 'bigint') {
        return bigToBytes(data, size, endian);
    }
    else if (typeof data === 'number') {
        return numToBytes(data, size, endian);
    }
    else if (typeof data === 'boolean') {
        return Uint8Array.of(data ? 1 : 0);
    }
    throw new TypeError('Unsupported format:' + String(typeof data));
}

class Buff extends Uint8Array {
    static { this.num = numToBuff; }
    static { this.big = bigToBuff; }
    static { this.bin = binToBuff; }
    static { this.raw = rawToBuff; }
    static { this.str = strToBuff; }
    static { this.hex = hexToBuff; }
    static { this.bytes = buffer; }
    static { this.json = jsonToBuff; }
    static { this.base64 = base64ToBuff; }
    static { this.b64url = b64urlToBuff; }
    static { this.bech32 = bech32ToBuff; }
    static { this.bech32m = bech32mToBuff; }
    static { this.b58chk = b58chkToBuff; }
    static { this.encode = strToBytes; }
    static { this.decode = bytesToStr; }
    static { this.parse = parse_data; }
    static { this.is_bytes = is_bytes$1; }
    static { this.is_hex = is_hex$1; }
    static { this.is_equal = is_equal; }
    static random(size = 32) {
        const rand = randomBytes(size);
        return new Buff(rand, size);
    }
    static now(size = 4) {
        const stamp = Math.floor(Date.now() / 1000);
        return new Buff(stamp, size);
    }
    constructor(data, size, endian) {
        if (data instanceof Buff &&
            size === undefined) {
            return data;
        }
        const buffer = buffer_data(data, size, endian);
        super(buffer);
    }
    get arr() {
        return [...this];
    }
    get num() {
        return this.to_num();
    }
    get big() {
        return this.to_big();
    }
    get str() {
        return this.to_str();
    }
    get hex() {
        return this.to_hex();
    }
    get raw() {
        return new Uint8Array(this);
    }
    get bin() {
        return this.to_bin();
    }
    get b58chk() {
        return this.to_b58chk();
    }
    get base64() {
        return this.to_base64();
    }
    get b64url() {
        return this.to_b64url();
    }
    get digest() {
        return this.to_hash();
    }
    get id() {
        return this.to_hash().hex;
    }
    get stream() {
        return new Stream(this);
    }
    to_num(endian = 'be') {
        const bytes = (endian === 'be')
            ? this.reverse()
            : this;
        return bytesToNum(bytes);
    }
    to_big(endian = 'be') {
        const bytes = (endian === 'be')
            ? this.reverse()
            : this;
        return bytesToBig(bytes);
    }
    to_bin() {
        return bytesToBin(this);
    }
    to_hash() {
        const digest = sha256$1(this);
        return new Buff(digest);
    }
    to_json(reviver) {
        if (reviver === undefined) {
            reviver = bigint_reviver;
        }
        const str = bytesToStr(this);
        return JSON.parse(str, reviver);
    }
    to_bech32(prefix, limit) {
        const { encode, to_words } = Bech32$1;
        const words = to_words(this);
        return encode(prefix, words, limit);
    }
    to_bech32m(prefix, limit) {
        const { encode, to_words } = Bech32m$1;
        const words = to_words(this);
        return encode(prefix, words, limit);
    }
    to_str() { return bytesToStr(this); }
    to_hex() { return bytesToHex(this); }
    to_bytes() { return new Uint8Array(this); }
    to_b58chk() { return B58chk.encode(this); }
    to_base64() { return Base64.encode(this); }
    to_b64url() { return B64url.encode(this); }
    append(data) {
        return Buff.join([this, Buff.bytes(data)]);
    }
    equals(data) {
        return buffer(data).hex === this.hex;
    }
    prepend(data) {
        return Buff.join([Buff.bytes(data), this]);
    }
    reverse() {
        const arr = new Uint8Array(this).reverse();
        return new Buff(arr);
    }
    slice(start, end) {
        const arr = new Uint8Array(this).slice(start, end);
        return new Buff(arr);
    }
    set(array, offset) {
        this.set(array, offset);
    }
    subarray(begin, end) {
        const arr = new Uint8Array(this).subarray(begin, end);
        return new Buff(arr);
    }
    write(bytes, offset) {
        const b = Buff.bytes(bytes);
        this.set(b, offset);
    }
    add_varint(endian) {
        const size = Buff.calc_varint(this.length, endian);
        return Buff.join([size, this]);
    }
    toJSON() {
        return this.hex;
    }
    toString() {
        return this.hex;
    }
    static from(data) {
        return new Buff(Uint8Array.from(data));
    }
    static of(...args) {
        return new Buff(Uint8Array.of(...args));
    }
    static join(arr) {
        const bytes = arr.map(e => Buff.bytes(e));
        const joined = join_array(bytes);
        return new Buff(joined);
    }
    static sort(arr, size) {
        const hex = arr.map(e => buffer(e, size).hex);
        hex.sort();
        return hex.map(e => Buff.hex(e, size));
    }
    static calc_varint(num, endian) {
        if (num < 0xFD) {
            return Buff.num(num, 1);
        }
        else if (num < 0x10000) {
            return Buff.of(0xFD, ...Buff.num(num, 2, endian));
        }
        else if (num < 0x100000000) {
            return Buff.of(0xFE, ...Buff.num(num, 4, endian));
        }
        else if (BigInt(num) < 0x10000000000000000n) {
            return Buff.of(0xFF, ...Buff.num(num, 8, endian));
        }
        else {
            throw new Error(`Value is too large: ${num}`);
        }
    }
}
function numToBuff(number, size, endian) {
    return new Buff(number, size, endian);
}
function binToBuff(data, size, endian) {
    return new Buff(binToBytes(data), size, endian);
}
function bigToBuff(bigint, size, endian) {
    return new Buff(bigint, size, endian);
}
function rawToBuff(data, size, endian) {
    return new Buff(data, size, endian);
}
function strToBuff(data, size, endian) {
    return new Buff(strToBytes(data), size, endian);
}
function hexToBuff(data, size, endian) {
    return new Buff(data, size, endian);
}
function jsonToBuff(data, replacer) {
    if (replacer === undefined) {
        replacer = bigint_replacer;
    }
    const str = JSON.stringify(data, replacer);
    return new Buff(strToBytes(str));
}
function base64ToBuff(data) {
    return new Buff(Base64.decode(data));
}
function b64urlToBuff(data) {
    return new Buff(B64url.decode(data));
}
function bech32ToBuff(data, limit, chk_prefix) {
    const { decode, to_bytes } = Bech32$1;
    const { prefix, words } = decode(data, limit);
    const bytes = to_bytes(words);
    if (typeof chk_prefix === 'string') {
        is_prefix(prefix, chk_prefix);
    }
    return new Buff(bytes);
}
function bech32mToBuff(data, limit, chk_prefix) {
    const { decode, to_bytes } = Bech32m$1;
    const { prefix, words } = decode(data, limit);
    const bytes = to_bytes(words);
    if (typeof chk_prefix === 'string') {
        is_prefix(prefix, chk_prefix);
    }
    return new Buff(bytes);
}
function b58chkToBuff(data) {
    return new Buff(B58chk.decode(data));
}
function parse_data(data_blob, chunk_size, total_size) {
    const bytes = buffer_data(data_blob);
    const chunks = parse_data$1(bytes, chunk_size, total_size);
    return chunks.map(e => Buff.bytes(e));
}
function is_equal(a, b) {
    return new Buff(a).hex === new Buff(b).hex;
}
function buffer(bytes, size, end) {
    return new Buff(bytes, size, end);
}
class Stream {
    constructor(data) {
        this.data = Buff.bytes(data);
        this.size = this.data.length;
    }
    peek(size) {
        if (size > this.size) {
            throw new Error(`Size greater than stream: ${size} > ${this.size}`);
        }
        return new Buff(this.data.slice(0, size));
    }
    read(size) {
        const chunk = this.peek(size);
        this.data = this.data.slice(size);
        this.size = this.data.length;
        return chunk;
    }
    read_varint(endian) {
        const num = this.read(1).num;
        switch (true) {
            case (num >= 0 && num < 0xFD):
                return num;
            case (num === 0xFD):
                return this.read(2).to_num(endian);
            case (num === 0xFE):
                return this.read(4).to_num(endian);
            case (num === 0xFF):
                return this.read(8).to_num(endian);
            default:
                throw new Error(`Varint is out of range: ${num}`);
        }
    }
}

const OPCODE_MAP = {
    OP_0: 0,
    OP_PUSHDATA1: 76,
    OP_PUSHDATA2: 77,
    OP_PUSHDATA4: 78,
    OP_1NEGATE: 79,
    OP_SUCCESS80: 80,
    OP_1: 81,
    OP_2: 82,
    OP_3: 83,
    OP_4: 84,
    OP_5: 85,
    OP_6: 86,
    OP_7: 87,
    OP_8: 88,
    OP_9: 89,
    OP_10: 90,
    OP_11: 91,
    OP_12: 92,
    OP_13: 93,
    OP_14: 94,
    OP_15: 95,
    OP_16: 96,
    OP_NOP: 97,
    OP_SUCCESS98: 98,
    OP_IF: 99,
    OP_NOTIF: 100,
    OP_ELSE: 103,
    OP_ENDIF: 104,
    OP_VERIFY: 105,
    OP_RETURN: 106,
    OP_TOALTSTACK: 107,
    OP_FROMALTSTACK: 108,
    OP_2DROP: 109,
    OP_2DUP: 110,
    OP_3DUP: 111,
    OP_2OVER: 112,
    OP_2ROT: 113,
    OP_2SWAP: 114,
    OP_IFDUP: 115,
    OP_DEPTH: 116,
    OP_DROP: 117,
    OP_DUP: 118,
    OP_NIP: 119,
    OP_OVER: 120,
    OP_PICK: 121,
    OP_ROLL: 122,
    OP_ROT: 123,
    OP_SWAP: 124,
    OP_TUCK: 125,
    OP_SUCCESS126: 126,
    OP_SUCCESS127: 127,
    OP_SUCCESS128: 128,
    OP_SUCCESS129: 129,
    OP_SIZE: 130,
    OP_SUCCESS131: 131,
    OP_SUCCESS132: 132,
    OP_SUCCESS133: 133,
    OP_SUCCESS134: 134,
    OP_EQUAL: 135,
    OP_EQUALVERIFY: 136,
    OP_SUCCESS137: 137,
    OP_SUCCESS138: 138,
    OP_1ADD: 139,
    OP_1SUB: 140,
    OP_SUCCESS141: 141,
    OP_SUCCESS142: 142,
    OP_NEGATE: 143,
    OP_ABS: 144,
    OP_NOT: 145,
    OP_0NOTEQUAL: 146,
    OP_ADD: 147,
    OP_SUB: 148,
    OP_SUCCESS149: 149,
    OP_SUCCESS150: 150,
    OP_SUCCESS151: 151,
    OP_SUCCESS152: 152,
    OP_SUCCESS153: 153,
    OP_BOOLAND: 154,
    OP_BOOLOR: 155,
    OP_NUMEQUAL: 156,
    OP_NUMEQUALVERIFY: 157,
    OP_NUMNOTEQUAL: 158,
    OP_LESSTHAN: 159,
    OP_GREATERTHAN: 160,
    OP_LESSTHANOREQUAL: 161,
    OP_GREATERTHANOREQUAL: 162,
    OP_MIN: 163,
    OP_MAX: 164,
    OP_WITHIN: 165,
    OP_RIPEMD160: 166,
    OP_SHA1: 167,
    OP_SHA256: 168,
    OP_HASH160: 169,
    OP_HASH256: 170,
    OP_CODESEPARATOR: 171,
    OP_CHECKSIG: 172,
    OP_CHECKSIGVERIFY: 173,
    OP_CHECKMULTISIG: 174,
    OP_CHECKMULTISIGVERIFY: 175,
    OP_NOP1: 176,
    OP_CHECKLOCKTIMEVERIFY: 177,
    OP_CHECKSEQUENCEVERIFY: 178,
    OP_NOP4: 179,
    OP_NOP5: 180,
    OP_NOP6: 181,
    OP_NOP7: 182,
    OP_NOP8: 183,
    OP_NOP9: 184,
    OP_NOP10: 185,
    OP_CHECKSIGADD: 186,
    OP_SUCCESS187: 187,
    OP_SUCCESS188: 188,
    OP_SUCCESS189: 189,
    OP_SUCCESS190: 190,
    OP_SUCCESS191: 191,
    OP_SUCCESS192: 192,
    OP_SUCCESS193: 193,
    OP_SUCCESS194: 194,
    OP_SUCCESS195: 195,
    OP_SUCCESS196: 196,
    OP_SUCCESS197: 197,
    OP_SUCCESS198: 198,
    OP_SUCCESS199: 199,
    OP_SUCCESS200: 200,
    OP_SUCCESS201: 201,
    OP_SUCCESS202: 202,
    OP_SUCCESS203: 203,
    OP_SUCCESS204: 204,
    OP_SUCCESS205: 205,
    OP_SUCCESS206: 206,
    OP_SUCCESS207: 207,
    OP_SUCCESS208: 208,
    OP_SUCCESS209: 209,
    OP_SUCCESS210: 210,
    OP_SUCCESS211: 211,
    OP_SUCCESS212: 212,
    OP_SUCCESS213: 213,
    OP_SUCCESS214: 214,
    OP_SUCCESS215: 215,
    OP_SUCCESS216: 216,
    OP_SUCCESS217: 217,
    OP_SUCCESS218: 218,
    OP_SUCCESS219: 219,
    OP_SUCCESS220: 220,
    OP_SUCCESS221: 221,
    OP_SUCCESS222: 222,
    OP_SUCCESS223: 223,
    OP_SUCCESS224: 224,
    OP_SUCCESS225: 225,
    OP_SUCCESS226: 226,
    OP_SUCCESS227: 227,
    OP_SUCCESS228: 228,
    OP_SUCCESS229: 229,
    OP_SUCCESS230: 230,
    OP_SUCCESS231: 231,
    OP_SUCCESS232: 232,
    OP_SUCCESS233: 233,
    OP_SUCCESS234: 234,
    OP_SUCCESS235: 235,
    OP_SUCCESS236: 236,
    OP_SUCCESS237: 237,
    OP_SUCCESS238: 238,
    OP_SUCCESS239: 239,
    OP_SUCCESS240: 240,
    OP_SUCCESS241: 241,
    OP_SUCCESS242: 242,
    OP_SUCCESS243: 243,
    OP_SUCCESS244: 244,
    OP_SUCCESS245: 245,
    OP_SUCCESS246: 246,
    OP_SUCCESS247: 247,
    OP_SUCCESS248: 248,
    OP_SUCCESS249: 249,
    OP_SUCCESS250: 250,
    OP_SUCCESS251: 251,
    OP_SUCCESS252: 252,
    OP_SUCCESS253: 253,
    OP_SUCCESS254: 254
};
const SCRIPT_TYPES = [
    ['p2pkh', /^76a914(?<hash>\w{40})88ac$/],
    ['p2sh', /^a914(?<hash>\w{40})87$/],
    ['p2w-pkh', /^0014(?<hash>\w{40})$/],
    ['p2w-sh', /^0020(?<hash>\w{64})$/],
    ['p2tr', /^5120(?<hash>\w{64})$/]
];

function get_op_code(num) {
    if (num > 186 && num < 255) {
        return 'OP_SUCCESS' + String(num);
    }
    for (const [k, v] of Object.entries(OPCODE_MAP)) {
        if (v === num)
            return k;
    }
    throw new Error('OPCODE not found:' + String(num));
}
function get_asm_code(string) {
    for (const [k, v] of Object.entries(OPCODE_MAP)) {
        if (k === string)
            return Number(v);
    }
    throw new Error('OPCODE not found:' + string);
}
function get_op_type(word) {
    switch (true) {
        case (word === 0):
            return 'opcode';
        case (word >= 1 && word <= 75):
            return 'varint';
        case (word === 76):
            return 'pushdata1';
        case (word === 77):
            return 'pushdata2';
        case (word === 78):
            return 'pushdata4';
        case (word <= 254):
            return 'opcode';
        default:
            throw new Error(`Invalid word range: ${word}`);
    }
}
function is_valid_op(word) {
    const MIN_RANGE = 75;
    const MAX_RANGE = 254;
    const DISABLED_OPCODES = [];
    switch (true) {
        case (typeof (word) !== 'number'):
            return false;
        case (word === 0):
            return true;
        case (DISABLED_OPCODES.includes(word)):
            return false;
        case (MIN_RANGE < word && word < MAX_RANGE):
            return true;
        default:
            return false;
    }
}

function decode_script(script, varint = false) {
    let bytes = Buff.bytes(script);
    if (varint) {
        const stream = bytes.stream;
        const len = stream.read_varint('le');
        if (stream.size !== len) {
            throw new Error(`Varint does not match stream size: ${String(len)} !== ${bytes.length}`);
        }
        bytes = bytes.slice(1);
    }
    return decode_word_bytes(bytes);
}
function decode_word_bytes(words) {
    const stream = new Stream(words);
    const stack = [];
    const stack_size = stream.size;
    let word;
    let word_type;
    let word_size;
    let count = 0;
    while (count < stack_size) {
        word = stream.read(1).num;
        word_type = get_op_type(word);
        count++;
        switch (word_type) {
            case 'varint':
                stack.push(stream.read(word).hex);
                count += word;
                break;
            case 'pushdata1':
                word_size = stream.read(1).reverse().num;
                stack.push(stream.read(word_size).hex);
                count += word_size + 1;
                break;
            case 'pushdata2':
                word_size = stream.read(2).reverse().num;
                stack.push(stream.read(word_size).hex);
                count += word_size + 2;
                break;
            case 'pushdata4':
                word_size = stream.read(4).reverse().num;
                stack.push(stream.read(word_size).hex);
                count += word_size + 4;
                break;
            case 'opcode':
                if (!is_valid_op(word)) {
                    throw new Error(`Invalid OPCODE: ${word}`);
                }
                stack.push(get_op_code(word));
                break;
            default:
                throw new Error(`Word type undefined: ${word}`);
        }
    }
    return stack;
}

function is_hex(input) {
    const regex = /[^a-fA-F0-9]/;
    if (typeof input === 'string' &&
        input.length % 2 === 0 &&
        input.match(regex) === null) {
        return true;
    }
    return false;
}
function is_bytes(input) {
    if (typeof input === 'string' &&
        is_hex(input)) {
        return true;
    }
    else if (typeof input === 'number' ||
        typeof input === 'bigint' ||
        input instanceof Uint8Array) {
        return true;
    }
    else if (Array.isArray(input) &&
        input.every(e => typeof e === 'number')) {
        return true;
    }
    else {
        return false;
    }
}
function is_empty(data) {
    if (typeof data === 'undefined' || data === null) {
        return true;
    }
    else if (Array.isArray(data) ||
        typeof data === 'string' ||
        data instanceof Uint8Array) {
        return data.length === 0;
    }
    else if (typeof data === 'object') {
        return Object.keys(data).length === 0;
    }
    return false;
}

const MAX_WORD_SIZE = 520;
function encode_script(script = [], varint = true) {
    let buff = Buff.num(0);
    if (Array.isArray(script)) {
        buff = Buff.raw(encode_words(script));
    }
    if (is_hex(script)) {
        buff = Buff.hex(script);
    }
    if (script instanceof Uint8Array) {
        buff = Buff.raw(script);
    }
    if (varint) {
        buff = buff.add_varint('le');
    }
    return buff;
}
function encode_words(words) {
    const bytes = [];
    for (const word of words) {
        bytes.push(format_word(word));
    }
    return (bytes.length > 0)
        ? Buff.join(bytes)
        : new Uint8Array();
}
function format_word(word) {
    let buff = new Uint8Array();
    if (typeof (word) === 'string') {
        if (word.startsWith('OP_')) {
            return Buff.num(get_asm_code(word), 1);
        }
        else if (is_hex(word)) {
            buff = Buff.hex(word);
        }
        else {
            buff = Buff.str(word);
        }
    }
    else {
        buff = Buff.bytes(word);
    }
    if (buff.length === 1) {
        if (buff[0] !== 0 && buff[0] <= 16) {
            buff[0] += 0x50;
        }
        else if (buff[0] > 128 && buff[0] <= 256) {
            buff = new Uint8Array([buff[0], 0]);
        }
    }
    else if (buff.length > MAX_WORD_SIZE) {
        let words;
        words = split_word(buff);
        words = words.map(e => prefix_word(e));
        buff = Buff.join(words);
    }
    else {
        buff = prefix_word(buff);
    }
    return buff;
}
function split_word(word) {
    const words = [];
    const buff = new Stream(word);
    while (buff.size > MAX_WORD_SIZE) {
        words.push(buff.read(MAX_WORD_SIZE));
    }
    words.push(buff.read(buff.size));
    return words;
}
function prefix_word(word) {
    const varint = encode_size(word.length);
    return Buff.join([varint, word]);
}
function encode_size(size) {
    const OP_PUSHDATA1 = Buff.num(0x4c, 1);
    const OP_PUSHDATA2 = Buff.num(0x4d, 1);
    switch (true) {
        case (size <= 0x4b):
            return Buff.num(size);
        case (size > 0x4b && size < 0x100):
            return Buff.join([OP_PUSHDATA1, Buff.num(size, 1, 'le')]);
        case (size >= 0x100 && size <= MAX_WORD_SIZE):
            return Buff.join([OP_PUSHDATA2, Buff.num(size, 2, 'le')]);
        default:
            throw new Error('Invalid word size:' + size.toString());
    }
}

function parse_script(script) {
    const hex = buffer_asm(script, false).hex;
    for (const [type, pattern] of SCRIPT_TYPES) {
        const { groups } = pattern.exec(hex) ?? {};
        const { hash } = groups ?? {};
        if (is_hex(hash)) {
            return {
                type,
                hex,
                key: Buff.hex(hash),
                asm: parse_asm(script, false)
            };
        }
    }
    return { type: 'raw', hex, asm: parse_asm(script, false) };
}
function parse_asm(script, varint) {
    if (Array.isArray(script)) {
        script = encode_script(script, varint);
    }
    if (is_bytes(script)) {
        return decode_script(script, varint);
    }
    throw new Error('Invalid script format: ' + String(script));
}
function buffer_asm(script, varint) {
    if (is_bytes(script)) {
        script = decode_script(script, varint);
    }
    if (Array.isArray(script)) {
        return encode_script(script, varint);
    }
    throw new Error('Invalid script format: ' + String(script));
}

/**
 * HMAC: RFC2104 message authentication code.
 * @module
 */
class HMAC extends Hash {
    constructor(hash, _key) {
        super();
        this.finished = false;
        this.destroyed = false;
        ahash(hash);
        const key = toBytes(_key);
        this.iHash = hash.create();
        if (typeof this.iHash.update !== 'function')
            throw new Error('Expected instance of class which extends utils.Hash');
        this.blockLen = this.iHash.blockLen;
        this.outputLen = this.iHash.outputLen;
        const blockLen = this.blockLen;
        const pad = new Uint8Array(blockLen);
        // blockLen can be bigger than outputLen
        pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
        for (let i = 0; i < pad.length; i++)
            pad[i] ^= 0x36;
        this.iHash.update(pad);
        // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
        this.oHash = hash.create();
        // Undo internal XOR && apply outer XOR
        for (let i = 0; i < pad.length; i++)
            pad[i] ^= 0x36 ^ 0x5c;
        this.oHash.update(pad);
        clean(pad);
    }
    update(buf) {
        aexists(this);
        this.iHash.update(buf);
        return this;
    }
    digestInto(out) {
        aexists(this);
        abytes$1(out, this.outputLen);
        this.finished = true;
        this.iHash.digestInto(out);
        this.oHash.update(out);
        this.oHash.digestInto(out);
        this.destroy();
    }
    digest() {
        const out = new Uint8Array(this.oHash.outputLen);
        this.digestInto(out);
        return out;
    }
    _cloneInto(to) {
        // Create new instance without calling constructor since key already in state and we don't know it.
        to || (to = Object.create(Object.getPrototypeOf(this), {}));
        const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
        to = to;
        to.finished = finished;
        to.destroyed = destroyed;
        to.blockLen = blockLen;
        to.outputLen = outputLen;
        to.oHash = oHash._cloneInto(to.oHash);
        to.iHash = iHash._cloneInto(to.iHash);
        return to;
    }
    clone() {
        return this._cloneInto();
    }
    destroy() {
        this.destroyed = true;
        this.oHash.destroy();
        this.iHash.destroy();
    }
}
/**
 * HMAC: RFC2104 message authentication code.
 * @param hash - function that would be used e.g. sha256
 * @param key - message key
 * @param message - message data
 * @example
 * import { hmac } from '@noble/hashes/hmac';
 * import { sha256 } from '@noble/hashes/sha2';
 * const mac1 = hmac(sha256, 'key', 'message');
 */
const hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);

/**

SHA1 (RFC 3174), MD5 (RFC 1321) and RIPEMD160 (RFC 2286) legacy, weak hash functions.
Don't use them in a new protocol. What "weak" means:

- Collisions can be made with 2^18 effort in MD5, 2^60 in SHA1, 2^80 in RIPEMD160.
- No practical pre-image attacks (only theoretical, 2^123.4)
- HMAC seems kinda ok: https://datatracker.ietf.org/doc/html/rfc6151
 * @module
 */
// RIPEMD-160
const Rho160 = /* @__PURE__ */ Uint8Array.from([
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
]);
const Id160 = /* @__PURE__ */ (() => Uint8Array.from(new Array(16).fill(0).map((_, i) => i)))();
const Pi160 = /* @__PURE__ */ (() => Id160.map((i) => (9 * i + 5) % 16))();
const idxLR = /* @__PURE__ */ (() => {
    const L = [Id160];
    const R = [Pi160];
    const res = [L, R];
    for (let i = 0; i < 4; i++)
        for (let j of res)
            j.push(j[i].map((k) => Rho160[k]));
    return res;
})();
const idxL = /* @__PURE__ */ (() => idxLR[0])();
const idxR = /* @__PURE__ */ (() => idxLR[1])();
// const [idxL, idxR] = idxLR;
const shifts160 = /* @__PURE__ */ [
    [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
    [12, 13, 11, 15, 6, 9, 9, 7, 12, 15, 11, 13, 7, 8, 7, 7],
    [13, 15, 14, 11, 7, 7, 6, 8, 13, 14, 13, 12, 5, 5, 6, 9],
    [14, 11, 12, 14, 8, 6, 5, 5, 15, 12, 15, 14, 9, 9, 8, 6],
    [15, 12, 13, 13, 9, 5, 8, 6, 14, 11, 12, 11, 8, 6, 5, 5],
].map((i) => Uint8Array.from(i));
const shiftsL160 = /* @__PURE__ */ idxL.map((idx, i) => idx.map((j) => shifts160[i][j]));
const shiftsR160 = /* @__PURE__ */ idxR.map((idx, i) => idx.map((j) => shifts160[i][j]));
const Kl160 = /* @__PURE__ */ Uint32Array.from([
    0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e,
]);
const Kr160 = /* @__PURE__ */ Uint32Array.from([
    0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000,
]);
// It's called f() in spec.
function ripemd_f(group, x, y, z) {
    if (group === 0)
        return x ^ y ^ z;
    if (group === 1)
        return (x & y) | (~x & z);
    if (group === 2)
        return (x | ~y) ^ z;
    if (group === 3)
        return (x & z) | (y & ~z);
    return x ^ (y | ~z);
}
// Reusable temporary buffer
const BUF_160 = /* @__PURE__ */ new Uint32Array(16);
class RIPEMD160 extends HashMD {
    constructor() {
        super(64, 20, 8, true);
        this.h0 = 0x67452301 | 0;
        this.h1 = 0xefcdab89 | 0;
        this.h2 = 0x98badcfe | 0;
        this.h3 = 0x10325476 | 0;
        this.h4 = 0xc3d2e1f0 | 0;
    }
    get() {
        const { h0, h1, h2, h3, h4 } = this;
        return [h0, h1, h2, h3, h4];
    }
    set(h0, h1, h2, h3, h4) {
        this.h0 = h0 | 0;
        this.h1 = h1 | 0;
        this.h2 = h2 | 0;
        this.h3 = h3 | 0;
        this.h4 = h4 | 0;
    }
    process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
            BUF_160[i] = view.getUint32(offset, true);
        // prettier-ignore
        let al = this.h0 | 0, ar = al, bl = this.h1 | 0, br = bl, cl = this.h2 | 0, cr = cl, dl = this.h3 | 0, dr = dl, el = this.h4 | 0, er = el;
        // Instead of iterating 0 to 80, we split it into 5 groups
        // And use the groups in constants, functions, etc. Much simpler
        for (let group = 0; group < 5; group++) {
            const rGroup = 4 - group;
            const hbl = Kl160[group], hbr = Kr160[group]; // prettier-ignore
            const rl = idxL[group], rr = idxR[group]; // prettier-ignore
            const sl = shiftsL160[group], sr = shiftsR160[group]; // prettier-ignore
            for (let i = 0; i < 16; i++) {
                const tl = (rotl(al + ripemd_f(group, bl, cl, dl) + BUF_160[rl[i]] + hbl, sl[i]) + el) | 0;
                al = el, el = dl, dl = rotl(cl, 10) | 0, cl = bl, bl = tl; // prettier-ignore
            }
            // 2 loops are 10% faster
            for (let i = 0; i < 16; i++) {
                const tr = (rotl(ar + ripemd_f(rGroup, br, cr, dr) + BUF_160[rr[i]] + hbr, sr[i]) + er) | 0;
                ar = er, er = dr, dr = rotl(cr, 10) | 0, cr = br, br = tr; // prettier-ignore
            }
        }
        // Add the compressed chunk to the current hash value
        this.set((this.h1 + cl + dr) | 0, (this.h2 + dl + er) | 0, (this.h3 + el + ar) | 0, (this.h4 + al + br) | 0, (this.h0 + bl + cr) | 0);
    }
    roundClean() {
        clean(BUF_160);
    }
    destroy() {
        this.destroyed = true;
        clean(this.buffer);
        this.set(0, 0, 0, 0, 0);
    }
}
/**
 * RIPEMD-160 - a legacy hash function from 1990s.
 * * https://homes.esat.kuleuven.be/~bosselae/ripemd160.html
 * * https://homes.esat.kuleuven.be/~bosselae/ripemd160/pdf/AB-9601/AB-9601.pdf
 */
const ripemd160$1 = /* @__PURE__ */ createHasher(() => new RIPEMD160());

/**
 * RIPEMD-160 legacy hash function.
 * https://homes.esat.kuleuven.be/~bosselae/ripemd160.html
 * https://homes.esat.kuleuven.be/~bosselae/ripemd160/pdf/AB-9601/AB-9601.pdf
 * @module
 * @deprecated
 */
/** @deprecated Use import from `noble/hashes/legacy` module */
const ripemd160 = ripemd160$1;

function sha256(...data) {
    const b = Buff.join(data);
    return Buff.raw(sha256$1(b));
}
function hash256(...data) {
    const b = Buff.join(data);
    return Buff.raw(sha256$1(sha256$1(b)));
}
function hash160$2(...data) {
    const b = Buff.join(data);
    return Buff.raw(ripemd160(sha256$1(b)));
}
function taghash(tag) {
    const hash = Buff.str(tag).digest;
    return Buff.join([hash, hash]);
}
function hash340(tag, ...data) {
    const hash = taghash(tag);
    return Buff.join([hash, ...data]).digest;
}

function ok(value, message) {
    if (value === false)
        throw new Error('Assertion failed!');
}
function size$1(input, size) {
    const bytes = Buff.bytes(input);
    if (bytes.length !== size) {
        throw new Error(`Invalid input size: ${bytes.hex} !== ${size}`);
    }
}

function hash160pkh(pubkey) {
    const bytes = Buff.bytes(pubkey);
    size$1(bytes, 33);
    return hash160$2(bytes);
}
function hash160sh(script) {
    const bytes = buffer_asm(script, false);
    return hash160$2(bytes);
}
function sha256sh(script) {
    const bytes = buffer_asm(script, false);
    return sha256(bytes);
}

function bech32_encode(prefix, data, version = 0) {
    const { encode, to_words } = Bech32$1;
    const bytes = Buff.bytes(data);
    const words = [version, ...to_words(bytes)];
    return encode(prefix, words);
}
function bech32_decode(str) {
    const { decode, to_bytes } = Bech32$1;
    const { prefix, words } = decode(str);
    const [version, ...rest] = words;
    const data = Buff.raw(to_bytes(rest));
    return { prefix, version, data };
}
function bech32m_encode(prefix, data, version = 1) {
    const { encode, to_words } = Bech32m$1;
    const bytes = Buff.bytes(data);
    const words = [version, ...to_words(bytes)];
    return encode(prefix, words);
}
function bech32m_decode(str) {
    const { decode, to_bytes } = Bech32m$1;
    const { prefix, words } = decode(str);
    const [version, ...rest] = words;
    const data = Buff.raw(to_bytes(rest));
    return { prefix, version, data };
}
function decode_data(str, type) {
    if (type === 'base58') {
        return Buff.b58chk(str).slice(1);
    }
    else if (type === 'bech32') {
        const decoded = bech32_decode(str);
        return decoded.data;
    }
    else if (type === 'bech32m') {
        const decoded = bech32m_decode(str);
        return decoded.data;
    }
    throw new Error('Unrecognized format type: ' + type);
}
const Bech32 = {
    encode: bech32_encode,
    decode: bech32_decode
};
const Bech32m = {
    encode: bech32m_encode,
    decode: bech32m_decode
};

const ADDR_TYPES = [
    ['p2pkh', '1', 'main', 20, 'base58'],
    ['p2sh', '3', 'main', 20, 'base58'],
    ['p2pkh', 'm', 'testnet', 20, 'base58'],
    ['p2pkh', 'n', 'testnet', 20, 'base58'],
    ['p2sh', '2', 'testnet', 20, 'base58'],
    ['p2w-pkh', 'bc1q', 'main', 20, 'bech32'],
    ['p2w-pkh', 'tb1q', 'testnet', 20, 'bech32'],
    ['p2w-pkh', 'bcrt1q', 'regtest', 20, 'bech32'],
    ['p2w-sh', 'bc1q', 'main', 32, 'bech32'],
    ['p2w-sh', 'tb1q', 'testnet', 32, 'bech32'],
    ['p2w-sh', 'bcrt1q', 'regtest', 32, 'bech32'],
    ['p2tr', 'bc1p', 'main', 32, 'bech32m'],
    ['p2tr', 'tb1p', 'testnet', 32, 'bech32m'],
    ['p2tr', 'bcrt1p', 'regtest', 32, 'bech32m']
];
const BECH32_PREFIXES = {
    main: 'bc',
    testnet: 'tb',
    signet: 'tb',
    regtest: 'bcrt'
};
function lookup(address) {
    for (const row of ADDR_TYPES) {
        const [type, prefix, network, size, format] = row;
        if (address.startsWith(prefix)) {
            const data = decode_data(address, format);
            if (data.length === size) {
                return { type, prefix, network, size, format };
            }
        }
    }
    return null;
}

function check_address$4(address, network = 'main') {
    const prefixes = (network === 'main') ? ['1'] : ['m', 'n'];
    for (const prefix of prefixes) {
        if (address.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function encode_keydata$4(keydata, network = 'main') {
    const bytes = Buff.bytes(keydata);
    const prefix = (network === 'main') ? Buff.num(0x00) : Buff.num(0x6F);
    size$1(keydata, 20);
    return bytes.prepend(prefix).to_b58chk();
}
function decode_address$4(address) {
    const meta = lookup(address);
    ok(meta !== null);
    const { type, network } = meta;
    if (!check_address$4(address, network)) {
        throw new TypeError('Invalid p2pkh address:' + address);
    }
    const dat = Buff.b58chk(address).slice(1);
    const asm = create_script$4(dat);
    const hex = encode_script(asm, false).hex;
    const key = dat.hex;
    return { asm, hex, key, network, type };
}
function create_address$5(input, network) {
    const bytes = Buff.bytes(input);
    size$1(bytes, 33);
    const hash = hash160pkh(bytes);
    return encode_keydata$4(hash, network);
}
function create_script$4(keydata) {
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 20);
    return ['OP_DUP', 'OP_HASH160', bytes.hex, 'OP_EQUALVERIFY', 'OP_CHECKSIG'];
}
var P2PKH = {
    create: create_address$5,
    encode: encode_keydata$4,
    decode: decode_address$4
};

function check_address$3(address, network = 'main') {
    const prefixes = (network === 'main') ? ['3'] : ['2'];
    for (const prefix of prefixes) {
        if (address.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function encode_keydata$3(input, network = 'main') {
    const prefix = (network === 'main') ? Buff.num(0x05) : Buff.num(0xC4);
    const bytes = Buff.bytes(input);
    size$1(bytes, 20);
    return bytes.prepend(prefix).to_b58chk();
}
function decode_address$3(address) {
    const meta = lookup(address);
    ok(meta !== null);
    const { type, network } = meta;
    if (!check_address$3(address, network)) {
        throw new TypeError('Invalid p2sh address:' + address);
    }
    const dat = Buff.b58chk(address).slice(1);
    const asm = create_script$3(dat);
    const hex = encode_script(asm, false).hex;
    const key = dat.hex;
    return { asm, hex, key, network, type };
}
function create_address$4(input, network) {
    const bytes = buffer_asm(input, false);
    const hash = hash160sh(bytes);
    return encode_keydata$3(hash, network);
}
function create_script$3(keydata) {
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 20);
    return ['OP_HASH160', bytes.hex, 'OP_EQUAL'];
}
var P2SH = {
    create: create_address$4,
    encode: encode_keydata$3,
    decode: decode_address$3
};

const VALID_PREFIXES$2 = ['bc1q', 'tb1q', 'bcrt1q'];
function check_address$2(address) {
    for (const prefix of VALID_PREFIXES$2) {
        if (address.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function encode_keydata$2(keydata, network = 'main') {
    const prefix = BECH32_PREFIXES[network];
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 20);
    return Bech32.encode(prefix, bytes, 0);
}
function decode_address$2(address) {
    const meta = lookup(address);
    ok(meta !== null);
    const { type, network } = meta;
    if (!check_address$2(address)) {
        throw new TypeError('Invalid segwit address!');
    }
    const { data, version } = Bech32.decode(address);
    const asm = create_script$2(data);
    const hex = encode_script(asm, false).hex;
    const key = data.hex;
    ok(version === 0);
    return { asm, hex, key, network, type };
}
function create_address$3(input, network) {
    const bytes = Buff.bytes(input);
    size$1(bytes, 33);
    const hash = hash160pkh(bytes);
    return encode_keydata$2(hash, network);
}
function create_script$2(keydata) {
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 20);
    return ['OP_0', bytes.hex];
}
var P2WPKH = {
    create: create_address$3,
    encode: encode_keydata$2,
    decode: decode_address$2
};

const VALID_PREFIXES$1 = ['bc1q', 'tb1q', 'bcrt1q'];
function check_address$1(address) {
    for (const prefix of VALID_PREFIXES$1) {
        if (address.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function encode_keydata$1(keydata, network = 'main') {
    const prefix = BECH32_PREFIXES[network];
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 32);
    return Bech32.encode(prefix, bytes);
}
function decode_address$1(address) {
    const meta = lookup(address);
    ok(meta !== null);
    const { type, network } = meta;
    if (!check_address$1(address)) {
        throw new TypeError('Invalid segwit address!');
    }
    const { data, version } = Bech32.decode(address);
    const asm = create_script$1(data);
    const hex = encode_script(asm, false).hex;
    const key = data.hex;
    ok(version === 0);
    return { asm, hex, key, network, type };
}
function create_address$2(input, network) {
    const bytes = buffer_asm(input, false);
    const hash = sha256sh(bytes);
    return encode_keydata$1(hash, network);
}
function create_script$1(keydata) {
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 32);
    return ['OP_0', bytes.hex];
}
var P2WSH = {
    create: create_address$2,
    encode: encode_keydata$1,
    decode: decode_address$1
};

const VALID_PREFIXES = ['bc1p', 'tb1p', 'bcrt1p'];
function check_address(address) {
    for (const prefix of VALID_PREFIXES) {
        if (address.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function encode_keydata(keydata, network = 'main') {
    const prefix = BECH32_PREFIXES[network];
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 32);
    return Bech32m.encode(prefix, bytes);
}
function decode_address(address) {
    const meta = lookup(address);
    ok(meta !== null);
    const { type, network } = meta;
    if (!check_address(address)) {
        throw new TypeError('Invalid segwit address!');
    }
    const { data, version } = Bech32m.decode(address);
    const asm = create_script(data);
    const hex = encode_script(asm, false).hex;
    const key = data.hex;
    ok(version === 1);
    return { asm, hex, key, network, type };
}
function create_address$1(input, network) {
    const bytes = Buff.bytes(input);
    ok(bytes.length === 32);
    return encode_keydata(bytes, network);
}
function create_script(keydata) {
    const bytes = Buff.bytes(keydata);
    size$1(bytes, 32);
    return ['OP_1', bytes.hex];
}
var P2TR = {
    create: create_address$1,
    encode: encode_keydata,
    decode: decode_address
};

const ADDR_TOOLS = {
    p2pkh: P2PKH,
    p2sh: P2SH,
    'p2w-pkh': P2WPKH,
    'p2w-sh': P2WSH,
    p2tr: P2TR
};

const tools = ADDR_TOOLS;
function parse_addr(address) {
    for (const row of ADDR_TYPES) {
        const [type, prefix, network, size] = row;
        if (address.startsWith(prefix)) {
            const tool = tools[type];
            const addr = tool.decode(address, network);
            if (addr.key.length / 2 === size) {
                return addr;
            }
        }
    }
    throw new Error('Unable to parse address: ' + address);
}
function create_addr(script, network) {
    const { type, key, hex } = parse_script(script);
    if (type !== 'raw') {
        const tool = tools[type];
        if (tool === undefined) {
            throw new Error('Unable to find parser for address type: ' + type);
        }
        return tool.encode(key, network);
    }
    throw new Error('Unrecognized script format: ' + hex);
}

function encode_tx$1(txdata, enable_segwit = true) {
    const { version, vin, vout, locktime } = txdata;
    const useWitness = (enable_segwit === true && check_witness(vin));
    const raw = [encode_version(version)];
    if (useWitness) {
        raw.push(Buff.hex('0001'));
    }
    raw.push(encode_inputs(vin));
    raw.push(encode_outputs(vout));
    for (const txin of vin) {
        if (useWitness) {
            raw.push(encode_witness(txin.witness));
        }
    }
    raw.push(encode_locktime(locktime));
    return Buff.join(raw);
}
function check_witness(vin) {
    for (const txin of vin) {
        if (!is_empty(txin.witness))
            return true;
    }
    return false;
}
function encode_version(num) {
    return Buff.num(num, 4).reverse();
}
function encode_txid(txid) {
    return Buff.hex(txid, 32).reverse();
}
function encode_idx(vout) {
    return Buff.num(vout, 4).reverse();
}
function encode_sequence(sequence) {
    return (typeof sequence === 'string')
        ? Buff.hex(sequence, 4)
        : Buff.num(sequence, 4).reverse();
}
function encode_inputs(arr) {
    const raw = [Buff.calc_varint(arr.length, 'le')];
    for (const vin of arr)
        raw.push(encode_vin(vin));
    return Buff.join(raw);
}
function encode_vin(vin) {
    const { txid, vout, scriptSig, sequence } = vin;
    return Buff.join([
        encode_txid(txid),
        encode_idx(vout),
        encode_script(scriptSig, true),
        encode_sequence(sequence)
    ]);
}
function encode_value(value) {
    return Buff.big(value, 8).reverse();
}
function encode_outputs(arr) {
    const raw = [Buff.calc_varint(arr.length, 'le')];
    for (const vout of arr)
        raw.push(encode_vout(vout));
    return Buff.join(raw);
}
function encode_vout(vout) {
    const { value, scriptPubKey } = vout;
    const raw = [];
    raw.push(encode_value(value));
    raw.push(encode_script(scriptPubKey, true));
    return Buff.join(raw);
}
function encode_witness(data = []) {
    const buffer = [];
    if (Array.isArray(data)) {
        const count = Buff.calc_varint(data.length);
        buffer.push(count);
        for (const entry of data) {
            buffer.push(encode_data(entry));
        }
        return Buff.join(buffer);
    }
    else {
        return Buff.bytes(data);
    }
}
function encode_data(data) {
    return (!is_empty(data))
        ? encode_script(data, true)
        : new Buff(0);
}
function encode_locktime(locktime) {
    return (typeof locktime === 'string')
        ? Buff.hex(locktime, 4)
        : Buff.num(locktime, 4).reverse();
}

function decode_tx$1(txhex, enable_segwit = true) {
    if (typeof txhex === 'string') {
        txhex = Buff.hex(txhex).raw;
    }
    const stream = new Stream(txhex);
    const version = read_version(stream);
    const has_witness = (enable_segwit)
        ? check_witness_flag(stream)
        : false;
    const vin = read_inputs(stream);
    const vout = read_outputs(stream);
    if (has_witness) {
        for (const txin of vin) {
            txin.witness = read_witness(stream);
        }
    }
    const locktime = read_locktime(stream);
    return { version, vin, vout, locktime };
}
function read_version(stream) {
    return stream.read(4).reverse().to_num();
}
function check_witness_flag(stream) {
    const [marker, flag] = [...stream.peek(2)];
    if (marker === 0) {
        stream.read(2);
        if (flag === 1) {
            return true;
        }
        else {
            throw new Error(`Invalid witness flag: ${flag}`);
        }
    }
    return false;
}
function read_inputs(stream) {
    const inputs = [];
    const vinCount = stream.read_varint();
    for (let i = 0; i < vinCount; i++) {
        inputs.push(read_vin(stream));
    }
    return inputs;
}
function read_vin(stream) {
    return {
        txid: stream.read(32).reverse().hex,
        vout: stream.read(4).reverse().num,
        scriptSig: read_script(stream, true),
        sequence: stream.read(4).reverse().num,
        witness: []
    };
}
function read_outputs(stream) {
    const outputs = [];
    const vcount = stream.read_varint();
    for (let i = 0; i < vcount; i++) {
        const vout = read_vout(stream);
        outputs.push(vout);
    }
    return outputs;
}
function read_vout(stream) {
    return {
        value: stream.read(8).reverse().big,
        scriptPubKey: read_script(stream, true)
    };
}
function read_witness(stream) {
    const stack = [];
    const count = stream.read_varint();
    for (let i = 0; i < count; i++) {
        const word = read_data(stream, true);
        stack.push(word ?? '');
    }
    return stack;
}
function read_data(stream, varint) {
    const size = (varint === true)
        ? stream.read_varint('le')
        : stream.size;
    return size > 0
        ? stream.read(size).hex
        : null;
}
function read_script(stream, varint) {
    const data = read_data(stream, varint);
    return data ?? [];
}
function read_locktime(stream) {
    return stream.read(4).reverse().to_num();
}

const keys = Object.keys(OPCODE_MAP);
const hexstr = stringType().regex(/^[a-fA-F0-9]*$/).refine(e => e.length % 2 === 0);
const hash = stringType().regex(/^[a-fA-F0-9]{64}$/);
const uint32 = numberType().min(0).max(0xFFFFFFFF);
const uint64 = bigIntType().min(0n).max(0xffffffffffffffffn);
const uint8a = instanceOfType(Uint8Array);
const opcodes = enumType(keys);
const asmcode = unionType([uint32, opcodes, hexstr, uint8a]).array();
const script$1 = unionType([asmcode, hexstr, uint8a]);
const witness = arrayType(script$1);

const txout = objectType({
    value: uint64,
    scriptPubKey: script$1
});
const txin = objectType({
    txid: hash,
    vout: uint32,
    scriptSig: script$1,
    sequence: uint32,
    prevout: txout.optional(),
    witness
});
const txdata = objectType({
    version: uint32,
    vin: txin.array(),
    vout: txout.array(),
    locktime: uint32
});

const DEFAULT_TX = {
    version: 2,
    vin: [],
    vout: [],
    locktime: 0
};
const DEFAULT_VIN = {
    scriptSig: [],
    sequence: 4294967293,
    witness: []
};
const DEFAULT_VOUT = {
    value: 0n,
    scriptPubKey: []
};
function parse_txid(txdata, segwit = false) {
    const json = parse_tx(txdata);
    const data = encode_tx$1(json, segwit);
    return hash256(data).reverse().hex;
}
function parse_txsize(txdata) {
    const json = parse_tx(txdata);
    const bsize = encode_tx$1(json, true).length;
    const fsize = encode_tx$1(json, false).length;
    const weight = bsize * 3 + fsize;
    const remain = (weight % 4 > 0) ? 1 : 0;
    const vsize = Math.floor(weight / 4) + remain;
    return { size: fsize, bsize, vsize, weight };
}
function create_vin(vin) {
    const sequence = (typeof vin.sequence === 'string')
        ? Buff.hex(vin.sequence).num
        : vin.sequence ?? DEFAULT_VIN.sequence;
    const prevout = (typeof vin.prevout !== 'undefined')
        ? create_vout(vin.prevout)
        : vin.prevout;
    return { ...DEFAULT_VIN, ...vin, prevout, sequence };
}
function create_vout(vout) {
    let value;
    if (typeof vout.value === 'number') {
        value = BigInt(vout.value);
    }
    else if (typeof vout.value === 'string') {
        value = Buff.hex(vout.value).big;
    }
    else if (typeof vout.value === 'bigint') {
        value = vout.value;
    }
    else {
        value = 0n;
    }
    return { ...DEFAULT_VOUT, ...vout, value };
}
function create_tx(template) {
    const locktime = (typeof template.locktime === 'string')
        ? Buff.hex(template.locktime).num
        : template.locktime ?? DEFAULT_TX.locktime;
    const tx = { ...DEFAULT_TX, ...template, locktime };
    tx.vin = tx.vin.map(txin => create_vin(txin));
    tx.vout = tx.vout.map(txout => create_vout(txout));
    return txdata.parse(tx);
}
function parse_tx(txdata) {
    return (is_bytes(txdata))
        ? decode_tx$1(txdata)
        : create_tx(txdata);
}

var Check;
(function (Check) {
    function exists(value) {
        if (typeof value === 'undefined' || value === null) {
            return false;
        }
        return true;
    }
    Check.exists = exists;
    function is_number(value) {
        return typeof value === 'number';
    }
    Check.is_number = is_number;
    function is_bigint(value) {
        return typeof value === 'bigint';
    }
    Check.is_bigint = is_bigint;
    function is_hex(value) {
        if (typeof value === 'string' &&
            value.match(/[^a-fA-F0-9]/) === null &&
            value.length % 2 === 0) {
            return true;
        }
        return false;
    }
    Check.is_hex = is_hex;
    function is_hash(value) {
        if (is_hex(value) && value.length === 64) {
            return true;
        }
        return false;
    }
    Check.is_hash = is_hash;
    function is_schema(input, schema) {
        return schema.safeParse(input).success;
    }
    Check.is_schema = is_schema;
})(Check || (Check = {}));
var Assert;
(function (Assert) {
    function ok(value, message) {
        if (value === false) {
            throw new Error(message ?? 'Assertion failed!');
        }
    }
    Assert.ok = ok;
    function exists(value, msg) {
        if (!Check.exists(value)) {
            throw new Error(msg ?? 'Value is null or undefined!');
        }
    }
    Assert.exists = exists;
    function is_number(value) {
        if (!Check.is_number(value)) {
            throw new TypeError(`invalid number: ${String(value)}`);
        }
    }
    Assert.is_number = is_number;
    function is_bigint(value) {
        if (!Check.is_bigint(value)) {
            throw new TypeError(`invalid bigint: ${String(value)}`);
        }
    }
    Assert.is_bigint = is_bigint;
    function is_hex(value) {
        if (!Check.is_hex(value)) {
            throw new TypeError(`invalid hex: ${String(value)}`);
        }
    }
    Assert.is_hex = is_hex;
    function is_hash(value, msg) {
        if (!Check.is_hash(value)) {
            throw new TypeError(msg ?? `invalid hash: ${String(value)}`);
        }
    }
    Assert.is_hash = is_hash;
    function size(input, size) {
        const bytes = Buff.bytes(input);
        if (bytes.length !== size) {
            throw new Error(`Invalid input size: ${bytes.hex} !== ${size}`);
        }
    }
    Assert.size = size;
    function is_schema(input, schema, msg) {
        const result = schema.safeParse(input);
        if (!result.success) {
            console.error(result.error);
            throw new Error(msg ?? 'input failed schema validation');
        }
    }
    Assert.is_schema = is_schema;
})(Assert || (Assert = {}));

/**
 * Hex, bytes and number utilities.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const _0n$5 = /* @__PURE__ */ BigInt(0);
const _1n$4 = /* @__PURE__ */ BigInt(1);
function abool(title, value) {
    if (typeof value !== 'boolean')
        throw new Error(title + ' boolean expected, got ' + value);
}
// Used in weierstrass, der
function numberToHexUnpadded(num) {
    const hex = num.toString(16);
    return hex.length & 1 ? '0' + hex : hex;
}
function hexToNumber(hex) {
    if (typeof hex !== 'string')
        throw new Error('hex string expected, got ' + typeof hex);
    return hex === '' ? _0n$5 : BigInt('0x' + hex); // Big Endian
}
// BE: Big Endian, LE: Little Endian
function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex$1(bytes));
}
function bytesToNumberLE(bytes) {
    abytes$1(bytes);
    return hexToNumber(bytesToHex$1(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
    return hexToBytes$1(n.toString(16).padStart(len * 2, '0'));
}
function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
}
/**
 * Takes hex string or Uint8Array, converts to Uint8Array.
 * Validates output length.
 * Will throw error for other types.
 * @param title descriptive title for an error e.g. 'private key'
 * @param hex hex string or Uint8Array
 * @param expectedLength optional, will compare to result array's length
 * @returns
 */
function ensureBytes(title, hex, expectedLength) {
    let res;
    if (typeof hex === 'string') {
        try {
            res = hexToBytes$1(hex);
        }
        catch (e) {
            throw new Error(title + ' must be hex string or Uint8Array, cause: ' + e);
        }
    }
    else if (isBytes$3(hex)) {
        // Uint8Array.from() instead of hash.slice() because node.js Buffer
        // is instance of Uint8Array, and its slice() creates **mutable** copy
        res = Uint8Array.from(hex);
    }
    else {
        throw new Error(title + ' must be hex string or Uint8Array');
    }
    const len = res.length;
    if (typeof expectedLength === 'number' && len !== expectedLength)
        throw new Error(title + ' of length ' + expectedLength + ' expected, got ' + len);
    return res;
}
/**
 * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
 */
// export const utf8ToBytes: typeof utf8ToBytes_ = utf8ToBytes_;
/**
 * Converts bytes to string using UTF8 encoding.
 * @example bytesToUtf8(Uint8Array.from([97, 98, 99])) // 'abc'
 */
// export const bytesToUtf8: typeof bytesToUtf8_ = bytesToUtf8_;
// Is positive bigint
const isPosBig = (n) => typeof n === 'bigint' && _0n$5 <= n;
function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
/**
 * Asserts min <= n < max. NOTE: It's < max and not <= max.
 * @example
 * aInRange('x', x, 1n, 256n); // would assume x is in (1n..255n)
 */
function aInRange(title, n, min, max) {
    // Why min <= n < max and not a (min < n < max) OR b (min <= n <= max)?
    // consider P=256n, min=0n, max=P
    // - a for min=0 would require -1:          `inRange('x', x, -1n, P)`
    // - b would commonly require subtraction:  `inRange('x', x, 0n, P - 1n)`
    // - our way is the cleanest:               `inRange('x', x, 0n, P)
    if (!inRange(n, min, max))
        throw new Error('expected valid ' + title + ': ' + min + ' <= n < ' + max + ', got ' + n);
}
// Bit operations
/**
 * Calculates amount of bits in a bigint.
 * Same as `n.toString(2).length`
 * TODO: merge with nLength in modular
 */
function bitLen(n) {
    let len;
    for (len = 0; n > _0n$5; n >>= _1n$4, len += 1)
        ;
    return len;
}
/**
 * Calculate mask for N bits. Not using ** operator with bigints because of old engines.
 * Same as BigInt(`0b${Array(i).fill('1').join('')}`)
 */
const bitMask = (n) => (_1n$4 << BigInt(n)) - _1n$4;
/**
 * Minimal HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
 * @returns function that will call DRBG until 2nd arg returns something meaningful
 * @example
 *   const drbg = createHmacDRBG<Key>(32, 32, hmac);
 *   drbg(seed, bytesToKey); // bytesToKey must return Key or undefined
 */
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
    if (typeof hashLen !== 'number' || hashLen < 2)
        throw new Error('hashLen must be a number');
    if (typeof qByteLen !== 'number' || qByteLen < 2)
        throw new Error('qByteLen must be a number');
    if (typeof hmacFn !== 'function')
        throw new Error('hmacFn must be a function');
    // Step B, Step C: set hashLen to 8*ceil(hlen/8)
    const u8n = (len) => new Uint8Array(len); // creates Uint8Array
    const u8of = (byte) => Uint8Array.of(byte); // another shortcut
    let v = u8n(hashLen); // Minimal non-full-spec HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
    let k = u8n(hashLen); // Steps B and C of RFC6979 3.2: set hashLen, in our case always same
    let i = 0; // Iterations counter, will throw when over 1000
    const reset = () => {
        v.fill(1);
        k.fill(0);
        i = 0;
    };
    const h = (...b) => hmacFn(k, v, ...b); // hmac(k)(v, ...values)
    const reseed = (seed = u8n(0)) => {
        // HMAC-DRBG reseed() function. Steps D-G
        k = h(u8of(0x00), seed); // k = hmac(k || v || 0x00 || seed)
        v = h(); // v = hmac(k || v)
        if (seed.length === 0)
            return;
        k = h(u8of(0x01), seed); // k = hmac(k || v || 0x01 || seed)
        v = h(); // v = hmac(k || v)
    };
    const gen = () => {
        // HMAC-DRBG generate() function
        if (i++ >= 1000)
            throw new Error('drbg: tried 1000 values');
        let len = 0;
        const out = [];
        while (len < qByteLen) {
            v = h();
            const sl = v.slice();
            out.push(sl);
            len += v.length;
        }
        return concatBytes$2(...out);
    };
    const genUntil = (seed, pred) => {
        reset();
        reseed(seed); // Steps D-G
        let res = undefined; // Step H: grind until k is in [1..n-1]
        while (!(res = pred(gen())))
            reseed();
        reset();
        return res;
    };
    return genUntil;
}
function _validateObject(object, fields, optFields = {}) {
    if (!object || typeof object !== 'object')
        throw new Error('expected valid options object');
    function checkField(fieldName, expectedType, isOpt) {
        const val = object[fieldName];
        if (isOpt && val === undefined)
            return;
        const current = typeof val;
        if (current !== expectedType || val === null)
            throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
    }
    Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
    Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
}
/**
 * Memoizes (caches) computation result.
 * Uses WeakMap: the value is going auto-cleaned by GC after last reference is removed.
 */
function memoized(fn) {
    const map = new WeakMap();
    return (arg, ...args) => {
        const val = map.get(arg);
        if (val !== undefined)
            return val;
        const computed = fn(arg, ...args);
        map.set(arg, computed);
        return computed;
    };
}

/**
 * Utils for modular division and fields.
 * Field over 11 is a finite (Galois) field is integer number operations `mod 11`.
 * There is no division: it is replaced by modular multiplicative inverse.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// prettier-ignore
const _0n$4 = BigInt(0), _1n$3 = BigInt(1), _2n$2 = /* @__PURE__ */ BigInt(2), _3n$1 = /* @__PURE__ */ BigInt(3);
// prettier-ignore
const _4n$1 = /* @__PURE__ */ BigInt(4), _5n = /* @__PURE__ */ BigInt(5);
const _8n = /* @__PURE__ */ BigInt(8);
// Calculates a modulo b
function mod(a, b) {
    const result = a % b;
    return result >= _0n$4 ? result : b + result;
}
/** Does `x^(2^power)` mod p. `pow2(30, 4)` == `30^(2^4)` */
function pow2(x, power, modulo) {
    let res = x;
    while (power-- > _0n$4) {
        res *= res;
        res %= modulo;
    }
    return res;
}
/**
 * Inverses number over modulo.
 * Implemented using [Euclidean GCD](https://brilliant.org/wiki/extended-euclidean-algorithm/).
 */
function invert(number, modulo) {
    if (number === _0n$4)
        throw new Error('invert: expected non-zero number');
    if (modulo <= _0n$4)
        throw new Error('invert: expected positive modulus, got ' + modulo);
    // Fermat's little theorem "CT-like" version inv(n) = n^(m-2) mod m is 30x slower.
    let a = mod(number, modulo);
    let b = modulo;
    // prettier-ignore
    let x = _0n$4, u = _1n$3;
    while (a !== _0n$4) {
        // JIT applies optimization if those two lines follow each other
        const q = b / a;
        const r = b % a;
        const m = x - u * q;
        // prettier-ignore
        b = a, a = r, x = u, u = m;
    }
    const gcd = b;
    if (gcd !== _1n$3)
        throw new Error('invert: does not exist');
    return mod(x, modulo);
}
// Not all roots are possible! Example which will throw:
// const NUM =
// n = 72057594037927816n;
// Fp = Field(BigInt('0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab'));
function sqrt3mod4(Fp, n) {
    const p1div4 = (Fp.ORDER + _1n$3) / _4n$1;
    const root = Fp.pow(n, p1div4);
    // Throw if root^2 != n
    if (!Fp.eql(Fp.sqr(root), n))
        throw new Error('Cannot find square root');
    return root;
}
function sqrt5mod8(Fp, n) {
    const p5div8 = (Fp.ORDER - _5n) / _8n;
    const n2 = Fp.mul(n, _2n$2);
    const v = Fp.pow(n2, p5div8);
    const nv = Fp.mul(n, v);
    const i = Fp.mul(Fp.mul(nv, _2n$2), v);
    const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
    if (!Fp.eql(Fp.sqr(root), n))
        throw new Error('Cannot find square root');
    return root;
}
// TODO: Commented-out for now. Provide test vectors.
// Tonelli is too slow for extension fields Fp2.
// That means we can't use sqrt (c1, c2...) even for initialization constants.
// if (P % _16n === _9n) return sqrt9mod16;
// // prettier-ignore
// function sqrt9mod16<T>(Fp: IField<T>, n: T, p7div16?: bigint) {
//   if (p7div16 === undefined) p7div16 = (Fp.ORDER + BigInt(7)) / _16n;
//   const c1 = Fp.sqrt(Fp.neg(Fp.ONE)); //  1. c1 = sqrt(-1) in F, i.e., (c1^2) == -1 in F
//   const c2 = Fp.sqrt(c1);             //  2. c2 = sqrt(c1) in F, i.e., (c2^2) == c1 in F
//   const c3 = Fp.sqrt(Fp.neg(c1));     //  3. c3 = sqrt(-c1) in F, i.e., (c3^2) == -c1 in F
//   const c4 = p7div16;                 //  4. c4 = (q + 7) / 16        # Integer arithmetic
//   let tv1 = Fp.pow(n, c4);            //  1. tv1 = x^c4
//   let tv2 = Fp.mul(c1, tv1);          //  2. tv2 = c1 * tv1
//   const tv3 = Fp.mul(c2, tv1);        //  3. tv3 = c2 * tv1
//   let tv4 = Fp.mul(c3, tv1);          //  4. tv4 = c3 * tv1
//   const e1 = Fp.eql(Fp.sqr(tv2), n);  //  5.  e1 = (tv2^2) == x
//   const e2 = Fp.eql(Fp.sqr(tv3), n);  //  6.  e2 = (tv3^2) == x
//   tv1 = Fp.cmov(tv1, tv2, e1); //  7. tv1 = CMOV(tv1, tv2, e1)  # Select tv2 if (tv2^2) == x
//   tv2 = Fp.cmov(tv4, tv3, e2); //  8. tv2 = CMOV(tv4, tv3, e2)  # Select tv3 if (tv3^2) == x
//   const e3 = Fp.eql(Fp.sqr(tv2), n);  //  9.  e3 = (tv2^2) == x
//   return Fp.cmov(tv1, tv2, e3); // 10.  z = CMOV(tv1, tv2, e3) # Select the sqrt from tv1 and tv2
// }
/**
 * Tonelli-Shanks square root search algorithm.
 * 1. https://eprint.iacr.org/2012/685.pdf (page 12)
 * 2. Square Roots from 1; 24, 51, 10 to Dan Shanks
 * @param P field order
 * @returns function that takes field Fp (created from P) and number n
 */
function tonelliShanks(P) {
    // Initialization (precomputation).
    // Caching initialization could boost perf by 7%.
    if (P < BigInt(3))
        throw new Error('sqrt is not defined for small field');
    // Factor P - 1 = Q * 2^S, where Q is odd
    let Q = P - _1n$3;
    let S = 0;
    while (Q % _2n$2 === _0n$4) {
        Q /= _2n$2;
        S++;
    }
    // Find the first quadratic non-residue Z >= 2
    let Z = _2n$2;
    const _Fp = Field$1(P);
    while (FpLegendre(_Fp, Z) === 1) {
        // Basic primality test for P. After x iterations, chance of
        // not finding quadratic non-residue is 2^x, so 2^1000.
        if (Z++ > 1000)
            throw new Error('Cannot find square root: probably non-prime P');
    }
    // Fast-path; usually done before Z, but we do "primality test".
    if (S === 1)
        return sqrt3mod4;
    // Slow-path
    // TODO: test on Fp2 and others
    let cc = _Fp.pow(Z, Q); // c = z^Q
    const Q1div2 = (Q + _1n$3) / _2n$2;
    return function tonelliSlow(Fp, n) {
        if (Fp.is0(n))
            return n;
        // Check if n is a quadratic residue using Legendre symbol
        if (FpLegendre(Fp, n) !== 1)
            throw new Error('Cannot find square root');
        // Initialize variables for the main loop
        let M = S;
        let c = Fp.mul(Fp.ONE, cc); // c = z^Q, move cc from field _Fp into field Fp
        let t = Fp.pow(n, Q); // t = n^Q, first guess at the fudge factor
        let R = Fp.pow(n, Q1div2); // R = n^((Q+1)/2), first guess at the square root
        // Main loop
        // while t != 1
        while (!Fp.eql(t, Fp.ONE)) {
            if (Fp.is0(t))
                return Fp.ZERO; // if t=0 return R=0
            let i = 1;
            // Find the smallest i >= 1 such that t^(2^i) ≡ 1 (mod P)
            let t_tmp = Fp.sqr(t); // t^(2^1)
            while (!Fp.eql(t_tmp, Fp.ONE)) {
                i++;
                t_tmp = Fp.sqr(t_tmp); // t^(2^2)...
                if (i === M)
                    throw new Error('Cannot find square root');
            }
            // Calculate the exponent for b: 2^(M - i - 1)
            const exponent = _1n$3 << BigInt(M - i - 1); // bigint is important
            const b = Fp.pow(c, exponent); // b = 2^(M - i - 1)
            // Update variables
            M = i;
            c = Fp.sqr(b); // c = b^2
            t = Fp.mul(t, c); // t = (t * b^2)
            R = Fp.mul(R, b); // R = R*b
        }
        return R;
    };
}
/**
 * Square root for a finite field. Will try optimized versions first:
 *
 * 1. P ≡ 3 (mod 4)
 * 2. P ≡ 5 (mod 8)
 * 3. Tonelli-Shanks algorithm
 *
 * Different algorithms can give different roots, it is up to user to decide which one they want.
 * For example there is FpSqrtOdd/FpSqrtEven to choice root based on oddness (used for hash-to-curve).
 */
function FpSqrt(P) {
    // P ≡ 3 (mod 4) => √n = n^((P+1)/4)
    if (P % _4n$1 === _3n$1)
        return sqrt3mod4;
    // P ≡ 5 (mod 8) => Atkin algorithm, page 10 of https://eprint.iacr.org/2012/685.pdf
    if (P % _8n === _5n)
        return sqrt5mod8;
    // P ≡ 9 (mod 16) not implemented, see above
    // Tonelli-Shanks algorithm
    return tonelliShanks(P);
}
// prettier-ignore
const FIELD_FIELDS = [
    'create', 'isValid', 'is0', 'neg', 'inv', 'sqrt', 'sqr',
    'eql', 'add', 'sub', 'mul', 'pow', 'div',
    'addN', 'subN', 'mulN', 'sqrN'
];
function validateField(field) {
    const initial = {
        ORDER: 'bigint',
        MASK: 'bigint',
        BYTES: 'number',
        BITS: 'number',
    };
    const opts = FIELD_FIELDS.reduce((map, val) => {
        map[val] = 'function';
        return map;
    }, initial);
    _validateObject(field, opts);
    // const max = 16384;
    // if (field.BYTES < 1 || field.BYTES > max) throw new Error('invalid field');
    // if (field.BITS < 1 || field.BITS > 8 * max) throw new Error('invalid field');
    return field;
}
// Generic field functions
/**
 * Same as `pow` but for Fp: non-constant-time.
 * Unsafe in some contexts: uses ladder, so can expose bigint bits.
 */
function FpPow(Fp, num, power) {
    if (power < _0n$4)
        throw new Error('invalid exponent, negatives unsupported');
    if (power === _0n$4)
        return Fp.ONE;
    if (power === _1n$3)
        return num;
    let p = Fp.ONE;
    let d = num;
    while (power > _0n$4) {
        if (power & _1n$3)
            p = Fp.mul(p, d);
        d = Fp.sqr(d);
        power >>= _1n$3;
    }
    return p;
}
/**
 * Efficiently invert an array of Field elements.
 * Exception-free. Will return `undefined` for 0 elements.
 * @param passZero map 0 to 0 (instead of undefined)
 */
function FpInvertBatch(Fp, nums, passZero = false) {
    const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : undefined);
    // Walk from first to last, multiply them by each other MOD p
    const multipliedAcc = nums.reduce((acc, num, i) => {
        if (Fp.is0(num))
            return acc;
        inverted[i] = acc;
        return Fp.mul(acc, num);
    }, Fp.ONE);
    // Invert last element
    const invertedAcc = Fp.inv(multipliedAcc);
    // Walk from last to first, multiply them by inverted each other MOD p
    nums.reduceRight((acc, num, i) => {
        if (Fp.is0(num))
            return acc;
        inverted[i] = Fp.mul(acc, inverted[i]);
        return Fp.mul(acc, num);
    }, invertedAcc);
    return inverted;
}
/**
 * Legendre symbol.
 * Legendre constant is used to calculate Legendre symbol (a | p)
 * which denotes the value of a^((p-1)/2) (mod p).
 *
 * * (a | p) ≡ 1    if a is a square (mod p), quadratic residue
 * * (a | p) ≡ -1   if a is not a square (mod p), quadratic non residue
 * * (a | p) ≡ 0    if a ≡ 0 (mod p)
 */
function FpLegendre(Fp, n) {
    // We can use 3rd argument as optional cache of this value
    // but seems unneeded for now. The operation is very fast.
    const p1mod2 = (Fp.ORDER - _1n$3) / _2n$2;
    const powered = Fp.pow(n, p1mod2);
    const yes = Fp.eql(powered, Fp.ONE);
    const zero = Fp.eql(powered, Fp.ZERO);
    const no = Fp.eql(powered, Fp.neg(Fp.ONE));
    if (!yes && !zero && !no)
        throw new Error('invalid Legendre symbol result');
    return yes ? 1 : zero ? 0 : -1;
}
// CURVE.n lengths
function nLength(n, nBitLength) {
    // Bit size, byte size of CURVE.n
    if (nBitLength !== undefined)
        anumber$1(nBitLength);
    const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
}
/**
 * Creates a finite field. Major performance optimizations:
 * * 1. Denormalized operations like mulN instead of mul.
 * * 2. Identical object shape: never add or remove keys.
 * * 3. `Object.freeze`.
 * Fragile: always run a benchmark on a change.
 * Security note: operations don't check 'isValid' for all elements for performance reasons,
 * it is caller responsibility to check this.
 * This is low-level code, please make sure you know what you're doing.
 *
 * Note about field properties:
 * * CHARACTERISTIC p = prime number, number of elements in main subgroup.
 * * ORDER q = similar to cofactor in curves, may be composite `q = p^m`.
 *
 * @param ORDER field order, probably prime, or could be composite
 * @param bitLen how many bits the field consumes
 * @param isLE (default: false) if encoding / decoding should be in little-endian
 * @param redef optional faster redefinitions of sqrt and other methods
 */
function Field$1(ORDER, bitLenOrOpts, isLE = false, opts = {}) {
    if (ORDER <= _0n$4)
        throw new Error('invalid field: expected ORDER > 0, got ' + ORDER);
    let _nbitLength = undefined;
    let _sqrt = undefined;
    if (typeof bitLenOrOpts === 'object' && bitLenOrOpts != null) {
        if (opts.sqrt || isLE)
            throw new Error('cannot specify opts in two arguments');
        const _opts = bitLenOrOpts;
        if (_opts.BITS)
            _nbitLength = _opts.BITS;
        if (_opts.sqrt)
            _sqrt = _opts.sqrt;
        if (typeof _opts.isLE === 'boolean')
            isLE = _opts.isLE;
    }
    else {
        if (typeof bitLenOrOpts === 'number')
            _nbitLength = bitLenOrOpts;
        if (opts.sqrt)
            _sqrt = opts.sqrt;
    }
    const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
    if (BYTES > 2048)
        throw new Error('invalid field: expected ORDER of <= 2048 bytes');
    let sqrtP; // cached sqrtP
    const f = Object.freeze({
        ORDER,
        isLE,
        BITS,
        BYTES,
        MASK: bitMask(BITS),
        ZERO: _0n$4,
        ONE: _1n$3,
        create: (num) => mod(num, ORDER),
        isValid: (num) => {
            if (typeof num !== 'bigint')
                throw new Error('invalid field element: expected bigint, got ' + typeof num);
            return _0n$4 <= num && num < ORDER; // 0 is valid element, but it's not invertible
        },
        is0: (num) => num === _0n$4,
        // is valid and invertible
        isValidNot0: (num) => !f.is0(num) && f.isValid(num),
        isOdd: (num) => (num & _1n$3) === _1n$3,
        neg: (num) => mod(-num, ORDER),
        eql: (lhs, rhs) => lhs === rhs,
        sqr: (num) => mod(num * num, ORDER),
        add: (lhs, rhs) => mod(lhs + rhs, ORDER),
        sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
        mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
        pow: (num, power) => FpPow(f, num, power),
        div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
        // Same as above, but doesn't normalize
        sqrN: (num) => num * num,
        addN: (lhs, rhs) => lhs + rhs,
        subN: (lhs, rhs) => lhs - rhs,
        mulN: (lhs, rhs) => lhs * rhs,
        inv: (num) => invert(num, ORDER),
        sqrt: _sqrt ||
            ((n) => {
                if (!sqrtP)
                    sqrtP = FpSqrt(ORDER);
                return sqrtP(f, n);
            }),
        toBytes: (num) => (isLE ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES)),
        fromBytes: (bytes) => {
            if (bytes.length !== BYTES)
                throw new Error('Field.fromBytes: expected ' + BYTES + ' bytes, got ' + bytes.length);
            return isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
        },
        // TODO: we don't need it here, move out to separate fn
        invertBatch: (lst) => FpInvertBatch(f, lst),
        // We can't move this out because Fp6, Fp12 implement it
        // and it's unclear what to return in there.
        cmov: (a, b, c) => (c ? b : a),
    });
    return Object.freeze(f);
}
/**
 * Returns total number of bytes consumed by the field element.
 * For example, 32 bytes for usual 256-bit weierstrass curve.
 * @param fieldOrder number of field elements, usually CURVE.n
 * @returns byte length of field
 */
function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== 'bigint')
        throw new Error('field order must be bigint');
    const bitLength = fieldOrder.toString(2).length;
    return Math.ceil(bitLength / 8);
}
/**
 * Returns minimal amount of bytes that can be safely reduced
 * by field order.
 * Should be 2^-128 for 128-bit curve such as P256.
 * @param fieldOrder number of field elements, usually CURVE.n
 * @returns byte length of target hash
 */
function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
}
/**
 * "Constant-time" private key generation utility.
 * Can take (n + n/2) or more bytes of uniform input e.g. from CSPRNG or KDF
 * and convert them into private scalar, with the modulo bias being negligible.
 * Needs at least 48 bytes of input for 32-byte private key.
 * https://research.kudelskisecurity.com/2020/07/28/the-definitive-guide-to-modulo-bias-and-how-to-avoid-it/
 * FIPS 186-5, A.2 https://csrc.nist.gov/publications/detail/fips/186/5/final
 * RFC 9380, https://www.rfc-editor.org/rfc/rfc9380#section-5
 * @param hash hash output from SHA3 or a similar function
 * @param groupOrder size of subgroup - (e.g. secp256k1.CURVE.n)
 * @param isLE interpret hash bytes as LE num
 * @returns valid private scalar
 */
function mapHashToField(key, fieldOrder, isLE = false) {
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = getMinHashLength(fieldOrder);
    // No small numbers: need to understand bias story. No huge numbers: easier to detect JS timings.
    if (len < 16 || len < minLen || len > 1024)
        throw new Error('expected ' + minLen + '-1024 bytes of input, got ' + len);
    const num = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
    // `mod(x, 11)` can sometimes produce 0. `mod(x, 10) + 1` is the same, but no 0
    const reduced = mod(num, fieldOrder - _1n$3) + _1n$3;
    return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

/**
 * Methods for elliptic curve multiplication by scalars.
 * Contains wNAF, pippenger
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const _0n$3 = BigInt(0);
const _1n$2 = BigInt(1);
function negateCt(condition, item) {
    const neg = item.negate();
    return condition ? neg : item;
}
/**
 * Takes a bunch of Projective Points but executes only one
 * inversion on all of them. Inversion is very slow operation,
 * so this improves performance massively.
 * Optimization: converts a list of projective points to a list of identical points with Z=1.
 */
function normalizeZ(c, property, points) {
    const getz = (p) => p.pz ;
    const toInv = FpInvertBatch(c.Fp, points.map(getz));
    // @ts-ignore
    const affined = points.map((p, i) => p.toAffine(toInv[i]));
    return affined.map(c.fromAffine);
}
function validateW(W, bits) {
    if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
        throw new Error('invalid window size, expected [1..' + bits + '], got W=' + W);
}
function calcWOpts(W, scalarBits) {
    validateW(W, scalarBits);
    const windows = Math.ceil(scalarBits / W) + 1; // W=8 33. Not 32, because we skip zero
    const windowSize = 2 ** (W - 1); // W=8 128. Not 256, because we skip zero
    const maxNumber = 2 ** W; // W=8 256
    const mask = bitMask(W); // W=8 255 == mask 0b11111111
    const shiftBy = BigInt(W); // W=8 8
    return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
    const { windowSize, mask, maxNumber, shiftBy } = wOpts;
    let wbits = Number(n & mask); // extract W bits.
    let nextN = n >> shiftBy; // shift number by W bits.
    // What actually happens here:
    // const highestBit = Number(mask ^ (mask >> 1n));
    // let wbits2 = wbits - 1; // skip zero
    // if (wbits2 & highestBit) { wbits2 ^= Number(mask); // (~);
    // split if bits > max: +224 => 256-32
    if (wbits > windowSize) {
        // we skip zero, which means instead of `>= size-1`, we do `> size`
        wbits -= maxNumber; // -32, can be maxNumber - wbits, but then we need to set isNeg here.
        nextN += _1n$2; // +256 (carry)
    }
    const offsetStart = window * windowSize;
    const offset = offsetStart + Math.abs(wbits) - 1; // -1 because we skip zero
    const isZero = wbits === 0; // is current window slice a 0?
    const isNeg = wbits < 0; // is current window slice negative?
    const isNegF = window % 2 !== 0; // fake random statement for noise
    const offsetF = offsetStart; // fake offset for noise
    return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
    if (!Array.isArray(points))
        throw new Error('array expected');
    points.forEach((p, i) => {
        if (!(p instanceof c))
            throw new Error('invalid point at index ' + i);
    });
}
function validateMSMScalars(scalars, field) {
    if (!Array.isArray(scalars))
        throw new Error('array of scalars expected');
    scalars.forEach((s, i) => {
        if (!field.isValid(s))
            throw new Error('invalid scalar at index ' + i);
    });
}
// Since points in different groups cannot be equal (different object constructor),
// we can have single place to store precomputes.
// Allows to make points frozen / immutable.
const pointPrecomputes = new WeakMap();
const pointWindowSizes = new WeakMap();
function getW(P) {
    return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
    if (n !== _0n$3)
        throw new Error('invalid wNAF');
}
/**
 * Elliptic curve multiplication of Point by scalar. Fragile.
 * Scalars should always be less than curve order: this should be checked inside of a curve itself.
 * Creates precomputation tables for fast multiplication:
 * - private scalar is split by fixed size windows of W bits
 * - every window point is collected from window's table & added to accumulator
 * - since windows are different, same point inside tables won't be accessed more than once per calc
 * - each multiplication is 'Math.ceil(CURVE_ORDER / 𝑊) + 1' point additions (fixed for any scalar)
 * - +1 window is neccessary for wNAF
 * - wNAF reduces table size: 2x less memory + 2x faster generation, but 10% slower multiplication
 *
 * @todo Research returning 2d JS array of windows, instead of a single window.
 * This would allow windows to be in different memory locations
 */
function wNAF(c, bits) {
    return {
        constTimeNegate: negateCt,
        hasPrecomputes(elm) {
            return getW(elm) !== 1;
        },
        // non-const time multiplication ladder
        unsafeLadder(elm, n, p = c.ZERO) {
            let d = elm;
            while (n > _0n$3) {
                if (n & _1n$2)
                    p = p.add(d);
                d = d.double();
                n >>= _1n$2;
            }
            return p;
        },
        /**
         * Creates a wNAF precomputation window. Used for caching.
         * Default window size is set by `utils.precompute()` and is equal to 8.
         * Number of precomputed points depends on the curve size:
         * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
         * - 𝑊 is the window size
         * - 𝑛 is the bitlength of the curve order.
         * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
         * @param elm Point instance
         * @param W window size
         * @returns precomputed point tables flattened to a single array
         */
        precomputeWindow(elm, W) {
            const { windows, windowSize } = calcWOpts(W, bits);
            const points = [];
            let p = elm;
            let base = p;
            for (let window = 0; window < windows; window++) {
                base = p;
                points.push(base);
                // i=1, bc we skip 0
                for (let i = 1; i < windowSize; i++) {
                    base = base.add(p);
                    points.push(base);
                }
                p = base.double();
            }
            return points;
        },
        /**
         * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
         * @param W window size
         * @param precomputes precomputed tables
         * @param n scalar (we don't check here, but should be less than curve order)
         * @returns real and fake (for const-time) points
         */
        wNAF(W, precomputes, n) {
            // Smaller version:
            // https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
            // TODO: check the scalar is less than group order?
            // wNAF behavior is undefined otherwise. But have to carefully remove
            // other checks before wNAF. ORDER == bits here.
            // Accumulators
            let p = c.ZERO;
            let f = c.BASE;
            // This code was first written with assumption that 'f' and 'p' will never be infinity point:
            // since each addition is multiplied by 2 ** W, it cannot cancel each other. However,
            // there is negate now: it is possible that negated element from low value
            // would be the same as high element, which will create carry into next window.
            // It's not obvious how this can fail, but still worth investigating later.
            const wo = calcWOpts(W, bits);
            for (let window = 0; window < wo.windows; window++) {
                // (n === _0n) is handled and not early-exited. isEven and offsetF are used for noise
                const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
                n = nextN;
                if (isZero) {
                    // bits are 0: add garbage to fake point
                    // Important part for const-time getPublicKey: add random "noise" point to f.
                    f = f.add(negateCt(isNegF, precomputes[offsetF]));
                }
                else {
                    // bits are 1: add to result point
                    p = p.add(negateCt(isNeg, precomputes[offset]));
                }
            }
            assert0(n);
            // Return both real and fake points: JIT won't eliminate f.
            // At this point there is a way to F be infinity-point even if p is not,
            // which makes it less const-time: around 1 bigint multiply.
            return { p, f };
        },
        /**
         * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
         * @param W window size
         * @param precomputes precomputed tables
         * @param n scalar (we don't check here, but should be less than curve order)
         * @param acc accumulator point to add result of multiplication
         * @returns point
         */
        wNAFUnsafe(W, precomputes, n, acc = c.ZERO) {
            const wo = calcWOpts(W, bits);
            for (let window = 0; window < wo.windows; window++) {
                if (n === _0n$3)
                    break; // Early-exit, skip 0 value
                const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
                n = nextN;
                if (isZero) {
                    // Window bits are 0: skip processing.
                    // Move to next window.
                    continue;
                }
                else {
                    const item = precomputes[offset];
                    acc = acc.add(isNeg ? item.negate() : item); // Re-using acc allows to save adds in MSM
                }
            }
            assert0(n);
            return acc;
        },
        getPrecomputes(W, P, transform) {
            // Calculate precomputes on a first run, reuse them after
            let comp = pointPrecomputes.get(P);
            if (!comp) {
                comp = this.precomputeWindow(P, W);
                if (W !== 1) {
                    // Doing transform outside of if brings 15% perf hit
                    if (typeof transform === 'function')
                        comp = transform(comp);
                    pointPrecomputes.set(P, comp);
                }
            }
            return comp;
        },
        wNAFCached(P, n, transform) {
            const W = getW(P);
            return this.wNAF(W, this.getPrecomputes(W, P, transform), n);
        },
        wNAFCachedUnsafe(P, n, transform, prev) {
            const W = getW(P);
            if (W === 1)
                return this.unsafeLadder(P, n, prev); // For W=1 ladder is ~x2 faster
            return this.wNAFUnsafe(W, this.getPrecomputes(W, P, transform), n, prev);
        },
        // We calculate precomputes for elliptic curve point multiplication
        // using windowed method. This specifies window size and
        // stores precomputed values. Usually only base point would be precomputed.
        setWindowSize(P, W) {
            validateW(W, bits);
            pointWindowSizes.set(P, W);
            pointPrecomputes.delete(P);
        },
    };
}
/**
 * Endomorphism-specific multiplication for Koblitz curves.
 * Cost: 128 dbl, 0-256 adds.
 */
function mulEndoUnsafe(c, point, k1, k2) {
    let acc = point;
    let p1 = c.ZERO;
    let p2 = c.ZERO;
    while (k1 > _0n$3 || k2 > _0n$3) {
        if (k1 & _1n$2)
            p1 = p1.add(acc);
        if (k2 & _1n$2)
            p2 = p2.add(acc);
        acc = acc.double();
        k1 >>= _1n$2;
        k2 >>= _1n$2;
    }
    return { p1, p2 };
}
/**
 * Pippenger algorithm for multi-scalar multiplication (MSM, Pa + Qb + Rc + ...).
 * 30x faster vs naive addition on L=4096, 10x faster than precomputes.
 * For N=254bit, L=1, it does: 1024 ADD + 254 DBL. For L=5: 1536 ADD + 254 DBL.
 * Algorithmically constant-time (for same L), even when 1 point + scalar, or when scalar = 0.
 * @param c Curve Point constructor
 * @param fieldN field over CURVE.N - important that it's not over CURVE.P
 * @param points array of L curve points
 * @param scalars array of L scalars (aka private keys / bigints)
 */
function pippenger(c, fieldN, points, scalars) {
    // If we split scalars by some window (let's say 8 bits), every chunk will only
    // take 256 buckets even if there are 4096 scalars, also re-uses double.
    // TODO:
    // - https://eprint.iacr.org/2024/750.pdf
    // - https://tches.iacr.org/index.php/TCHES/article/view/10287
    // 0 is accepted in scalars
    validateMSMPoints(points, c);
    validateMSMScalars(scalars, fieldN);
    const plength = points.length;
    const slength = scalars.length;
    if (plength !== slength)
        throw new Error('arrays of points and scalars must have equal length');
    // if (plength === 0) throw new Error('array must be of length >= 2');
    const zero = c.ZERO;
    const wbits = bitLen(BigInt(plength));
    let windowSize = 1; // bits
    if (wbits > 12)
        windowSize = wbits - 3;
    else if (wbits > 4)
        windowSize = wbits - 2;
    else if (wbits > 0)
        windowSize = 2;
    const MASK = bitMask(windowSize);
    const buckets = new Array(Number(MASK) + 1).fill(zero); // +1 for zero array
    const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
    let sum = zero;
    for (let i = lastBits; i >= 0; i -= windowSize) {
        buckets.fill(zero);
        for (let j = 0; j < slength; j++) {
            const scalar = scalars[j];
            const wbits = Number((scalar >> BigInt(i)) & MASK);
            buckets[wbits] = buckets[wbits].add(points[j]);
        }
        let resI = zero; // not using this will do small speed-up, but will lose ct
        // Skip first bucket, because it is zero
        for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
            sumI = sumI.add(buckets[j]);
            resI = resI.add(sumI);
        }
        sum = sum.add(resI);
        if (i !== 0)
            for (let j = 0; j < windowSize; j++)
                sum = sum.double();
    }
    return sum;
}
function createField(order, field) {
    if (field) {
        if (field.ORDER !== order)
            throw new Error('Field.ORDER must match order: Fp == p, Fn == n');
        validateField(field);
        return field;
    }
    else {
        return Field$1(order);
    }
}
/** Validates CURVE opts and creates fields */
function _createCurveFields(type, CURVE, curveOpts = {}) {
    if (!CURVE || typeof CURVE !== 'object')
        throw new Error(`expected valid ${type} CURVE object`);
    for (const p of ['p', 'n', 'h']) {
        const val = CURVE[p];
        if (!(typeof val === 'bigint' && val > _0n$3))
            throw new Error(`CURVE.${p} must be positive bigint`);
    }
    const Fp = createField(CURVE.p, curveOpts.Fp);
    const Fn = createField(CURVE.n, curveOpts.Fn);
    const _b = 'b' ;
    const params = ['Gx', 'Gy', 'a', _b];
    for (const p of params) {
        // @ts-ignore
        if (!Fp.isValid(CURVE[p]))
            throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
    }
    return { Fp, Fn };
}

/**
 * Short Weierstrass curve methods. The formula is: y² = x³ + ax + b.
 *
 * ### Design rationale for types
 *
 * * Interaction between classes from different curves should fail:
 *   `k256.Point.BASE.add(p256.Point.BASE)`
 * * For this purpose we want to use `instanceof` operator, which is fast and works during runtime
 * * Different calls of `curve()` would return different classes -
 *   `curve(params) !== curve(params)`: if somebody decided to monkey-patch their curve,
 *   it won't affect others
 *
 * TypeScript can't infer types for classes created inside a function. Classes is one instance
 * of nominative types in TypeScript and interfaces only check for shape, so it's hard to create
 * unique type for every function call.
 *
 * We can use generic types via some param, like curve opts, but that would:
 *     1. Enable interaction between `curve(params)` and `curve(params)` (curves of same params)
 *     which is hard to debug.
 *     2. Params can be generic and we can't enforce them to be constant value:
 *     if somebody creates curve from non-constant params,
 *     it would be allowed to interact with other curves with non-constant params
 *
 * @todo https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-7.html#unique-symbol
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function validateSigVerOpts(opts) {
    if (opts.lowS !== undefined)
        abool('lowS', opts.lowS);
    if (opts.prehash !== undefined)
        abool('prehash', opts.prehash);
}
class DERErr extends Error {
    constructor(m = '') {
        super(m);
    }
}
/**
 * ASN.1 DER encoding utilities. ASN is very complex & fragile. Format:
 *
 *     [0x30 (SEQUENCE), bytelength, 0x02 (INTEGER), intLength, R, 0x02 (INTEGER), intLength, S]
 *
 * Docs: https://letsencrypt.org/docs/a-warm-welcome-to-asn1-and-der/, https://luca.ntop.org/Teaching/Appunti/asn1.html
 */
const DER = {
    // asn.1 DER encoding utils
    Err: DERErr,
    // Basic building block is TLV (Tag-Length-Value)
    _tlv: {
        encode: (tag, data) => {
            const { Err: E } = DER;
            if (tag < 0 || tag > 256)
                throw new E('tlv.encode: wrong tag');
            if (data.length & 1)
                throw new E('tlv.encode: unpadded data');
            const dataLen = data.length / 2;
            const len = numberToHexUnpadded(dataLen);
            if ((len.length / 2) & 128)
                throw new E('tlv.encode: long form length too big');
            // length of length with long form flag
            const lenLen = dataLen > 127 ? numberToHexUnpadded((len.length / 2) | 128) : '';
            const t = numberToHexUnpadded(tag);
            return t + lenLen + len + data;
        },
        // v - value, l - left bytes (unparsed)
        decode(tag, data) {
            const { Err: E } = DER;
            let pos = 0;
            if (tag < 0 || tag > 256)
                throw new E('tlv.encode: wrong tag');
            if (data.length < 2 || data[pos++] !== tag)
                throw new E('tlv.decode: wrong tlv');
            const first = data[pos++];
            const isLong = !!(first & 128); // First bit of first length byte is flag for short/long form
            let length = 0;
            if (!isLong)
                length = first;
            else {
                // Long form: [longFlag(1bit), lengthLength(7bit), length (BE)]
                const lenLen = first & 127;
                if (!lenLen)
                    throw new E('tlv.decode(long): indefinite length not supported');
                if (lenLen > 4)
                    throw new E('tlv.decode(long): byte length is too big'); // this will overflow u32 in js
                const lengthBytes = data.subarray(pos, pos + lenLen);
                if (lengthBytes.length !== lenLen)
                    throw new E('tlv.decode: length bytes not complete');
                if (lengthBytes[0] === 0)
                    throw new E('tlv.decode(long): zero leftmost byte');
                for (const b of lengthBytes)
                    length = (length << 8) | b;
                pos += lenLen;
                if (length < 128)
                    throw new E('tlv.decode(long): not minimal encoding');
            }
            const v = data.subarray(pos, pos + length);
            if (v.length !== length)
                throw new E('tlv.decode: wrong value length');
            return { v, l: data.subarray(pos + length) };
        },
    },
    // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
    // since we always use positive integers here. It must always be empty:
    // - add zero byte if exists
    // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
    _int: {
        encode(num) {
            const { Err: E } = DER;
            if (num < _0n$2)
                throw new E('integer: negative integers are not allowed');
            let hex = numberToHexUnpadded(num);
            // Pad with zero byte if negative flag is present
            if (Number.parseInt(hex[0], 16) & 0b1000)
                hex = '00' + hex;
            if (hex.length & 1)
                throw new E('unexpected DER parsing assertion: unpadded hex');
            return hex;
        },
        decode(data) {
            const { Err: E } = DER;
            if (data[0] & 128)
                throw new E('invalid signature integer: negative');
            if (data[0] === 0x00 && !(data[1] & 128))
                throw new E('invalid signature integer: unnecessary leading zero');
            return bytesToNumberBE(data);
        },
    },
    toSig(hex) {
        // parse DER signature
        const { Err: E, _int: int, _tlv: tlv } = DER;
        const data = ensureBytes('signature', hex);
        const { v: seqBytes, l: seqLeftBytes } = tlv.decode(0x30, data);
        if (seqLeftBytes.length)
            throw new E('invalid signature: left bytes after parsing');
        const { v: rBytes, l: rLeftBytes } = tlv.decode(0x02, seqBytes);
        const { v: sBytes, l: sLeftBytes } = tlv.decode(0x02, rLeftBytes);
        if (sLeftBytes.length)
            throw new E('invalid signature: left bytes after parsing');
        return { r: int.decode(rBytes), s: int.decode(sBytes) };
    },
    hexFromSig(sig) {
        const { _tlv: tlv, _int: int } = DER;
        const rs = tlv.encode(0x02, int.encode(sig.r));
        const ss = tlv.encode(0x02, int.encode(sig.s));
        const seq = rs + ss;
        return tlv.encode(0x30, seq);
    },
};
// Be friendly to bad ECMAScript parsers by not using bigint literals
// prettier-ignore
const _0n$2 = BigInt(0), _1n$1 = BigInt(1), _2n$1 = BigInt(2), _3n = BigInt(3), _4n = BigInt(4);
// TODO: remove
function _legacyHelperEquat(Fp, a, b) {
    /**
     * y² = x³ + ax + b: Short weierstrass curve formula. Takes x, returns y².
     * @returns y²
     */
    function weierstrassEquation(x) {
        const x2 = Fp.sqr(x); // x * x
        const x3 = Fp.mul(x2, x); // x² * x
        return Fp.add(Fp.add(x3, Fp.mul(x, a)), b); // x³ + a * x + b
    }
    return weierstrassEquation;
}
function _legacyHelperNormPriv(Fn, allowedPrivateKeyLengths, wrapPrivateKey) {
    const { BYTES: expected } = Fn;
    // Validates if priv key is valid and converts it to bigint.
    function normPrivateKeyToScalar(key) {
        let num;
        if (typeof key === 'bigint') {
            num = key;
        }
        else {
            let bytes = ensureBytes('private key', key);
            if (allowedPrivateKeyLengths) {
                if (!allowedPrivateKeyLengths.includes(bytes.length * 2))
                    throw new Error('invalid private key');
                const padded = new Uint8Array(expected);
                padded.set(bytes, padded.length - bytes.length);
                bytes = padded;
            }
            try {
                num = Fn.fromBytes(bytes);
            }
            catch (error) {
                throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
            }
        }
        if (wrapPrivateKey)
            num = Fn.create(num); // disabled by default, enabled for BLS
        if (!Fn.isValidNot0(num))
            throw new Error('invalid private key: out of range [1..N-1]');
        return num;
    }
    return normPrivateKeyToScalar;
}
function weierstrassN(CURVE, curveOpts = {}) {
    const { Fp, Fn } = _createCurveFields('weierstrass', CURVE, curveOpts);
    const { h: cofactor, n: CURVE_ORDER } = CURVE;
    _validateObject(curveOpts, {}, {
        allowInfinityPoint: 'boolean',
        clearCofactor: 'function',
        isTorsionFree: 'function',
        fromBytes: 'function',
        toBytes: 'function',
        endo: 'object',
        wrapPrivateKey: 'boolean',
    });
    const { endo } = curveOpts;
    if (endo) {
        // validateObject(endo, { beta: 'bigint', splitScalar: 'function' });
        if (!Fp.is0(CURVE.a) ||
            typeof endo.beta !== 'bigint' ||
            typeof endo.splitScalar !== 'function') {
            throw new Error('invalid endo: expected "beta": bigint and "splitScalar": function');
        }
    }
    function assertCompressionIsSupported() {
        if (!Fp.isOdd)
            throw new Error('compression is not supported: Field does not have .isOdd()');
    }
    // Implements IEEE P1363 point encoding
    function pointToBytes(_c, point, isCompressed) {
        const { x, y } = point.toAffine();
        const bx = Fp.toBytes(x);
        abool('isCompressed', isCompressed);
        if (isCompressed) {
            assertCompressionIsSupported();
            const hasEvenY = !Fp.isOdd(y);
            return concatBytes$2(pprefix(hasEvenY), bx);
        }
        else {
            return concatBytes$2(Uint8Array.of(0x04), bx, Fp.toBytes(y));
        }
    }
    function pointFromBytes(bytes) {
        abytes$1(bytes);
        const L = Fp.BYTES;
        const LC = L + 1; // length compressed, e.g. 33 for 32-byte field
        const LU = 2 * L + 1; // length uncompressed, e.g. 65 for 32-byte field
        const length = bytes.length;
        const head = bytes[0];
        const tail = bytes.subarray(1);
        // No actual validation is done here: use .assertValidity()
        if (length === LC && (head === 0x02 || head === 0x03)) {
            const x = Fp.fromBytes(tail);
            if (!Fp.isValid(x))
                throw new Error('bad point: is not on curve, wrong x');
            const y2 = weierstrassEquation(x); // y² = x³ + ax + b
            let y;
            try {
                y = Fp.sqrt(y2); // y = y² ^ (p+1)/4
            }
            catch (sqrtError) {
                const err = sqrtError instanceof Error ? ': ' + sqrtError.message : '';
                throw new Error('bad point: is not on curve, sqrt error' + err);
            }
            assertCompressionIsSupported();
            const isYOdd = Fp.isOdd(y); // (y & _1n) === _1n;
            const isHeadOdd = (head & 1) === 1; // ECDSA-specific
            if (isHeadOdd !== isYOdd)
                y = Fp.neg(y);
            return { x, y };
        }
        else if (length === LU && head === 0x04) {
            // TODO: more checks
            const x = Fp.fromBytes(tail.subarray(L * 0, L * 1));
            const y = Fp.fromBytes(tail.subarray(L * 1, L * 2));
            if (!isValidXY(x, y))
                throw new Error('bad point: is not on curve');
            return { x, y };
        }
        else {
            throw new Error(`bad point: got length ${length}, expected compressed=${LC} or uncompressed=${LU}`);
        }
    }
    const toBytes = curveOpts.toBytes || pointToBytes;
    const fromBytes = curveOpts.fromBytes || pointFromBytes;
    const weierstrassEquation = _legacyHelperEquat(Fp, CURVE.a, CURVE.b);
    // TODO: move top-level
    /** Checks whether equation holds for given x, y: y² == x³ + ax + b */
    function isValidXY(x, y) {
        const left = Fp.sqr(y); // y²
        const right = weierstrassEquation(x); // x³ + ax + b
        return Fp.eql(left, right);
    }
    // Validate whether the passed curve params are valid.
    // Test 1: equation y² = x³ + ax + b should work for generator point.
    if (!isValidXY(CURVE.Gx, CURVE.Gy))
        throw new Error('bad curve params: generator point');
    // Test 2: discriminant Δ part should be non-zero: 4a³ + 27b² != 0.
    // Guarantees curve is genus-1, smooth (non-singular).
    const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n), _4n);
    const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
    if (Fp.is0(Fp.add(_4a3, _27b2)))
        throw new Error('bad curve params: a or b');
    /** Asserts coordinate is valid: 0 <= n < Fp.ORDER. */
    function acoord(title, n, banZero = false) {
        if (!Fp.isValid(n) || (banZero && Fp.is0(n)))
            throw new Error(`bad point coordinate ${title}`);
        return n;
    }
    function aprjpoint(other) {
        if (!(other instanceof Point))
            throw new Error('ProjectivePoint expected');
    }
    // Memoized toAffine / validity check. They are heavy. Points are immutable.
    // Converts Projective point to affine (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    // (X, Y, Z) ∋ (x=X/Z, y=Y/Z)
    const toAffineMemo = memoized((p, iz) => {
        const { px: x, py: y, pz: z } = p;
        // Fast-path for normalized points
        if (Fp.eql(z, Fp.ONE))
            return { x, y };
        const is0 = p.is0();
        // If invZ was 0, we return zero point. However we still want to execute
        // all operations, so we replace invZ with a random number, 1.
        if (iz == null)
            iz = is0 ? Fp.ONE : Fp.inv(z);
        const ax = Fp.mul(x, iz);
        const ay = Fp.mul(y, iz);
        const zz = Fp.mul(z, iz);
        if (is0)
            return { x: Fp.ZERO, y: Fp.ZERO };
        if (!Fp.eql(zz, Fp.ONE))
            throw new Error('invZ was invalid');
        return { x: ax, y: ay };
    });
    // NOTE: on exception this will crash 'cached' and no value will be set.
    // Otherwise true will be return
    const assertValidMemo = memoized((p) => {
        if (p.is0()) {
            // (0, 1, 0) aka ZERO is invalid in most contexts.
            // In BLS, ZERO can be serialized, so we allow it.
            // (0, 0, 0) is invalid representation of ZERO.
            if (curveOpts.allowInfinityPoint && !Fp.is0(p.py))
                return;
            throw new Error('bad point: ZERO');
        }
        // Some 3rd-party test vectors require different wording between here & `fromCompressedHex`
        const { x, y } = p.toAffine();
        if (!Fp.isValid(x) || !Fp.isValid(y))
            throw new Error('bad point: x or y not field elements');
        if (!isValidXY(x, y))
            throw new Error('bad point: equation left != right');
        if (!p.isTorsionFree())
            throw new Error('bad point: not in prime-order subgroup');
        return true;
    });
    function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
        k2p = new Point(Fp.mul(k2p.px, endoBeta), k2p.py, k2p.pz);
        k1p = negateCt(k1neg, k1p);
        k2p = negateCt(k2neg, k2p);
        return k1p.add(k2p);
    }
    /**
     * Projective Point works in 3d / projective (homogeneous) coordinates:(X, Y, Z) ∋ (x=X/Z, y=Y/Z).
     * Default Point works in 2d / affine coordinates: (x, y).
     * We're doing calculations in projective, because its operations don't require costly inversion.
     */
    class Point {
        /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
        constructor(px, py, pz) {
            this.px = acoord('x', px);
            this.py = acoord('y', py, true);
            this.pz = acoord('z', pz);
            Object.freeze(this);
        }
        /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
        static fromAffine(p) {
            const { x, y } = p || {};
            if (!p || !Fp.isValid(x) || !Fp.isValid(y))
                throw new Error('invalid affine point');
            if (p instanceof Point)
                throw new Error('projective point not allowed');
            // (0, 0) would've produced (0, 0, 1) - instead, we need (0, 1, 0)
            if (Fp.is0(x) && Fp.is0(y))
                return Point.ZERO;
            return new Point(x, y, Fp.ONE);
        }
        get x() {
            return this.toAffine().x;
        }
        get y() {
            return this.toAffine().y;
        }
        static normalizeZ(points) {
            return normalizeZ(Point, 'pz', points);
        }
        static fromBytes(bytes) {
            abytes$1(bytes);
            return Point.fromHex(bytes);
        }
        /** Converts hash string or Uint8Array to Point. */
        static fromHex(hex) {
            const P = Point.fromAffine(fromBytes(ensureBytes('pointHex', hex)));
            P.assertValidity();
            return P;
        }
        /** Multiplies generator point by privateKey. */
        static fromPrivateKey(privateKey) {
            const normPrivateKeyToScalar = _legacyHelperNormPriv(Fn, curveOpts.allowedPrivateKeyLengths, curveOpts.wrapPrivateKey);
            return Point.BASE.multiply(normPrivateKeyToScalar(privateKey));
        }
        /** Multiscalar Multiplication */
        static msm(points, scalars) {
            return pippenger(Point, Fn, points, scalars);
        }
        /**
         *
         * @param windowSize
         * @param isLazy true will defer table computation until the first multiplication
         * @returns
         */
        precompute(windowSize = 8, isLazy = true) {
            wnaf.setWindowSize(this, windowSize);
            if (!isLazy)
                this.multiply(_3n); // random number
            return this;
        }
        /** "Private method", don't use it directly */
        _setWindowSize(windowSize) {
            this.precompute(windowSize);
        }
        // TODO: return `this`
        /** A point on curve is valid if it conforms to equation. */
        assertValidity() {
            assertValidMemo(this);
        }
        hasEvenY() {
            const { y } = this.toAffine();
            if (!Fp.isOdd)
                throw new Error("Field doesn't support isOdd");
            return !Fp.isOdd(y);
        }
        /** Compare one point to another. */
        equals(other) {
            aprjpoint(other);
            const { px: X1, py: Y1, pz: Z1 } = this;
            const { px: X2, py: Y2, pz: Z2 } = other;
            const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
            const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
            return U1 && U2;
        }
        /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
        negate() {
            return new Point(this.px, Fp.neg(this.py), this.pz);
        }
        // Renes-Costello-Batina exception-free doubling formula.
        // There is 30% faster Jacobian formula, but it is not complete.
        // https://eprint.iacr.org/2015/1060, algorithm 3
        // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
        double() {
            const { a, b } = CURVE;
            const b3 = Fp.mul(b, _3n);
            const { px: X1, py: Y1, pz: Z1 } = this;
            let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
            let t0 = Fp.mul(X1, X1); // step 1
            let t1 = Fp.mul(Y1, Y1);
            let t2 = Fp.mul(Z1, Z1);
            let t3 = Fp.mul(X1, Y1);
            t3 = Fp.add(t3, t3); // step 5
            Z3 = Fp.mul(X1, Z1);
            Z3 = Fp.add(Z3, Z3);
            X3 = Fp.mul(a, Z3);
            Y3 = Fp.mul(b3, t2);
            Y3 = Fp.add(X3, Y3); // step 10
            X3 = Fp.sub(t1, Y3);
            Y3 = Fp.add(t1, Y3);
            Y3 = Fp.mul(X3, Y3);
            X3 = Fp.mul(t3, X3);
            Z3 = Fp.mul(b3, Z3); // step 15
            t2 = Fp.mul(a, t2);
            t3 = Fp.sub(t0, t2);
            t3 = Fp.mul(a, t3);
            t3 = Fp.add(t3, Z3);
            Z3 = Fp.add(t0, t0); // step 20
            t0 = Fp.add(Z3, t0);
            t0 = Fp.add(t0, t2);
            t0 = Fp.mul(t0, t3);
            Y3 = Fp.add(Y3, t0);
            t2 = Fp.mul(Y1, Z1); // step 25
            t2 = Fp.add(t2, t2);
            t0 = Fp.mul(t2, t3);
            X3 = Fp.sub(X3, t0);
            Z3 = Fp.mul(t2, t1);
            Z3 = Fp.add(Z3, Z3); // step 30
            Z3 = Fp.add(Z3, Z3);
            return new Point(X3, Y3, Z3);
        }
        // Renes-Costello-Batina exception-free addition formula.
        // There is 30% faster Jacobian formula, but it is not complete.
        // https://eprint.iacr.org/2015/1060, algorithm 1
        // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
        add(other) {
            aprjpoint(other);
            const { px: X1, py: Y1, pz: Z1 } = this;
            const { px: X2, py: Y2, pz: Z2 } = other;
            let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
            const a = CURVE.a;
            const b3 = Fp.mul(CURVE.b, _3n);
            let t0 = Fp.mul(X1, X2); // step 1
            let t1 = Fp.mul(Y1, Y2);
            let t2 = Fp.mul(Z1, Z2);
            let t3 = Fp.add(X1, Y1);
            let t4 = Fp.add(X2, Y2); // step 5
            t3 = Fp.mul(t3, t4);
            t4 = Fp.add(t0, t1);
            t3 = Fp.sub(t3, t4);
            t4 = Fp.add(X1, Z1);
            let t5 = Fp.add(X2, Z2); // step 10
            t4 = Fp.mul(t4, t5);
            t5 = Fp.add(t0, t2);
            t4 = Fp.sub(t4, t5);
            t5 = Fp.add(Y1, Z1);
            X3 = Fp.add(Y2, Z2); // step 15
            t5 = Fp.mul(t5, X3);
            X3 = Fp.add(t1, t2);
            t5 = Fp.sub(t5, X3);
            Z3 = Fp.mul(a, t4);
            X3 = Fp.mul(b3, t2); // step 20
            Z3 = Fp.add(X3, Z3);
            X3 = Fp.sub(t1, Z3);
            Z3 = Fp.add(t1, Z3);
            Y3 = Fp.mul(X3, Z3);
            t1 = Fp.add(t0, t0); // step 25
            t1 = Fp.add(t1, t0);
            t2 = Fp.mul(a, t2);
            t4 = Fp.mul(b3, t4);
            t1 = Fp.add(t1, t2);
            t2 = Fp.sub(t0, t2); // step 30
            t2 = Fp.mul(a, t2);
            t4 = Fp.add(t4, t2);
            t0 = Fp.mul(t1, t4);
            Y3 = Fp.add(Y3, t0);
            t0 = Fp.mul(t5, t4); // step 35
            X3 = Fp.mul(t3, X3);
            X3 = Fp.sub(X3, t0);
            t0 = Fp.mul(t3, t1);
            Z3 = Fp.mul(t5, Z3);
            Z3 = Fp.add(Z3, t0); // step 40
            return new Point(X3, Y3, Z3);
        }
        subtract(other) {
            return this.add(other.negate());
        }
        is0() {
            return this.equals(Point.ZERO);
        }
        /**
         * Constant time multiplication.
         * Uses wNAF method. Windowed method may be 10% faster,
         * but takes 2x longer to generate and consumes 2x memory.
         * Uses precomputes when available.
         * Uses endomorphism for Koblitz curves.
         * @param scalar by which the point would be multiplied
         * @returns New point
         */
        multiply(scalar) {
            const { endo } = curveOpts;
            if (!Fn.isValidNot0(scalar))
                throw new Error('invalid scalar: out of range'); // 0 is invalid
            let point, fake; // Fake point is used to const-time mult
            const mul = (n) => wnaf.wNAFCached(this, n, Point.normalizeZ);
            /** See docs for {@link EndomorphismOpts} */
            if (endo) {
                const { k1neg, k1, k2neg, k2 } = endo.splitScalar(scalar);
                const { p: k1p, f: k1f } = mul(k1);
                const { p: k2p, f: k2f } = mul(k2);
                fake = k1f.add(k2f);
                point = finishEndo(endo.beta, k1p, k2p, k1neg, k2neg);
            }
            else {
                const { p, f } = mul(scalar);
                point = p;
                fake = f;
            }
            // Normalize `z` for both points, but return only real one
            return Point.normalizeZ([point, fake])[0];
        }
        /**
         * Non-constant-time multiplication. Uses double-and-add algorithm.
         * It's faster, but should only be used when you don't care about
         * an exposed private key e.g. sig verification, which works over *public* keys.
         */
        multiplyUnsafe(sc) {
            const { endo } = curveOpts;
            const p = this;
            if (!Fn.isValid(sc))
                throw new Error('invalid scalar: out of range'); // 0 is valid
            if (sc === _0n$2 || p.is0())
                return Point.ZERO;
            if (sc === _1n$1)
                return p; // fast-path
            if (wnaf.hasPrecomputes(this))
                return this.multiply(sc);
            if (endo) {
                const { k1neg, k1, k2neg, k2 } = endo.splitScalar(sc);
                // `wNAFCachedUnsafe` is 30% slower
                const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
                return finishEndo(endo.beta, p1, p2, k1neg, k2neg);
            }
            else {
                return wnaf.wNAFCachedUnsafe(p, sc);
            }
        }
        multiplyAndAddUnsafe(Q, a, b) {
            const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
            return sum.is0() ? undefined : sum;
        }
        /**
         * Converts Projective point to affine (x, y) coordinates.
         * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
         */
        toAffine(invertedZ) {
            return toAffineMemo(this, invertedZ);
        }
        /**
         * Checks whether Point is free of torsion elements (is in prime subgroup).
         * Always torsion-free for cofactor=1 curves.
         */
        isTorsionFree() {
            const { isTorsionFree } = curveOpts;
            if (cofactor === _1n$1)
                return true;
            if (isTorsionFree)
                return isTorsionFree(Point, this);
            return wnaf.wNAFCachedUnsafe(this, CURVE_ORDER).is0();
        }
        clearCofactor() {
            const { clearCofactor } = curveOpts;
            if (cofactor === _1n$1)
                return this; // Fast-path
            if (clearCofactor)
                return clearCofactor(Point, this);
            return this.multiplyUnsafe(cofactor);
        }
        toBytes(isCompressed = true) {
            abool('isCompressed', isCompressed);
            this.assertValidity();
            return toBytes(Point, this, isCompressed);
        }
        /** @deprecated use `toBytes` */
        toRawBytes(isCompressed = true) {
            return this.toBytes(isCompressed);
        }
        toHex(isCompressed = true) {
            return bytesToHex$1(this.toBytes(isCompressed));
        }
        toString() {
            return `<Point ${this.is0() ? 'ZERO' : this.toHex()}>`;
        }
    }
    // base / generator point
    Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
    // zero / infinity / identity point
    Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO); // 0, 1, 0
    // fields
    Point.Fp = Fp;
    Point.Fn = Fn;
    const bits = Fn.BITS;
    const wnaf = wNAF(Point, curveOpts.endo ? Math.ceil(bits / 2) : bits);
    return Point;
}
// Points start with byte 0x02 when y is even; otherwise 0x03
function pprefix(hasEvenY) {
    return Uint8Array.of(hasEvenY ? 0x02 : 0x03);
}
function ecdsa(Point, ecdsaOpts, curveOpts = {}) {
    _validateObject(ecdsaOpts, { hash: 'function' }, {
        hmac: 'function',
        lowS: 'boolean',
        randomBytes: 'function',
        bits2int: 'function',
        bits2int_modN: 'function',
    });
    const randomBytes_ = ecdsaOpts.randomBytes || randomBytes;
    const hmac_ = ecdsaOpts.hmac ||
        ((key, ...msgs) => hmac(ecdsaOpts.hash, key, concatBytes$2(...msgs)));
    const { Fp, Fn } = Point;
    const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
    function isBiggerThanHalfOrder(number) {
        const HALF = CURVE_ORDER >> _1n$1;
        return number > HALF;
    }
    function normalizeS(s) {
        return isBiggerThanHalfOrder(s) ? Fn.neg(s) : s;
    }
    function aValidRS(title, num) {
        if (!Fn.isValidNot0(num))
            throw new Error(`invalid signature ${title}: out of range 1..CURVE.n`);
    }
    /**
     * ECDSA signature with its (r, s) properties. Supports DER & compact representations.
     */
    class Signature {
        constructor(r, s, recovery) {
            aValidRS('r', r); // r in [1..N-1]
            aValidRS('s', s); // s in [1..N-1]
            this.r = r;
            this.s = s;
            if (recovery != null)
                this.recovery = recovery;
            Object.freeze(this);
        }
        // pair (bytes of r, bytes of s)
        static fromCompact(hex) {
            const L = Fn.BYTES;
            const b = ensureBytes('compactSignature', hex, L * 2);
            return new Signature(Fn.fromBytes(b.subarray(0, L)), Fn.fromBytes(b.subarray(L, L * 2)));
        }
        // DER encoded ECDSA signature
        // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
        static fromDER(hex) {
            const { r, s } = DER.toSig(ensureBytes('DER', hex));
            return new Signature(r, s);
        }
        /**
         * @todo remove
         * @deprecated
         */
        assertValidity() { }
        addRecoveryBit(recovery) {
            return new Signature(this.r, this.s, recovery);
        }
        // ProjPointType<bigint>
        recoverPublicKey(msgHash) {
            const FIELD_ORDER = Fp.ORDER;
            const { r, s, recovery: rec } = this;
            if (rec == null || ![0, 1, 2, 3].includes(rec))
                throw new Error('recovery id invalid');
            // ECDSA recovery is hard for cofactor > 1 curves.
            // In sign, `r = q.x mod n`, and here we recover q.x from r.
            // While recovering q.x >= n, we need to add r+n for cofactor=1 curves.
            // However, for cofactor>1, r+n may not get q.x:
            // r+n*i would need to be done instead where i is unknown.
            // To easily get i, we either need to:
            // a. increase amount of valid recid values (4, 5...); OR
            // b. prohibit non-prime-order signatures (recid > 1).
            const hasCofactor = CURVE_ORDER * _2n$1 < FIELD_ORDER;
            if (hasCofactor && rec > 1)
                throw new Error('recovery id is ambiguous for h>1 curve');
            const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
            if (!Fp.isValid(radj))
                throw new Error('recovery id 2 or 3 invalid');
            const x = Fp.toBytes(radj);
            const R = Point.fromHex(concatBytes$2(pprefix((rec & 1) === 0), x));
            const ir = Fn.inv(radj); // r^-1
            const h = bits2int_modN(ensureBytes('msgHash', msgHash)); // Truncate hash
            const u1 = Fn.create(-h * ir); // -hr^-1
            const u2 = Fn.create(s * ir); // sr^-1
            // (sr^-1)R-(hr^-1)G = -(hr^-1)G + (sr^-1). unsafe is fine: there is no private data.
            const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
            if (Q.is0())
                throw new Error('point at infinify');
            Q.assertValidity();
            return Q;
        }
        // Signatures should be low-s, to prevent malleability.
        hasHighS() {
            return isBiggerThanHalfOrder(this.s);
        }
        normalizeS() {
            return this.hasHighS() ? new Signature(this.r, Fn.neg(this.s), this.recovery) : this;
        }
        toBytes(format) {
            if (format === 'compact')
                return concatBytes$2(Fn.toBytes(this.r), Fn.toBytes(this.s));
            if (format === 'der')
                return hexToBytes$1(DER.hexFromSig(this));
            throw new Error('invalid format');
        }
        // DER-encoded
        toDERRawBytes() {
            return this.toBytes('der');
        }
        toDERHex() {
            return bytesToHex$1(this.toBytes('der'));
        }
        // padded bytes of r, then padded bytes of s
        toCompactRawBytes() {
            return this.toBytes('compact');
        }
        toCompactHex() {
            return bytesToHex$1(this.toBytes('compact'));
        }
    }
    const normPrivateKeyToScalar = _legacyHelperNormPriv(Fn, curveOpts.allowedPrivateKeyLengths, curveOpts.wrapPrivateKey);
    const utils = {
        isValidPrivateKey(privateKey) {
            try {
                normPrivateKeyToScalar(privateKey);
                return true;
            }
            catch (error) {
                return false;
            }
        },
        normPrivateKeyToScalar: normPrivateKeyToScalar,
        /**
         * Produces cryptographically secure private key from random of size
         * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
         */
        randomPrivateKey: () => {
            const n = CURVE_ORDER;
            return mapHashToField(randomBytes_(getMinHashLength(n)), n);
        },
        precompute(windowSize = 8, point = Point.BASE) {
            return point.precompute(windowSize, false);
        },
    };
    /**
     * Computes public key for a private key. Checks for validity of the private key.
     * @param privateKey private key
     * @param isCompressed whether to return compact (default), or full key
     * @returns Public key, full when isCompressed=false; short when isCompressed=true
     */
    function getPublicKey(privateKey, isCompressed = true) {
        return Point.fromPrivateKey(privateKey).toBytes(isCompressed);
    }
    /**
     * Quick and dirty check for item being public key. Does not validate hex, or being on-curve.
     */
    function isProbPub(item) {
        if (typeof item === 'bigint')
            return false;
        if (item instanceof Point)
            return true;
        const arr = ensureBytes('key', item);
        const length = arr.length;
        const L = Fp.BYTES;
        const LC = L + 1; // e.g. 33 for 32
        const LU = 2 * L + 1; // e.g. 65 for 32
        if (curveOpts.allowedPrivateKeyLengths || Fn.BYTES === LC) {
            return undefined;
        }
        else {
            return length === LC || length === LU;
        }
    }
    /**
     * ECDH (Elliptic Curve Diffie Hellman).
     * Computes shared public key from private key and public key.
     * Checks: 1) private key validity 2) shared key is on-curve.
     * Does NOT hash the result.
     * @param privateA private key
     * @param publicB different public key
     * @param isCompressed whether to return compact (default), or full key
     * @returns shared public key
     */
    function getSharedSecret(privateA, publicB, isCompressed = true) {
        if (isProbPub(privateA) === true)
            throw new Error('first arg must be private key');
        if (isProbPub(publicB) === false)
            throw new Error('second arg must be public key');
        const b = Point.fromHex(publicB); // check for being on-curve
        return b.multiply(normPrivateKeyToScalar(privateA)).toBytes(isCompressed);
    }
    // RFC6979: ensure ECDSA msg is X bytes and < N. RFC suggests optional truncating via bits2octets.
    // FIPS 186-4 4.6 suggests the leftmost min(nBitLen, outLen) bits, which matches bits2int.
    // bits2int can produce res>N, we can do mod(res, N) since the bitLen is the same.
    // int2octets can't be used; pads small msgs with 0: unacceptatble for trunc as per RFC vectors
    const bits2int = ecdsaOpts.bits2int ||
        function (bytes) {
            // Our custom check "just in case", for protection against DoS
            if (bytes.length > 8192)
                throw new Error('input is too large');
            // For curves with nBitLength % 8 !== 0: bits2octets(bits2octets(m)) !== bits2octets(m)
            // for some cases, since bytes.length * 8 is not actual bitLength.
            const num = bytesToNumberBE(bytes); // check for == u8 done here
            const delta = bytes.length * 8 - fnBits; // truncate to nBitLength leftmost bits
            return delta > 0 ? num >> BigInt(delta) : num;
        };
    const bits2int_modN = ecdsaOpts.bits2int_modN ||
        function (bytes) {
            return Fn.create(bits2int(bytes)); // can't use bytesToNumberBE here
        };
    // NOTE: pads output with zero as per spec
    const ORDER_MASK = bitMask(fnBits);
    /**
     * Converts to bytes. Checks if num in `[0..ORDER_MASK-1]` e.g.: `[0..2^256-1]`.
     */
    function int2octets(num) {
        // IMPORTANT: the check ensures working for case `Fn.BYTES != Fn.BITS * 8`
        aInRange('num < 2^' + fnBits, num, _0n$2, ORDER_MASK);
        return Fn.toBytes(num);
    }
    // Steps A, D of RFC6979 3.2
    // Creates RFC6979 seed; converts msg/privKey to numbers.
    // Used only in sign, not in verify.
    // NOTE: we cannot assume here that msgHash has same amount of bytes as curve order,
    // this will be invalid at least for P521. Also it can be bigger for P224 + SHA256
    function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
        if (['recovered', 'canonical'].some((k) => k in opts))
            throw new Error('sign() legacy options not supported');
        const { hash } = ecdsaOpts;
        let { lowS, prehash, extraEntropy: ent } = opts; // generates low-s sigs by default
        if (lowS == null)
            lowS = true; // RFC6979 3.2: we skip step A, because we already provide hash
        msgHash = ensureBytes('msgHash', msgHash);
        validateSigVerOpts(opts);
        if (prehash)
            msgHash = ensureBytes('prehashed msgHash', hash(msgHash));
        // We can't later call bits2octets, since nested bits2int is broken for curves
        // with fnBits % 8 !== 0. Because of that, we unwrap it here as int2octets call.
        // const bits2octets = (bits) => int2octets(bits2int_modN(bits))
        const h1int = bits2int_modN(msgHash);
        const d = normPrivateKeyToScalar(privateKey); // validate private key, convert to bigint
        const seedArgs = [int2octets(d), int2octets(h1int)];
        // extraEntropy. RFC6979 3.6: additional k' (optional).
        if (ent != null && ent !== false) {
            // K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1) || k')
            const e = ent === true ? randomBytes_(Fp.BYTES) : ent; // generate random bytes OR pass as-is
            seedArgs.push(ensureBytes('extraEntropy', e)); // check for being bytes
        }
        const seed = concatBytes$2(...seedArgs); // Step D of RFC6979 3.2
        const m = h1int; // NOTE: no need to call bits2int second time here, it is inside truncateHash!
        // Converts signature params into point w r/s, checks result for validity.
        // Can use scalar blinding b^-1(bm + bdr) where b ∈ [1,q−1] according to
        // https://tches.iacr.org/index.php/TCHES/article/view/7337/6509. We've decided against it:
        // a) dependency on CSPRNG b) 15% slowdown c) doesn't really help since bigints are not CT
        function k2sig(kBytes) {
            // RFC 6979 Section 3.2, step 3: k = bits2int(T)
            // Important: all mod() calls here must be done over N
            const k = bits2int(kBytes); // Cannot use fields methods, since it is group element
            if (!Fn.isValidNot0(k))
                return; // Valid scalars (including k) must be in 1..N-1
            const ik = Fn.inv(k); // k^-1 mod n
            const q = Point.BASE.multiply(k).toAffine(); // q = Gk
            const r = Fn.create(q.x); // r = q.x mod n
            if (r === _0n$2)
                return;
            const s = Fn.create(ik * Fn.create(m + r * d)); // Not using blinding here, see comment above
            if (s === _0n$2)
                return;
            let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n$1); // recovery bit (2 or 3, when q.x > n)
            let normS = s;
            if (lowS && isBiggerThanHalfOrder(s)) {
                normS = normalizeS(s); // if lowS was passed, ensure s is always
                recovery ^= 1; // // in the bottom half of N
            }
            return new Signature(r, normS, recovery); // use normS, not s
        }
        return { seed, k2sig };
    }
    const defaultSigOpts = { lowS: ecdsaOpts.lowS, prehash: false };
    const defaultVerOpts = { lowS: ecdsaOpts.lowS, prehash: false };
    /**
     * Signs message hash with a private key.
     * ```
     * sign(m, d, k) where
     *   (x, y) = G × k
     *   r = x mod n
     *   s = (m + dr)/k mod n
     * ```
     * @param msgHash NOT message. msg needs to be hashed to `msgHash`, or use `prehash`.
     * @param privKey private key
     * @param opts lowS for non-malleable sigs. extraEntropy for mixing randomness into k. prehash will hash first arg.
     * @returns signature with recovery param
     */
    function sign(msgHash, privKey, opts = defaultSigOpts) {
        const { seed, k2sig } = prepSig(msgHash, privKey, opts); // Steps A, D of RFC6979 3.2.
        const drbg = createHmacDrbg(ecdsaOpts.hash.outputLen, Fn.BYTES, hmac_);
        return drbg(seed, k2sig); // Steps B, C, D, E, F, G
    }
    // Enable precomputes. Slows down first publicKey computation by 20ms.
    Point.BASE.precompute(8);
    /**
     * Verifies a signature against message hash and public key.
     * Rejects lowS signatures by default: to override,
     * specify option `{lowS: false}`. Implements section 4.1.4 from https://www.secg.org/sec1-v2.pdf:
     *
     * ```
     * verify(r, s, h, P) where
     *   U1 = hs^-1 mod n
     *   U2 = rs^-1 mod n
     *   R = U1⋅G - U2⋅P
     *   mod(R.x, n) == r
     * ```
     */
    function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
        const sg = signature;
        msgHash = ensureBytes('msgHash', msgHash);
        publicKey = ensureBytes('publicKey', publicKey);
        // Verify opts
        validateSigVerOpts(opts);
        const { lowS, prehash, format } = opts;
        // TODO: remove
        if ('strict' in opts)
            throw new Error('options.strict was renamed to lowS');
        if (format !== undefined && !['compact', 'der', 'js'].includes(format))
            throw new Error('format must be "compact", "der" or "js"');
        const isHex = typeof sg === 'string' || isBytes$3(sg);
        const isObj = !isHex &&
            !format &&
            typeof sg === 'object' &&
            sg !== null &&
            typeof sg.r === 'bigint' &&
            typeof sg.s === 'bigint';
        if (!isHex && !isObj)
            throw new Error('invalid signature, expected Uint8Array, hex string or Signature instance');
        let _sig = undefined;
        let P;
        // deduce signature format
        try {
            // if (format === 'js') {
            //   if (sg != null && !isBytes(sg)) _sig = new Signature(sg.r, sg.s);
            // } else if (format === 'compact') {
            //   _sig = Signature.fromCompact(sg);
            // } else if (format === 'der') {
            //   _sig = Signature.fromDER(sg);
            // } else {
            //   throw new Error('invalid format');
            // }
            if (isObj) {
                if (format === undefined || format === 'js') {
                    _sig = new Signature(sg.r, sg.s);
                }
                else {
                    throw new Error('invalid format');
                }
            }
            if (isHex) {
                // TODO: remove this malleable check
                // Signature can be represented in 2 ways: compact (2*Fn.BYTES) & DER (variable-length).
                // Since DER can also be 2*Fn.BYTES bytes, we check for it first.
                try {
                    if (format !== 'compact')
                        _sig = Signature.fromDER(sg);
                }
                catch (derError) {
                    if (!(derError instanceof DER.Err))
                        throw derError;
                }
                if (!_sig && format !== 'der')
                    _sig = Signature.fromCompact(sg);
            }
            P = Point.fromHex(publicKey);
        }
        catch (error) {
            return false;
        }
        if (!_sig)
            return false;
        if (lowS && _sig.hasHighS())
            return false;
        // todo: optional.hash => hash
        if (prehash)
            msgHash = ecdsaOpts.hash(msgHash);
        const { r, s } = _sig;
        const h = bits2int_modN(msgHash); // Cannot use fields methods, since it is group element
        const is = Fn.inv(s); // s^-1
        const u1 = Fn.create(h * is); // u1 = hs^-1 mod n
        const u2 = Fn.create(r * is); // u2 = rs^-1 mod n
        const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
        if (R.is0())
            return false;
        const v = Fn.create(R.x); // v = r.x mod n
        return v === r;
    }
    // TODO: clarify API for cloning .clone({hash: sha512}) ? .createWith({hash: sha512})?
    // const clone = (hash: CHash): ECDSA => ecdsa(Point, { ...ecdsaOpts, ...getHash(hash) }, curveOpts);
    return Object.freeze({
        getPublicKey,
        getSharedSecret,
        sign,
        verify,
        utils,
        Point,
        Signature,
    });
}
function _weierstrass_legacy_opts_to_new(c) {
    const CURVE = {
        a: c.a,
        b: c.b,
        p: c.Fp.ORDER,
        n: c.n,
        h: c.h,
        Gx: c.Gx,
        Gy: c.Gy,
    };
    const Fp = c.Fp;
    const Fn = Field$1(CURVE.n, c.nBitLength);
    const curveOpts = {
        Fp,
        Fn,
        allowedPrivateKeyLengths: c.allowedPrivateKeyLengths,
        allowInfinityPoint: c.allowInfinityPoint,
        endo: c.endo,
        wrapPrivateKey: c.wrapPrivateKey,
        isTorsionFree: c.isTorsionFree,
        clearCofactor: c.clearCofactor,
        fromBytes: c.fromBytes,
        toBytes: c.toBytes,
    };
    return { CURVE, curveOpts };
}
function _ecdsa_legacy_opts_to_new(c) {
    const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
    const ecdsaOpts = {
        hash: c.hash,
        hmac: c.hmac,
        randomBytes: c.randomBytes,
        lowS: c.lowS,
        bits2int: c.bits2int,
        bits2int_modN: c.bits2int_modN,
    };
    return { CURVE, curveOpts, ecdsaOpts };
}
function _ecdsa_new_output_to_legacy(c, ecdsa) {
    return Object.assign({}, ecdsa, {
        ProjectivePoint: ecdsa.Point,
        CURVE: c,
    });
}
// _ecdsa_legacy
function weierstrass(c) {
    const { CURVE, curveOpts, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
    const Point = weierstrassN(CURVE, curveOpts);
    const signs = ecdsa(Point, ecdsaOpts, curveOpts);
    return _ecdsa_new_output_to_legacy(c, signs);
}

/**
 * Utilities for short weierstrass curves, combined with noble-hashes.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function createCurve(curveDef, defHash) {
    const create = (hash) => weierstrass({ ...curveDef, hash: hash });
    return { ...create(defHash), create };
}

/**
 * SECG secp256k1. See [pdf](https://www.secg.org/sec2-v2.pdf).
 *
 * Belongs to Koblitz curves: it has efficiently-computable GLV endomorphism ψ,
 * check out {@link EndomorphismOpts}. Seems to be rigid (not backdoored).
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// Seems like generator was produced from some seed:
// `Point.BASE.multiply(Point.Fn.inv(2n, N)).toAffine().x`
// // gives short x 0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63n
const secp256k1_CURVE = {
    p: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f'),
    n: BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'),
    h: BigInt(1),
    a: BigInt(0),
    b: BigInt(7),
    Gx: BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
    Gy: BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'),
};
const _0n$1 = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const divNearest = (a, b) => (a + b / _2n) / b;
/**
 * √n = n^((p+1)/4) for fields p = 3 mod 4. We unwrap the loop and multiply bit-by-bit.
 * (P+1n/4n).toString(2) would produce bits [223x 1, 0, 22x 1, 4x 0, 11, 00]
 */
function sqrtMod(y) {
    const P = secp256k1_CURVE.p;
    // prettier-ignore
    const _3n = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
    // prettier-ignore
    const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
    const b2 = (y * y * y) % P; // x^3, 11
    const b3 = (b2 * b2 * y) % P; // x^7
    const b6 = (pow2(b3, _3n, P) * b3) % P;
    const b9 = (pow2(b6, _3n, P) * b3) % P;
    const b11 = (pow2(b9, _2n, P) * b2) % P;
    const b22 = (pow2(b11, _11n, P) * b11) % P;
    const b44 = (pow2(b22, _22n, P) * b22) % P;
    const b88 = (pow2(b44, _44n, P) * b44) % P;
    const b176 = (pow2(b88, _88n, P) * b88) % P;
    const b220 = (pow2(b176, _44n, P) * b44) % P;
    const b223 = (pow2(b220, _3n, P) * b3) % P;
    const t1 = (pow2(b223, _23n, P) * b22) % P;
    const t2 = (pow2(t1, _6n, P) * b2) % P;
    const root = pow2(t2, _2n, P);
    if (!Fpk1.eql(Fpk1.sqr(root), y))
        throw new Error('Cannot find square root');
    return root;
}
const Fpk1 = Field$1(secp256k1_CURVE.p, undefined, undefined, { sqrt: sqrtMod });
/**
 * secp256k1 curve, ECDSA and ECDH methods.
 *
 * Field: `2n**256n - 2n**32n - 2n**9n - 2n**8n - 2n**7n - 2n**6n - 2n**4n - 1n`
 *
 * @example
 * ```js
 * import { secp256k1 } from '@noble/curves/secp256k1';
 * const priv = secp256k1.utils.randomPrivateKey();
 * const pub = secp256k1.getPublicKey(priv);
 * const msg = new Uint8Array(32).fill(1); // message hash (not message) in ecdsa
 * const sig = secp256k1.sign(msg, priv); // `{prehash: true}` option is available
 * const isValid = secp256k1.verify(sig, msg, pub) === true;
 * ```
 */
const secp256k1 = createCurve({
    ...secp256k1_CURVE,
    Fp: Fpk1,
    lowS: true, // Allow only low-S signatures by default in sign() and verify()
    endo: {
        // Endomorphism, see above
        beta: BigInt('0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee'),
        splitScalar: (k) => {
            const n = secp256k1_CURVE.n;
            const a1 = BigInt('0x3086d221a7d46bcde86c90e49284eb15');
            const b1 = -_1n * BigInt('0xe4437ed6010e88286f547fa90abfe4c3');
            const a2 = BigInt('0x114ca50f7a8e2f3f657c1108d9d44cfd8');
            const b2 = a1;
            const POW_2_128 = BigInt('0x100000000000000000000000000000000'); // (2n**128n).toString(16)
            const c1 = divNearest(b2 * k, n);
            const c2 = divNearest(-b1 * k, n);
            let k1 = mod(k - c1 * a1 - c2 * a2, n);
            let k2 = mod(-c1 * b1 - c2 * b2, n);
            const k1neg = k1 > POW_2_128;
            const k2neg = k2 > POW_2_128;
            if (k1neg)
                k1 = n - k1;
            if (k2neg)
                k2 = n - k2;
            if (k1 > POW_2_128 || k2 > POW_2_128) {
                throw new Error('splitScalar: Endomorphism failed, k=' + k);
            }
            return { k1neg, k1, k2neg, k2 };
        },
    },
}, sha256$2);
// Schnorr signatures are superior to ECDSA from above. Below is Schnorr-specific BIP0340 code.
// https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
const TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
    let tagP = TAGGED_HASH_PREFIXES[tag];
    if (tagP === undefined) {
        const tagH = sha256$2(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
        tagP = concatBytes$2(tagH, tagH);
        TAGGED_HASH_PREFIXES[tag] = tagP;
    }
    return sha256$2(concatBytes$2(tagP, ...messages));
}
// ECDSA compact points are 33-byte. Schnorr is 32: we strip first byte 0x02 or 0x03
const pointToBytes = (point) => point.toBytes(true).slice(1);
const numTo32b = (n) => numberToBytesBE(n, 32);
const modP = (x) => mod(x, secp256k1_CURVE.p);
const modN = (x) => mod(x, secp256k1_CURVE.n);
const Point$2 = /* @__PURE__ */ (() => secp256k1.Point)();
const hasEven = (y) => y % _2n === _0n$1;
// Calculate point, scalar and bytes
function schnorrGetExtPubKey(priv) {
    let d_ = secp256k1.utils.normPrivateKeyToScalar(priv); // same method executed in fromPrivateKey
    let p = Point$2.fromPrivateKey(d_); // P = d'⋅G; 0 < d' < n check is done inside
    const scalar = hasEven(p.y) ? d_ : modN(-d_);
    return { scalar: scalar, bytes: pointToBytes(p) };
}
/**
 * lift_x from BIP340. Convert 32-byte x coordinate to elliptic curve point.
 * @returns valid point checked for being on-curve
 */
function lift_x(x) {
    aInRange('x', x, _1n, secp256k1_CURVE.p); // Fail if x ≥ p.
    const xx = modP(x * x);
    const c = modP(xx * x + BigInt(7)); // Let c = x³ + 7 mod p.
    let y = sqrtMod(c); // Let y = c^(p+1)/4 mod p.
    if (!hasEven(y))
        y = modP(-y); // Return the unique point P such that x(P) = x and
    const p = Point$2.fromAffine({ x, y }); // y(P) = y if y mod 2 = 0 or y(P) = p-y otherwise.
    p.assertValidity();
    return p;
}
const num = bytesToNumberBE;
/**
 * Create tagged hash, convert it to bigint, reduce modulo-n.
 */
function challenge(...args) {
    return modN(num(taggedHash('BIP0340/challenge', ...args)));
}
/**
 * Schnorr public key is just `x` coordinate of Point as per BIP340.
 */
function schnorrGetPublicKey(privateKey) {
    return schnorrGetExtPubKey(privateKey).bytes; // d'=int(sk). Fail if d'=0 or d'≥n. Ret bytes(d'⋅G)
}
/**
 * Creates Schnorr signature as per BIP340. Verifies itself before returning anything.
 * auxRand is optional and is not the sole source of k generation: bad CSPRNG won't be dangerous.
 */
function schnorrSign(message, privateKey, auxRand = randomBytes(32)) {
    const m = ensureBytes('message', message);
    const { bytes: px, scalar: d } = schnorrGetExtPubKey(privateKey); // checks for isWithinCurveOrder
    const a = ensureBytes('auxRand', auxRand, 32); // Auxiliary random data a: a 32-byte array
    const t = numTo32b(d ^ num(taggedHash('BIP0340/aux', a))); // Let t be the byte-wise xor of bytes(d) and hash/aux(a)
    const rand = taggedHash('BIP0340/nonce', t, px, m); // Let rand = hash/nonce(t || bytes(P) || m)
    const k_ = modN(num(rand)); // Let k' = int(rand) mod n
    if (k_ === _0n$1)
        throw new Error('sign failed: k is zero'); // Fail if k' = 0.
    const { bytes: rx, scalar: k } = schnorrGetExtPubKey(k_); // Let R = k'⋅G.
    const e = challenge(rx, px, m); // Let e = int(hash/challenge(bytes(R) || bytes(P) || m)) mod n.
    const sig = new Uint8Array(64); // Let sig = bytes(R) || bytes((k + ed) mod n).
    sig.set(rx, 0);
    sig.set(numTo32b(modN(k + e * d)), 32);
    // If Verify(bytes(P), m, sig) (see below) returns failure, abort
    if (!schnorrVerify(sig, m, px))
        throw new Error('sign: Invalid signature produced');
    return sig;
}
/**
 * Verifies Schnorr signature.
 * Will swallow errors & return false except for initial type validation of arguments.
 */
function schnorrVerify(signature, message, publicKey) {
    const sig = ensureBytes('signature', signature, 64);
    const m = ensureBytes('message', message);
    const pub = ensureBytes('publicKey', publicKey, 32);
    try {
        const P = lift_x(num(pub)); // P = lift_x(int(pk)); fail if that fails
        const r = num(sig.subarray(0, 32)); // Let r = int(sig[0:32]); fail if r ≥ p.
        if (!inRange(r, _1n, secp256k1_CURVE.p))
            return false;
        const s = num(sig.subarray(32, 64)); // Let s = int(sig[32:64]); fail if s ≥ n.
        if (!inRange(s, _1n, secp256k1_CURVE.n))
            return false;
        const e = challenge(numTo32b(r), pointToBytes(P), m); // int(challenge(bytes(r)||bytes(P)||m))%n
        // R = s⋅G - e⋅P, where -eP == (n-e)P
        const R = Point$2.BASE.multiplyUnsafe(s).add(P.multiplyUnsafe(modN(-e)));
        const { x, y } = R.toAffine();
        // Fail if is_infinite(R) / not has_even_y(R) / x(R) ≠ r.
        if (R.is0() || !hasEven(y) || x !== r)
            return false;
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Schnorr signatures over secp256k1.
 * https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
 * @example
 * ```js
 * import { schnorr } from '@noble/curves/secp256k1';
 * const priv = schnorr.utils.randomPrivateKey();
 * const pub = schnorr.getPublicKey(priv);
 * const msg = new TextEncoder().encode('hello');
 * const sig = schnorr.sign(msg, priv);
 * const isValid = schnorr.verify(sig, msg, pub);
 * ```
 */
const schnorr = /* @__PURE__ */ (() => ({
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    utils: {
        randomPrivateKey: secp256k1.utils.randomPrivateKey,
        lift_x,
        pointToBytes,
        numberToBytesBE,
        bytesToNumberBE,
        taggedHash,
        mod,
    },
}))();

/**
 * Define complex binary structures using composable primitives.
 * Main ideas:
 * - Encode / decode can be chained, same as in `scure-base`
 * - A complex structure can be created from an array and struct of primitive types
 * - Strings / bytes are arrays with specific optimizations: we can just read bytes directly
 *   without creating plain array first and reading each byte separately.
 * - Types are inferred from definition
 * @module
 * @example
 * import * as P from 'micro-packed';
 * const s = P.struct({
 *   field1: P.U32BE, // 32-bit unsigned big-endian integer
 *   field2: P.string(P.U8), // String with U8 length prefix
 *   field3: P.bytes(32), // 32 bytes
 *   field4: P.array(P.U16BE, P.struct({ // Array of structs with U16BE length
 *     subField1: P.U64BE, // 64-bit unsigned big-endian integer
 *     subField2: P.string(10) // 10-byte string
 *   }))
 * });
 */
// TODO: remove dependency on scure-base & inline?
/*
Exports can be groupped like this:

- Primitive types: P.bytes, P.string, P.hex, P.constant, P.pointer
- Complex types: P.array, P.struct, P.tuple, P.map, P.tag, P.mappedTag
- Padding, prefix, magic: P.padLeft, P.padRight, P.prefix, P.magic, P.magicBytes
- Flags: P.flag, P.flagged, P.optional
- Wrappers: P.apply, P.wrap, P.lazy
- Bit fiddling: P.bits, P.bitset
- utils: P.validate, coders.decimal
- Debugger
*/
/** Shortcut to zero-length (empty) byte array */
const EMPTY = /* @__PURE__ */ new Uint8Array();
/** Shortcut to one-element (element is 0) byte array */
const NULL = /* @__PURE__ */ new Uint8Array([0]);
/** Checks if two Uint8Arrays are equal. Not constant-time. */
function equalBytes$1(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
/** Checks if the given value is a Uint8Array. */
function isBytes$1(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
/**
 * Concatenates multiple Uint8Arrays.
 * Engines limit functions to 65K+ arguments.
 * @param arrays Array of Uint8Array elements
 * @returns Concatenated Uint8Array
 */
function concatBytes$1(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        if (!isBytes$1(a))
            throw new Error('Uint8Array expected');
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
/**
 * Creates DataView from Uint8Array
 * @param arr - bytes
 * @returns DataView
 */
const createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
/**
 * Checks if the provided value is a plain object, not created from any class or special constructor.
 * Array, Uint8Array and others are not plain objects.
 * @param obj - The value to be checked.
 */
function isPlainObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}
function isNum(num) {
    return Number.isSafeInteger(num);
}
const utils$1 = {
    equalBytes: equalBytes$1,
    isBytes: isBytes$1,
    concatBytes: concatBytes$1};
// NOTE: we can't have terminator separate function, since it won't know about boundaries
// E.g. array of U16LE ([1,2,3]) would be [1, 0, 2, 0, 3, 0]
// But terminator will find array at index '1', which happens to be inside of an element itself
/**
 * Can be:
 * - Dynamic (CoderType)
 * - Fixed (number)
 * - Terminated (usually zero): Uint8Array with terminator
 * - Field path to field with length (string)
 * - Infinity (null) - decodes until end of buffer
 * Used in:
 * - bytes (string, prefix is implementation of bytes)
 * - array
 */
const lengthCoder = (len) => {
    if (len !== null && typeof len !== 'string' && !isCoder(len) && !isBytes$1(len) && !isNum(len)) {
        throw new Error(`lengthCoder: expected null | number | Uint8Array | CoderType, got ${len} (${typeof len})`);
    }
    return {
        encodeStream(w, value) {
            if (len === null)
                return;
            if (isCoder(len))
                return len.encodeStream(w, value);
            let byteLen;
            if (typeof len === 'number')
                byteLen = len;
            else if (typeof len === 'string')
                byteLen = Path.resolve(w.stack, len);
            if (typeof byteLen === 'bigint')
                byteLen = Number(byteLen);
            if (byteLen === undefined || byteLen !== value)
                throw w.err(`Wrong length: ${byteLen} len=${len} exp=${value} (${typeof value})`);
        },
        decodeStream(r) {
            let byteLen;
            if (isCoder(len))
                byteLen = Number(len.decodeStream(r));
            else if (typeof len === 'number')
                byteLen = len;
            else if (typeof len === 'string')
                byteLen = Path.resolve(r.stack, len);
            if (typeof byteLen === 'bigint')
                byteLen = Number(byteLen);
            if (typeof byteLen !== 'number')
                throw r.err(`Wrong length: ${byteLen}`);
            return byteLen;
        },
    };
};
/**
 * Small bitset structure to store position of ranges that have been read.
 * Can be more efficient when internal trees are utilized at the cost of complexity.
 * Needs `O(N/8)` memory for parsing.
 * Purpose: if there are pointers in parsed structure,
 * they can cause read of two distinct ranges:
 * [0-32, 64-128], which means 'pos' is not enough to handle them
 */
const Bitset = {
    BITS: 32,
    FULL_MASK: -1 >>> 0, // 1<<32 will overflow
    len: (len) => Math.ceil(len / 32),
    create: (len) => new Uint32Array(Bitset.len(len)),
    clean: (bs) => bs.fill(0),
    debug: (bs) => Array.from(bs).map((i) => (i >>> 0).toString(2).padStart(32, '0')),
    checkLen: (bs, len) => {
        if (Bitset.len(len) === bs.length)
            return;
        throw new Error(`wrong length=${bs.length}. Expected: ${Bitset.len(len)}`);
    },
    chunkLen: (bsLen, pos, len) => {
        if (pos < 0)
            throw new Error(`wrong pos=${pos}`);
        if (pos + len > bsLen)
            throw new Error(`wrong range=${pos}/${len} of ${bsLen}`);
    },
    set: (bs, chunk, value, allowRewrite = true) => {
        if (!allowRewrite && (bs[chunk] & value) !== 0)
            return false;
        bs[chunk] |= value;
        return true;
    },
    pos: (pos, i) => ({
        chunk: Math.floor((pos + i) / 32),
        mask: 1 << (32 - ((pos + i) % 32) - 1),
    }),
    indices: (bs, len, invert = false) => {
        Bitset.checkLen(bs, len);
        const { FULL_MASK, BITS } = Bitset;
        const left = BITS - (len % BITS);
        const lastMask = left ? (FULL_MASK >>> left) << left : FULL_MASK;
        const res = [];
        for (let i = 0; i < bs.length; i++) {
            let c = bs[i];
            if (invert)
                c = ~c; // allows to gen unset elements
            // apply mask to last element, so we won't iterate non-existent items
            if (i === bs.length - 1)
                c &= lastMask;
            if (c === 0)
                continue; // fast-path
            for (let j = 0; j < BITS; j++) {
                const m = 1 << (BITS - j - 1);
                if (c & m)
                    res.push(i * BITS + j);
            }
        }
        return res;
    },
    range: (arr) => {
        const res = [];
        let cur;
        for (const i of arr) {
            if (cur === undefined || i !== cur.pos + cur.length)
                res.push((cur = { pos: i, length: 1 }));
            else
                cur.length += 1;
        }
        return res;
    },
    rangeDebug: (bs, len, invert = false) => `[${Bitset.range(Bitset.indices(bs, len, invert))
        .map((i) => `(${i.pos}/${i.length})`)
        .join(', ')}]`,
    setRange: (bs, bsLen, pos, len, allowRewrite = true) => {
        Bitset.chunkLen(bsLen, pos, len);
        const { FULL_MASK, BITS } = Bitset;
        // Try to set range with maximum efficiency:
        // - first chunk is always    '0000[1111]' (only right ones)
        // - middle chunks are set to '[1111 1111]' (all ones)
        // - last chunk is always     '[1111]0000' (only left ones)
        // - max operations:          (N/32) + 2 (first and last)
        const first = pos % BITS ? Math.floor(pos / BITS) : undefined;
        const lastPos = pos + len;
        const last = lastPos % BITS ? Math.floor(lastPos / BITS) : undefined;
        // special case, whole range inside single chunk
        if (first !== undefined && first === last)
            return Bitset.set(bs, first, (FULL_MASK >>> (BITS - len)) << (BITS - len - pos), allowRewrite);
        if (first !== undefined) {
            if (!Bitset.set(bs, first, FULL_MASK >>> pos % BITS, allowRewrite))
                return false; // first chunk
        }
        // middle chunks
        const start = first !== undefined ? first + 1 : pos / BITS;
        const end = last !== undefined ? last : lastPos / BITS;
        for (let i = start; i < end; i++)
            if (!Bitset.set(bs, i, FULL_MASK, allowRewrite))
                return false;
        if (last !== undefined && first !== last)
            if (!Bitset.set(bs, last, FULL_MASK << (BITS - (lastPos % BITS)), allowRewrite))
                return false; // last chunk
        return true;
    },
};
const Path = {
    /**
     * Internal method for handling stack of paths (debug, errors, dynamic fields via path)
     * This is looks ugly (callback), but allows us to force stack cleaning by construction (.pop always after function).
     * Also, this makes impossible:
     * - pushing field when stack is empty
     * - pushing field inside of field (real bug)
     * NOTE: we don't want to do '.pop' on error!
     */
    pushObj: (stack, obj, objFn) => {
        const last = { obj };
        stack.push(last);
        objFn((field, fieldFn) => {
            last.field = field;
            fieldFn();
            last.field = undefined;
        });
        stack.pop();
    },
    path: (stack) => {
        const res = [];
        for (const i of stack)
            if (i.field !== undefined)
                res.push(i.field);
        return res.join('/');
    },
    err: (name, stack, msg) => {
        const err = new Error(`${name}(${Path.path(stack)}): ${typeof msg === 'string' ? msg : msg.message}`);
        if (msg instanceof Error && msg.stack)
            err.stack = msg.stack;
        return err;
    },
    resolve: (stack, path) => {
        const parts = path.split('/');
        const objPath = stack.map((i) => i.obj);
        let i = 0;
        for (; i < parts.length; i++) {
            if (parts[i] === '..')
                objPath.pop();
            else
                break;
        }
        let cur = objPath.pop();
        for (; i < parts.length; i++) {
            if (!cur || cur[parts[i]] === undefined)
                return undefined;
            cur = cur[parts[i]];
        }
        return cur;
    },
};
/**
 * Internal structure. Reader class for reading from a byte array.
 * `stack` is internal: for debugger and logging
 * @class Reader
 */
class _Reader {
    constructor(data, opts = {}, stack = [], parent = undefined, parentOffset = 0) {
        this.pos = 0;
        this.bitBuf = 0;
        this.bitPos = 0;
        this.data = data;
        this.opts = opts;
        this.stack = stack;
        this.parent = parent;
        this.parentOffset = parentOffset;
        this.view = createView(data);
    }
    /** Internal method for pointers. */
    _enablePointers() {
        if (this.parent)
            return this.parent._enablePointers();
        if (this.bs)
            return;
        this.bs = Bitset.create(this.data.length);
        Bitset.setRange(this.bs, this.data.length, 0, this.pos, this.opts.allowMultipleReads);
    }
    markBytesBS(pos, len) {
        if (this.parent)
            return this.parent.markBytesBS(this.parentOffset + pos, len);
        if (!len)
            return true;
        if (!this.bs)
            return true;
        return Bitset.setRange(this.bs, this.data.length, pos, len, false);
    }
    markBytes(len) {
        const pos = this.pos;
        this.pos += len;
        const res = this.markBytesBS(pos, len);
        if (!this.opts.allowMultipleReads && !res)
            throw this.err(`multiple read pos=${this.pos} len=${len}`);
        return res;
    }
    pushObj(obj, objFn) {
        return Path.pushObj(this.stack, obj, objFn);
    }
    readView(n, fn) {
        if (!Number.isFinite(n))
            throw this.err(`readView: wrong length=${n}`);
        if (this.pos + n > this.data.length)
            throw this.err('readView: Unexpected end of buffer');
        const res = fn(this.view, this.pos);
        this.markBytes(n);
        return res;
    }
    // read bytes by absolute offset
    absBytes(n) {
        if (n > this.data.length)
            throw new Error('Unexpected end of buffer');
        return this.data.subarray(n);
    }
    finish() {
        if (this.opts.allowUnreadBytes)
            return;
        if (this.bitPos) {
            throw this.err(`${this.bitPos} bits left after unpack: ${hex.encode(this.data.slice(this.pos))}`);
        }
        if (this.bs && !this.parent) {
            const notRead = Bitset.indices(this.bs, this.data.length, true);
            if (notRead.length) {
                const formatted = Bitset.range(notRead)
                    .map(({ pos, length }) => `(${pos}/${length})[${hex.encode(this.data.subarray(pos, pos + length))}]`)
                    .join(', ');
                throw this.err(`unread byte ranges: ${formatted} (total=${this.data.length})`);
            }
            else
                return; // all bytes read, everything is ok
        }
        // Default: no pointers enabled
        if (!this.isEnd()) {
            throw this.err(`${this.leftBytes} bytes ${this.bitPos} bits left after unpack: ${hex.encode(this.data.slice(this.pos))}`);
        }
    }
    // User methods
    err(msg) {
        return Path.err('Reader', this.stack, msg);
    }
    offsetReader(n) {
        if (n > this.data.length)
            throw this.err('offsetReader: Unexpected end of buffer');
        return new _Reader(this.absBytes(n), this.opts, this.stack, this, n);
    }
    bytes(n, peek = false) {
        if (this.bitPos)
            throw this.err('readBytes: bitPos not empty');
        if (!Number.isFinite(n))
            throw this.err(`readBytes: wrong length=${n}`);
        if (this.pos + n > this.data.length)
            throw this.err('readBytes: Unexpected end of buffer');
        const slice = this.data.subarray(this.pos, this.pos + n);
        if (!peek)
            this.markBytes(n);
        return slice;
    }
    byte(peek = false) {
        if (this.bitPos)
            throw this.err('readByte: bitPos not empty');
        if (this.pos + 1 > this.data.length)
            throw this.err('readBytes: Unexpected end of buffer');
        const data = this.data[this.pos];
        if (!peek)
            this.markBytes(1);
        return data;
    }
    get leftBytes() {
        return this.data.length - this.pos;
    }
    get totalBytes() {
        return this.data.length;
    }
    isEnd() {
        return this.pos >= this.data.length && !this.bitPos;
    }
    // bits are read in BE mode (left to right): (0b1000_0000).readBits(1) == 1
    bits(bits) {
        if (bits > 32)
            throw this.err('BitReader: cannot read more than 32 bits in single call');
        let out = 0;
        while (bits) {
            if (!this.bitPos) {
                this.bitBuf = this.byte();
                this.bitPos = 8;
            }
            const take = Math.min(bits, this.bitPos);
            this.bitPos -= take;
            out = (out << take) | ((this.bitBuf >> this.bitPos) & (2 ** take - 1));
            this.bitBuf &= 2 ** this.bitPos - 1;
            bits -= take;
        }
        // Fix signed integers
        return out >>> 0;
    }
    find(needle, pos = this.pos) {
        if (!isBytes$1(needle))
            throw this.err(`find: needle is not bytes! ${needle}`);
        if (this.bitPos)
            throw this.err('findByte: bitPos not empty');
        if (!needle.length)
            throw this.err(`find: needle is empty`);
        // indexOf should be faster than full equalBytes check
        for (let idx = pos; (idx = this.data.indexOf(needle[0], idx)) !== -1; idx++) {
            if (idx === -1)
                return;
            const leftBytes = this.data.length - idx;
            if (leftBytes < needle.length)
                return;
            if (equalBytes$1(needle, this.data.subarray(idx, idx + needle.length)))
                return idx;
        }
        return;
    }
}
/**
 * Internal structure. Writer class for writing to a byte array.
 * The `stack` argument of constructor is internal, for debugging and logs.
 * @class Writer
 */
class _Writer {
    constructor(stack = []) {
        this.pos = 0;
        // We could have a single buffer here and re-alloc it with
        // x1.5-2 size each time it full, but it will be slower:
        // basic/encode bench: 395ns -> 560ns
        this.buffers = [];
        this.ptrs = [];
        this.bitBuf = 0;
        this.bitPos = 0;
        this.viewBuf = new Uint8Array(8);
        this.finished = false;
        this.stack = stack;
        this.view = createView(this.viewBuf);
    }
    pushObj(obj, objFn) {
        return Path.pushObj(this.stack, obj, objFn);
    }
    writeView(len, fn) {
        if (this.finished)
            throw this.err('buffer: finished');
        if (!isNum(len) || len > 8)
            throw new Error(`wrong writeView length=${len}`);
        fn(this.view);
        this.bytes(this.viewBuf.slice(0, len));
        this.viewBuf.fill(0);
    }
    // User methods
    err(msg) {
        if (this.finished)
            throw this.err('buffer: finished');
        return Path.err('Reader', this.stack, msg);
    }
    bytes(b) {
        if (this.finished)
            throw this.err('buffer: finished');
        if (this.bitPos)
            throw this.err('writeBytes: ends with non-empty bit buffer');
        this.buffers.push(b);
        this.pos += b.length;
    }
    byte(b) {
        if (this.finished)
            throw this.err('buffer: finished');
        if (this.bitPos)
            throw this.err('writeByte: ends with non-empty bit buffer');
        this.buffers.push(new Uint8Array([b]));
        this.pos++;
    }
    finish(clean = true) {
        if (this.finished)
            throw this.err('buffer: finished');
        if (this.bitPos)
            throw this.err('buffer: ends with non-empty bit buffer');
        // Can't use concatBytes, because it limits amount of arguments (65K).
        const buffers = this.buffers.concat(this.ptrs.map((i) => i.buffer));
        const sum = buffers.map((b) => b.length).reduce((a, b) => a + b, 0);
        const buf = new Uint8Array(sum);
        for (let i = 0, pad = 0; i < buffers.length; i++) {
            const a = buffers[i];
            buf.set(a, pad);
            pad += a.length;
        }
        for (let pos = this.pos, i = 0; i < this.ptrs.length; i++) {
            const ptr = this.ptrs[i];
            buf.set(ptr.ptr.encode(pos), ptr.pos);
            pos += ptr.buffer.length;
        }
        // Cleanup
        if (clean) {
            // We cannot cleanup buffers here, since it can be static user provided buffer.
            // Only '.byte' and '.bits' create buffer which we can safely clean.
            // for (const b of this.buffers) b.fill(0);
            this.buffers = [];
            for (const p of this.ptrs)
                p.buffer.fill(0);
            this.ptrs = [];
            this.finished = true;
            this.bitBuf = 0;
        }
        return buf;
    }
    bits(value, bits) {
        if (bits > 32)
            throw this.err('writeBits: cannot write more than 32 bits in single call');
        if (value >= 2 ** bits)
            throw this.err(`writeBits: value (${value}) >= 2**bits (${bits})`);
        while (bits) {
            const take = Math.min(bits, 8 - this.bitPos);
            this.bitBuf = (this.bitBuf << take) | (value >> (bits - take));
            this.bitPos += take;
            bits -= take;
            value &= 2 ** bits - 1;
            if (this.bitPos === 8) {
                this.bitPos = 0;
                this.buffers.push(new Uint8Array([this.bitBuf]));
                this.pos++;
            }
        }
    }
}
// Immutable LE<->BE
const swapEndianness = (b) => Uint8Array.from(b).reverse();
/** Internal function for checking bit bounds of bigint in signed/unsinged form */
function checkBounds(value, bits, signed) {
    if (signed) {
        // [-(2**(32-1)), 2**(32-1)-1]
        const signBit = 2n ** (bits - 1n);
        if (value < -signBit || value >= signBit)
            throw new Error(`value out of signed bounds. Expected ${-signBit} <= ${value} < ${signBit}`);
    }
    else {
        // [0, 2**32-1]
        if (0n > value || value >= 2n ** bits)
            throw new Error(`value out of unsigned bounds. Expected 0 <= ${value} < ${2n ** bits}`);
    }
}
function _wrap(inner) {
    return {
        // NOTE: we cannot export validate here, since it is likely mistake.
        encodeStream: inner.encodeStream,
        decodeStream: inner.decodeStream,
        size: inner.size,
        encode: (value) => {
            const w = new _Writer();
            inner.encodeStream(w, value);
            return w.finish();
        },
        decode: (data, opts = {}) => {
            const r = new _Reader(data, opts);
            const res = inner.decodeStream(r);
            r.finish();
            return res;
        },
    };
}
/**
 * Validates a value before encoding and after decoding using a provided function.
 * @param inner - The inner CoderType.
 * @param fn - The validation function.
 * @returns CoderType which check value with validation function.
 * @example
 * const val = (n: number) => {
 *   if (n > 10) throw new Error(`${n} > 10`);
 *   return n;
 * };
 *
 * const RangedInt = P.validate(P.U32LE, val); // Will check if value is <= 10 during encoding and decoding
 */
function validate(inner, fn) {
    if (!isCoder(inner))
        throw new Error(`validate: invalid inner value ${inner}`);
    if (typeof fn !== 'function')
        throw new Error('validate: fn should be function');
    return _wrap({
        size: inner.size,
        encodeStream: (w, value) => {
            let res;
            try {
                res = fn(value);
            }
            catch (e) {
                throw w.err(e);
            }
            inner.encodeStream(w, res);
        },
        decodeStream: (r) => {
            const res = inner.decodeStream(r);
            try {
                return fn(res);
            }
            catch (e) {
                throw r.err(e);
            }
        },
    });
}
/**
 * Wraps a stream encoder into a generic encoder and optionally validation function
 * @param {inner} inner BytesCoderStream & { validate?: Validate<T> }.
 * @returns The wrapped CoderType.
 * @example
 * const U8 = P.wrap({
 *   encodeStream: (w: Writer, value: number) => w.byte(value),
 *   decodeStream: (r: Reader): number => r.byte()
 * });
 * const checkedU8 = P.wrap({
 *   encodeStream: (w: Writer, value: number) => w.byte(value),
 *   decodeStream: (r: Reader): number => r.byte()
 *   validate: (n: number) => {
 *    if (n > 10) throw new Error(`${n} > 10`);
 *    return n;
 *   }
 * });
 */
const wrap = (inner) => {
    const res = _wrap(inner);
    return inner.validate ? validate(res, inner.validate) : res;
};
const isBaseCoder = (elm) => isPlainObject(elm) && typeof elm.decode === 'function' && typeof elm.encode === 'function';
/**
 * Checks if the given value is a CoderType.
 * @param elm - The value to check.
 * @returns True if the value is a CoderType, false otherwise.
 */
function isCoder(elm) {
    return (isPlainObject(elm) &&
        isBaseCoder(elm) &&
        typeof elm.encodeStream === 'function' &&
        typeof elm.decodeStream === 'function' &&
        (elm.size === undefined || isNum(elm.size)));
}
// Coders (like in @scure/base) for common operations
/**
 * Base coder for working with dictionaries (records, objects, key-value map)
 * Dictionary is dynamic type like: `[key: string, value: any][]`
 * @returns base coder that encodes/decodes between arrays of key-value tuples and dictionaries.
 * @example
 * const dict: P.CoderType<Record<string, number>> = P.apply(
 *  P.array(P.U16BE, P.tuple([P.cstring, P.U32LE] as const)),
 *  P.coders.dict()
 * );
 */
function dict() {
    return {
        encode: (from) => {
            if (!Array.isArray(from))
                throw new Error('array expected');
            const to = {};
            for (const item of from) {
                if (!Array.isArray(item) || item.length !== 2)
                    throw new Error(`array of two elements expected`);
                const name = item[0];
                const value = item[1];
                if (to[name] !== undefined)
                    throw new Error(`key(${name}) appears twice in struct`);
                to[name] = value;
            }
            return to;
        },
        decode: (to) => {
            if (!isPlainObject(to))
                throw new Error(`expected plain object, got ${to}`);
            return Object.entries(to);
        },
    };
}
/**
 * Safely converts bigint to number.
 * Sometimes pointers / tags use u64 or other big numbers which cannot be represented by number,
 * but we still can use them since real value will be smaller than u32
 */
const numberBigint = {
    encode: (from) => {
        if (typeof from !== 'bigint')
            throw new Error(`expected bigint, got ${typeof from}`);
        if (from > BigInt(Number.MAX_SAFE_INTEGER))
            throw new Error(`element bigger than MAX_SAFE_INTEGER=${from}`);
        return Number(from);
    },
    decode: (to) => {
        if (!isNum(to))
            throw new Error('element is not a safe integer');
        return BigInt(to);
    },
};
/**
 * Base coder for working with TypeScript enums.
 * @param e - TypeScript enum.
 * @returns base coder that encodes/decodes between numbers and enum keys.
 * @example
 * enum Color { Red, Green, Blue }
 * const colorCoder = P.coders.tsEnum(Color);
 * colorCoder.encode(Color.Red); // 'Red'
 * colorCoder.decode('Green'); // 1
 */
function tsEnum(e) {
    if (!isPlainObject(e))
        throw new Error('plain object expected');
    return {
        encode: (from) => {
            if (!isNum(from) || !(from in e))
                throw new Error(`wrong value ${from}`);
            return e[from];
        },
        decode: (to) => {
            if (typeof to !== 'string')
                throw new Error(`wrong value ${typeof to}`);
            return e[to];
        },
    };
}
/**
 * Base coder for working with decimal numbers.
 * @param precision - Number of decimal places.
 * @param round - Round fraction part if bigger than precision (throws error by default)
 * @returns base coder that encodes/decodes between bigints and decimal strings.
 * @example
 * const decimal8 = P.coders.decimal(8);
 * decimal8.encode(630880845n); // '6.30880845'
 * decimal8.decode('6.30880845'); // 630880845n
 */
function decimal(precision, round = false) {
    if (!isNum(precision))
        throw new Error(`decimal/precision: wrong value ${precision}`);
    if (typeof round !== 'boolean')
        throw new Error(`decimal/round: expected boolean, got ${typeof round}`);
    const decimalMask = 10n ** BigInt(precision);
    return {
        encode: (from) => {
            if (typeof from !== 'bigint')
                throw new Error(`expected bigint, got ${typeof from}`);
            let s = (from < 0n ? -from : from).toString(10);
            let sep = s.length - precision;
            if (sep < 0) {
                s = s.padStart(s.length - sep, '0');
                sep = 0;
            }
            let i = s.length - 1;
            for (; i >= sep && s[i] === '0'; i--)
                ;
            let int = s.slice(0, sep);
            let frac = s.slice(sep, i + 1);
            if (!int)
                int = '0';
            if (from < 0n)
                int = '-' + int;
            if (!frac)
                return int;
            return `${int}.${frac}`;
        },
        decode: (to) => {
            if (typeof to !== 'string')
                throw new Error(`expected string, got ${typeof to}`);
            if (to === '-0')
                throw new Error(`negative zero is not allowed`);
            let neg = false;
            if (to.startsWith('-')) {
                neg = true;
                to = to.slice(1);
            }
            if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(to))
                throw new Error(`wrong string value=${to}`);
            let sep = to.indexOf('.');
            sep = sep === -1 ? to.length : sep;
            // split by separator and strip trailing zeros from fraction. always returns [string, string] (.split doesn't).
            const intS = to.slice(0, sep);
            const fracS = to.slice(sep + 1).replace(/0+$/, '');
            const int = BigInt(intS) * decimalMask;
            if (!round && fracS.length > precision) {
                throw new Error(`fractional part cannot be represented with this precision (num=${to}, prec=${precision})`);
            }
            const fracLen = Math.min(fracS.length, precision);
            const frac = BigInt(fracS.slice(0, fracLen)) * 10n ** BigInt(precision - fracLen);
            const value = int + frac;
            return neg ? -value : value;
        },
    };
}
/**
 * Combines multiple coders into a single coder, allowing conditional encoding/decoding based on input.
 * Acts as a parser combinator, splitting complex conditional coders into smaller parts.
 *
 *   `encode = [Ae, Be]; decode = [Ad, Bd]`
 *   ->
 *   `match([{encode: Ae, decode: Ad}, {encode: Be; decode: Bd}])`
 *
 * @param lst - Array of coders to match.
 * @returns Combined coder for conditional encoding/decoding.
 */
function match(lst) {
    if (!Array.isArray(lst))
        throw new Error(`expected array, got ${typeof lst}`);
    for (const i of lst)
        if (!isBaseCoder(i))
            throw new Error(`wrong base coder ${i}`);
    return {
        encode: (from) => {
            for (const c of lst) {
                const elm = c.encode(from);
                if (elm !== undefined)
                    return elm;
            }
            throw new Error(`match/encode: cannot find match in ${from}`);
        },
        decode: (to) => {
            for (const c of lst) {
                const elm = c.decode(to);
                if (elm !== undefined)
                    return elm;
            }
            throw new Error(`match/decode: cannot find match in ${to}`);
        },
    };
}
/** Reverses direction of coder */
const reverse = (coder) => {
    if (!isBaseCoder(coder))
        throw new Error('BaseCoder expected');
    return { encode: coder.decode, decode: coder.encode };
};
const coders = { dict, numberBigint, tsEnum, decimal, match, reverse };
/**
 * CoderType for working with bigint values.
 * Unsized bigint values should be wrapped in a container (e.g., bytes or string).
 *
 * `0n = new Uint8Array([])`
 *
 * `1n = new Uint8Array([1n])`
 *
 * Please open issue, if you need different behavior for zero.
 *
 * @param size - Size of the bigint in bytes.
 * @param le - Whether to use little-endian byte order.
 * @param signed - Whether the bigint is signed.
 * @param sized - Whether the bigint should have a fixed size.
 * @returns CoderType representing the bigint value.
 * @example
 * const U512BE = P.bigint(64, false, true, true); // Define a CoderType for a 512-bit unsigned big-endian integer
 */
const bigint = (size, le = false, signed = false, sized = true) => {
    if (!isNum(size))
        throw new Error(`bigint/size: wrong value ${size}`);
    if (typeof le !== 'boolean')
        throw new Error(`bigint/le: expected boolean, got ${typeof le}`);
    if (typeof signed !== 'boolean')
        throw new Error(`bigint/signed: expected boolean, got ${typeof signed}`);
    if (typeof sized !== 'boolean')
        throw new Error(`bigint/sized: expected boolean, got ${typeof sized}`);
    const bLen = BigInt(size);
    const signBit = 2n ** (8n * bLen - 1n);
    return wrap({
        size: sized ? size : undefined,
        encodeStream: (w, value) => {
            if (signed && value < 0)
                value = value | signBit;
            const b = [];
            for (let i = 0; i < size; i++) {
                b.push(Number(value & 255n));
                value >>= 8n;
            }
            let res = new Uint8Array(b).reverse();
            if (!sized) {
                let pos = 0;
                for (pos = 0; pos < res.length; pos++)
                    if (res[pos] !== 0)
                        break;
                res = res.subarray(pos); // remove leading zeros
            }
            w.bytes(le ? res.reverse() : res);
        },
        decodeStream: (r) => {
            // TODO: for le we can read until first zero?
            const value = r.bytes(sized ? size : Math.min(size, r.leftBytes));
            const b = le ? value : swapEndianness(value);
            let res = 0n;
            for (let i = 0; i < b.length; i++)
                res |= BigInt(b[i]) << (8n * BigInt(i));
            if (signed && res & signBit)
                res = (res ^ signBit) - signBit;
            return res;
        },
        validate: (value) => {
            if (typeof value !== 'bigint')
                throw new Error(`bigint: invalid value: ${value}`);
            checkBounds(value, 8n * bLen, !!signed);
            return value;
        },
    });
};
/** Unsigned 256-bit big-endian integer CoderType. */
const U256BE = /* @__PURE__ */ bigint(32, false);
/** Unsigned 64-bit little-endian integer CoderType. */
const U64LE = /* @__PURE__ */ bigint(8, true);
/** Signed 64-bit little-endian integer CoderType. */
const I64LE = /* @__PURE__ */ bigint(8, true, true);
const view = (len, opts) => wrap({
    size: len,
    encodeStream: (w, value) => w.writeView(len, (view) => opts.write(view, value)),
    decodeStream: (r) => r.readView(len, opts.read),
    validate: (value) => {
        if (typeof value !== 'number')
            throw new Error(`viewCoder: expected number, got ${typeof value}`);
        if (opts.validate)
            opts.validate(value);
        return value;
    },
});
const intView = (len, signed, opts) => {
    const bits = len * 8;
    const signBit = 2 ** (bits - 1);
    // Inlined checkBounds for integer
    const validateSigned = (value) => {
        if (!isNum(value))
            throw new Error(`sintView: value is not safe integer: ${value}`);
        if (value < -signBit || value >= signBit) {
            throw new Error(`sintView: value out of bounds. Expected ${-signBit} <= ${value} < ${signBit}`);
        }
    };
    const maxVal = 2 ** bits;
    const validateUnsigned = (value) => {
        if (!isNum(value))
            throw new Error(`uintView: value is not safe integer: ${value}`);
        if (0 > value || value >= maxVal) {
            throw new Error(`uintView: value out of bounds. Expected 0 <= ${value} < ${maxVal}`);
        }
    };
    return view(len, {
        write: opts.write,
        read: opts.read,
        validate: signed ? validateSigned : validateUnsigned,
    });
};
/** Unsigned 32-bit little-endian integer CoderType. */
const U32LE = /* @__PURE__ */ intView(4, false, {
    read: (view, pos) => view.getUint32(pos, true),
    write: (view, value) => view.setUint32(0, value, true),
});
/** Unsigned 32-bit big-endian integer CoderType. */
const U32BE = /* @__PURE__ */ intView(4, false, {
    read: (view, pos) => view.getUint32(pos, false),
    write: (view, value) => view.setUint32(0, value, false),
});
/** Signed 32-bit little-endian integer CoderType. */
const I32LE = /* @__PURE__ */ intView(4, true, {
    read: (view, pos) => view.getInt32(pos, true),
    write: (view, value) => view.setInt32(0, value, true),
});
/** Unsigned 16-bit little-endian integer CoderType. */
const U16LE = /* @__PURE__ */ intView(2, false, {
    read: (view, pos) => view.getUint16(pos, true),
    write: (view, value) => view.setUint16(0, value, true),
});
/** Unsigned 8-bit integer CoderType. */
const U8 = /* @__PURE__ */ intView(1, false, {
    read: (view, pos) => view.getUint8(pos),
    write: (view, value) => view.setUint8(0, value),
});
/**
 * Bytes CoderType with a specified length and endianness.
 * The bytes can have:
 * - Dynamic size (prefixed with a length CoderType like U16BE)
 * - Fixed size (specified by a number)
 * - Unknown size (null, will parse until end of buffer)
 * - Zero-terminated (terminator can be any Uint8Array)
 * @param len - CoderType, number, Uint8Array (terminator) or null
 * @param le - Whether to use little-endian byte order.
 * @returns CoderType representing the bytes.
 * @example
 * // Dynamic size bytes (prefixed with P.U16BE number of bytes length)
 * const dynamicBytes = P.bytes(P.U16BE, false);
 * const fixedBytes = P.bytes(32, false); // Fixed size bytes
 * const unknownBytes = P.bytes(null, false); // Unknown size bytes, will parse until end of buffer
 * const zeroTerminatedBytes = P.bytes(new Uint8Array([0]), false); // Zero-terminated bytes
 */
const createBytes = (len, le = false) => {
    if (typeof le !== 'boolean')
        throw new Error(`bytes/le: expected boolean, got ${typeof le}`);
    const _length = lengthCoder(len);
    const _isb = isBytes$1(len);
    return wrap({
        size: typeof len === 'number' ? len : undefined,
        encodeStream: (w, value) => {
            if (!_isb)
                _length.encodeStream(w, value.length);
            w.bytes(le ? swapEndianness(value) : value);
            if (_isb)
                w.bytes(len);
        },
        decodeStream: (r) => {
            let bytes;
            if (_isb) {
                const tPos = r.find(len);
                if (!tPos)
                    throw r.err(`bytes: cannot find terminator`);
                bytes = r.bytes(tPos - r.pos);
                r.bytes(len.length);
            }
            else {
                bytes = r.bytes(len === null ? r.leftBytes : _length.decodeStream(r));
            }
            return le ? swapEndianness(bytes) : bytes;
        },
        validate: (value) => {
            if (!isBytes$1(value))
                throw new Error(`bytes: invalid value ${value}`);
            return value;
        },
    });
};
/**
 * Prefix-encoded value using a length prefix and an inner CoderType.
 * The prefix can have:
 * - Dynamic size (prefixed with a length CoderType like U16BE)
 * - Fixed size (specified by a number)
 * - Unknown size (null, will parse until end of buffer)
 * - Zero-terminated (terminator can be any Uint8Array)
 * @param len - Length CoderType (dynamic size), number (fixed size), Uint8Array (for terminator), or null (will parse until end of buffer)
 * @param inner - CoderType for the actual value to be prefix-encoded.
 * @returns CoderType representing the prefix-encoded value.
 * @example
 * const dynamicPrefix = P.prefix(P.U16BE, P.bytes(null)); // Dynamic size prefix (prefixed with P.U16BE number of bytes length)
 * const fixedPrefix = P.prefix(10, P.bytes(null)); // Fixed size prefix (always 10 bytes)
 */
function prefix(len, inner) {
    if (!isCoder(inner))
        throw new Error(`prefix: invalid inner value ${inner}`);
    return apply(createBytes(len), reverse(inner));
}
/**
 * String CoderType with a specified length and endianness.
 * The string can be:
 * - Dynamic size (prefixed with a length CoderType like U16BE)
 * - Fixed size (specified by a number)
 * - Unknown size (null, will parse until end of buffer)
 * - Zero-terminated (terminator can be any Uint8Array)
 * @param len - Length CoderType (dynamic size), number (fixed size), Uint8Array (for terminator), or null (will parse until end of buffer)
 * @param le - Whether to use little-endian byte order.
 * @returns CoderType representing the string.
 * @example
 * const dynamicString = P.string(P.U16BE, false); // Dynamic size string (prefixed with P.U16BE number of string length)
 * const fixedString = P.string(10, false); // Fixed size string
 * const unknownString = P.string(null, false); // Unknown size string, will parse until end of buffer
 * const nullTerminatedString = P.cstring; // NUL-terminated string
 * const _cstring = P.string(new Uint8Array([0])); // Same thing
 */
const string = (len, le = false) => validate(apply(createBytes(len, le), utf8), (value) => {
    // TextEncoder/TextDecoder will fail on non-string, but we create more readable errors earlier
    if (typeof value !== 'string')
        throw new Error(`expected string, got ${typeof value}`);
    return value;
});
/**
 * Hexadecimal string CoderType with a specified length, endianness, and optional 0x prefix.
 * @param len - Length CoderType (dynamic size), number (fixed size), Uint8Array (for terminator), or null (will parse until end of buffer)
 * @param le - Whether to use little-endian byte order.
 * @param withZero - Whether to include the 0x prefix.
 * @returns CoderType representing the hexadecimal string.
 * @example
 * const dynamicHex = P.hex(P.U16BE, {isLE: false, with0x: true}); // Hex string with 0x prefix and U16BE length
 * const fixedHex = P.hex(32, {isLE: false, with0x: false}); // Fixed-length 32-byte hex string without 0x prefix
 */
const createHex = (len, options = { isLE: false, with0x: false }) => {
    let inner = apply(createBytes(len, options.isLE), hex);
    const prefix = options.with0x;
    if (typeof prefix !== 'boolean')
        throw new Error(`hex/with0x: expected boolean, got ${typeof prefix}`);
    if (prefix) {
        inner = apply(inner, {
            encode: (value) => `0x${value}`,
            decode: (value) => {
                if (!value.startsWith('0x'))
                    throw new Error('hex(with0x=true).encode input should start with 0x');
                return value.slice(2);
            },
        });
    }
    return inner;
};
/**
 * Applies a base coder to a CoderType.
 * @param inner - The inner CoderType.
 * @param b - The base coder to apply.
 * @returns CoderType representing the transformed value.
 * @example
 * import { hex } from '@scure/base';
 * const hex = P.apply(P.bytes(32), hex); // will decode bytes into a hex string
 */
function apply(inner, base) {
    if (!isCoder(inner))
        throw new Error(`apply: invalid inner value ${inner}`);
    if (!isBaseCoder(base))
        throw new Error(`apply: invalid base value ${inner}`);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => {
            let innerValue;
            try {
                innerValue = base.decode(value);
            }
            catch (e) {
                throw w.err('' + e);
            }
            return inner.encodeStream(w, innerValue);
        },
        decodeStream: (r) => {
            const innerValue = inner.decodeStream(r);
            try {
                return base.encode(innerValue);
            }
            catch (e) {
                throw r.err('' + e);
            }
        },
    });
}
/**
 * Flag CoderType that encodes/decodes a boolean value based on the presence of a marker.
 * @param flagValue - Marker value.
 * @param xor - Whether to invert the flag behavior.
 * @returns CoderType representing the flag value.
 * @example
 * const flag = P.flag(new Uint8Array([0x01, 0x02])); // Encodes true as u8a([0x01, 0x02]), false as u8a([])
 * const flagXor = P.flag(new Uint8Array([0x01, 0x02]), true); // Encodes true as u8a([]), false as u8a([0x01, 0x02])
 * // Conditional encoding with flagged
 * const s = P.struct({ f: P.flag(new Uint8Array([0x0, 0x1])), f2: P.flagged('f', P.U32BE) });
 */
const flag$1 = (flagValue, xor = false) => {
    if (!isBytes$1(flagValue))
        throw new Error(`flag/flagValue: expected Uint8Array, got ${typeof flagValue}`);
    if (typeof xor !== 'boolean')
        throw new Error(`flag/xor: expected boolean, got ${typeof xor}`);
    return wrap({
        size: flagValue.length,
        encodeStream: (w, value) => {
            if (!!value !== xor)
                w.bytes(flagValue);
        },
        decodeStream: (r) => {
            let hasFlag = r.leftBytes >= flagValue.length;
            if (hasFlag) {
                hasFlag = equalBytes$1(r.bytes(flagValue.length, true), flagValue);
                // Found flag, advance cursor position
                if (hasFlag)
                    r.bytes(flagValue.length);
            }
            return hasFlag !== xor; // hasFlag ^ xor
        },
        validate: (value) => {
            if (value !== undefined && typeof value !== 'boolean')
                throw new Error(`flag: expected boolean value or undefined, got ${typeof value}`);
            return value;
        },
    });
};
/**
 * Conditional CoderType that encodes/decodes a value only if a flag is present.
 * @param path - Path to the flag value or a CoderType for the flag.
 * @param inner - Inner CoderType for the value.
 * @param def - Optional default value to use if the flag is not present.
 * @returns CoderType representing the conditional value.
 * @example
 * const s = P.struct({
 *   f: P.flag(new Uint8Array([0x0, 0x1])),
 *   f2: P.flagged('f', P.U32BE)
 * });
 *
 * @example
 * const s2 = P.struct({
 *   f: P.flag(new Uint8Array([0x0, 0x1])),
 *   f2: P.flagged('f', P.U32BE, 123)
 * });
 */
function flagged(path, inner, def) {
    if (!isCoder(inner))
        throw new Error(`flagged: invalid inner value ${inner}`);
    return wrap({
        encodeStream: (w, value) => {
            {
                if (Path.resolve(w.stack, path))
                    inner.encodeStream(w, value);
            }
        },
        decodeStream: (r) => {
            let hasFlag = false;
            hasFlag = !!Path.resolve(r.stack, path);
            // If there is a flag -- decode and return value
            if (hasFlag)
                return inner.decodeStream(r);
            return;
        },
    });
}
/**
 * Magic value CoderType that encodes/decodes a constant value.
 * This can be used to check for a specific magic value or sequence of bytes at the beginning of a data structure.
 * @param inner - Inner CoderType for the value.
 * @param constant - Constant value.
 * @param check - Whether to check the decoded value against the constant.
 * @returns CoderType representing the magic value.
 * @example
 * // Always encodes constant as bytes using inner CoderType, throws if encoded value is not present
 * const magicU8 = P.magic(P.U8, 0x42);
 */
function magic(inner, constant, check = true) {
    if (!isCoder(inner))
        throw new Error(`magic: invalid inner value ${inner}`);
    if (typeof check !== 'boolean')
        throw new Error(`magic: expected boolean, got ${typeof check}`);
    return wrap({
        size: inner.size,
        encodeStream: (w, _value) => inner.encodeStream(w, constant),
        decodeStream: (r) => {
            const value = inner.decodeStream(r);
            if ((check && typeof value !== 'object' && value !== constant) ||
                (isBytes$1(constant) && !equalBytes$1(constant, value))) {
                throw r.err(`magic: invalid value: ${value} !== ${constant}`);
            }
            return;
        },
        validate: (value) => {
            if (value !== undefined)
                throw new Error(`magic: wrong value=${typeof value}`);
            return value;
        },
    });
}
function sizeof(fields) {
    let size = 0;
    for (const f of fields) {
        if (f.size === undefined)
            return;
        if (!isNum(f.size))
            throw new Error(`sizeof: wrong element size=${size}`);
        size += f.size;
    }
    return size;
}
/**
 * Structure of composable primitives (C/Rust struct)
 * @param fields - Object mapping field names to CoderTypes.
 * @returns CoderType representing the structure.
 * @example
 * // Define a structure with a 32-bit big-endian unsigned integer, a string, and a nested structure
 * const myStruct = P.struct({
 *   id: P.U32BE,
 *   name: P.string(P.U8),
 *   nested: P.struct({
 *     flag: P.bool,
 *     value: P.I16LE
 *   })
 * });
 */
function struct(fields) {
    if (!isPlainObject(fields))
        throw new Error(`struct: expected plain object, got ${fields}`);
    for (const name in fields) {
        if (!isCoder(fields[name]))
            throw new Error(`struct: field ${name} is not CoderType`);
    }
    return wrap({
        size: sizeof(Object.values(fields)),
        encodeStream: (w, value) => {
            w.pushObj(value, (fieldFn) => {
                for (const name in fields)
                    fieldFn(name, () => fields[name].encodeStream(w, value[name]));
            });
        },
        decodeStream: (r) => {
            const res = {};
            r.pushObj(res, (fieldFn) => {
                for (const name in fields)
                    fieldFn(name, () => (res[name] = fields[name].decodeStream(r)));
            });
            return res;
        },
        validate: (value) => {
            if (typeof value !== 'object' || value === null)
                throw new Error(`struct: invalid value ${value}`);
            return value;
        },
    });
}
/**
 * Tuple (unnamed structure) of CoderTypes. Same as struct but with unnamed fields.
 * @param fields - Array of CoderTypes.
 * @returns CoderType representing the tuple.
 * @example
 * const myTuple = P.tuple([P.U8, P.U16LE, P.string(P.U8)]);
 */
function tuple(fields) {
    if (!Array.isArray(fields))
        throw new Error(`Packed.Tuple: got ${typeof fields} instead of array`);
    for (let i = 0; i < fields.length; i++) {
        if (!isCoder(fields[i]))
            throw new Error(`tuple: field ${i} is not CoderType`);
    }
    return wrap({
        size: sizeof(fields),
        encodeStream: (w, value) => {
            // TODO: fix types
            if (!Array.isArray(value))
                throw w.err(`tuple: invalid value ${value}`);
            w.pushObj(value, (fieldFn) => {
                for (let i = 0; i < fields.length; i++)
                    fieldFn(`${i}`, () => fields[i].encodeStream(w, value[i]));
            });
        },
        decodeStream: (r) => {
            const res = [];
            r.pushObj(res, (fieldFn) => {
                for (let i = 0; i < fields.length; i++)
                    fieldFn(`${i}`, () => res.push(fields[i].decodeStream(r)));
            });
            return res;
        },
        validate: (value) => {
            if (!Array.isArray(value))
                throw new Error(`tuple: invalid value ${value}`);
            if (value.length !== fields.length)
                throw new Error(`tuple: wrong length=${value.length}, expected ${fields.length}`);
            return value;
        },
    });
}
/**
 * Array of items (inner type) with a specified length.
 * @param len - Length CoderType (dynamic size), number (fixed size), Uint8Array (for terminator), or null (will parse until end of buffer)
 * @param inner - CoderType for encoding/decoding each array item.
 * @returns CoderType representing the array.
 * @example
 * const a1 = P.array(P.U16BE, child); // Dynamic size array (prefixed with P.U16BE number of array length)
 * const a2 = P.array(4, child); // Fixed size array
 * const a3 = P.array(null, child); // Unknown size array, will parse until end of buffer
 * const a4 = P.array(new Uint8Array([0]), child); // zero-terminated array (NOTE: terminator can be any buffer)
 */
function array(len, inner) {
    if (!isCoder(inner))
        throw new Error(`array: invalid inner value ${inner}`);
    // By construction length is inside array (otherwise there will be various incorrect stack states)
    // But forcing users always write '..' seems like bad idea. Also, breaking change.
    const _length = lengthCoder(typeof len === 'string' ? `../${len}` : len);
    return wrap({
        size: typeof len === 'number' && inner.size ? len * inner.size : undefined,
        encodeStream: (w, value) => {
            const _w = w;
            _w.pushObj(value, (fieldFn) => {
                if (!isBytes$1(len))
                    _length.encodeStream(w, value.length);
                for (let i = 0; i < value.length; i++) {
                    fieldFn(`${i}`, () => {
                        const elm = value[i];
                        const startPos = w.pos;
                        inner.encodeStream(w, elm);
                        if (isBytes$1(len)) {
                            // Terminator is bigger than elm size, so skip
                            if (len.length > _w.pos - startPos)
                                return;
                            const data = _w.finish(false).subarray(startPos, _w.pos);
                            // There is still possible case when multiple elements create terminator,
                            // but it is hard to catch here, will be very slow
                            if (equalBytes$1(data.subarray(0, len.length), len))
                                throw _w.err(`array: inner element encoding same as separator. elm=${elm} data=${data}`);
                        }
                    });
                }
            });
            if (isBytes$1(len))
                w.bytes(len);
        },
        decodeStream: (r) => {
            const res = [];
            r.pushObj(res, (fieldFn) => {
                if (len === null) {
                    for (let i = 0; !r.isEnd(); i++) {
                        fieldFn(`${i}`, () => res.push(inner.decodeStream(r)));
                        if (inner.size && r.leftBytes < inner.size)
                            break;
                    }
                }
                else if (isBytes$1(len)) {
                    for (let i = 0;; i++) {
                        if (equalBytes$1(r.bytes(len.length, true), len)) {
                            // Advance cursor position if terminator found
                            r.bytes(len.length);
                            break;
                        }
                        fieldFn(`${i}`, () => res.push(inner.decodeStream(r)));
                    }
                }
                else {
                    let length;
                    fieldFn('arrayLen', () => (length = _length.decodeStream(r)));
                    for (let i = 0; i < length; i++)
                        fieldFn(`${i}`, () => res.push(inner.decodeStream(r)));
                }
            });
            return res;
        },
        validate: (value) => {
            if (!Array.isArray(value))
                throw new Error(`array: invalid value ${value}`);
            return value;
        },
    });
}

const Point$1 = secp256k1.ProjectivePoint;
const CURVE_ORDER = secp256k1.CURVE.n;
const isBytes = utils$1.isBytes;
const concatBytes = utils$1.concatBytes;
const equalBytes = utils$1.equalBytes;
const hash160$1 = (msg) => ripemd160$1(sha256$2(msg));
const sha256x2 = (...msgs) => sha256$2(sha256$2(concatBytes(...msgs)));
const pubSchnorr = schnorr.getPublicKey;
const pubECDSA = secp256k1.getPublicKey;
// low-r signature grinding. Used to reduce tx size by 1 byte.
// noble/secp256k1 does not support the feature: it is not used outside of BTC.
// We implement it manually, because in BTC it's common.
// Not best way, but closest to bitcoin implementation (easier to check)
const hasLowR = (sig) => sig.r < CURVE_ORDER / 2n;
function signECDSA(hash, privateKey, lowR = false) {
    let sig = secp256k1.sign(hash, privateKey);
    if (lowR && !hasLowR(sig)) {
        const extraEntropy = new Uint8Array(32);
        let counter = 0;
        while (!hasLowR(sig)) {
            extraEntropy.set(U32LE.encode(counter++));
            sig = secp256k1.sign(hash, privateKey, { extraEntropy });
            if (counter > 4294967295)
                throw new Error('lowR counter overflow: report the error');
        }
    }
    return sig.toDERRawBytes();
}
const signSchnorr = schnorr.sign;
const tagSchnorr = schnorr.utils.taggedHash;
var PubT;
(function (PubT) {
    PubT[PubT["ecdsa"] = 0] = "ecdsa";
    PubT[PubT["schnorr"] = 1] = "schnorr";
})(PubT || (PubT = {}));
function validatePubkey(pub, type) {
    const len = pub.length;
    if (type === PubT.ecdsa) {
        if (len === 32)
            throw new Error('Expected non-Schnorr key');
        Point$1.fromHex(pub); // does assertValidity
        return pub;
    }
    else if (type === PubT.schnorr) {
        if (len !== 32)
            throw new Error('Expected 32-byte Schnorr key');
        schnorr.utils.lift_x(schnorr.utils.bytesToNumberBE(pub));
        return pub;
    }
    else {
        throw new Error('Unknown key type');
    }
}
function tapTweak(a, b) {
    const u = schnorr.utils;
    const t = u.taggedHash('TapTweak', a, b);
    const tn = u.bytesToNumberBE(t);
    if (tn >= CURVE_ORDER)
        throw new Error('tweak higher than curve order');
    return tn;
}
function taprootTweakPrivKey(privKey, merkleRoot = Uint8Array.of()) {
    const u = schnorr.utils;
    const seckey0 = u.bytesToNumberBE(privKey); // seckey0 = int_from_bytes(seckey0)
    const P = Point$1.fromPrivateKey(seckey0); // P = point_mul(G, seckey0)
    // seckey = seckey0 if has_even_y(P) else SECP256K1_ORDER - seckey0
    const seckey = P.hasEvenY() ? seckey0 : u.mod(-seckey0, CURVE_ORDER);
    const xP = u.pointToBytes(P);
    // t = int_from_bytes(tagged_hash("TapTweak", bytes_from_int(x(P)) + h)); >= SECP256K1_ORDER check
    const t = tapTweak(xP, merkleRoot);
    // bytes_from_int((seckey + t) % SECP256K1_ORDER)
    return u.numberToBytesBE(u.mod(seckey + t, CURVE_ORDER), 32);
}
function taprootTweakPubkey(pubKey, h) {
    const u = schnorr.utils;
    const t = tapTweak(pubKey, h); // t = int_from_bytes(tagged_hash("TapTweak", pubkey + h))
    const P = u.lift_x(u.bytesToNumberBE(pubKey)); // P = lift_x(int_from_bytes(pubkey))
    const Q = P.add(Point$1.fromPrivateKey(t)); // Q = point_add(P, point_mul(G, t))
    const parity = Q.hasEvenY() ? 0 : 1; // 0 if has_even_y(Q) else 1
    return [u.pointToBytes(Q), parity]; // bytes_from_int(x(Q))
}
// Another stupid decision, where lack of standard affects security.
// Multisig needs to be generated with some key.
// We are using approach from BIP 341/bitcoinjs-lib: SHA256(uncompressedDER(SECP256K1_GENERATOR_POINT))
// It is possible to switch SECP256K1_GENERATOR_POINT with some random point;
// but it's too complex to prove.
// Also used by bitcoin-core and bitcoinjs-lib
sha256$2(Point$1.BASE.toRawBytes(false));
const NETWORK = {
    bech32: 'bc',
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
};
// Exported for tests, internal method
function compareBytes(a, b) {
    if (!isBytes(a) || !isBytes(b))
        throw new Error(`cmp: wrong type a=${typeof a} b=${typeof b}`);
    // -1 -> a<b, 0 -> a==b, 1 -> a>b
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++)
        if (a[i] != b[i])
            return Math.sign(a[i] - b[i]);
    return Math.sign(a.length - b.length);
}

// prettier-ignore
var OP;
(function (OP) {
    OP[OP["OP_0"] = 0] = "OP_0";
    OP[OP["PUSHDATA1"] = 76] = "PUSHDATA1";
    OP[OP["PUSHDATA2"] = 77] = "PUSHDATA2";
    OP[OP["PUSHDATA4"] = 78] = "PUSHDATA4";
    OP[OP["1NEGATE"] = 79] = "1NEGATE";
    OP[OP["RESERVED"] = 80] = "RESERVED";
    OP[OP["OP_1"] = 81] = "OP_1";
    OP[OP["OP_2"] = 82] = "OP_2";
    OP[OP["OP_3"] = 83] = "OP_3";
    OP[OP["OP_4"] = 84] = "OP_4";
    OP[OP["OP_5"] = 85] = "OP_5";
    OP[OP["OP_6"] = 86] = "OP_6";
    OP[OP["OP_7"] = 87] = "OP_7";
    OP[OP["OP_8"] = 88] = "OP_8";
    OP[OP["OP_9"] = 89] = "OP_9";
    OP[OP["OP_10"] = 90] = "OP_10";
    OP[OP["OP_11"] = 91] = "OP_11";
    OP[OP["OP_12"] = 92] = "OP_12";
    OP[OP["OP_13"] = 93] = "OP_13";
    OP[OP["OP_14"] = 94] = "OP_14";
    OP[OP["OP_15"] = 95] = "OP_15";
    OP[OP["OP_16"] = 96] = "OP_16";
    // Control
    OP[OP["NOP"] = 97] = "NOP";
    OP[OP["VER"] = 98] = "VER";
    OP[OP["IF"] = 99] = "IF";
    OP[OP["NOTIF"] = 100] = "NOTIF";
    OP[OP["VERIF"] = 101] = "VERIF";
    OP[OP["VERNOTIF"] = 102] = "VERNOTIF";
    OP[OP["ELSE"] = 103] = "ELSE";
    OP[OP["ENDIF"] = 104] = "ENDIF";
    OP[OP["VERIFY"] = 105] = "VERIFY";
    OP[OP["RETURN"] = 106] = "RETURN";
    // Stack
    OP[OP["TOALTSTACK"] = 107] = "TOALTSTACK";
    OP[OP["FROMALTSTACK"] = 108] = "FROMALTSTACK";
    OP[OP["2DROP"] = 109] = "2DROP";
    OP[OP["2DUP"] = 110] = "2DUP";
    OP[OP["3DUP"] = 111] = "3DUP";
    OP[OP["2OVER"] = 112] = "2OVER";
    OP[OP["2ROT"] = 113] = "2ROT";
    OP[OP["2SWAP"] = 114] = "2SWAP";
    OP[OP["IFDUP"] = 115] = "IFDUP";
    OP[OP["DEPTH"] = 116] = "DEPTH";
    OP[OP["DROP"] = 117] = "DROP";
    OP[OP["DUP"] = 118] = "DUP";
    OP[OP["NIP"] = 119] = "NIP";
    OP[OP["OVER"] = 120] = "OVER";
    OP[OP["PICK"] = 121] = "PICK";
    OP[OP["ROLL"] = 122] = "ROLL";
    OP[OP["ROT"] = 123] = "ROT";
    OP[OP["SWAP"] = 124] = "SWAP";
    OP[OP["TUCK"] = 125] = "TUCK";
    // Splice
    OP[OP["CAT"] = 126] = "CAT";
    OP[OP["SUBSTR"] = 127] = "SUBSTR";
    OP[OP["LEFT"] = 128] = "LEFT";
    OP[OP["RIGHT"] = 129] = "RIGHT";
    OP[OP["SIZE"] = 130] = "SIZE";
    // Boolean logic
    OP[OP["INVERT"] = 131] = "INVERT";
    OP[OP["AND"] = 132] = "AND";
    OP[OP["OR"] = 133] = "OR";
    OP[OP["XOR"] = 134] = "XOR";
    OP[OP["EQUAL"] = 135] = "EQUAL";
    OP[OP["EQUALVERIFY"] = 136] = "EQUALVERIFY";
    OP[OP["RESERVED1"] = 137] = "RESERVED1";
    OP[OP["RESERVED2"] = 138] = "RESERVED2";
    // Numbers
    OP[OP["1ADD"] = 139] = "1ADD";
    OP[OP["1SUB"] = 140] = "1SUB";
    OP[OP["2MUL"] = 141] = "2MUL";
    OP[OP["2DIV"] = 142] = "2DIV";
    OP[OP["NEGATE"] = 143] = "NEGATE";
    OP[OP["ABS"] = 144] = "ABS";
    OP[OP["NOT"] = 145] = "NOT";
    OP[OP["0NOTEQUAL"] = 146] = "0NOTEQUAL";
    OP[OP["ADD"] = 147] = "ADD";
    OP[OP["SUB"] = 148] = "SUB";
    OP[OP["MUL"] = 149] = "MUL";
    OP[OP["DIV"] = 150] = "DIV";
    OP[OP["MOD"] = 151] = "MOD";
    OP[OP["LSHIFT"] = 152] = "LSHIFT";
    OP[OP["RSHIFT"] = 153] = "RSHIFT";
    OP[OP["BOOLAND"] = 154] = "BOOLAND";
    OP[OP["BOOLOR"] = 155] = "BOOLOR";
    OP[OP["NUMEQUAL"] = 156] = "NUMEQUAL";
    OP[OP["NUMEQUALVERIFY"] = 157] = "NUMEQUALVERIFY";
    OP[OP["NUMNOTEQUAL"] = 158] = "NUMNOTEQUAL";
    OP[OP["LESSTHAN"] = 159] = "LESSTHAN";
    OP[OP["GREATERTHAN"] = 160] = "GREATERTHAN";
    OP[OP["LESSTHANOREQUAL"] = 161] = "LESSTHANOREQUAL";
    OP[OP["GREATERTHANOREQUAL"] = 162] = "GREATERTHANOREQUAL";
    OP[OP["MIN"] = 163] = "MIN";
    OP[OP["MAX"] = 164] = "MAX";
    OP[OP["WITHIN"] = 165] = "WITHIN";
    // Crypto
    OP[OP["RIPEMD160"] = 166] = "RIPEMD160";
    OP[OP["SHA1"] = 167] = "SHA1";
    OP[OP["SHA256"] = 168] = "SHA256";
    OP[OP["HASH160"] = 169] = "HASH160";
    OP[OP["HASH256"] = 170] = "HASH256";
    OP[OP["CODESEPARATOR"] = 171] = "CODESEPARATOR";
    OP[OP["CHECKSIG"] = 172] = "CHECKSIG";
    OP[OP["CHECKSIGVERIFY"] = 173] = "CHECKSIGVERIFY";
    OP[OP["CHECKMULTISIG"] = 174] = "CHECKMULTISIG";
    OP[OP["CHECKMULTISIGVERIFY"] = 175] = "CHECKMULTISIGVERIFY";
    // Expansion
    OP[OP["NOP1"] = 176] = "NOP1";
    OP[OP["CHECKLOCKTIMEVERIFY"] = 177] = "CHECKLOCKTIMEVERIFY";
    OP[OP["CHECKSEQUENCEVERIFY"] = 178] = "CHECKSEQUENCEVERIFY";
    OP[OP["NOP4"] = 179] = "NOP4";
    OP[OP["NOP5"] = 180] = "NOP5";
    OP[OP["NOP6"] = 181] = "NOP6";
    OP[OP["NOP7"] = 182] = "NOP7";
    OP[OP["NOP8"] = 183] = "NOP8";
    OP[OP["NOP9"] = 184] = "NOP9";
    OP[OP["NOP10"] = 185] = "NOP10";
    // BIP 342
    OP[OP["CHECKSIGADD"] = 186] = "CHECKSIGADD";
    // Invalid
    OP[OP["INVALID"] = 255] = "INVALID";
})(OP || (OP = {}));
// We can encode almost any number as ScriptNum, however, parsing will be a problem
// since we can't know if buffer is a number or something else.
function ScriptNum(bytesLimit = 6, forceMinimal = false) {
    return wrap({
        encodeStream: (w, value) => {
            if (value === 0n)
                return;
            const neg = value < 0;
            const val = BigInt(value);
            const nums = [];
            for (let abs = neg ? -val : val; abs; abs >>= 8n)
                nums.push(Number(abs & 0xffn));
            if (nums[nums.length - 1] >= 0x80)
                nums.push(neg ? 0x80 : 0);
            else if (neg)
                nums[nums.length - 1] |= 0x80;
            w.bytes(new Uint8Array(nums));
        },
        decodeStream: (r) => {
            const len = r.leftBytes;
            if (len > bytesLimit)
                throw new Error(`ScriptNum: number (${len}) bigger than limit=${bytesLimit}`);
            if (len === 0)
                return 0n;
            if (forceMinimal) {
                const data = r.bytes(len, true);
                // MSB is zero (without sign bit) -> not minimally encoded
                if ((data[data.length - 1] & 0x7f) === 0) {
                    // exception
                    if (len <= 1 || (data[data.length - 2] & 0x80) === 0)
                        throw new Error('Non-minimally encoded ScriptNum');
                }
            }
            let last = 0;
            let res = 0n;
            for (let i = 0; i < len; ++i) {
                last = r.byte();
                res |= BigInt(last) << (8n * BigInt(i));
            }
            if (last >= 0x80) {
                res &= (2n ** BigInt(len * 8) - 1n) >> 1n;
                res = -res;
            }
            return res;
        },
    });
}
function OpToNum(op, bytesLimit = 4, forceMinimal = true) {
    if (typeof op === 'number')
        return op;
    if (isBytes(op)) {
        try {
            const val = ScriptNum(bytesLimit, forceMinimal).decode(op);
            if (val > Number.MAX_SAFE_INTEGER)
                return;
            return Number(val);
        }
        catch (e) {
            return;
        }
    }
    return;
}
// Converts script bytes to parsed script
// 5221030000000000000000000000000000000000000000000000000000000000000001210300000000000000000000000000000000000000000000000000000000000000022103000000000000000000000000000000000000000000000000000000000000000353ae
// =>
// OP_2
//   030000000000000000000000000000000000000000000000000000000000000001
//   030000000000000000000000000000000000000000000000000000000000000002
//   030000000000000000000000000000000000000000000000000000000000000003
//   OP_3
//   CHECKMULTISIG
const Script = wrap({
    encodeStream: (w, value) => {
        for (let o of value) {
            if (typeof o === 'string') {
                if (OP[o] === undefined)
                    throw new Error(`Unknown opcode=${o}`);
                w.byte(OP[o]);
                continue;
            }
            else if (typeof o === 'number') {
                if (o === 0x00) {
                    w.byte(0x00);
                    continue;
                }
                else if (1 <= o && o <= 16) {
                    w.byte(OP.OP_1 - 1 + o);
                    continue;
                }
            }
            // Encode big numbers
            if (typeof o === 'number')
                o = ScriptNum().encode(BigInt(o));
            if (!isBytes(o))
                throw new Error(`Wrong Script OP=${o} (${typeof o})`);
            // Bytes
            const len = o.length;
            if (len < OP.PUSHDATA1)
                w.byte(len);
            else if (len <= 0xff) {
                w.byte(OP.PUSHDATA1);
                w.byte(len);
            }
            else if (len <= 0xffff) {
                w.byte(OP.PUSHDATA2);
                w.bytes(U16LE.encode(len));
            }
            else {
                w.byte(OP.PUSHDATA4);
                w.bytes(U32LE.encode(len));
            }
            w.bytes(o);
        }
    },
    decodeStream: (r) => {
        const out = [];
        while (!r.isEnd()) {
            const cur = r.byte();
            // if 0 < cur < 78
            if (OP.OP_0 < cur && cur <= OP.PUSHDATA4) {
                let len;
                if (cur < OP.PUSHDATA1)
                    len = cur;
                else if (cur === OP.PUSHDATA1)
                    len = U8.decodeStream(r);
                else if (cur === OP.PUSHDATA2)
                    len = U16LE.decodeStream(r);
                else if (cur === OP.PUSHDATA4)
                    len = U32LE.decodeStream(r);
                else
                    throw new Error('Should be not possible');
                out.push(r.bytes(len));
            }
            else if (cur === 0x00) {
                out.push(0);
            }
            else if (OP.OP_1 <= cur && cur <= OP.OP_16) {
                out.push(cur - (OP.OP_1 - 1));
            }
            else {
                const op = OP[cur];
                if (op === undefined)
                    throw new Error(`Unknown opcode=${cur.toString(16)}`);
                out.push(op);
            }
        }
        return out;
    },
});
// BTC specific variable length integer encoding
// https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer
const CSLimits = {
    0xfd: [0xfd, 2, 253n, 65535n],
    0xfe: [0xfe, 4, 65536n, 4294967295n],
    0xff: [0xff, 8, 4294967296n, 18446744073709551615n],
};
const CompactSize = wrap({
    encodeStream: (w, value) => {
        if (typeof value === 'number')
            value = BigInt(value);
        if (0n <= value && value <= 252n)
            return w.byte(Number(value));
        for (const [flag, bytes, start, stop] of Object.values(CSLimits)) {
            if (start > value || value > stop)
                continue;
            w.byte(flag);
            for (let i = 0; i < bytes; i++)
                w.byte(Number((value >> (8n * BigInt(i))) & 0xffn));
            return;
        }
        throw w.err(`VarInt too big: ${value}`);
    },
    decodeStream: (r) => {
        const b0 = r.byte();
        if (b0 <= 0xfc)
            return BigInt(b0);
        const [_, bytes, start] = CSLimits[b0];
        let num = 0n;
        for (let i = 0; i < bytes; i++)
            num |= BigInt(r.byte()) << (8n * BigInt(i));
        if (num < start)
            throw r.err(`Wrong CompactSize(${8 * bytes})`);
        return num;
    },
});
// Same thing, but in number instead of bigint. Checks for safe integer inside
const CompactSizeLen = apply(CompactSize, coders.numberBigint);
// ui8a of size <CompactSize>
const VarBytes = createBytes(CompactSize);
// SegWit v0 stack of witness buffers
const RawWitness = array(CompactSizeLen, VarBytes);
// Array of size <CompactSize>
const BTCArray = (t) => array(CompactSize, t);
const RawInput = struct({
    txid: createBytes(32, true), // hash(prev_tx),
    index: U32LE, // output number of previous tx
    finalScriptSig: VarBytes, // btc merges input and output script, executes it. If ok = tx passes
    sequence: U32LE, // ?
});
const RawOutput = struct({ amount: U64LE, script: VarBytes });
// https://en.bitcoin.it/wiki/Protocol_documentation#tx
const _RawTx = struct({
    version: I32LE,
    segwitFlag: flag$1(new Uint8Array([0x00, 0x01])),
    inputs: BTCArray(RawInput),
    outputs: BTCArray(RawOutput),
    witnesses: flagged('segwitFlag', array('inputs/length', RawWitness)),
    // < 500000000	Block number at which this transaction is unlocked
    // >= 500000000	UNIX timestamp at which this transaction is unlocked
    // Handled as part of PSBTv2
    lockTime: U32LE,
});
function validateRawTx(tx) {
    if (tx.segwitFlag && tx.witnesses && !tx.witnesses.length)
        throw new Error('Segwit flag with empty witnesses array');
    return tx;
}
const RawTx = validate(_RawTx, validateRawTx);
// Pre-SegWit serialization format (for PSBTv0)
const RawOldTx = struct({
    version: I32LE,
    inputs: BTCArray(RawInput),
    outputs: BTCArray(RawOutput),
    lockTime: U32LE,
});

// PSBT BIP174, BIP370, BIP371
// Can be 33 or 64 bytes
const PubKeyECDSA = validate(createBytes(null), (pub) => validatePubkey(pub, PubT.ecdsa));
const PubKeySchnorr = validate(createBytes(32), (pub) => validatePubkey(pub, PubT.schnorr));
const SignatureSchnorr = validate(createBytes(null), (sig) => {
    if (sig.length !== 64 && sig.length !== 65)
        throw new Error('Schnorr signature should be 64 or 65 bytes long');
    return sig;
});
const BIP32Der = struct({
    fingerprint: U32BE,
    path: array(null, U32LE),
});
const TaprootBIP32Der = struct({
    hashes: array(CompactSizeLen, createBytes(32)),
    der: BIP32Der,
});
// The 78 byte serialized extended public key as defined by BIP 32.
const GlobalXPUB = createBytes(78);
const tapScriptSigKey = struct({ pubKey: PubKeySchnorr, leafHash: createBytes(32) });
// Complex structure for PSBT fields
// <control byte with leaf version and parity bit> <internal key p> <C> <E> <AB>
const _TaprootControlBlock = struct({
    version: U8, // With parity :(
    internalKey: createBytes(32),
    merklePath: array(null, createBytes(32)),
});
const TaprootControlBlock = validate(_TaprootControlBlock, (cb) => {
    if (cb.merklePath.length > 128)
        throw new Error('TaprootControlBlock: merklePath should be of length 0..128 (inclusive)');
    return cb;
});
// {<8-bit uint depth> <8-bit uint leaf version> <compact size uint scriptlen> <bytes script>}*
const tapTree = array(null, struct({
    depth: U8,
    version: U8,
    script: VarBytes,
}));
const BytesInf = createBytes(null); // Bytes will conflict with Bytes type
const Bytes20 = createBytes(20);
const Bytes32 = createBytes(32);
// versionsRequiringExclusing = !versionsAllowsInclusion (as set)
// {name: [tag, keyCoder, valueCoder, versionsRequiringInclusion, versionsRequiringExclusing, versionsAllowsInclusion, silentIgnore]}
// SilentIgnore: we use some v2 fields for v1 representation too, so we just clean them before serialize
// Tables from BIP-0174 (https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)
// prettier-ignore
const PSBTGlobal = {
    unsignedTx: [0x00, false, RawOldTx, [0], [0], false],
    xpub: [0x01, GlobalXPUB, BIP32Der, [], [0, 2], false],
    txVersion: [0x02, false, U32LE, [2], [2], false],
    fallbackLocktime: [0x03, false, U32LE, [], [2], false],
    inputCount: [0x04, false, CompactSizeLen, [2], [2], false],
    outputCount: [0x05, false, CompactSizeLen, [2], [2], false],
    txModifiable: [0x06, false, U8, [], [2], false], // TODO: bitfield
    version: [0xfb, false, U32LE, [], [0, 2], false],
    proprietary: [0xfc, BytesInf, BytesInf, [], [0, 2], false],
};
// prettier-ignore
const PSBTInput = {
    nonWitnessUtxo: [0x00, false, RawTx, [], [0, 2], false],
    witnessUtxo: [0x01, false, RawOutput, [], [0, 2], false],
    partialSig: [0x02, PubKeyECDSA, BytesInf, [], [0, 2], false],
    sighashType: [0x03, false, U32LE, [], [0, 2], false],
    redeemScript: [0x04, false, BytesInf, [], [0, 2], false],
    witnessScript: [0x05, false, BytesInf, [], [0, 2], false],
    bip32Derivation: [0x06, PubKeyECDSA, BIP32Der, [], [0, 2], false],
    finalScriptSig: [0x07, false, BytesInf, [], [0, 2], false],
    finalScriptWitness: [0x08, false, RawWitness, [], [0, 2], false],
    porCommitment: [0x09, false, BytesInf, [], [0, 2], false],
    ripemd160: [0x0a, Bytes20, BytesInf, [], [0, 2], false],
    sha256: [0x0b, Bytes32, BytesInf, [], [0, 2], false],
    hash160: [0x0c, Bytes20, BytesInf, [], [0, 2], false],
    hash256: [0x0d, Bytes32, BytesInf, [], [0, 2], false],
    txid: [0x0e, false, Bytes32, [2], [2], true],
    index: [0x0f, false, U32LE, [2], [2], true],
    sequence: [0x10, false, U32LE, [], [2], true],
    requiredTimeLocktime: [0x11, false, U32LE, [], [2], false],
    requiredHeightLocktime: [0x12, false, U32LE, [], [2], false],
    tapKeySig: [0x13, false, SignatureSchnorr, [], [0, 2], false],
    tapScriptSig: [0x14, tapScriptSigKey, SignatureSchnorr, [], [0, 2], false],
    tapLeafScript: [0x15, TaprootControlBlock, BytesInf, [], [0, 2], false],
    tapBip32Derivation: [0x16, Bytes32, TaprootBIP32Der, [], [0, 2], false],
    tapInternalKey: [0x17, false, PubKeySchnorr, [], [0, 2], false],
    tapMerkleRoot: [0x18, false, Bytes32, [], [0, 2], false],
    proprietary: [0xfc, BytesInf, BytesInf, [], [0, 2], false],
};
// All other keys removed when finalizing
const PSBTInputFinalKeys = [
    'txid',
    'sequence',
    'index',
    'witnessUtxo',
    'nonWitnessUtxo',
    'finalScriptSig',
    'finalScriptWitness',
    'unknown',
];
// Can be modified even on signed input
const PSBTInputUnsignedKeys = [
    'partialSig',
    'finalScriptSig',
    'finalScriptWitness',
    'tapKeySig',
    'tapScriptSig',
];
// prettier-ignore
const PSBTOutput = {
    redeemScript: [0x00, false, BytesInf, [], [0, 2], false],
    witnessScript: [0x01, false, BytesInf, [], [0, 2], false],
    bip32Derivation: [0x02, PubKeyECDSA, BIP32Der, [], [0, 2], false],
    amount: [0x03, false, I64LE, [2], [2], true],
    script: [0x04, false, BytesInf, [2], [2], true],
    tapInternalKey: [0x05, false, PubKeySchnorr, [], [0, 2], false],
    tapTree: [0x06, false, tapTree, [], [0, 2], false],
    tapBip32Derivation: [0x07, PubKeySchnorr, TaprootBIP32Der, [], [0, 2], false],
    proprietary: [0xfc, BytesInf, BytesInf, [], [0, 2], false],
};
// Can be modified even on signed input
const PSBTOutputUnsignedKeys = [];
const PSBTKeyPair = array(NULL, struct({
    //  <key> := <keylen> <keytype> <keydata> WHERE keylen = len(keytype)+len(keydata)
    key: prefix(CompactSizeLen, struct({ type: CompactSizeLen, key: createBytes(null) })),
    //  <value> := <valuelen> <valuedata>
    value: createBytes(CompactSizeLen),
}));
function PSBTKeyInfo(info) {
    const [type, kc, vc, reqInc, allowInc, silentIgnore] = info;
    return { type, kc, vc, reqInc, allowInc, silentIgnore };
}
struct({ type: CompactSizeLen, key: createBytes(null) });
// Key cannot be 'unknown', value coder cannot be array for elements with empty key
function PSBTKeyMap(psbtEnum) {
    // -> Record<type, [keyName, ...coders]>
    const byType = {};
    for (const k in psbtEnum) {
        const [num, kc, vc] = psbtEnum[k];
        byType[num] = [k, kc, vc];
    }
    return wrap({
        encodeStream: (w, value) => {
            let out = [];
            // Because we use order of psbtEnum, keymap is sorted here
            for (const name in psbtEnum) {
                const val = value[name];
                if (val === undefined)
                    continue;
                const [type, kc, vc] = psbtEnum[name];
                if (!kc) {
                    out.push({ key: { type, key: EMPTY }, value: vc.encode(val) });
                }
                else {
                    // Low level interface, returns keys as is (with duplicates). Useful for debug
                    const kv = val.map(([k, v]) => [
                        kc.encode(k),
                        vc.encode(v),
                    ]);
                    // sort by keys
                    kv.sort((a, b) => compareBytes(a[0], b[0]));
                    for (const [key, value] of kv)
                        out.push({ key: { key, type }, value });
                }
            }
            if (value.unknown) {
                value.unknown.sort((a, b) => compareBytes(a[0].key, b[0].key));
                for (const [k, v] of value.unknown)
                    out.push({ key: k, value: v });
            }
            PSBTKeyPair.encodeStream(w, out);
        },
        decodeStream: (r) => {
            const raw = PSBTKeyPair.decodeStream(r);
            const out = {};
            const noKey = {};
            for (const elm of raw) {
                let name = 'unknown';
                let key = elm.key.key;
                let value = elm.value;
                if (byType[elm.key.type]) {
                    const [_name, kc, vc] = byType[elm.key.type];
                    name = _name;
                    if (!kc && key.length) {
                        throw new Error(`PSBT: Non-empty key for ${name} (key=${hex.encode(key)} value=${hex.encode(value)}`);
                    }
                    key = kc ? kc.decode(key) : undefined;
                    value = vc.decode(value);
                    if (!kc) {
                        if (out[name])
                            throw new Error(`PSBT: Same keys: ${name} (key=${key} value=${value})`);
                        out[name] = value;
                        noKey[name] = true;
                        continue;
                    }
                }
                else {
                    // For unknown: add key type inside key
                    key = { type: elm.key.type, key: elm.key.key };
                }
                // Only keyed elements at this point
                if (noKey[name])
                    throw new Error(`PSBT: Key type with empty key and no key=${name} val=${value}`);
                if (!out[name])
                    out[name] = [];
                out[name].push([key, value]);
            }
            return out;
        },
    });
}
const PSBTInputCoder = validate(PSBTKeyMap(PSBTInput), (i) => {
    if (i.finalScriptWitness && !i.finalScriptWitness.length)
        throw new Error('validateInput: empty finalScriptWitness');
    //if (i.finalScriptSig && !i.finalScriptSig.length) throw new Error('validateInput: empty finalScriptSig');
    if (i.partialSig && !i.partialSig.length)
        throw new Error('Empty partialSig');
    if (i.partialSig)
        for (const [k] of i.partialSig)
            validatePubkey(k, PubT.ecdsa);
    if (i.bip32Derivation)
        for (const [k] of i.bip32Derivation)
            validatePubkey(k, PubT.ecdsa);
    // Locktime = unsigned little endian integer greater than or equal to 500000000 representing
    if (i.requiredTimeLocktime !== undefined && i.requiredTimeLocktime < 500000000)
        throw new Error(`validateInput: wrong timeLocktime=${i.requiredTimeLocktime}`);
    // unsigned little endian integer greater than 0 and less than 500000000
    if (i.requiredHeightLocktime !== undefined &&
        (i.requiredHeightLocktime <= 0 || i.requiredHeightLocktime >= 500000000))
        throw new Error(`validateInput: wrong heighLocktime=${i.requiredHeightLocktime}`);
    if (i.tapLeafScript) {
        // tap leaf version appears here twice: in control block and at the end of script
        for (const [k, v] of i.tapLeafScript) {
            if ((k.version & 254) !== v[v.length - 1])
                throw new Error('validateInput: tapLeafScript version mimatch');
            if (v[v.length - 1] & 1)
                throw new Error('validateInput: tapLeafScript version has parity bit!');
        }
    }
    return i;
});
const PSBTOutputCoder = validate(PSBTKeyMap(PSBTOutput), (o) => {
    if (o.bip32Derivation)
        for (const [k] of o.bip32Derivation)
            validatePubkey(k, PubT.ecdsa);
    return o;
});
const PSBTGlobalCoder = validate(PSBTKeyMap(PSBTGlobal), (g) => {
    const version = g.version || 0;
    if (version === 0) {
        if (!g.unsignedTx)
            throw new Error('PSBTv0: missing unsignedTx');
        for (const inp of g.unsignedTx.inputs)
            if (inp.finalScriptSig && inp.finalScriptSig.length)
                throw new Error('PSBTv0: input scriptSig found in unsignedTx');
    }
    return g;
});
const _RawPSBTV0 = struct({
    magic: magic(string(new Uint8Array([0xff])), 'psbt'),
    global: PSBTGlobalCoder,
    inputs: array('global/unsignedTx/inputs/length', PSBTInputCoder),
    outputs: array(null, PSBTOutputCoder),
});
const _RawPSBTV2 = struct({
    magic: magic(string(new Uint8Array([0xff])), 'psbt'),
    global: PSBTGlobalCoder,
    inputs: array('global/inputCount', PSBTInputCoder),
    outputs: array('global/outputCount', PSBTOutputCoder),
});
struct({
    magic: magic(string(new Uint8Array([0xff])), 'psbt'),
    items: array(null, apply(array(NULL, tuple([createHex(CompactSizeLen), createBytes(CompactSize)])), coders.dict())),
});
function validatePSBTFields(version, info, lst) {
    for (const k in lst) {
        if (k === 'unknown')
            continue;
        if (!info[k])
            continue;
        const { allowInc } = PSBTKeyInfo(info[k]);
        if (!allowInc.includes(version))
            throw new Error(`PSBTv${version}: field ${k} is not allowed`);
    }
    for (const k in info) {
        const { reqInc } = PSBTKeyInfo(info[k]);
        if (reqInc.includes(version) && lst[k] === undefined)
            throw new Error(`PSBTv${version}: missing required field ${k}`);
    }
}
function cleanPSBTFields(version, info, lst) {
    const out = {};
    for (const _k in lst) {
        const k = _k;
        if (k !== 'unknown') {
            if (!info[k])
                continue;
            const { allowInc, silentIgnore } = PSBTKeyInfo(info[k]);
            if (!allowInc.includes(version)) {
                if (silentIgnore)
                    continue;
                throw new Error(`Failed to serialize in PSBTv${version}: ${k} but versions allows inclusion=${allowInc}`);
            }
        }
        out[k] = lst[k];
    }
    return out;
}
function validatePSBT(tx) {
    const version = (tx && tx.global && tx.global.version) || 0;
    validatePSBTFields(version, PSBTGlobal, tx.global);
    for (const i of tx.inputs)
        validatePSBTFields(version, PSBTInput, i);
    for (const o of tx.outputs)
        validatePSBTFields(version, PSBTOutput, o);
    // We allow only one empty element at the end of map (compat with bitcoinjs-lib bug)
    const inputCount = !version ? tx.global.unsignedTx.inputs.length : tx.global.inputCount;
    if (tx.inputs.length < inputCount)
        throw new Error('Not enough inputs');
    const inputsLeft = tx.inputs.slice(inputCount);
    if (inputsLeft.length > 1 || (inputsLeft.length && Object.keys(inputsLeft[0]).length))
        throw new Error(`Unexpected inputs left in tx=${inputsLeft}`);
    // Same for inputs
    const outputCount = !version ? tx.global.unsignedTx.outputs.length : tx.global.outputCount;
    if (tx.outputs.length < outputCount)
        throw new Error('Not outputs inputs');
    const outputsLeft = tx.outputs.slice(outputCount);
    if (outputsLeft.length > 1 || (outputsLeft.length && Object.keys(outputsLeft[0]).length))
        throw new Error(`Unexpected outputs left in tx=${outputsLeft}`);
    return tx;
}
function mergeKeyMap(psbtEnum, val, cur, allowedFields, allowUnknown) {
    const res = { ...cur, ...val };
    // All arguments can be provided as hex
    for (const k in psbtEnum) {
        const key = k;
        const [_, kC, vC] = psbtEnum[key];
        const cannotChange = allowedFields && !allowedFields.includes(k);
        if (val[k] === undefined && k in val) {
            if (cannotChange)
                throw new Error(`Cannot remove signed field=${k}`);
            delete res[k];
        }
        else if (kC) {
            const oldKV = (cur && cur[k] ? cur[k] : []);
            let newKV = val[key];
            if (newKV) {
                if (!Array.isArray(newKV))
                    throw new Error(`keyMap(${k}): KV pairs should be [k, v][]`);
                // Decode hex in k-v
                newKV = newKV.map((val) => {
                    if (val.length !== 2)
                        throw new Error(`keyMap(${k}): KV pairs should be [k, v][]`);
                    return [
                        typeof val[0] === 'string' ? kC.decode(hex.decode(val[0])) : val[0],
                        typeof val[1] === 'string' ? vC.decode(hex.decode(val[1])) : val[1],
                    ];
                });
                const map = {};
                const add = (kStr, k, v) => {
                    if (map[kStr] === undefined) {
                        map[kStr] = [k, v];
                        return;
                    }
                    const oldVal = hex.encode(vC.encode(map[kStr][1]));
                    const newVal = hex.encode(vC.encode(v));
                    if (oldVal !== newVal)
                        throw new Error(`keyMap(${key}): same key=${kStr} oldVal=${oldVal} newVal=${newVal}`);
                };
                for (const [k, v] of oldKV) {
                    const kStr = hex.encode(kC.encode(k));
                    add(kStr, k, v);
                }
                for (const [k, v] of newKV) {
                    const kStr = hex.encode(kC.encode(k));
                    // undefined removes previous value
                    if (v === undefined) {
                        if (cannotChange)
                            throw new Error(`Cannot remove signed field=${key}/${k}`);
                        delete map[kStr];
                    }
                    else
                        add(kStr, k, v);
                }
                res[key] = Object.values(map);
            }
        }
        else if (typeof res[k] === 'string') {
            res[k] = vC.decode(hex.decode(res[k]));
        }
        else if (cannotChange && k in val && cur && cur[k] !== undefined) {
            if (!equalBytes(vC.encode(val[k]), vC.encode(cur[k])))
                throw new Error(`Cannot change signed field=${k}`);
        }
    }
    // Remove unknown keys except the "unknown" array if allowUnknown is true
    for (const k in res) {
        if (!psbtEnum[k]) {
            if (allowUnknown && k === 'unknown')
                continue;
            delete res[k];
        }
    }
    return res;
}
const RawPSBTV0 = validate(_RawPSBTV0, validatePSBT);
const RawPSBTV2 = validate(_RawPSBTV2, validatePSBT);

const OutP2A = {
    encode(from) {
        if (from.length !== 2 || from[0] !== 1 || !isBytes(from[1]) || hex.encode(from[1]) !== '4e73')
            return;
        return { type: 'p2a', script: Script.encode(from) };
    },
    decode: (to) => {
        if (to.type !== 'p2a')
            return;
        return [1, hex.decode('4e73')];
    },
};
function isValidPubkey(pub, type) {
    try {
        validatePubkey(pub, type);
        return true;
    }
    catch (e) {
        return false;
    }
}
const OutPK = {
    encode(from) {
        if (from.length !== 2 ||
            !isBytes(from[0]) ||
            !isValidPubkey(from[0], PubT.ecdsa) ||
            from[1] !== 'CHECKSIG')
            return;
        return { type: 'pk', pubkey: from[0] };
    },
    decode: (to) => (to.type === 'pk' ? [to.pubkey, 'CHECKSIG'] : undefined),
};
const OutPKH = {
    encode(from) {
        if (from.length !== 5 || from[0] !== 'DUP' || from[1] !== 'HASH160' || !isBytes(from[2]))
            return;
        if (from[3] !== 'EQUALVERIFY' || from[4] !== 'CHECKSIG')
            return;
        return { type: 'pkh', hash: from[2] };
    },
    decode: (to) => to.type === 'pkh' ? ['DUP', 'HASH160', to.hash, 'EQUALVERIFY', 'CHECKSIG'] : undefined,
};
const OutSH = {
    encode(from) {
        if (from.length !== 3 || from[0] !== 'HASH160' || !isBytes(from[1]) || from[2] !== 'EQUAL')
            return;
        return { type: 'sh', hash: from[1] };
    },
    decode: (to) => to.type === 'sh' ? ['HASH160', to.hash, 'EQUAL'] : undefined,
};
const OutWSH = {
    encode(from) {
        if (from.length !== 2 || from[0] !== 0 || !isBytes(from[1]))
            return;
        if (from[1].length !== 32)
            return;
        return { type: 'wsh', hash: from[1] };
    },
    decode: (to) => (to.type === 'wsh' ? [0, to.hash] : undefined),
};
const OutWPKH = {
    encode(from) {
        if (from.length !== 2 || from[0] !== 0 || !isBytes(from[1]))
            return;
        if (from[1].length !== 20)
            return;
        return { type: 'wpkh', hash: from[1] };
    },
    decode: (to) => (to.type === 'wpkh' ? [0, to.hash] : undefined),
};
const OutMS = {
    encode(from) {
        const last = from.length - 1;
        if (from[last] !== 'CHECKMULTISIG')
            return;
        const m = from[0];
        const n = from[last - 1];
        if (typeof m !== 'number' || typeof n !== 'number')
            return;
        const pubkeys = from.slice(1, -2);
        if (n !== pubkeys.length)
            return;
        for (const pub of pubkeys)
            if (!isBytes(pub))
                return;
        return { type: 'ms', m, pubkeys: pubkeys }; // we don't need n, since it is the same as pubkeys
    },
    // checkmultisig(n, ..pubkeys, m)
    decode: (to) => to.type === 'ms' ? [to.m, ...to.pubkeys, to.pubkeys.length, 'CHECKMULTISIG'] : undefined,
};
const OutTR = {
    encode(from) {
        if (from.length !== 2 || from[0] !== 1 || !isBytes(from[1]))
            return;
        return { type: 'tr', pubkey: from[1] };
    },
    decode: (to) => (to.type === 'tr' ? [1, to.pubkey] : undefined),
};
const OutTRNS = {
    encode(from) {
        const last = from.length - 1;
        if (from[last] !== 'CHECKSIG')
            return;
        const pubkeys = [];
        // On error return, since it can be different script
        for (let i = 0; i < last; i++) {
            const elm = from[i];
            if (i & 1) {
                if (elm !== 'CHECKSIGVERIFY' || i === last - 1)
                    return;
                continue;
            }
            if (!isBytes(elm))
                return;
            pubkeys.push(elm);
        }
        return { type: 'tr_ns', pubkeys };
    },
    decode: (to) => {
        if (to.type !== 'tr_ns')
            return;
        const out = [];
        for (let i = 0; i < to.pubkeys.length - 1; i++)
            out.push(to.pubkeys[i], 'CHECKSIGVERIFY');
        out.push(to.pubkeys[to.pubkeys.length - 1], 'CHECKSIG');
        return out;
    },
};
const OutTRMS = {
    encode(from) {
        const last = from.length - 1;
        if (from[last] !== 'NUMEQUAL' || from[1] !== 'CHECKSIG')
            return;
        const pubkeys = [];
        const m = OpToNum(from[last - 1]);
        if (typeof m !== 'number')
            return;
        for (let i = 0; i < last - 1; i++) {
            const elm = from[i];
            if (i & 1) {
                if (elm !== (i === 1 ? 'CHECKSIG' : 'CHECKSIGADD'))
                    throw new Error('OutScript.encode/tr_ms: wrong element');
                continue;
            }
            if (!isBytes(elm))
                throw new Error('OutScript.encode/tr_ms: wrong key element');
            pubkeys.push(elm);
        }
        return { type: 'tr_ms', pubkeys, m };
    },
    decode: (to) => {
        if (to.type !== 'tr_ms')
            return;
        const out = [to.pubkeys[0], 'CHECKSIG'];
        for (let i = 1; i < to.pubkeys.length; i++)
            out.push(to.pubkeys[i], 'CHECKSIGADD');
        out.push(to.m, 'NUMEQUAL');
        return out;
    },
};
const OutUnknown = {
    encode(from) {
        return { type: 'unknown', script: Script.encode(from) };
    },
    decode: (to) => to.type === 'unknown' ? Script.decode(to.script) : undefined,
};
// /Payments
const OutScripts = [
    OutP2A,
    OutPK,
    OutPKH,
    OutSH,
    OutWSH,
    OutWPKH,
    OutMS,
    OutTR,
    OutTRNS,
    OutTRMS,
    OutUnknown,
];
// TODO: we can support user supplied output scripts now
// - addOutScript
// - removeOutScript
// - We can do that as log we modify array in-place
// - Actually is very hard, since there is sign/finalize logic
const _OutScript = apply(Script, coders.match(OutScripts));
// We can validate this once, because of packed & coders
const OutScript = validate(_OutScript, (i) => {
    if (i.type === 'pk' && !isValidPubkey(i.pubkey, PubT.ecdsa))
        throw new Error('OutScript/pk: wrong key');
    if ((i.type === 'pkh' || i.type === 'sh' || i.type === 'wpkh') &&
        (!isBytes(i.hash) || i.hash.length !== 20))
        throw new Error(`OutScript/${i.type}: wrong hash`);
    if (i.type === 'wsh' && (!isBytes(i.hash) || i.hash.length !== 32))
        throw new Error(`OutScript/wsh: wrong hash`);
    if (i.type === 'tr' && (!isBytes(i.pubkey) || !isValidPubkey(i.pubkey, PubT.schnorr)))
        throw new Error('OutScript/tr: wrong taproot public key');
    if (i.type === 'ms' || i.type === 'tr_ns' || i.type === 'tr_ms')
        if (!Array.isArray(i.pubkeys))
            throw new Error('OutScript/multisig: wrong pubkeys array');
    if (i.type === 'ms') {
        const n = i.pubkeys.length;
        for (const p of i.pubkeys)
            if (!isValidPubkey(p, PubT.ecdsa))
                throw new Error('OutScript/multisig: wrong pubkey');
        if (i.m <= 0 || n > 16 || i.m > n)
            throw new Error('OutScript/multisig: invalid params');
    }
    if (i.type === 'tr_ns' || i.type === 'tr_ms') {
        for (const p of i.pubkeys)
            if (!isValidPubkey(p, PubT.schnorr))
                throw new Error(`OutScript/${i.type}: wrong pubkey`);
    }
    if (i.type === 'tr_ms') {
        const n = i.pubkeys.length;
        if (i.m <= 0 || n > 999 || i.m > n)
            throw new Error('OutScript/tr_ms: invalid params');
    }
    return i;
});
// Basic sanity check for scripts
function checkWSH(s, witnessScript) {
    if (!equalBytes(s.hash, sha256$2(witnessScript)))
        throw new Error('checkScript: wsh wrong witnessScript hash');
    const w = OutScript.decode(witnessScript);
    if (w.type === 'tr' || w.type === 'tr_ns' || w.type === 'tr_ms')
        throw new Error(`checkScript: P2${w.type} cannot be wrapped in P2SH`);
    if (w.type === 'wpkh' || w.type === 'sh')
        throw new Error(`checkScript: P2${w.type} cannot be wrapped in P2WSH`);
}
function checkScript(script, redeemScript, witnessScript) {
    if (script) {
        const s = OutScript.decode(script);
        // ms||pk maybe work, but there will be no address, hard to spend
        if (s.type === 'tr_ns' || s.type === 'tr_ms' || s.type === 'ms' || s.type == 'pk')
            throw new Error(`checkScript: non-wrapped ${s.type}`);
        if (s.type === 'sh' && redeemScript) {
            if (!equalBytes(s.hash, hash160$1(redeemScript)))
                throw new Error('checkScript: sh wrong redeemScript hash');
            const r = OutScript.decode(redeemScript);
            if (r.type === 'tr' || r.type === 'tr_ns' || r.type === 'tr_ms')
                throw new Error(`checkScript: P2${r.type} cannot be wrapped in P2SH`);
            // Not sure if this unspendable, but we cannot represent this via PSBT
            if (r.type === 'sh')
                throw new Error('checkScript: P2SH cannot be wrapped in P2SH');
        }
        if (s.type === 'wsh' && witnessScript)
            checkWSH(s, witnessScript);
    }
    if (redeemScript) {
        const r = OutScript.decode(redeemScript);
        if (r.type === 'wsh' && witnessScript)
            checkWSH(r, witnessScript);
    }
}
const TAP_LEAF_VERSION = 0xc0;
const tapLeafHash = (script, version = TAP_LEAF_VERSION) => tagSchnorr('TapLeaf', new Uint8Array([version]), VarBytes.encode(script));
const base58check = createBase58check(sha256$2);
function validateWitness(version, data) {
    if (data.length < 2 || data.length > 40)
        throw new Error('Witness: invalid length');
    if (version > 16)
        throw new Error('Witness: invalid version');
    if (version === 0 && !(data.length === 20 || data.length === 32))
        throw new Error('Witness: invalid length for version');
}
function programToWitness(version, data, network = NETWORK) {
    validateWitness(version, data);
    const coder = version === 0 ? bech32 : bech32m;
    return coder.encode(network.bech32, [version].concat(coder.toWords(data)));
}
function formatKey(hashed, prefix) {
    return base58check.encode(concatBytes(Uint8Array.from(prefix), hashed));
}
// Returns OutType, which can be used to create outscript
function Address(network = NETWORK) {
    return {
        encode(from) {
            const { type } = from;
            if (type === 'wpkh')
                return programToWitness(0, from.hash, network);
            else if (type === 'wsh')
                return programToWitness(0, from.hash, network);
            else if (type === 'tr')
                return programToWitness(1, from.pubkey, network);
            else if (type === 'pkh')
                return formatKey(from.hash, [network.pubKeyHash]);
            else if (type === 'sh')
                return formatKey(from.hash, [network.scriptHash]);
            throw new Error(`Unknown address type=${type}`);
        },
        decode(address) {
            if (address.length < 14 || address.length > 74)
                throw new Error('Invalid address length');
            // Bech32
            if (network.bech32 && address.toLowerCase().startsWith(`${network.bech32}1`)) {
                let res;
                try {
                    res = bech32.decode(address);
                    if (res.words[0] !== 0)
                        throw new Error(`bech32: wrong version=${res.words[0]}`);
                }
                catch (_) {
                    // Starting from version 1 it is decoded as bech32m
                    res = bech32m.decode(address);
                    if (res.words[0] === 0)
                        throw new Error(`bech32m: wrong version=${res.words[0]}`);
                }
                if (res.prefix !== network.bech32)
                    throw new Error(`wrong bech32 prefix=${res.prefix}`);
                const [version, ...program] = res.words;
                const data = bech32.fromWords(program);
                validateWitness(version, data);
                if (version === 0 && data.length === 32)
                    return { type: 'wsh', hash: data };
                else if (version === 0 && data.length === 20)
                    return { type: 'wpkh', hash: data };
                else if (version === 1 && data.length === 32)
                    return { type: 'tr', pubkey: data };
                else
                    throw new Error('Unknown witness program');
            }
            const data = base58check.decode(address);
            if (data.length !== 21)
                throw new Error('Invalid base58 address');
            // Pay To Public Key Hash
            if (data[0] === network.pubKeyHash) {
                return { type: 'pkh', hash: data.slice(1) };
            }
            else if (data[0] === network.scriptHash) {
                return {
                    type: 'sh',
                    hash: data.slice(1),
                };
            }
            throw new Error(`Invalid address prefix=${data[0]}`);
        },
    };
}

const EMPTY32 = new Uint8Array(32);
const EMPTY_OUTPUT = {
    amount: 0xffffffffffffffffn,
    script: EMPTY,
};
const toVsize = (weight) => Math.ceil(weight / 4);
const PRECISION = 8;
const DEFAULT_VERSION$2 = 2;
const DEFAULT_LOCKTIME = 0;
const DEFAULT_SEQUENCE = 4294967295;
coders.decimal(PRECISION);
// Same as value || def, but doesn't overwrites zero ('0', 0, 0n, etc)
const def = (value, def) => (value === undefined ? def : value);
function cloneDeep(obj) {
    if (Array.isArray(obj))
        return obj.map((i) => cloneDeep(i));
    // slice of nodejs Buffer doesn't copy
    else if (isBytes(obj))
        return Uint8Array.from(obj);
    // immutable
    else if (['number', 'bigint', 'boolean', 'string', 'undefined'].includes(typeof obj))
        return obj;
    // null is object
    else if (obj === null)
        return obj;
    // should be last, so it won't catch other types
    else if (typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, cloneDeep(v)]));
    }
    throw new Error(`cloneDeep: unknown type=${obj} (${typeof obj})`);
}
/**
 * Internal, exported only for backwards-compat. Use `SigHash` instead.
 * @deprecated
 */
var SignatureHash;
(function (SignatureHash) {
    SignatureHash[SignatureHash["DEFAULT"] = 0] = "DEFAULT";
    SignatureHash[SignatureHash["ALL"] = 1] = "ALL";
    SignatureHash[SignatureHash["NONE"] = 2] = "NONE";
    SignatureHash[SignatureHash["SINGLE"] = 3] = "SINGLE";
    SignatureHash[SignatureHash["ANYONECANPAY"] = 128] = "ANYONECANPAY";
})(SignatureHash || (SignatureHash = {}));
var SigHash;
(function (SigHash) {
    SigHash[SigHash["DEFAULT"] = 0] = "DEFAULT";
    SigHash[SigHash["ALL"] = 1] = "ALL";
    SigHash[SigHash["NONE"] = 2] = "NONE";
    SigHash[SigHash["SINGLE"] = 3] = "SINGLE";
    SigHash[SigHash["DEFAULT_ANYONECANPAY"] = 128] = "DEFAULT_ANYONECANPAY";
    SigHash[SigHash["ALL_ANYONECANPAY"] = 129] = "ALL_ANYONECANPAY";
    SigHash[SigHash["NONE_ANYONECANPAY"] = 130] = "NONE_ANYONECANPAY";
    SigHash[SigHash["SINGLE_ANYONECANPAY"] = 131] = "SINGLE_ANYONECANPAY";
})(SigHash || (SigHash = {}));
function getTaprootKeys(privKey, pubKey, internalKey, merkleRoot = EMPTY) {
    if (equalBytes(internalKey, pubKey)) {
        privKey = taprootTweakPrivKey(privKey, merkleRoot);
        pubKey = pubSchnorr(privKey);
    }
    return { privKey, pubKey };
}
// Force check amount/script
function outputBeforeSign(i) {
    if (i.script === undefined || i.amount === undefined)
        throw new Error('Transaction/output: script and amount required');
    return { script: i.script, amount: i.amount };
}
// Force check index/txid/sequence
function inputBeforeSign(i) {
    if (i.txid === undefined || i.index === undefined)
        throw new Error('Transaction/input: txid and index required');
    return {
        txid: i.txid,
        index: i.index,
        sequence: def(i.sequence, DEFAULT_SEQUENCE),
        finalScriptSig: def(i.finalScriptSig, EMPTY),
    };
}
function cleanFinalInput(i) {
    for (const _k in i) {
        const k = _k;
        if (!PSBTInputFinalKeys.includes(k))
            delete i[k];
    }
}
// (TxHash, Idx)
const TxHashIdx = struct({ txid: createBytes(32, true), index: U32LE });
function validateSigHash(s) {
    if (typeof s !== 'number' || typeof SigHash[s] !== 'string')
        throw new Error(`Invalid SigHash=${s}`);
    return s;
}
function unpackSighash(hashType) {
    const masked = hashType & 0b0011111;
    return {
        isAny: !!(hashType & SignatureHash.ANYONECANPAY),
        isNone: masked === SignatureHash.NONE,
        isSingle: masked === SignatureHash.SINGLE,
    };
}
function validateOpts(opts) {
    if (opts !== undefined && {}.toString.call(opts) !== '[object Object]')
        throw new Error(`Wrong object type for transaction options: ${opts}`);
    const _opts = {
        ...opts,
        // Defaults
        version: def(opts.version, DEFAULT_VERSION$2),
        lockTime: def(opts.lockTime, 0),
        PSBTVersion: def(opts.PSBTVersion, 0),
    };
    if (typeof _opts.allowUnknowInput !== 'undefined')
        opts.allowUnknownInputs = _opts.allowUnknowInput;
    if (typeof _opts.allowUnknowOutput !== 'undefined')
        opts.allowUnknownOutputs = _opts.allowUnknowOutput;
    if (typeof _opts.lockTime !== 'number')
        throw new Error('Transaction lock time should be number');
    U32LE.encode(_opts.lockTime); // Additional range checks that lockTime
    // There is no PSBT v1, and any new version will probably have fields which we don't know how to parse, which
    // can lead to constructing broken transactions
    if (_opts.PSBTVersion !== 0 && _opts.PSBTVersion !== 2)
        throw new Error(`Unknown PSBT version ${_opts.PSBTVersion}`);
    // Flags
    for (const k of [
        'allowUnknownVersion',
        'allowUnknownOutputs',
        'allowUnknownInputs',
        'disableScriptCheck',
        'bip174jsCompat',
        'allowLegacyWitnessUtxo',
        'lowR',
    ]) {
        const v = _opts[k];
        if (v === undefined)
            continue; // optional
        if (typeof v !== 'boolean')
            throw new Error(`Transation options wrong type: ${k}=${v} (${typeof v})`);
    }
    // 0 and -1 happens in tests
    if (_opts.allowUnknownVersion
        ? typeof _opts.version === 'number'
        : ![-1, 0, 1, 2, 3].includes(_opts.version))
        throw new Error(`Unknown version: ${_opts.version}`);
    if (_opts.customScripts !== undefined) {
        const cs = _opts.customScripts;
        if (!Array.isArray(cs)) {
            throw new Error(`wrong custom scripts type (expected array): customScripts=${cs} (${typeof cs})`);
        }
        for (const s of cs) {
            if (typeof s.encode !== 'function' || typeof s.decode !== 'function')
                throw new Error(`wrong script=${s} (${typeof s})`);
            if (s.finalizeTaproot !== undefined && typeof s.finalizeTaproot !== 'function')
                throw new Error(`wrong script=${s} (${typeof s})`);
        }
    }
    return Object.freeze(_opts);
}
// NOTE: we cannot do this inside PSBTInput coder, because there is no index/txid at this point!
function validateInput(i) {
    if (i.nonWitnessUtxo && i.index !== undefined) {
        const last = i.nonWitnessUtxo.outputs.length - 1;
        if (i.index > last)
            throw new Error(`validateInput: index(${i.index}) not in nonWitnessUtxo`);
        const prevOut = i.nonWitnessUtxo.outputs[i.index];
        if (i.witnessUtxo &&
            (!equalBytes(i.witnessUtxo.script, prevOut.script) || i.witnessUtxo.amount !== prevOut.amount))
            throw new Error('validateInput: witnessUtxo different from nonWitnessUtxo');
        if (i.txid) {
            const outputs = i.nonWitnessUtxo.outputs;
            if (outputs.length - 1 < i.index)
                throw new Error('nonWitnessUtxo: incorect output index');
            // At this point, we are using previous tx output to create new input.
            // Script safety checks are unnecessary:
            // - User has no control over previous tx. If somebody send money in same tx
            //   as unspendable output, we still want user able to spend money
            // - We still want some checks to notify user about possible errors early
            //   in case user wants to use wrong input by mistake
            // - Worst case: tx will be rejected by nodes. Still better than disallowing user
            //   to spend real input, no matter how broken it looks
            const tx = Transaction.fromRaw(RawTx.encode(i.nonWitnessUtxo), {
                allowUnknownOutputs: true,
                disableScriptCheck: true,
                allowUnknownInputs: true,
            });
            const txid = hex.encode(i.txid);
            // PSBTv2 vectors have non-final tx in inputs
            if (tx.isFinal && tx.id !== txid)
                throw new Error(`nonWitnessUtxo: wrong txid, exp=${txid} got=${tx.id}`);
        }
    }
    return i;
}
// Normalizes input
function getPrevOut(input) {
    if (input.nonWitnessUtxo) {
        if (input.index === undefined)
            throw new Error('Unknown input index');
        return input.nonWitnessUtxo.outputs[input.index];
    }
    else if (input.witnessUtxo)
        return input.witnessUtxo;
    else
        throw new Error('Cannot find previous output info');
}
function normalizeInput(i, cur, allowedFields, disableScriptCheck = false, allowUnknown = false) {
    let { nonWitnessUtxo, txid } = i;
    // String support for common fields. We usually prefer Uint8Array to avoid errors
    // like hex looking string accidentally passed, however, in case of nonWitnessUtxo
    // it is better to expect string, since constructing this complex object will be
    // difficult for user
    if (typeof nonWitnessUtxo === 'string')
        nonWitnessUtxo = hex.decode(nonWitnessUtxo);
    if (isBytes(nonWitnessUtxo))
        nonWitnessUtxo = RawTx.decode(nonWitnessUtxo);
    if (!('nonWitnessUtxo' in i) && nonWitnessUtxo === undefined)
        nonWitnessUtxo = cur?.nonWitnessUtxo;
    if (typeof txid === 'string')
        txid = hex.decode(txid);
    // TODO: if we have nonWitnessUtxo, we can extract txId from here
    if (txid === undefined)
        txid = cur?.txid;
    let res = { ...cur, ...i, nonWitnessUtxo, txid };
    if (!('nonWitnessUtxo' in i) && res.nonWitnessUtxo === undefined)
        delete res.nonWitnessUtxo;
    if (res.sequence === undefined)
        res.sequence = DEFAULT_SEQUENCE;
    if (res.tapMerkleRoot === null)
        delete res.tapMerkleRoot;
    res = mergeKeyMap(PSBTInput, res, cur, allowedFields, allowUnknown);
    PSBTInputCoder.encode(res); // Validates that everything is correct at this point
    let prevOut;
    if (res.nonWitnessUtxo && res.index !== undefined)
        prevOut = res.nonWitnessUtxo.outputs[res.index];
    else if (res.witnessUtxo)
        prevOut = res.witnessUtxo;
    if (prevOut && !disableScriptCheck)
        checkScript(prevOut && prevOut.script, res.redeemScript, res.witnessScript);
    return res;
}
function getInputType(input, allowLegacyWitnessUtxo = false) {
    let txType = 'legacy';
    let defaultSighash = SignatureHash.ALL;
    const prevOut = getPrevOut(input);
    const first = OutScript.decode(prevOut.script);
    let type = first.type;
    let cur = first;
    const stack = [first];
    if (first.type === 'tr') {
        defaultSighash = SignatureHash.DEFAULT;
        return {
            txType: 'taproot',
            type: 'tr',
            last: first,
            lastScript: prevOut.script,
            defaultSighash,
            sighash: input.sighashType || defaultSighash,
        };
    }
    else {
        if (first.type === 'wpkh' || first.type === 'wsh')
            txType = 'segwit';
        if (first.type === 'sh') {
            if (!input.redeemScript)
                throw new Error('inputType: sh without redeemScript');
            let child = OutScript.decode(input.redeemScript);
            if (child.type === 'wpkh' || child.type === 'wsh')
                txType = 'segwit';
            stack.push(child);
            cur = child;
            type += `-${child.type}`;
        }
        // wsh can be inside sh
        if (cur.type === 'wsh') {
            if (!input.witnessScript)
                throw new Error('inputType: wsh without witnessScript');
            let child = OutScript.decode(input.witnessScript);
            if (child.type === 'wsh')
                txType = 'segwit';
            stack.push(child);
            cur = child;
            type += `-${child.type}`;
        }
        const last = stack[stack.length - 1];
        if (last.type === 'sh' || last.type === 'wsh')
            throw new Error('inputType: sh/wsh cannot be terminal type');
        const lastScript = OutScript.encode(last);
        const res = {
            type,
            txType,
            last,
            lastScript,
            defaultSighash,
            sighash: input.sighashType || defaultSighash,
        };
        if (txType === 'legacy' && !allowLegacyWitnessUtxo && !input.nonWitnessUtxo) {
            throw new Error(`Transaction/sign: legacy input without nonWitnessUtxo, can result in attack that forces paying higher fees. Pass allowLegacyWitnessUtxo=true, if you sure`);
        }
        return res;
    }
}
class Transaction {
    constructor(opts = {}) {
        this.global = {};
        this.inputs = []; // use getInput()
        this.outputs = []; // use getOutput()
        const _opts = (this.opts = validateOpts(opts));
        // Merge with global structure of PSBTv2
        if (_opts.lockTime !== DEFAULT_LOCKTIME)
            this.global.fallbackLocktime = _opts.lockTime;
        this.global.txVersion = _opts.version;
    }
    // Import
    static fromRaw(raw, opts = {}) {
        const parsed = RawTx.decode(raw);
        const tx = new Transaction({ ...opts, version: parsed.version, lockTime: parsed.lockTime });
        for (const o of parsed.outputs)
            tx.addOutput(o);
        tx.outputs = parsed.outputs;
        tx.inputs = parsed.inputs;
        if (parsed.witnesses) {
            for (let i = 0; i < parsed.witnesses.length; i++)
                tx.inputs[i].finalScriptWitness = parsed.witnesses[i];
        }
        return tx;
    }
    // PSBT
    static fromPSBT(psbt_, opts = {}) {
        let parsed;
        try {
            parsed = RawPSBTV0.decode(psbt_);
        }
        catch (e0) {
            try {
                parsed = RawPSBTV2.decode(psbt_);
            }
            catch (e2) {
                // Throw error for v0 parsing, since it popular, otherwise it would be shadowed by v2 error
                throw e0;
            }
        }
        const PSBTVersion = parsed.global.version || 0;
        if (PSBTVersion !== 0 && PSBTVersion !== 2)
            throw new Error(`Wrong PSBT version=${PSBTVersion}`);
        const unsigned = parsed.global.unsignedTx;
        const version = PSBTVersion === 0 ? unsigned?.version : parsed.global.txVersion;
        const lockTime = PSBTVersion === 0 ? unsigned?.lockTime : parsed.global.fallbackLocktime;
        const tx = new Transaction({ ...opts, version, lockTime, PSBTVersion });
        // We need slice here, because otherwise
        const inputCount = PSBTVersion === 0 ? unsigned?.inputs.length : parsed.global.inputCount;
        tx.inputs = parsed.inputs.slice(0, inputCount).map((i, j) => validateInput({
            finalScriptSig: EMPTY,
            ...parsed.global.unsignedTx?.inputs[j],
            ...i,
        }));
        const outputCount = PSBTVersion === 0 ? unsigned?.outputs.length : parsed.global.outputCount;
        tx.outputs = parsed.outputs.slice(0, outputCount).map((i, j) => ({
            ...i,
            ...parsed.global.unsignedTx?.outputs[j],
        }));
        tx.global = { ...parsed.global, txVersion: version }; // just in case proprietary/unknown fields
        if (lockTime !== DEFAULT_LOCKTIME)
            tx.global.fallbackLocktime = lockTime;
        return tx;
    }
    toPSBT(PSBTVersion = this.opts.PSBTVersion) {
        if (PSBTVersion !== 0 && PSBTVersion !== 2)
            throw new Error(`Wrong PSBT version=${PSBTVersion}`);
        // if (PSBTVersion === 0 && this.inputs.length === 0) {
        //   throw new Error(
        //     'PSBT version=0 export for transaction without inputs disabled, please use version=2. Please check `toPSBT` method for explanation.'
        //   );
        // }
        const inputs = this.inputs.map((i) => validateInput(cleanPSBTFields(PSBTVersion, PSBTInput, i)));
        for (const inp of inputs) {
            // Don't serialize empty fields
            if (inp.partialSig && !inp.partialSig.length)
                delete inp.partialSig;
            if (inp.finalScriptSig && !inp.finalScriptSig.length)
                delete inp.finalScriptSig;
            if (inp.finalScriptWitness && !inp.finalScriptWitness.length)
                delete inp.finalScriptWitness;
        }
        const outputs = this.outputs.map((i) => cleanPSBTFields(PSBTVersion, PSBTOutput, i));
        const global = { ...this.global };
        if (PSBTVersion === 0) {
            /*
            - Bitcoin raw transaction expects to have at least 1 input because it uses case with zero inputs as marker for SegWit
            - this means we cannot serialize raw tx with zero inputs since it will be parsed as SegWit tx
            - Parsing of PSBTv0 depends on unsignedTx (it looks for input count here)
            - BIP-174 requires old serialization format (without witnesses) inside global, which solves this
            */
            global.unsignedTx = RawOldTx.decode(RawOldTx.encode({
                version: this.version,
                lockTime: this.lockTime,
                inputs: this.inputs.map(inputBeforeSign).map((i) => ({
                    ...i,
                    finalScriptSig: EMPTY,
                })),
                outputs: this.outputs.map(outputBeforeSign),
            }));
            delete global.fallbackLocktime;
            delete global.txVersion;
        }
        else {
            global.version = PSBTVersion;
            global.txVersion = this.version;
            global.inputCount = this.inputs.length;
            global.outputCount = this.outputs.length;
            if (global.fallbackLocktime && global.fallbackLocktime === DEFAULT_LOCKTIME)
                delete global.fallbackLocktime;
        }
        if (this.opts.bip174jsCompat) {
            if (!inputs.length)
                inputs.push({});
            if (!outputs.length)
                outputs.push({});
        }
        return (PSBTVersion === 0 ? RawPSBTV0 : RawPSBTV2).encode({
            global,
            inputs,
            outputs,
        });
    }
    // BIP370 lockTime (https://github.com/bitcoin/bips/blob/master/bip-0370.mediawiki#determining-lock-time)
    get lockTime() {
        let height = DEFAULT_LOCKTIME;
        let heightCnt = 0;
        let time = DEFAULT_LOCKTIME;
        let timeCnt = 0;
        for (const i of this.inputs) {
            if (i.requiredHeightLocktime) {
                height = Math.max(height, i.requiredHeightLocktime);
                heightCnt++;
            }
            if (i.requiredTimeLocktime) {
                time = Math.max(time, i.requiredTimeLocktime);
                timeCnt++;
            }
        }
        if (heightCnt && heightCnt >= timeCnt)
            return height;
        if (time !== DEFAULT_LOCKTIME)
            return time;
        return this.global.fallbackLocktime || DEFAULT_LOCKTIME;
    }
    get version() {
        // Should be not possible
        if (this.global.txVersion === undefined)
            throw new Error('No global.txVersion');
        return this.global.txVersion;
    }
    inputStatus(idx) {
        this.checkInputIdx(idx);
        const input = this.inputs[idx];
        // Finalized
        if (input.finalScriptSig && input.finalScriptSig.length)
            return 'finalized';
        if (input.finalScriptWitness && input.finalScriptWitness.length)
            return 'finalized';
        // Signed taproot
        if (input.tapKeySig)
            return 'signed';
        if (input.tapScriptSig && input.tapScriptSig.length)
            return 'signed';
        // Signed
        if (input.partialSig && input.partialSig.length)
            return 'signed';
        return 'unsigned';
    }
    // Cannot replace unpackSighash, tests rely on very generic implemenetation with signing inputs outside of range
    // We will lose some vectors -> smaller test coverage of preimages (very important!)
    inputSighash(idx) {
        this.checkInputIdx(idx);
        const inputSighash = this.inputs[idx].sighashType;
        const sighash = inputSighash === undefined ? SignatureHash.DEFAULT : inputSighash;
        // ALL or DEFAULT -- everything signed
        // NONE           -- all inputs + no outputs
        // SINGLE         -- all inputs + output with same index
        // ALL + ANYONE   -- specific input + all outputs
        // NONE + ANYONE  -- specific input + no outputs
        // SINGLE         -- specific inputs + output with same index
        const sigOutputs = sighash === SignatureHash.DEFAULT ? SignatureHash.ALL : sighash & 0b11;
        const sigInputs = sighash & SignatureHash.ANYONECANPAY;
        return { sigInputs, sigOutputs };
    }
    // Very nice for debug purposes, but slow. If there is too much inputs/outputs to add, will be quadratic.
    // Some cache will be nice, but there chance to have bugs with cache invalidation
    signStatus() {
        // if addInput or addOutput is not possible, then all inputs or outputs are signed
        let addInput = true, addOutput = true;
        let inputs = [], outputs = [];
        for (let idx = 0; idx < this.inputs.length; idx++) {
            const status = this.inputStatus(idx);
            // Unsigned input doesn't affect anything
            if (status === 'unsigned')
                continue;
            const { sigInputs, sigOutputs } = this.inputSighash(idx);
            // Input type
            if (sigInputs === SignatureHash.ANYONECANPAY)
                inputs.push(idx);
            else
                addInput = false;
            // Output type
            if (sigOutputs === SignatureHash.ALL)
                addOutput = false;
            else if (sigOutputs === SignatureHash.SINGLE)
                outputs.push(idx);
            else if (sigOutputs === SignatureHash.NONE) ;
            else
                throw new Error(`Wrong signature hash output type: ${sigOutputs}`);
        }
        return { addInput, addOutput, inputs, outputs };
    }
    get isFinal() {
        for (let idx = 0; idx < this.inputs.length; idx++)
            if (this.inputStatus(idx) !== 'finalized')
                return false;
        return true;
    }
    // Info utils
    get hasWitnesses() {
        let out = false;
        for (const i of this.inputs)
            if (i.finalScriptWitness && i.finalScriptWitness.length)
                out = true;
        return out;
    }
    // https://en.bitcoin.it/wiki/Weight_units
    get weight() {
        if (!this.isFinal)
            throw new Error('Transaction is not finalized');
        let out = 32;
        // Outputs
        const outputs = this.outputs.map(outputBeforeSign);
        out += 4 * CompactSizeLen.encode(this.outputs.length).length;
        for (const o of outputs)
            out += 32 + 4 * VarBytes.encode(o.script).length;
        // Inputs
        if (this.hasWitnesses)
            out += 2;
        out += 4 * CompactSizeLen.encode(this.inputs.length).length;
        for (const i of this.inputs) {
            out += 160 + 4 * VarBytes.encode(i.finalScriptSig || EMPTY).length;
            if (this.hasWitnesses && i.finalScriptWitness)
                out += RawWitness.encode(i.finalScriptWitness).length;
        }
        return out;
    }
    get vsize() {
        return toVsize(this.weight);
    }
    toBytes(withScriptSig = false, withWitness = false) {
        return RawTx.encode({
            version: this.version,
            lockTime: this.lockTime,
            inputs: this.inputs.map(inputBeforeSign).map((i) => ({
                ...i,
                finalScriptSig: (withScriptSig && i.finalScriptSig) || EMPTY,
            })),
            outputs: this.outputs.map(outputBeforeSign),
            witnesses: this.inputs.map((i) => i.finalScriptWitness || []),
            segwitFlag: withWitness && this.hasWitnesses,
        });
    }
    get unsignedTx() {
        return this.toBytes(false, false);
    }
    get hex() {
        return hex.encode(this.toBytes(true, this.hasWitnesses));
    }
    get hash() {
        if (!this.isFinal)
            throw new Error('Transaction is not finalized');
        return hex.encode(sha256x2(this.toBytes(true)));
    }
    get id() {
        if (!this.isFinal)
            throw new Error('Transaction is not finalized');
        return hex.encode(sha256x2(this.toBytes(true)).reverse());
    }
    // Input stuff
    checkInputIdx(idx) {
        if (!Number.isSafeInteger(idx) || 0 > idx || idx >= this.inputs.length)
            throw new Error(`Wrong input index=${idx}`);
    }
    getInput(idx) {
        this.checkInputIdx(idx);
        return cloneDeep(this.inputs[idx]);
    }
    get inputsLength() {
        return this.inputs.length;
    }
    // Modification
    addInput(input, _ignoreSignStatus = false) {
        if (!_ignoreSignStatus && !this.signStatus().addInput)
            throw new Error('Tx has signed inputs, cannot add new one');
        this.inputs.push(normalizeInput(input, undefined, undefined, this.opts.disableScriptCheck));
        return this.inputs.length - 1;
    }
    updateInput(idx, input, _ignoreSignStatus = false) {
        this.checkInputIdx(idx);
        let allowedFields = undefined;
        if (!_ignoreSignStatus) {
            const status = this.signStatus();
            if (!status.addInput || status.inputs.includes(idx))
                allowedFields = PSBTInputUnsignedKeys;
        }
        this.inputs[idx] = normalizeInput(input, this.inputs[idx], allowedFields, this.opts.disableScriptCheck, this.opts.allowUnknown);
    }
    // Output stuff
    checkOutputIdx(idx) {
        if (!Number.isSafeInteger(idx) || 0 > idx || idx >= this.outputs.length)
            throw new Error(`Wrong output index=${idx}`);
    }
    getOutput(idx) {
        this.checkOutputIdx(idx);
        return cloneDeep(this.outputs[idx]);
    }
    getOutputAddress(idx, network = NETWORK) {
        const out = this.getOutput(idx);
        if (!out.script)
            return;
        return Address(network).encode(OutScript.decode(out.script));
    }
    get outputsLength() {
        return this.outputs.length;
    }
    normalizeOutput(o, cur, allowedFields) {
        let { amount, script } = o;
        if (amount === undefined)
            amount = cur?.amount;
        if (typeof amount !== 'bigint')
            throw new Error(`Wrong amount type, should be of type bigint in sats, but got ${amount} of type ${typeof amount}`);
        if (typeof script === 'string')
            script = hex.decode(script);
        if (script === undefined)
            script = cur?.script;
        let res = { ...cur, ...o, amount, script };
        if (res.amount === undefined)
            delete res.amount;
        res = mergeKeyMap(PSBTOutput, res, cur, allowedFields, this.opts.allowUnknown);
        PSBTOutputCoder.encode(res);
        if (res.script &&
            !this.opts.allowUnknownOutputs &&
            OutScript.decode(res.script).type === 'unknown') {
            throw new Error('Transaction/output: unknown output script type, there is a chance that input is unspendable. Pass allowUnknownOutputs=true, if you sure');
        }
        if (!this.opts.disableScriptCheck)
            checkScript(res.script, res.redeemScript, res.witnessScript);
        return res;
    }
    addOutput(o, _ignoreSignStatus = false) {
        if (!_ignoreSignStatus && !this.signStatus().addOutput)
            throw new Error('Tx has signed outputs, cannot add new one');
        this.outputs.push(this.normalizeOutput(o));
        return this.outputs.length - 1;
    }
    updateOutput(idx, output, _ignoreSignStatus = false) {
        this.checkOutputIdx(idx);
        let allowedFields = undefined;
        if (!_ignoreSignStatus) {
            const status = this.signStatus();
            if (!status.addOutput || status.outputs.includes(idx))
                allowedFields = PSBTOutputUnsignedKeys;
        }
        this.outputs[idx] = this.normalizeOutput(output, this.outputs[idx], allowedFields);
    }
    addOutputAddress(address, amount, network = NETWORK) {
        return this.addOutput({ script: OutScript.encode(Address(network).decode(address)), amount });
    }
    // Utils
    get fee() {
        let res = 0n;
        for (const i of this.inputs) {
            const prevOut = getPrevOut(i);
            if (!prevOut)
                throw new Error('Empty input amount');
            res += prevOut.amount;
        }
        const outputs = this.outputs.map(outputBeforeSign);
        for (const o of outputs)
            res -= o.amount;
        return res;
    }
    // Signing
    // Based on https://github.com/bitcoin/bitcoin/blob/5871b5b5ab57a0caf9b7514eb162c491c83281d5/test/functional/test_framework/script.py#L624
    // There is optimization opportunity to re-use hashes for multiple inputs for witness v0/v1,
    // but we are trying to be less complicated for audit purpose for now.
    preimageLegacy(idx, prevOutScript, hashType) {
        const { isAny, isNone, isSingle } = unpackSighash(hashType);
        if (idx < 0 || !Number.isSafeInteger(idx))
            throw new Error(`Invalid input idx=${idx}`);
        if ((isSingle && idx >= this.outputs.length) || idx >= this.inputs.length)
            return U256BE.encode(1n);
        prevOutScript = Script.encode(Script.decode(prevOutScript).filter((i) => i !== 'CODESEPARATOR'));
        let inputs = this.inputs
            .map(inputBeforeSign)
            .map((input, inputIdx) => ({
            ...input,
            finalScriptSig: inputIdx === idx ? prevOutScript : EMPTY,
        }));
        if (isAny)
            inputs = [inputs[idx]];
        else if (isNone || isSingle) {
            inputs = inputs.map((input, inputIdx) => ({
                ...input,
                sequence: inputIdx === idx ? input.sequence : 0,
            }));
        }
        let outputs = this.outputs.map(outputBeforeSign);
        if (isNone)
            outputs = [];
        else if (isSingle) {
            outputs = outputs.slice(0, idx).fill(EMPTY_OUTPUT).concat([outputs[idx]]);
        }
        const tmpTx = RawTx.encode({
            lockTime: this.lockTime,
            version: this.version,
            segwitFlag: false,
            inputs,
            outputs,
        });
        return sha256x2(tmpTx, I32LE.encode(hashType));
    }
    preimageWitnessV0(idx, prevOutScript, hashType, amount) {
        const { isAny, isNone, isSingle } = unpackSighash(hashType);
        let inputHash = EMPTY32;
        let sequenceHash = EMPTY32;
        let outputHash = EMPTY32;
        const inputs = this.inputs.map(inputBeforeSign);
        const outputs = this.outputs.map(outputBeforeSign);
        if (!isAny)
            inputHash = sha256x2(...inputs.map(TxHashIdx.encode));
        if (!isAny && !isSingle && !isNone)
            sequenceHash = sha256x2(...inputs.map((i) => U32LE.encode(i.sequence)));
        if (!isSingle && !isNone) {
            outputHash = sha256x2(...outputs.map(RawOutput.encode));
        }
        else if (isSingle && idx < outputs.length)
            outputHash = sha256x2(RawOutput.encode(outputs[idx]));
        const input = inputs[idx];
        return sha256x2(I32LE.encode(this.version), inputHash, sequenceHash, createBytes(32, true).encode(input.txid), U32LE.encode(input.index), VarBytes.encode(prevOutScript), U64LE.encode(amount), U32LE.encode(input.sequence), outputHash, U32LE.encode(this.lockTime), U32LE.encode(hashType));
    }
    preimageWitnessV1(idx, prevOutScript, hashType, amount, codeSeparator = -1, leafScript, leafVer = 0xc0, annex) {
        if (!Array.isArray(amount) || this.inputs.length !== amount.length)
            throw new Error(`Invalid amounts array=${amount}`);
        if (!Array.isArray(prevOutScript) || this.inputs.length !== prevOutScript.length)
            throw new Error(`Invalid prevOutScript array=${prevOutScript}`);
        const out = [
            U8.encode(0),
            U8.encode(hashType), // U8 sigHash
            I32LE.encode(this.version),
            U32LE.encode(this.lockTime),
        ];
        const outType = hashType === SignatureHash.DEFAULT ? SignatureHash.ALL : hashType & 0b11;
        const inType = hashType & SignatureHash.ANYONECANPAY;
        const inputs = this.inputs.map(inputBeforeSign);
        const outputs = this.outputs.map(outputBeforeSign);
        if (inType !== SignatureHash.ANYONECANPAY) {
            out.push(...[
                inputs.map(TxHashIdx.encode),
                amount.map(U64LE.encode),
                prevOutScript.map(VarBytes.encode),
                inputs.map((i) => U32LE.encode(i.sequence)),
            ].map((i) => sha256$2(concatBytes(...i))));
        }
        if (outType === SignatureHash.ALL) {
            out.push(sha256$2(concatBytes(...outputs.map(RawOutput.encode))));
        }
        const spendType = (annex ? 1 : 0) | (leafScript ? 2 : 0);
        out.push(new Uint8Array([spendType]));
        if (inType === SignatureHash.ANYONECANPAY) {
            const inp = inputs[idx];
            out.push(TxHashIdx.encode(inp), U64LE.encode(amount[idx]), VarBytes.encode(prevOutScript[idx]), U32LE.encode(inp.sequence));
        }
        else
            out.push(U32LE.encode(idx));
        if (spendType & 1)
            out.push(sha256$2(VarBytes.encode(annex || EMPTY)));
        if (outType === SignatureHash.SINGLE)
            out.push(idx < outputs.length ? sha256$2(RawOutput.encode(outputs[idx])) : EMPTY32);
        if (leafScript)
            out.push(tapLeafHash(leafScript, leafVer), U8.encode(0), I32LE.encode(codeSeparator));
        return tagSchnorr('TapSighash', ...out);
    }
    // Signer can be privateKey OR instance of bip32 HD stuff
    signIdx(privateKey, idx, allowedSighash, _auxRand) {
        this.checkInputIdx(idx);
        const input = this.inputs[idx];
        const inputType = getInputType(input, this.opts.allowLegacyWitnessUtxo);
        // Handle BIP32 HDKey
        if (!isBytes(privateKey)) {
            if (!input.bip32Derivation || !input.bip32Derivation.length)
                throw new Error('bip32Derivation: empty');
            const signers = input.bip32Derivation
                .filter((i) => i[1].fingerprint == privateKey.fingerprint)
                .map(([pubKey, { path }]) => {
                let s = privateKey;
                for (const i of path)
                    s = s.deriveChild(i);
                if (!equalBytes(s.publicKey, pubKey))
                    throw new Error('bip32Derivation: wrong pubKey');
                if (!s.privateKey)
                    throw new Error('bip32Derivation: no privateKey');
                return s;
            });
            if (!signers.length)
                throw new Error(`bip32Derivation: no items with fingerprint=${privateKey.fingerprint}`);
            let signed = false;
            for (const s of signers)
                if (this.signIdx(s.privateKey, idx))
                    signed = true;
            return signed;
        }
        // Sighash checks
        // Just for compat with bitcoinjs-lib, so users won't face unexpected behaviour.
        if (!allowedSighash)
            allowedSighash = [inputType.defaultSighash];
        else
            allowedSighash.forEach(validateSigHash);
        const sighash = inputType.sighash;
        if (!allowedSighash.includes(sighash)) {
            throw new Error(`Input with not allowed sigHash=${sighash}. Allowed: ${allowedSighash.join(', ')}`);
        }
        // It is possible to sign these inputs for legacy/segwit v0 (but no taproot!),
        // however this was because of bug in bitcoin-core, which remains here because of consensus.
        // If this is absolutely neccessary for your case, please open issue.
        // We disable it to avoid complicated workflow where SINGLE will block adding new outputs
        const { sigOutputs } = this.inputSighash(idx);
        if (sigOutputs === SignatureHash.SINGLE && idx >= this.outputs.length) {
            throw new Error(`Input with sighash SINGLE, but there is no output with corresponding index=${idx}`);
        }
        // Actual signing
        // Taproot
        const prevOut = getPrevOut(input);
        if (inputType.txType === 'taproot') {
            const prevOuts = this.inputs.map(getPrevOut);
            const prevOutScript = prevOuts.map((i) => i.script);
            const amount = prevOuts.map((i) => i.amount);
            let signed = false;
            let schnorrPub = pubSchnorr(privateKey);
            let merkleRoot = input.tapMerkleRoot || EMPTY;
            if (input.tapInternalKey) {
                // internal + tweak = tweaked key
                // if internal key == current public key, we need to tweak private key,
                // otherwise sign as is. bitcoinjs implementation always wants tweaked
                // priv key to be provided
                const { pubKey, privKey } = getTaprootKeys(privateKey, schnorrPub, input.tapInternalKey, merkleRoot);
                const [taprootPubKey, _] = taprootTweakPubkey(input.tapInternalKey, merkleRoot);
                if (equalBytes(taprootPubKey, pubKey)) {
                    const hash = this.preimageWitnessV1(idx, prevOutScript, sighash, amount);
                    const sig = concatBytes(signSchnorr(hash, privKey, _auxRand), sighash !== SignatureHash.DEFAULT ? new Uint8Array([sighash]) : EMPTY);
                    this.updateInput(idx, { tapKeySig: sig }, true);
                    signed = true;
                }
            }
            if (input.tapLeafScript) {
                input.tapScriptSig = input.tapScriptSig || [];
                for (const [_, _script] of input.tapLeafScript) {
                    const script = _script.subarray(0, -1);
                    const scriptDecoded = Script.decode(script);
                    const ver = _script[_script.length - 1];
                    const hash = tapLeafHash(script, ver);
                    // NOTE: no need to tweak internal key here, since we don't support nested p2tr
                    const pos = scriptDecoded.findIndex((i) => isBytes(i) && equalBytes(i, schnorrPub));
                    // Skip if there is no public key in tapLeafScript
                    if (pos === -1)
                        continue;
                    const msg = this.preimageWitnessV1(idx, prevOutScript, sighash, amount, undefined, script, ver);
                    const sig = concatBytes(signSchnorr(msg, privateKey, _auxRand), sighash !== SignatureHash.DEFAULT ? new Uint8Array([sighash]) : EMPTY);
                    this.updateInput(idx, { tapScriptSig: [[{ pubKey: schnorrPub, leafHash: hash }, sig]] }, true);
                    signed = true;
                }
            }
            if (!signed)
                throw new Error('No taproot scripts signed');
            return true;
        }
        else {
            // only compressed keys are supported for now
            const pubKey = pubECDSA(privateKey);
            // TODO: replace with explicit checks
            // Check if script has public key or its has inside
            let hasPubkey = false;
            const pubKeyHash = hash160$1(pubKey);
            for (const i of Script.decode(inputType.lastScript)) {
                if (isBytes(i) && (equalBytes(i, pubKey) || equalBytes(i, pubKeyHash)))
                    hasPubkey = true;
            }
            if (!hasPubkey)
                throw new Error(`Input script doesn't have pubKey: ${inputType.lastScript}`);
            let hash;
            if (inputType.txType === 'legacy') {
                hash = this.preimageLegacy(idx, inputType.lastScript, sighash);
            }
            else if (inputType.txType === 'segwit') {
                let script = inputType.lastScript;
                // If wpkh OR sh-wpkh, wsh-wpkh is impossible, so looks ok
                if (inputType.last.type === 'wpkh')
                    script = OutScript.encode({ type: 'pkh', hash: inputType.last.hash });
                hash = this.preimageWitnessV0(idx, script, sighash, prevOut.amount);
            }
            else
                throw new Error(`Transaction/sign: unknown tx type: ${inputType.txType}`);
            const sig = signECDSA(hash, privateKey, this.opts.lowR);
            this.updateInput(idx, {
                partialSig: [[pubKey, concatBytes(sig, new Uint8Array([sighash]))]],
            }, true);
        }
        return true;
    }
    // This is bad API. Will work if user creates and signs tx, but if
    // there is some complex workflow with exchanging PSBT and signing them,
    // then it is better to validate which output user signs. How could a better API look like?
    // Example: user adds input, sends to another party, then signs received input (mixer etc),
    // another user can add different input for same key and user will sign it.
    // Even worse: another user can add bip32 derivation, and spend money from different address.
    // Better api: signIdx
    sign(privateKey, allowedSighash, _auxRand) {
        let num = 0;
        for (let i = 0; i < this.inputs.length; i++) {
            try {
                if (this.signIdx(privateKey, i, allowedSighash, _auxRand))
                    num++;
            }
            catch (e) { }
        }
        if (!num)
            throw new Error('No inputs signed');
        return num;
    }
    finalizeIdx(idx) {
        this.checkInputIdx(idx);
        if (this.fee < 0n)
            throw new Error('Outputs spends more than inputs amount');
        const input = this.inputs[idx];
        const inputType = getInputType(input, this.opts.allowLegacyWitnessUtxo);
        // Taproot finalize
        if (inputType.txType === 'taproot') {
            if (input.tapKeySig)
                input.finalScriptWitness = [input.tapKeySig];
            else if (input.tapLeafScript && input.tapScriptSig) {
                // Sort leafs by control block length.
                const leafs = input.tapLeafScript.sort((a, b) => TaprootControlBlock.encode(a[0]).length -
                    TaprootControlBlock.encode(b[0]).length);
                for (const [cb, _script] of leafs) {
                    // Last byte is version
                    const script = _script.slice(0, -1);
                    const ver = _script[_script.length - 1];
                    const outScript = OutScript.decode(script);
                    const hash = tapLeafHash(script, ver);
                    const scriptSig = input.tapScriptSig.filter((i) => equalBytes(i[0].leafHash, hash));
                    let signatures = [];
                    if (outScript.type === 'tr_ms') {
                        const m = outScript.m;
                        const pubkeys = outScript.pubkeys;
                        let added = 0;
                        for (const pub of pubkeys) {
                            const sigIdx = scriptSig.findIndex((i) => equalBytes(i[0].pubKey, pub));
                            // Should have exact amount of signatures (more -- will fail)
                            if (added === m || sigIdx === -1) {
                                signatures.push(EMPTY);
                                continue;
                            }
                            signatures.push(scriptSig[sigIdx][1]);
                            added++;
                        }
                        // Should be exact same as m
                        if (added !== m)
                            continue;
                    }
                    else if (outScript.type === 'tr_ns') {
                        for (const pub of outScript.pubkeys) {
                            const sigIdx = scriptSig.findIndex((i) => equalBytes(i[0].pubKey, pub));
                            if (sigIdx === -1)
                                continue;
                            signatures.push(scriptSig[sigIdx][1]);
                        }
                        if (signatures.length !== outScript.pubkeys.length)
                            continue;
                    }
                    else if (outScript.type === 'unknown' && this.opts.allowUnknownInputs) {
                        // Trying our best to sign what we can
                        const scriptDecoded = Script.decode(script);
                        signatures = scriptSig
                            .map(([{ pubKey }, signature]) => {
                            const pos = scriptDecoded.findIndex((i) => isBytes(i) && equalBytes(i, pubKey));
                            if (pos === -1)
                                throw new Error('finalize/taproot: cannot find position of pubkey in script');
                            return { signature, pos };
                        })
                            // Reverse order (because witness is stack and we take last element first from it)
                            .sort((a, b) => a.pos - b.pos)
                            .map((i) => i.signature);
                        if (!signatures.length)
                            continue;
                    }
                    else {
                        const custom = this.opts.customScripts;
                        if (custom) {
                            for (const c of custom) {
                                if (!c.finalizeTaproot)
                                    continue;
                                const scriptDecoded = Script.decode(script);
                                const csEncoded = c.encode(scriptDecoded);
                                if (csEncoded === undefined)
                                    continue;
                                const finalized = c.finalizeTaproot(script, csEncoded, scriptSig);
                                if (!finalized)
                                    continue;
                                input.finalScriptWitness = finalized.concat(TaprootControlBlock.encode(cb));
                                input.finalScriptSig = EMPTY;
                                cleanFinalInput(input);
                                return;
                            }
                        }
                        throw new Error('Finalize: Unknown tapLeafScript');
                    }
                    // Witness is stack, so last element will be used first
                    input.finalScriptWitness = signatures
                        .reverse()
                        .concat([script, TaprootControlBlock.encode(cb)]);
                    break;
                }
                if (!input.finalScriptWitness)
                    throw new Error('finalize/taproot: empty witness');
            }
            else
                throw new Error('finalize/taproot: unknown input');
            input.finalScriptSig = EMPTY;
            cleanFinalInput(input);
            return;
        }
        if (!input.partialSig || !input.partialSig.length)
            throw new Error('Not enough partial sign');
        let inputScript = EMPTY;
        let witness = [];
        // TODO: move input scripts closer to payments/output scripts
        // Multisig
        if (inputType.last.type === 'ms') {
            const m = inputType.last.m;
            const pubkeys = inputType.last.pubkeys;
            let signatures = [];
            // partial: [pubkey, sign]
            for (const pub of pubkeys) {
                const sign = input.partialSig.find((s) => equalBytes(pub, s[0]));
                if (!sign)
                    continue;
                signatures.push(sign[1]);
            }
            signatures = signatures.slice(0, m);
            if (signatures.length !== m) {
                throw new Error(`Multisig: wrong signatures count, m=${m} n=${pubkeys.length} signatures=${signatures.length}`);
            }
            inputScript = Script.encode([0, ...signatures]);
        }
        else if (inputType.last.type === 'pk') {
            inputScript = Script.encode([input.partialSig[0][1]]);
        }
        else if (inputType.last.type === 'pkh') {
            inputScript = Script.encode([input.partialSig[0][1], input.partialSig[0][0]]);
        }
        else if (inputType.last.type === 'wpkh') {
            inputScript = EMPTY;
            witness = [input.partialSig[0][1], input.partialSig[0][0]];
        }
        else if (inputType.last.type === 'unknown' && !this.opts.allowUnknownInputs)
            throw new Error('Unknown inputs not allowed');
        // Create final scripts (generic part)
        let finalScriptSig, finalScriptWitness;
        if (inputType.type.includes('wsh-')) {
            // P2WSH
            if (inputScript.length && inputType.lastScript.length) {
                witness = Script.decode(inputScript).map((i) => {
                    if (i === 0)
                        return EMPTY;
                    if (isBytes(i))
                        return i;
                    throw new Error(`Wrong witness op=${i}`);
                });
            }
            witness = witness.concat(inputType.lastScript);
        }
        if (inputType.txType === 'segwit')
            finalScriptWitness = witness;
        if (inputType.type.startsWith('sh-wsh-')) {
            finalScriptSig = Script.encode([Script.encode([0, sha256$2(inputType.lastScript)])]);
        }
        else if (inputType.type.startsWith('sh-')) {
            finalScriptSig = Script.encode([...Script.decode(inputScript), inputType.lastScript]);
        }
        else if (inputType.type.startsWith('wsh-')) ;
        else if (inputType.txType !== 'segwit')
            finalScriptSig = inputScript;
        if (!finalScriptSig && !finalScriptWitness)
            throw new Error('Unknown error finalizing input');
        if (finalScriptSig)
            input.finalScriptSig = finalScriptSig;
        if (finalScriptWitness)
            input.finalScriptWitness = finalScriptWitness;
        cleanFinalInput(input);
    }
    finalize() {
        for (let i = 0; i < this.inputs.length; i++)
            this.finalizeIdx(i);
    }
    extract() {
        if (!this.isFinal)
            throw new Error('Transaction has unfinalized inputs');
        if (!this.outputs.length)
            throw new Error('Transaction has no outputs');
        if (this.fee < 0n)
            throw new Error('Outputs spends more than inputs amount');
        return this.toBytes(true, true);
    }
    combine(other) {
        for (const k of ['PSBTVersion', 'version', 'lockTime']) {
            if (this.opts[k] !== other.opts[k]) {
                throw new Error(`Transaction/combine: different ${k} this=${this.opts[k]} other=${other.opts[k]}`);
            }
        }
        for (const k of ['inputs', 'outputs']) {
            if (this[k].length !== other[k].length) {
                throw new Error(`Transaction/combine: different ${k} length this=${this[k].length} other=${other[k].length}`);
            }
        }
        const thisUnsigned = this.global.unsignedTx ? RawOldTx.encode(this.global.unsignedTx) : EMPTY;
        const otherUnsigned = other.global.unsignedTx
            ? RawOldTx.encode(other.global.unsignedTx)
            : EMPTY;
        if (!equalBytes(thisUnsigned, otherUnsigned))
            throw new Error(`Transaction/combine: different unsigned tx`);
        this.global = mergeKeyMap(PSBTGlobal, this.global, other.global, undefined, this.opts.allowUnknown);
        for (let i = 0; i < this.inputs.length; i++)
            this.updateInput(i, other.inputs[i], true);
        for (let i = 0; i < this.outputs.length; i++)
            this.updateOutput(i, other.outputs[i], true);
        return this;
    }
    clone() {
        // deepClone probably faster, but this enforces that encoding is valid
        return Transaction.fromPSBT(this.toPSBT(this.opts.PSBTVersion), this.opts);
    }
}

const curve = secp256k1.CURVE;
const _N = curve.n;
const _P = curve.p;
const _G = { x: curve.Gx, y: curve.Gy };
const _0n = BigInt(0);
BigInt(1);
BigInt(2);
BigInt(3);
BigInt(4);

const fd = Field$1(_N, 32, true);
const mod_n = (x) => mod(x, _N);
FpSqrt(_N);
FpSqrt(_P);

function fail(error, throws = false) {
    if (!throws)
        return false;
    throw new Error(error);
}
function size(input, size, throws) {
    const bytes = Buff.bytes(input);
    if (bytes.length !== size) {
        return fail(`Invalid byte size: ${bytes.hex} !== ${size}`, throws);
    }
    return true;
}
function in_field(x, throws) {
    if (!(typeof x === 'bigint' && _0n < x && x < _N)) {
        fail('x value is not in the field!', throws);
    }
    return true;
}

const NoblePoint = secp256k1.ProjectivePoint;
class Field extends Uint8Array {
    static { this.N = _N; }
    static add(x) {
        return x.map(e => Field.mod(e)).reduce((p, n) => p.add(n));
    }
    static mod(x) {
        return new Field(x);
    }
    static mul(x) {
        return x.map(e => Field.mod(e)).reduce((p, n) => p.mul(n));
    }
    static is_valid(value, throws) {
        const big = Buff.bytes(value, 32).big;
        return in_field(big, throws);
    }
    static random() {
        return Field.mod(Buff.random(32));
    }
    constructor(x) {
        const b = mod_n(normalizeField(x));
        Field.is_valid(b, true);
        super(Buff.big(b, 32), 32);
    }
    get buff() {
        return new Buff(this);
    }
    get raw() {
        return this.buff.raw;
    }
    get big() {
        return this.buff.big;
    }
    get hex() {
        return this.buff.hex;
    }
    get point() {
        return this.generate();
    }
    get hasOddY() {
        return this.point.hasOddY;
    }
    get negated() {
        return (this.hasOddY)
            ? this.negate()
            : this;
    }
    gt(value) {
        const x = new Field(value);
        return x.big > this.big;
    }
    lt(value) {
        const x = new Field(value);
        return x.big < this.big;
    }
    eq(value) {
        const x = new Field(value);
        return x.big === this.big;
    }
    ne(value) {
        const x = new Field(value);
        return x.big !== this.big;
    }
    add(value) {
        const x = Field.mod(value);
        const a = fd.add(this.big, x.big);
        return new Field(a);
    }
    sub(value) {
        const x = Field.mod(value);
        const a = fd.sub(this.big, x.big);
        return new Field(a);
    }
    mul(value) {
        const x = Field.mod(value);
        const a = fd.mul(this.big, x.big);
        return new Field(a);
    }
    pow(value) {
        const x = Field.mod(value);
        const a = fd.pow(this.big, x.big);
        return new Field(a);
    }
    div(value) {
        const x = Field.mod(value);
        const a = fd.div(this.big, x.big);
        return new Field(a);
    }
    negate() {
        return new Field(Field.N - this.big);
    }
    generate() {
        const base = secp256k1.ProjectivePoint.BASE;
        const point = base.multiply(this.big);
        return Point.import(point);
    }
}
class Point {
    static { this.P = _P; }
    static { this.G = new Point(_G.x, _G.y); }
    static { this.curve = secp256k1.CURVE; }
    static { this.base = secp256k1.ProjectivePoint.BASE; }
    static from_x(bytes, even_y = false) {
        let cp = normalizePoint(bytes);
        if (cp.length === 32) {
            cp = cp.prepend(0x02);
        }
        else if (even_y) {
            cp[0] = 0x02;
        }
        size(cp, 33);
        const point = NoblePoint.fromHex(cp.hex);
        point.assertValidity();
        return new Point(point.x, point.y);
    }
    static generate(value) {
        const field = Field.mod(value);
        const point = Point.base.multiply(field.big);
        return Point.import(point);
    }
    static { this.mul = Point.generate; }
    static import(point) {
        const p = (point instanceof Point)
            ? { x: point.x.big, y: point.y.big }
            : { x: point.x, y: point.y };
        return new Point(p.x, p.y);
    }
    constructor(x, y) {
        this._p = new NoblePoint(x, y, 1n);
        this.p.assertValidity();
    }
    get p() {
        return this._p;
    }
    get x() {
        return Buff.big(this.p.x, 32);
    }
    get y() {
        return Buff.big(this.p.y, 32);
    }
    get buff() {
        return Buff.raw(this.p.toRawBytes(true));
    }
    get raw() {
        return this.buff.raw;
    }
    get hex() {
        return this.buff.hex;
    }
    get hasEvenY() {
        return this.p.hasEvenY();
    }
    get hasOddY() {
        return !this.p.hasEvenY();
    }
    get negated() {
        return (this.hasOddY)
            ? this.negate()
            : this;
    }
    eq(value) {
        const p = (value instanceof Point) ? value : Point.from_x(value);
        return this.x.big === p.x.big && this.y.big === p.y.big;
    }
    add(x) {
        return (x instanceof Point)
            ? Point.import(this.p.add(x.p))
            : Point.import(this.p.add(Point.generate(x).p));
    }
    sub(x) {
        return (x instanceof Point)
            ? Point.import(this.p.subtract(x.p))
            : Point.import(this.p.subtract(Point.generate(x).p));
    }
    mul(value) {
        return (value instanceof Point)
            ? Point.import(this.p.multiply(value.x.big))
            : Point.import(this.p.multiply(Field.mod(value).big));
    }
    negate() {
        return Point.import(this.p.negate());
    }
}
function normalizeField(value) {
    if (value instanceof Field) {
        return value.big;
    }
    if (value instanceof Point) {
        return value.x.big;
    }
    if (value instanceof Uint8Array) {
        return Buff.raw(value).big;
    }
    if (typeof value === 'string') {
        return Buff.hex(value).big;
    }
    if (typeof value === 'number') {
        return Buff.num(value).big;
    }
    if (typeof value === 'bigint') {
        return BigInt(value);
    }
    throw TypeError('Invalid input type:' + typeof value);
}
function normalizePoint(value) {
    if (value instanceof Field) {
        return value.point.buff;
    }
    if (value instanceof Point) {
        return value.buff;
    }
    if (value instanceof Uint8Array ||
        typeof value === 'string') {
        return Buff.bytes(value);
    }
    if (typeof value === 'number' ||
        typeof value === 'bigint') {
        return Buff.bytes(value, 32);
    }
    throw new TypeError(`Unknown type: ${typeof value}`);
}

function convert_32b(pubkey) {
    const key = Buff.bytes(pubkey);
    if (key.length === 32)
        return key;
    if (key.length === 33)
        return key.slice(1, 33);
    throw new TypeError(`Invalid key length: ${key.length}`);
}
function convert_33b(pubkey, even_y = false) {
    const key = Buff.bytes(pubkey);
    if (key.length === 32) {
        return key.prepend(0x02);
    }
    else if (key.length === 33) {
        if (even_y)
            key[0] = 0x02;
        return key;
    }
    throw new TypeError(`Invalid key size: ${key.length}`);
}

const DEFAULT_VERSION$1 = 0xc0;
get_script_only_pub();
function get_script_only_pub() {
    const G = Buff.hex('0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8');
    return Point.from_x(G.digest).x.hex;
}

const DEFAULT_VERSION = 0xc0;
function encode_tapleaf(data, version = DEFAULT_VERSION) {
    return hash340('TapLeaf', encode_leaf_version(version), data).hex;
}
function encode_tapscript(script, version) {
    const bytes = buffer_asm(script);
    return encode_tapleaf(bytes, version);
}
function encode_tapbranch(leaf_a, leaf_b) {
    if (leaf_b < leaf_a) {
        [leaf_a, leaf_b] = [leaf_b, leaf_a];
    }
    return hash340('TapBranch', leaf_a, leaf_b).hex;
}
function encode_leaf_version(version = 0xc0) {
    return version & 0xfe;
}

function merkleize(taptree, target, path = []) {
    const leaves = [];
    const tree = [];
    if (taptree.length < 1) {
        throw new Error('Tree is empty!');
    }
    for (let i = 0; i < taptree.length; i++) {
        const leaf = taptree[i];
        if (Array.isArray(leaf)) {
            const [r, t, p] = merkleize(leaf, target);
            target = t;
            leaves.push(r);
            for (const e of p) {
                path.push(e);
            }
        }
        else {
            leaves.push(leaf);
        }
    }
    if (leaves.length === 1) {
        return [leaves[0], target, path];
    }
    leaves.sort();
    if (leaves.length % 2 !== 0) {
        leaves.push(leaves[leaves.length - 1]);
    }
    for (let i = 0; i < leaves.length - 1; i += 2) {
        const branch = encode_tapbranch(leaves[i], leaves[i + 1]);
        tree.push(branch);
        if (typeof target === 'string') {
            if (target === leaves[i]) {
                path.push(leaves[i + 1]);
                target = branch;
            }
            else if (target === leaves[i + 1]) {
                path.push(leaves[i]);
                target = branch;
            }
        }
    }
    return merkleize(tree, target, path);
}

function config_tapleaf(config) {
    const { data, script, tapleaf, version } = config;
    let extension;
    if (script !== undefined) {
        extension = encode_tapscript(script, version);
    }
    if (data !== undefined) {
        extension = encode_tapleaf(data, version);
    }
    if (tapleaf !== undefined) {
        extension = Buff.bytes(tapleaf).hex;
    }
    return { data, extension, script };
}

function get_taptweak(pubkey, data) {
    data = data ?? new Uint8Array();
    size$1(pubkey, 32);
    return hash340('TapTweak', pubkey, data);
}
function tweak_pubkey(pubkey, tweak) {
    const pub = convert_32b(pubkey);
    return Point.from_x(pub).add(tweak).buff;
}

function parse_parity(pubkey) {
    const [parity] = convert_33b(pubkey);
    if (parity === 0x02)
        return 0;
    if (parity === 0x03)
        return 1;
    throw new Error('Invalid parity bit: ' + String(parity));
}

function tap_pubkey(pubkey, config = {}) {
    const { taptree = [], version = DEFAULT_VERSION$1 } = config;
    let path = [], taproot;
    const int_pub = Buff.bytes(pubkey);
    const { data, extension, script } = config_tapleaf(config);
    size$1(int_pub, 32);
    if (extension !== null) {
        if (taptree.length > 0) {
            const [root, _, proofs] = merkleize(taptree, extension);
            path = proofs;
            taproot = root;
        }
        else {
            taproot = extension;
        }
    }
    const taptweak = get_taptweak(int_pub, taproot);
    const twk_key = tweak_pubkey(int_pub, taptweak);
    const parity = parse_parity(twk_key);
    const tapkey = convert_32b(twk_key);
    const cbit = Buff.num(version + parity);
    const block = [cbit, int_pub.hex];
    if (path.length > 0) {
        path.forEach(e => block.push(Buff.hex(e)));
    }
    const cblock = Buff.join(block);
    return {
        data,
        extension,
        parity,
        path,
        script,
        taproot,
        taptree,
        version,
        cblock: cblock.hex,
        int_pub: int_pub.hex,
        tapkey: tapkey.hex,
        taptweak: taptweak.hex
    };
}

function create_address(script, network = 'regtest') {
    return create_addr(script, network);
}
function create_sats_txin(utxo) {
    const { txid, vout, value, script } = utxo;
    return create_vin({ txid, vout, prevout: { value, scriptPubKey: script } });
}
function create_ord_txin(utxo) {
    const { txid, vout, value: postage, script } = utxo;
    return create_vin({ txid, vout, prevout: { value: postage, scriptPubKey: script } });
}
function get_block_seq_val(timer) {
    const BLOCK_TIME = CONST.BLOCK_DURATION;
    const time_delay = Math.max(timer, BLOCK_TIME);
    return Math.ceil(time_delay / BLOCK_TIME);
}
function extract_utxo$1(tx, vout) {
    const txdata = parse_tx(tx);
    const txid = parse_txid(txdata);
    const prevout = txdata.vout.at(vout);
    Assert.exists(prevout, 'tx output does not exist');
    const { value, scriptPubKey } = prevout;
    const script = encode_script(scriptPubKey, false).hex;
    return { script, txid, vout, value: Number(value) };
}
function extract_op_return(tx) {
    const txdata = parse_tx(tx);
    const txout = txdata.vout.at(-1);
    Assert.exists(txout, 'tx output does not exist');
    Assert.ok(txout.value === CONST.BIGINT._0, 'tx data output is not zero value');
    const script = parse_script(txout.scriptPubKey);
    Assert.ok(script.asm[0] === 'OP_RETURN', 'output script does not start with OP_RETURN');
    return script.hex;
}
function get_txid(txdata) {
    return parse_txid(txdata);
}
function get_txsize(txdata) {
    return parse_txsize(txdata);
}
function get_vin_vsize(utxos) {
    let vsize = 0;
    for (const utxo of utxos) {
        const ctx = parse_script_meta(utxo.script);
        vsize += get_txin_type_vsize(ctx.type);
    }
    return vsize;
}
function get_txin_type_vsize(type) {
    switch (type) {
        case 'p2sh':
            return CONST.TXSIZE.TXIN.P2SH;
        case 'p2w-pkh':
            return CONST.TXSIZE.TXIN.P2WK;
        case 'p2tr':
            return CONST.TXSIZE.TXIN.P2TR;
        default:
            throw new Error('unsupported input type: ' + type);
    }
}
function get_taproot_script_key(scripts, index = 0, version = 0xc0) {
    const taptree = scripts.map(e => encode_tapscript(e, version));
    const tapleaf = taptree[index];
    const taproot_ctx = tap_pubkey(CONST.UNSPENDABLE_KEY, { taptree, tapleaf });
    return taproot_ctx.tapkey;
}
function create_tr_address(pubkey, network) {
    return P2TR.encode(pubkey, network);
}
function encode_p2tr_pubkey(pubkey) {
    return Script.encode(['OP_1', Buff.hex(pubkey)]);
}
function encode_tx(txdata) {
    return encode_tx$1(txdata).hex;
}
function decode_tx(txhex) {
    return decode_tx$1(txhex);
}
function parse_address(address) {
    return parse_addr(address);
}
function parse_address_script(address) {
    return Buff.hex(parse_addr(address).hex);
}
function parse_script_meta(script) {
    return parse_script(script);
}
function parse_script_asm(script) {
    return parse_script(script).asm;
}
var TX = {
    create_address,
    create_tr_address,
    create_ord_txin,
    create_sats_txin,
    extract_utxo: extract_utxo$1,
    extract_op_return,
    get_block_seq_val,
    get_taproot_script_key,
    get_txid,
    get_txsize,
    get_txin_type_vsize,
    get_vin_vsize,
    encode_script: (script, varint = false) => encode_script(script, varint),
    decode_script,
    encode_p2tr_pubkey,
    encode_tx,
    decode_tx,
    parse_address,
    parse_address_script,
    parse_script_asm,
    parse_script_meta
};

function assert_is_funded(psbt) {
    const pdata = parse_psbt(psbt);
    const pvouts = extract_txins(pdata);
    const txouts = extract_txouts(pdata);
    const vin_amt = pvouts.reduce((p, n) => p + Number(n.amount), 0);
    const out_amt = txouts.reduce((p, n) => p + Number(n.amount), 0);
    Assert.ok(vin_amt >= out_amt, `value in (${vin_amt}) < value out (${out_amt})`);
}
function extract_vins(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.inputsLength;
    const vins = [];
    for (let i = 0; i < count; i++) {
        const vin = pdata.getInput(i);
        vins.push(vin);
    }
    return vins;
}
function extract_txins(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.inputsLength;
    const prevouts = [];
    for (let i = 0; i < count; i++) {
        const { witnessUtxo } = pdata.getInput(i);
        if (witnessUtxo === undefined)
            continue;
        prevouts.push(witnessUtxo);
    }
    return prevouts;
}
function extract_txouts(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.outputsLength;
    const txouts = [];
    for (let i = 0; i < count; i++) {
        const { amount, script } = pdata.getOutput(i);
        if (amount === undefined || script === undefined)
            continue;
        txouts.push({ amount, script });
    }
    return txouts;
}
function decode_psbt(b64str) {
    const psbt = Buff.base64(b64str);
    return Transaction.fromPSBT(psbt, { allowUnknownOutputs: true });
}
function encode_psbt(psbt) {
    const psbt_bytes = psbt.toPSBT(0);
    return new Buff(psbt_bytes).base64;
}
function parse_psbt(psbt) {
    if (psbt instanceof Transaction) {
        return psbt;
    }
    else if (typeof psbt === 'string') {
        return decode_psbt(psbt);
    }
    else {
        throw new Error('invalid psbt: ' + psbt);
    }
}
function extract_tx(psbt) {
    let pdata = parse_psbt(psbt);
    pdata = finalize_legacy_inputs(pdata);
    const txdata = pdata.extract();
    return new Buff(txdata).hex;
}
function get_txhex(psbt) {
    let pdata = parse_psbt(psbt);
    pdata = finalize_legacy_inputs(pdata);
    return pdata.hex;
}
function get_vin_total(psbt) {
    const vins = extract_vins(psbt);
    return vins.reduce((acc, vin) => acc + Number(vin.witnessUtxo?.amount ?? 0), 0);
}
function extract_prevouts(psbt) {
    const scripts = [], values = [];
    const pdata = parse_psbt(psbt);
    for (let i = 0; i < pdata.inputsLength; i++) {
        const txin = pdata.getInput(i);
        Assert.exists(txin.witnessUtxo, `witness utxo does not exist for input ${i}`);
        scripts.push(txin.witnessUtxo.script);
        values.push(txin.witnessUtxo.amount);
    }
    return { scripts, values };
}
function extract_key_witness(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txin = pdata.getInput(index);
    if (txin.finalScriptWitness !== undefined) {
        return txin.finalScriptWitness.map(e => new Buff(e).hex);
    }
    else if (txin.partialSig?.at(0) !== undefined) {
        return txin.partialSig[0].map(e => new Buff(e).hex);
    }
    else if (txin.tapKeySig !== undefined) {
        return [new Buff(txin.tapKeySig).hex];
    }
    else {
        throw new Error('key signature not found');
    }
}
function extract_script_witness(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txin = pdata.getInput(index);
    if (txin.finalScriptWitness !== undefined) {
        return txin.finalScriptWitness.map(e => new Buff(e).hex);
    }
    else {
        const tleaf = txin.tapLeafScript?.at(0);
        Assert.ok(tleaf !== undefined, 'tapLeaf entry not found');
        const tss = txin.tapScriptSig?.at(0);
        Assert.ok(tss !== undefined, 'tapScriptSig entry not found');
        const cblock = TaprootControlBlock.encode(tleaf[0]);
        const script = new Buff(tleaf[1].slice(0, -1)).hex;
        const sig = new Buff(tss[1]).hex;
        return [sig, script, new Buff(cblock).hex];
    }
}
function extract_hash_witness(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txin = pdata.getInput(index);
    if (txin.finalScriptWitness !== undefined) {
        return txin.finalScriptWitness.map(e => new Buff(e).hex);
    }
    else {
        const tleaf = txin.tapLeafScript?.at(0);
        Assert.ok(tleaf !== undefined, 'tapLeaf entry not found');
        const tss = txin.hash160?.at(0);
        Assert.ok(tss !== undefined, 'hash160 entry not found');
        const cblock = TaprootControlBlock.encode(tleaf[0]);
        const script = new Buff(tleaf[1].slice(0, -1)).hex;
        const pimg = new Buff(tss[1]).hex;
        return [pimg, script, new Buff(cblock).hex];
    }
}
function extract_utxo(psbt, index) {
    let pdata = parse_psbt(psbt);
    pdata = finalize_legacy_inputs(pdata);
    const txout = pdata.getOutput(index);
    const txdata = pdata.hex;
    assert_psbt_output(txout);
    return {
        txid: parse_txid(txdata, false),
        vout: index,
        value: Number(txout.amount),
        script: new Buff(txout.script).hex
    };
}
function extract_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txinput = pdata.getInput(index);
    assert_psbt_input(txinput);
    return {
        txid: new Buff(txinput.txid).hex,
        vout: txinput.index,
        value: Number(txinput.witnessUtxo.amount),
        script: new Buff(txinput.witnessUtxo.script).hex
    };
}
function extract_sighash(psbt, index) {
    const pdata = parse_psbt(psbt);
    const prevouts = extract_prevouts(pdata);
    const script = prevouts.scripts.at(index);
    const amount = prevouts.values.at(index);
    const txinput = pdata.getInput(index);
    assert_psbt_input(txinput);
    Assert.exists(script, 'prevout script not found for index: ' + index);
    Assert.exists(amount, 'prevout amount not found for index: ' + index);
    const vintype = TX.parse_script_meta(script).type;
    if (vintype === 'p2w-pkh') {
        const pk_hash = new Buff(script.slice(2)).hex;
        const sigscript = Buff.hex(`76a914${pk_hash}88ac`);
        return new Buff(pdata.preimageWitnessV0(index, sigscript, 1, amount)).hex;
    }
    else if (vintype === 'p2sh') {
        Assert.ok(txinput.finalScriptSig?.at(1) === 20, 'invalid scriptsig for wrapped segwit');
        const pk_hash = new Buff(txinput.finalScriptSig.slice(2)).hex;
        const sigscript = Buff.hex(`76a914${pk_hash}88ac`);
        return new Buff(pdata.preimageWitnessV0(index, sigscript, 1, amount)).hex;
    }
    else if (vintype === 'p2tr') {
        return new Buff(pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.values)).hex;
    }
    else {
        throw new Error('invalid input type: ' + vintype);
    }
}
function extract_signed_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const utxo = extract_vin(pdata, index);
    const sighash = extract_sighash(pdata, index);
    const witness = extract_key_witness(pdata, index);
    return { ...utxo, sighash, witness };
}
function extract_scripted_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const utxo = extract_vin(pdata, index);
    const witness = extract_script_witness(pdata, index);
    return { ...utxo, witness };
}
function extract_hlock_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const utxo = extract_vin(pdata, index);
    const witness = extract_hash_witness(pdata, index);
    return { ...utxo, witness };
}
function extract_finalized_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txinput = pdata.getInput(index);
    const utxo = extract_vin(pdata, index);
    Assert.exists(txinput.finalScriptWitness, `PSBT input ${index} does not have a finalized witness`);
    const witness = txinput.finalScriptWitness.map(e => new Buff(e).hex);
    return { ...utxo, witness };
}
function finalize_script_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const pvin = pdata.getInput(index);
    const tdata = pvin.tapLeafScript?.at(0);
    const sdata = pvin.tapScriptSig?.at(0);
    Assert.exists(tdata, 'tapLeaf data is missing');
    Assert.exists(sdata, 'tapScriptSig data is missing');
    const script = tdata[1].slice(0, -1);
    const cblock = TaprootControlBlock.encode(tdata[0]);
    pdata.updateInput(index, {
        finalScriptWitness: [sdata[1], script, cblock]
    });
    return encode_psbt(pdata);
}
function extract_funding_vins(psbt, opt = {}) {
    const pdata = parse_psbt(psbt);
    const exclude = opt.post_exclude;
    const filter = opt.post_filter;
    const start = opt.start_idx ?? 1;
    const stop = opt.stop_idx ?? pdata.inputsLength;
    const utxos = [];
    for (let i = start; i < stop; i++) {
        const utxo = extract_signed_vin(pdata, i);
        if (typeof exclude === 'number' && utxo.value === exclude) {
            continue;
        }
        else if (typeof filter === 'number' && utxo.value !== filter) {
            continue;
        }
        else {
            utxos.push(utxo);
        }
    }
    return utxos;
}
function create_psbt_hashlock(hash, pimg) {
    return [Buff.hex(hash), Buff.hex(pimg)];
}
function create_psbt_tapscript(scripts, index = 0, version = 0xc0) {
    const taptree = scripts.map(e => encode_tapscript(e, version));
    const tapleaf = taptree[index];
    const taproot_ctx = tap_pubkey(CONST.UNSPENDABLE_KEY, { taptree, tapleaf });
    const parity = version | taproot_ctx.parity;
    const redeemScript = Buff.join([encode_script(scripts[index], false), Buff.num(version, 1)]);
    const internalKey = Buff.hex(CONST.UNSPENDABLE_KEY);
    const merklePath = taproot_ctx.path.map(e => new Buff(e));
    return [{ version: parity, internalKey, merklePath }, redeemScript];
}
function create_psbt_output(output) {
    return {
        amount: BigInt(output.value),
        script: Buff.hex(output.script)
    };
}
function create_psbt_input(utxo, witness) {
    const txinput = {
        txid: new Buff(utxo.txid),
        index: utxo.vout,
        witnessUtxo: {
            amount: BigInt(utxo.value),
            script: Buff.hex(utxo.script)
        }
    };
    if (Array.isArray(witness)) {
        txinput.finalScriptWitness = witness;
    }
    return txinput;
}
function create_psbt_payout(amount, address) {
    return {
        amount: BigInt(amount),
        script: new Buff(parse_addr(address).hex)
    };
}
function get_vsize$1(psbt) {
    const pdata = parse_psbt(psbt);
    return pdata.vsize;
}
function assert_psbt_output(psbt_out) {
    Assert.exists(psbt_out);
    Assert.exists(psbt_out.amount);
    Assert.exists(psbt_out.script);
}
function assert_psbt_input(psbt_vin) {
    Assert.exists(psbt_vin);
    Assert.exists(psbt_vin.txid);
    Assert.exists(psbt_vin.index);
    Assert.exists(psbt_vin.witnessUtxo);
}
var PSBT = {
    assert: {
        has_vin: assert_psbt_input,
        has_vout: assert_psbt_output,
        is_funded: assert_is_funded
    },
    extract: {
        tx: extract_tx,
        utxo: extract_utxo,
        base_vin: extract_vin,
        signed_vin: extract_signed_vin,
        hlock_vin: extract_hlock_vin,
        script_vin: extract_scripted_vin,
        sighash: extract_sighash,
        final_vin: extract_finalized_vin,
        funding_vins: extract_funding_vins,
        prevouts: extract_prevouts,
        key_witness: extract_key_witness,
        script_witness: extract_script_witness
    },
    get: {
        txhex: get_txhex,
        vsize: get_vsize$1,
        vin_total: get_vin_total
    },
    util: {
        finalize_legacy_inputs,
    },
    create: {
        psbt: (opts) => new Transaction(opts),
        input: create_psbt_input,
        hashlock: create_psbt_hashlock,
        output: create_psbt_output,
        payout: create_psbt_payout,
        tapscript: create_psbt_tapscript
    },
    finalize: {
        script_vin: finalize_script_vin
    },
    encode: encode_psbt,
    decode: decode_psbt,
    parse: parse_psbt
};
function finalize_legacy_inputs(pdata) {
    for (let i = 0; i < pdata.inputsLength; i++) {
        const pvin = pdata.getInput(i);
        const script = pvin.redeemScript;
        const psig = pvin.partialSig?.at(0);
        if (script !== undefined && psig !== undefined) {
            pdata.finalizeIdx(i);
        }
    }
    return pdata;
}

function now() {
    return Math.floor(Date.now() / 1000);
}
async function sleep(ms = 1000) {
    return new Promise(res => setTimeout(res, ms));
}
function get_map_value(terms, key, idx = 0) {
    const value = terms.get(key)?.at(idx);
    Assert.exists(value, 'value is null or undefined: ' + key);
    return value;
}
function round_to_fixed(float_value, precision) {
    return parseFloat(float_value.toFixed(precision));
}
function parse_schema(input, schema, error) {
    try {
        return schema.parse(input);
    }
    catch (err) {
        console.error(err);
        if (typeof error === 'string') {
            throw new Error(error);
        }
        else {
            throw err;
        }
    }
}
function parse_error(err) {
    if (err instanceof Error) {
        return err.message;
    }
    else if (typeof err === 'string') {
        return err;
    }
    else {
        return String(err);
    }
}
async function resolver(fn, timeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject('timeout'), timeout);
        fn().then((res) => {
            clearTimeout(timer);
            resolve(res);
        });
    });
}
async function safe_exec(fn) {
    try {
        return { ok: true, data: await fn() };
    }
    catch (err) {
        return { ok: false, err };
    }
}
function normalize_obj(obj) {
    if (obj instanceof Map || Array.isArray(obj) || typeof obj !== 'object') {
        return obj;
    }
    else {
        return Object.keys(obj)
            .sort()
            .filter(([_, value]) => value !== undefined)
            .reduce((sorted, key) => {
            sorted[key] = obj[key];
            return sorted;
        }, {});
    }
}
function get_record_key(map, type) {
    const ent = Object.entries(map).find(e => e[0] === type);
    if (ent === undefined)
        throw new Error('value does not exist for type: ' + String(type));
    return ent[1];
}
function get_record_type(map, key) {
    const ent = Object.entries(map).find(e => e[1] === key);
    if (ent === undefined)
        throw new Error('type does not exist for key: ' + key);
    return Number(ent[0]);
}

var Fetch;
(function (Fetch) {
    async function json(input, init, fetcher = fetch) {
        const res = await fetcher(input, init);
        return resolve_json(res);
    }
    Fetch.json = json;
    async function text(input, init, fetcher = fetch) {
        const res = await fetcher(input, init);
        return resolve_text(res);
    }
    Fetch.text = text;
    async function resolve_json(res) {
        if (!res.ok) {
            return resolve_error(res);
        }
        else {
            const data = await res.json();
            return { status: res.status, ok: true, data };
        }
    }
    async function resolve_text(res) {
        if (!res.ok) {
            return resolve_error(res);
        }
        else {
            const data = await res.text();
            return { status: res.status, ok: true, data };
        }
    }
    async function resolve_error(res) {
        const { status, statusText } = res;
        let error;
        try {
            error = await res.text();
        }
        catch {
            error = statusText;
        }
        return { error, status, ok: false };
    }
})(Fetch || (Fetch = {}));
var Resolve;
(function (Resolve) {
    function data(data, status = 200) {
        data = (data !== null && data !== undefined)
            ? normalize_obj(data)
            : data;
        return { ok: true, status, data };
    }
    Resolve.data = data;
    function schema(data, schema, err_code = 600) {
        const parsed = schema.safeParse(data);
        return parsed.success
            ? { ok: true, status: 200, data: parsed.data }
            : { ok: false, status: err_code, error: parsed.error.toString() };
    }
    Resolve.schema = schema;
    function error(error, status = 600) {
        const msg = parse_error(error);
        return { ok: false, status, error: msg };
    }
    Resolve.error = error;
    function fail(reason, status = 600) {
        return { ok: false, status, error: reason };
    }
    Resolve.fail = fail;
})(Resolve || (Resolve = {}));

function hash160(...bytes) {
    const preimage = Buff.join(bytes);
    const hash_256 = sha256$1(preimage);
    const hash_160 = ripemd160(hash_256);
    return new Buff(hash_160).hex;
}

var InscribeUtil;
(function (InscribeUtil) {
    function parse(script) {
        const words = parse_script(script).asm;
        const start_idx = words.findIndex(e => e === 'OP_0');
        Assert.ok(start_idx !== -1, 'inscription zero index not found');
        const envelopes = [];
        for (let idx = start_idx; idx < words.length; idx++) {
            Assert.ok(words[idx] === 'OP_0', 'OP_0 missing from envelope');
            Assert.ok(words[idx + 1] === 'OP_IF', 'OP_IF missing from envelope');
            Assert.ok(words[idx + 2] === '6f7264', 'magic missing from envelope');
            const stop_idx = words.findIndex(e => e === 'OP_ENDIF');
            Assert.ok(stop_idx !== -1, 'inscription envelope missing END_IF statement');
            const envelope = words.slice(idx + 3, stop_idx);
            envelopes.push(envelope);
            idx += stop_idx;
        }
        return envelopes.map(e => parse_inscription_words(e));
    }
    InscribeUtil.parse = parse;
})(InscribeUtil || (InscribeUtil = {}));
function parse_inscription_words(words) {
    const ret = {};
    for (let i = 0; i < words.length; i++) {
        switch (words[i]) {
            case 'OP_1':
                ret.type = Buff.hex(words[i + 1]).str;
                i += 1;
                break;
            case 'OP_2':
                ret.pointer = parse_inscription_pointer(words[i + 1]);
                i += 1;
                break;
            case 'OP_3':
                ret.parent = parse_inscription_id(words[i + 1]);
                i += 1;
                break;
            case 'OP_11':
                ret.delegate = parse_inscription_id(words[i + 1]);
                i += 1;
                break;
            case 'OP_13':
                ret.rune = words[i + 1];
                i += 1;
                break;
            case 'OP_0':
                ret.body = parse_inscription_body(words.slice(i + 1), ret.type);
                return ret;
            default:
                throw new Error('unknown code: ' + words[i]);
        }
    }
    return ret;
}
function parse_inscription_id(word) {
    const bytes = Buff.hex(word);
    const idx = bytes.at(-1) ?? 0;
    const txid = bytes.slice(0, -1).reverse().hex;
    return txid + 'i' + String(idx);
}
function parse_inscription_pointer(word) {
    return Buff.hex(word).reverse().num;
}
function parse_inscription_body(words, type) {
    const bytes = Buff.join(words);
    switch (type) {
        case 'application/json':
            return bytes.to_json();
        case 'text/plain':
            return bytes.str;
        default:
            return bytes.hex;
    }
}

var dist = {};

var constants = {};

var integer = {};

var u8 = {};

var monads = {};

var hasRequiredMonads;

function requireMonads () {
	if (hasRequiredMonads) return monads;
	hasRequiredMonads = 1;
	(function (exports) {
		// Copied with MIT License from link below:
		// https://github.com/thames-technology/monads/blob/de957d3d68449d659518d99be4ea74bbb70dfc8e/src/option/option.ts
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.isNone = exports.isSome = exports.None = exports.Some = exports.OptionType = void 0;
		/**
		 * Enum-like object to represent the type of an Option (Some or None).
		 */
		exports.OptionType = {
		    Some: Symbol(':some'),
		    None: Symbol(':none'),
		};
		/**
		 * Represents a Some value of Option.
		 */
		class SomeImpl {
		    constructor(val) {
		        this.val = val;
		    }
		    get type() {
		        return exports.OptionType.Some;
		    }
		    isSome() {
		        return true;
		    }
		    isNone() {
		        return false;
		    }
		    match(fn) {
		        return fn.some(this.val);
		    }
		    map(fn) {
		        return Some(fn(this.val));
		    }
		    inspect(fn) {
		        fn(this.val);
		        return this;
		    }
		    andThen(fn) {
		        return fn(this.val);
		    }
		    or(_optb) {
		        return this;
		    }
		    orElse(optb) {
		        return this;
		    }
		    and(optb) {
		        return optb;
		    }
		    unwrapOr(_def) {
		        return this.val;
		    }
		    unwrap() {
		        return this.val;
		    }
		}
		/**
		 * Represents a None value of Option.
		 */
		class NoneImpl {
		    get type() {
		        return exports.OptionType.None;
		    }
		    isSome() {
		        return false;
		    }
		    isNone() {
		        return true;
		    }
		    match({ none }) {
		        if (typeof none === 'function') {
		            return none();
		        }
		        return none;
		    }
		    map(_fn) {
		        return new NoneImpl();
		    }
		    inspect(fn) {
		        return this;
		    }
		    andThen(_fn) {
		        return new NoneImpl();
		    }
		    or(optb) {
		        return optb;
		    }
		    orElse(optb) {
		        return optb();
		    }
		    and(_optb) {
		        return new NoneImpl();
		    }
		    unwrapOr(def) {
		        return def;
		    }
		    unwrap() {
		        throw new ReferenceError('Trying to unwrap None.');
		    }
		}
		/**
		 * Creates a Some instance of Option containing the given value.
		 * This function is used to represent the presence of a value in an operation that may not always produce a value.
		 *
		 * @param val The value to be wrapped in a Some Option.
		 * @returns An Option instance representing the presence of a value.
		 *
		 * #### Example
		 *
		 * ```ts
		 * const option = Some(42);
		 * console.log(option.unwrap()); // Outputs: 42
		 * ```
		 */
		function Some(val) {
		    return new SomeImpl(val);
		}
		exports.Some = Some;
		/**
		 * The singleton instance representing None, an Option with no value.
		 * This constant is used to represent the absence of a value in operations that may not always produce a value.
		 *
		 * #### Example
		 *
		 * ```ts
		 * const option = None;
		 * console.log(option.isNone()); // Outputs: true
		 * ```
		 */
		exports.None = new NoneImpl(); // eslint-disable-line @typescript-eslint/no-explicit-any
		/**
		 * Type guard to check if an Option is a Some value.
		 * This function is used to narrow down the type of an Option to SomeOption in TypeScript's type system.
		 *
		 * @param val The Option to be checked.
		 * @returns true if the provided Option is a SomeOption, false otherwise.
		 *
		 * #### Example
		 *
		 * ```ts
		 * const option = Some('Success');
		 * if (isSome(option)) {
		 *   console.log('Option has a value:', option.unwrap());
		 * }
		 * ```
		 */
		function isSome(val) {
		    return val.isSome();
		}
		exports.isSome = isSome;
		/**
		 * Type guard to check if an Option is a None value.
		 * This function is used to narrow down the type of an Option to NoneOption in TypeScript's type system.
		 *
		 * @param val The Option to be checked.
		 * @returns true if the provided Option is a NoneOption, false otherwise.
		 *
		 * #### Example
		 *
		 * ```ts
		 * const option = None;
		 * if (isNone(option)) {
		 *   console.log('Option does not have a value.');
		 * }
		 * ```
		 */
		function isNone(val) {
		    return val.isNone();
		}
		exports.isNone = isNone;
		
	} (monads));
	return monads;
}

var hasRequiredU8;

function requireU8 () {
	if (hasRequiredU8) return u8;
	hasRequiredU8 = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.u8 = exports.U8_MAX_BIGINT = void 0;
		const monads_1 = /*@__PURE__*/ requireMonads();
		exports.U8_MAX_BIGINT = 0xffn;
		function u8(num) {
		    if (typeof num == 'bigint') {
		        if (num < 0n || num > exports.U8_MAX_BIGINT) {
		            throw new Error('num is out of range');
		        }
		    }
		    else {
		        if (!Number.isSafeInteger(num) || num < 0) {
		            throw new Error('num is not a valid integer');
		        }
		    }
		    return BigInt(num);
		}
		exports.u8 = u8;
		(function (u8) {
		    u8.MAX = u8(exports.U8_MAX_BIGINT);
		    function checkedAdd(x, y) {
		        const result = x + y;
		        if (result > u8.MAX) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u8(result));
		    }
		    u8.checkedAdd = checkedAdd;
		    function checkedSub(x, y) {
		        const result = x - y;
		        if (result < 0n) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u8(result));
		    }
		    u8.checkedSub = checkedSub;
		})(u8 || (exports.u8 = u8 = {}));
		
	} (u8));
	return u8;
}

var u32 = {};

var hasRequiredU32;

function requireU32 () {
	if (hasRequiredU32) return u32;
	hasRequiredU32 = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.u32 = exports.U32_MAX_BIGINT = void 0;
		const monads_1 = /*@__PURE__*/ requireMonads();
		exports.U32_MAX_BIGINT = 0xffffffffn;
		function u32(num) {
		    if (typeof num == 'bigint') {
		        if (num < 0n || num > exports.U32_MAX_BIGINT) {
		            throw new Error('num is out of range');
		        }
		    }
		    else {
		        if (!Number.isSafeInteger(num) || num < 0) {
		            throw new Error('num is not a valid integer');
		        }
		    }
		    return BigInt(num);
		}
		exports.u32 = u32;
		(function (u32) {
		    u32.MAX = u32(exports.U32_MAX_BIGINT);
		    function checkedAdd(x, y) {
		        const result = x + y;
		        if (result > u32.MAX) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u32(result));
		    }
		    u32.checkedAdd = checkedAdd;
		    function checkedSub(x, y) {
		        const result = x - y;
		        if (result < 0n) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u32(result));
		    }
		    u32.checkedSub = checkedSub;
		})(u32 || (exports.u32 = u32 = {}));
		
	} (u32));
	return u32;
}

var u64 = {};

var hasRequiredU64;

function requireU64 () {
	if (hasRequiredU64) return u64;
	hasRequiredU64 = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.u64 = exports.U64_MAX_BIGINT = void 0;
		const monads_1 = /*@__PURE__*/ requireMonads();
		exports.U64_MAX_BIGINT = 0xffffffffffffffffn;
		function u64(num) {
		    if (typeof num == 'bigint') {
		        if (num < 0n || num > exports.U64_MAX_BIGINT) {
		            throw new Error('num is out of range');
		        }
		    }
		    else {
		        if (!Number.isSafeInteger(num) || num < 0) {
		            throw new Error('num is not a valid integer');
		        }
		    }
		    return BigInt(num);
		}
		exports.u64 = u64;
		(function (u64) {
		    u64.MAX = u64(exports.U64_MAX_BIGINT);
		    function checkedAdd(x, y) {
		        const result = x + y;
		        if (result > u64.MAX) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u64(result));
		    }
		    u64.checkedAdd = checkedAdd;
		    function checkedSub(x, y) {
		        const result = x - y;
		        if (result < 0n) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u64(result));
		    }
		    u64.checkedSub = checkedSub;
		})(u64 || (exports.u64 = u64 = {}));
		
	} (u64));
	return u64;
}

var u128 = {};

var seekbuffer = {};

var hasRequiredSeekbuffer;

function requireSeekbuffer () {
	if (hasRequiredSeekbuffer) return seekbuffer;
	hasRequiredSeekbuffer = 1;
	Object.defineProperty(seekbuffer, "__esModule", { value: true });
	seekbuffer.SeekBuffer = void 0;
	class SeekBuffer {
	    constructor(buffer) {
	        this.buffer = buffer;
	        this.seekIndex = 0;
	    }
	    readUInt8() {
	        if (this.isFinished()) {
	            return undefined;
	        }
	        return this.buffer.readUInt8(this.seekIndex++);
	    }
	    isFinished() {
	        return this.seekIndex >= this.buffer.length;
	    }
	}
	seekbuffer.SeekBuffer = SeekBuffer;
	
	return seekbuffer;
}

var hasRequiredU128;

function requireU128 () {
	if (hasRequiredU128) return u128;
	hasRequiredU128 = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.getAllU128 = exports.u128 = exports.U128_MAX_BIGINT = void 0;
		const monads_1 = /*@__PURE__*/ requireMonads();
		const seekbuffer_1 = /*@__PURE__*/ requireSeekbuffer();
		const u64_1 = /*@__PURE__*/ requireU64();
		const u32_1 = /*@__PURE__*/ requireU32();
		const u8_1 = /*@__PURE__*/ requireU8();
		exports.U128_MAX_BIGINT = 0xffffffffffffffffffffffffffffffffn;
		/**
		 * Convert Number or BigInt to 128-bit unsigned integer.
		 * @param num - The Number or BigInt to convert.
		 * @returns - The resulting 128-bit unsigned integer (BigInt).
		 */
		function u128(num) {
		    if (typeof num == 'bigint') {
		        if (num < 0n || num > exports.U128_MAX_BIGINT) {
		            throw new Error('num is out of range');
		        }
		    }
		    else {
		        if (!Number.isSafeInteger(num) || num < 0) {
		            throw new Error('num is not a valid integer');
		        }
		    }
		    return BigInt(num);
		}
		exports.u128 = u128;
		(function (u128) {
		    u128.MAX = u128(exports.U128_MAX_BIGINT);
		    function checkedAdd(x, y) {
		        const result = x + y;
		        if (result > u128.MAX) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u128(result));
		    }
		    u128.checkedAdd = checkedAdd;
		    function checkedAddThrow(x, y) {
		        const option = u128.checkedAdd(x, y);
		        if (option.isNone()) {
		            throw new Error('checked add overflow');
		        }
		        return option.unwrap();
		    }
		    u128.checkedAddThrow = checkedAddThrow;
		    function checkedSub(x, y) {
		        const result = x - y;
		        if (result < 0n) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u128(result));
		    }
		    u128.checkedSub = checkedSub;
		    function checkedSubThrow(x, y) {
		        const option = u128.checkedSub(x, y);
		        if (option.isNone()) {
		            throw new Error('checked sub overflow');
		        }
		        return option.unwrap();
		    }
		    u128.checkedSubThrow = checkedSubThrow;
		    function checkedMultiply(x, y) {
		        const result = x * y;
		        if (result > u128.MAX) {
		            return monads_1.None;
		        }
		        return (0, monads_1.Some)(u128(result));
		    }
		    u128.checkedMultiply = checkedMultiply;
		    function saturatingAdd(x, y) {
		        const result = x + y;
		        return result > u128.MAX ? u128.MAX : u128(result);
		    }
		    u128.saturatingAdd = saturatingAdd;
		    function saturatingMultiply(x, y) {
		        const result = x * y;
		        return result > u128.MAX ? u128.MAX : u128(result);
		    }
		    u128.saturatingMultiply = saturatingMultiply;
		    function saturatingSub(x, y) {
		        return u128(x < y ? 0 : x - y);
		    }
		    u128.saturatingSub = saturatingSub;
		    function decodeVarInt(seekBuffer) {
		        try {
		            return (0, monads_1.Some)(tryDecodeVarInt(seekBuffer));
		        }
		        catch (e) {
		            return monads_1.None;
		        }
		    }
		    u128.decodeVarInt = decodeVarInt;
		    function tryDecodeVarInt(seekBuffer) {
		        let result = u128(0);
		        for (let i = 0; i <= 18; i++) {
		            const byte = seekBuffer.readUInt8();
		            if (byte === undefined) {
		                throw new Error('Unterminated');
		            }
		            const value = u128(byte) & 127n;
		            if (i === 18 && (value & 124n) !== 0n) {
		                throw new Error('Overflow');
		            }
		            result = u128(result | (value << u128(7 * i)));
		            if ((byte & 128) === 0) {
		                return result;
		            }
		        }
		        throw new Error('Overlong');
		    }
		    u128.tryDecodeVarInt = tryDecodeVarInt;
		    function encodeVarInt(value) {
		        const v = [];
		        while (value >> 7n > 0n) {
		            v.push(Number(value & 0xffn) | 128);
		            value = u128(value >> 7n);
		        }
		        v.push(Number(value & 0xffn));
		        return Buffer.from(v);
		    }
		    u128.encodeVarInt = encodeVarInt;
		    function tryIntoU64(n) {
		        return n > u64_1.u64.MAX ? monads_1.None : (0, monads_1.Some)((0, u64_1.u64)(n));
		    }
		    u128.tryIntoU64 = tryIntoU64;
		    function tryIntoU32(n) {
		        return n > u32_1.u32.MAX ? monads_1.None : (0, monads_1.Some)((0, u32_1.u32)(n));
		    }
		    u128.tryIntoU32 = tryIntoU32;
		    function tryIntoU8(n) {
		        return n > u8_1.u8.MAX ? monads_1.None : (0, monads_1.Some)((0, u8_1.u8)(n));
		    }
		    u128.tryIntoU8 = tryIntoU8;
		})(u128 || (exports.u128 = u128 = {}));
		function* getAllU128(buffer) {
		    const seekBuffer = new seekbuffer_1.SeekBuffer(buffer);
		    while (!seekBuffer.isFinished()) {
		        const nextValue = u128.tryDecodeVarInt(seekBuffer);
		        if (nextValue === undefined) {
		            return;
		        }
		        yield nextValue;
		    }
		}
		exports.getAllU128 = getAllU128;
		
	} (u128));
	return u128;
}

var hasRequiredInteger;

function requireInteger () {
	if (hasRequiredInteger) return integer;
	hasRequiredInteger = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.u128 = exports.u64 = exports.u32 = exports.u8 = void 0;
		var u8_1 = /*@__PURE__*/ requireU8();
		Object.defineProperty(exports, "u8", { enumerable: true, get: function () { return u8_1.u8; } });
		var u32_1 = /*@__PURE__*/ requireU32();
		Object.defineProperty(exports, "u32", { enumerable: true, get: function () { return u32_1.u32; } });
		var u64_1 = /*@__PURE__*/ requireU64();
		Object.defineProperty(exports, "u64", { enumerable: true, get: function () { return u64_1.u64; } });
		var u128_1 = /*@__PURE__*/ requireU128();
		Object.defineProperty(exports, "u128", { enumerable: true, get: function () { return u128_1.u128; } });
		
	} (integer));
	return integer;
}

var script = {};

var hasRequiredScript;

function requireScript () {
	if (hasRequiredScript) return script;
	hasRequiredScript = 1;
	Object.defineProperty(script, "__esModule", { value: true });
	script.script = script.opcodes = void 0;
	var pushdata;
	(function (pushdata) {
	    /**
	     * Calculates the encoding length of a number used for push data in Bitcoin transactions.
	     * @param i The number to calculate the encoding length for.
	     * @returns The encoding length of the number.
	     */
	    function encodingLength(i) {
	        return i < OPS.OP_PUSHDATA1 ? 1 : i <= 0xff ? 2 : i <= 0xffff ? 3 : 5;
	    }
	    pushdata.encodingLength = encodingLength;
	    /**
	     * Encodes a number into a buffer using a variable-length encoding scheme.
	     * The encoded buffer is written starting at the specified offset.
	     * Returns the size of the encoded buffer.
	     *
	     * @param buffer - The buffer to write the encoded data into.
	     * @param num - The number to encode.
	     * @param offset - The offset at which to start writing the encoded buffer.
	     * @returns The size of the encoded buffer.
	     */
	    function encode(buffer, num, offset) {
	        const size = encodingLength(num);
	        // ~6 bit
	        if (size === 1) {
	            buffer.writeUInt8(num, offset);
	            // 8 bit
	        }
	        else if (size === 2) {
	            buffer.writeUInt8(OPS.OP_PUSHDATA1, offset);
	            buffer.writeUInt8(num, offset + 1);
	            // 16 bit
	        }
	        else if (size === 3) {
	            buffer.writeUInt8(OPS.OP_PUSHDATA2, offset);
	            buffer.writeUInt16LE(num, offset + 1);
	            // 32 bit
	        }
	        else {
	            buffer.writeUInt8(OPS.OP_PUSHDATA4, offset);
	            buffer.writeUInt32LE(num, offset + 1);
	        }
	        return size;
	    }
	    pushdata.encode = encode;
	    /**
	     * Decodes a buffer and returns information about the opcode, number, and size.
	     * @param buffer - The buffer to decode.
	     * @param offset - The offset within the buffer to start decoding.
	     * @returns An object containing the opcode, number, and size, or null if decoding fails.
	     */
	    function decode(buffer, offset) {
	        const opcode = buffer.readUInt8(offset);
	        let num;
	        let size;
	        // ~6 bit
	        if (opcode < OPS.OP_PUSHDATA1) {
	            num = opcode;
	            size = 1;
	            // 8 bit
	        }
	        else if (opcode === OPS.OP_PUSHDATA1) {
	            if (offset + 2 > buffer.length)
	                return null;
	            num = buffer.readUInt8(offset + 1);
	            size = 2;
	            // 16 bit
	        }
	        else if (opcode === OPS.OP_PUSHDATA2) {
	            if (offset + 3 > buffer.length)
	                return null;
	            num = buffer.readUInt16LE(offset + 1);
	            size = 3;
	            // 32 bit
	        }
	        else {
	            if (offset + 5 > buffer.length)
	                return null;
	            if (opcode !== OPS.OP_PUSHDATA4)
	                throw new Error('Unexpected opcode');
	            num = buffer.readUInt32LE(offset + 1);
	            size = 5;
	        }
	        return {
	            opcode,
	            number: num,
	            size,
	        };
	    }
	    pushdata.decode = decode;
	})(pushdata || (pushdata = {}));
	const OPS = {
	    OP_FALSE: 0,
	    OP_0: 0,
	    OP_PUSHDATA1: 76,
	    OP_PUSHDATA2: 77,
	    OP_PUSHDATA4: 78,
	    OP_1NEGATE: 79,
	    OP_RESERVED: 80,
	    OP_TRUE: 81,
	    OP_1: 81,
	    OP_2: 82,
	    OP_3: 83,
	    OP_4: 84,
	    OP_5: 85,
	    OP_6: 86,
	    OP_7: 87,
	    OP_8: 88,
	    OP_9: 89,
	    OP_10: 90,
	    OP_11: 91,
	    OP_12: 92,
	    OP_13: 93,
	    OP_14: 94,
	    OP_15: 95,
	    OP_16: 96,
	    OP_NOP: 97,
	    OP_VER: 98,
	    OP_IF: 99,
	    OP_NOTIF: 100,
	    OP_VERIF: 101,
	    OP_VERNOTIF: 102,
	    OP_ELSE: 103,
	    OP_ENDIF: 104,
	    OP_VERIFY: 105,
	    OP_RETURN: 106,
	    OP_TOALTSTACK: 107,
	    OP_FROMALTSTACK: 108,
	    OP_2DROP: 109,
	    OP_2DUP: 110,
	    OP_3DUP: 111,
	    OP_2OVER: 112,
	    OP_2ROT: 113,
	    OP_2SWAP: 114,
	    OP_IFDUP: 115,
	    OP_DEPTH: 116,
	    OP_DROP: 117,
	    OP_DUP: 118,
	    OP_NIP: 119,
	    OP_OVER: 120,
	    OP_PICK: 121,
	    OP_ROLL: 122,
	    OP_ROT: 123,
	    OP_SWAP: 124,
	    OP_TUCK: 125,
	    OP_CAT: 126,
	    OP_SUBSTR: 127,
	    OP_LEFT: 128,
	    OP_RIGHT: 129,
	    OP_SIZE: 130,
	    OP_INVERT: 131,
	    OP_AND: 132,
	    OP_OR: 133,
	    OP_XOR: 134,
	    OP_EQUAL: 135,
	    OP_EQUALVERIFY: 136,
	    OP_RESERVED1: 137,
	    OP_RESERVED2: 138,
	    OP_1ADD: 139,
	    OP_1SUB: 140,
	    OP_2MUL: 141,
	    OP_2DIV: 142,
	    OP_NEGATE: 143,
	    OP_ABS: 144,
	    OP_NOT: 145,
	    OP_0NOTEQUAL: 146,
	    OP_ADD: 147,
	    OP_SUB: 148,
	    OP_MUL: 149,
	    OP_DIV: 150,
	    OP_MOD: 151,
	    OP_LSHIFT: 152,
	    OP_RSHIFT: 153,
	    OP_BOOLAND: 154,
	    OP_BOOLOR: 155,
	    OP_NUMEQUAL: 156,
	    OP_NUMEQUALVERIFY: 157,
	    OP_NUMNOTEQUAL: 158,
	    OP_LESSTHAN: 159,
	    OP_GREATERTHAN: 160,
	    OP_LESSTHANOREQUAL: 161,
	    OP_GREATERTHANOREQUAL: 162,
	    OP_MIN: 163,
	    OP_MAX: 164,
	    OP_WITHIN: 165,
	    OP_RIPEMD160: 166,
	    OP_SHA1: 167,
	    OP_SHA256: 168,
	    OP_HASH160: 169,
	    OP_HASH256: 170,
	    OP_CODESEPARATOR: 171,
	    OP_CHECKSIG: 172,
	    OP_CHECKSIGVERIFY: 173,
	    OP_CHECKMULTISIG: 174,
	    OP_CHECKMULTISIGVERIFY: 175,
	    OP_NOP1: 176,
	    OP_NOP2: 177,
	    OP_CHECKLOCKTIMEVERIFY: 177,
	    OP_NOP3: 178,
	    OP_CHECKSEQUENCEVERIFY: 178,
	    OP_NOP4: 179,
	    OP_NOP5: 180,
	    OP_NOP6: 181,
	    OP_NOP7: 182,
	    OP_NOP8: 183,
	    OP_NOP9: 184,
	    OP_NOP10: 185,
	    OP_CHECKSIGADD: 186,
	    OP_PUBKEYHASH: 253,
	    OP_PUBKEY: 254,
	    OP_INVALIDOPCODE: 255,
	};
	script.opcodes = OPS;
	function singleChunkIsBuffer(buf) {
	    return Buffer.isBuffer(buf);
	}
	var script$1;
	(function (script) {
	    function compile(chunks) {
	        const bufferSize = chunks.reduce((accum, chunk) => {
	            // data chunk
	            if (singleChunkIsBuffer(chunk)) {
	                return accum + pushdata.encodingLength(chunk.length) + chunk.length;
	            }
	            // opcode
	            return accum + 1;
	        }, 0.0);
	        const buffer = Buffer.allocUnsafe(bufferSize);
	        let offset = 0;
	        chunks.forEach((chunk) => {
	            // data chunk
	            if (singleChunkIsBuffer(chunk)) {
	                offset += pushdata.encode(buffer, chunk.length, offset);
	                chunk.copy(buffer, offset);
	                offset += chunk.length;
	                // opcode
	            }
	            else {
	                buffer.writeUInt8(chunk, offset);
	                offset += 1;
	            }
	        });
	        if (offset !== buffer.length)
	            throw new Error('Could not decode chunks');
	        return buffer;
	    }
	    script.compile = compile;
	    function* decompile(buffer) {
	        let i = 0;
	        while (i < buffer.length) {
	            const opcode = buffer[i];
	            // data chunk
	            if (opcode >= OPS.OP_0 && opcode <= OPS.OP_PUSHDATA4) {
	                const d = pushdata.decode(buffer, i);
	                // did reading a pushDataInt fail?
	                if (d === null)
	                    return false;
	                i += d.size;
	                // attempt to read too much data?
	                if (i + d.number > buffer.length)
	                    return false;
	                const data = buffer.subarray(i, i + d.number);
	                i += d.number;
	                yield data;
	                // opcode
	            }
	            else {
	                yield opcode;
	                i += 1;
	            }
	        }
	        return true;
	    }
	    script.decompile = decompile;
	})(script$1 || (script.script = script$1 = {}));
	
	return script;
}

var hasRequiredConstants;

function requireConstants () {
	if (hasRequiredConstants) return constants;
	hasRequiredConstants = 1;
	Object.defineProperty(constants, "__esModule", { value: true });
	constants.TAPROOT_SCRIPT_PUBKEY_TYPE = constants.COMMIT_CONFIRMATIONS = constants.TAPROOT_ANNEX_PREFIX = constants.MAGIC_NUMBER = constants.OP_RETURN = constants.MAX_SCRIPT_ELEMENT_SIZE = constants.SUBSIDY_HALVING_INTERVAL = constants.RESERVED = constants.MAX_DIVISIBILITY = void 0;
	const integer_1 = /*@__PURE__*/ requireInteger();
	const script_1 = /*@__PURE__*/ requireScript();
	constants.MAX_DIVISIBILITY = (0, integer_1.u8)(38);
	constants.RESERVED = (0, integer_1.u128)(6402364363415443603228541259936211926n);
	constants.SUBSIDY_HALVING_INTERVAL = 210000;
	constants.MAX_SCRIPT_ELEMENT_SIZE = 520;
	constants.OP_RETURN = script_1.opcodes.OP_RETURN;
	constants.MAGIC_NUMBER = script_1.opcodes.OP_13;
	constants.TAPROOT_ANNEX_PREFIX = 0x50;
	constants.COMMIT_CONFIRMATIONS = 6;
	constants.TAPROOT_SCRIPT_PUBKEY_TYPE = 'witness_v1_taproot';
	
	return constants;
}

var etching = {};

var hasRequiredEtching;

function requireEtching () {
	if (hasRequiredEtching) return etching;
	hasRequiredEtching = 1;
	Object.defineProperty(etching, "__esModule", { value: true });
	etching.Etching = void 0;
	const monads_1 = /*@__PURE__*/ requireMonads();
	const integer_1 = /*@__PURE__*/ requireInteger();
	class Etching {
	    constructor(divisibility, rune, spacers, symbol, terms, premine, turbo) {
	        this.divisibility = divisibility;
	        this.rune = rune;
	        this.spacers = spacers;
	        this.terms = terms;
	        this.premine = premine;
	        this.turbo = turbo;
	        this.symbol = symbol.andThen((value) => {
	            const codePoint = value.codePointAt(0);
	            return codePoint !== undefined ? (0, monads_1.Some)(String.fromCodePoint(codePoint)) : monads_1.None;
	        });
	    }
	    get supply() {
	        const premine = this.premine.unwrapOr((0, integer_1.u128)(0));
	        const cap = this.terms.andThen((terms) => terms.cap).unwrapOr((0, integer_1.u128)(0));
	        const amount = this.terms.andThen((terms) => terms.amount).unwrapOr((0, integer_1.u128)(0));
	        return integer_1.u128
	            .checkedMultiply(cap, amount)
	            .andThen((multiplyResult) => integer_1.u128.checkedAdd(premine, multiplyResult));
	    }
	}
	etching.Etching = Etching;
	
	return etching;
}

var flaw = {};

var hasRequiredFlaw;

function requireFlaw () {
	if (hasRequiredFlaw) return flaw;
	hasRequiredFlaw = 1;
	Object.defineProperty(flaw, "__esModule", { value: true });
	flaw.Flaw = void 0;
	var Flaw;
	(function (Flaw) {
	    Flaw[Flaw["EDICT_OUTPUT"] = 0] = "EDICT_OUTPUT";
	    Flaw[Flaw["EDICT_RUNE_ID"] = 1] = "EDICT_RUNE_ID";
	    Flaw[Flaw["INVALID_SCRIPT"] = 2] = "INVALID_SCRIPT";
	    Flaw[Flaw["OPCODE"] = 3] = "OPCODE";
	    Flaw[Flaw["SUPPLY_OVERFLOW"] = 4] = "SUPPLY_OVERFLOW";
	    Flaw[Flaw["TRAILING_INTEGERS"] = 5] = "TRAILING_INTEGERS";
	    Flaw[Flaw["TRUNCATED_FIELD"] = 6] = "TRUNCATED_FIELD";
	    Flaw[Flaw["UNRECOGNIZED_EVEN_TAG"] = 7] = "UNRECOGNIZED_EVEN_TAG";
	    Flaw[Flaw["UNRECOGNIZED_FLAG"] = 8] = "UNRECOGNIZED_FLAG";
	    Flaw[Flaw["VARINT"] = 9] = "VARINT";
	})(Flaw || (flaw.Flaw = Flaw = {}));
	
	return flaw;
}

var runeid = {};

var hasRequiredRuneid;

function requireRuneid () {
	if (hasRequiredRuneid) return runeid;
	hasRequiredRuneid = 1;
	Object.defineProperty(runeid, "__esModule", { value: true });
	runeid.RuneId = void 0;
	const monads_1 = /*@__PURE__*/ requireMonads();
	const integer_1 = /*@__PURE__*/ requireInteger();
	class RuneId {
	    constructor(block, tx) {
	        this.block = block;
	        this.tx = tx;
	    }
	    static new(block, tx) {
	        const id = new RuneId(block, tx);
	        if (id.block === 0n && id.tx > 0) {
	            return monads_1.None;
	        }
	        return (0, monads_1.Some)(id);
	    }
	    static sort(runeIds) {
	        return [...runeIds].sort((x, y) => Number(x.block - y.block || x.tx - y.tx));
	    }
	    delta(next) {
	        const optionBlock = integer_1.u64.checkedSub(next.block, this.block);
	        if (optionBlock.isNone()) {
	            return monads_1.None;
	        }
	        const block = optionBlock.unwrap();
	        let tx;
	        if (block === 0n) {
	            const optionTx = integer_1.u32.checkedSub(next.tx, this.tx);
	            if (optionTx.isNone()) {
	                return monads_1.None;
	            }
	            tx = optionTx.unwrap();
	        }
	        else {
	            tx = next.tx;
	        }
	        return (0, monads_1.Some)([(0, integer_1.u128)(block), (0, integer_1.u128)(tx)]);
	    }
	    next(block, tx) {
	        const optionBlock = integer_1.u128.tryIntoU64(block);
	        const optionTx = integer_1.u128.tryIntoU32(tx);
	        if (optionBlock.isNone() || optionTx.isNone()) {
	            return monads_1.None;
	        }
	        const blockU64 = optionBlock.unwrap();
	        const txU32 = optionTx.unwrap();
	        const nextBlock = integer_1.u64.checkedAdd(this.block, blockU64);
	        if (nextBlock.isNone()) {
	            return monads_1.None;
	        }
	        let nextTx;
	        if (blockU64 === 0n) {
	            const optionAdd = integer_1.u32.checkedAdd(this.tx, txU32);
	            if (optionAdd.isNone()) {
	                return monads_1.None;
	            }
	            nextTx = optionAdd.unwrap();
	        }
	        else {
	            nextTx = txU32;
	        }
	        return RuneId.new(nextBlock.unwrap(), nextTx);
	    }
	    toString() {
	        return `${this.block}:${this.tx}`;
	    }
	    static fromString(s) {
	        const parts = s.split(':');
	        if (parts.length !== 2) {
	            throw new Error(`invalid rune ID: ${s}`);
	        }
	        const [block, tx] = parts;
	        if (!/^\d+$/.test(block) || !/^\d+$/.test(tx)) {
	            throw new Error(`invalid rune ID: ${s}`);
	        }
	        return new RuneId((0, integer_1.u64)(BigInt(block)), (0, integer_1.u32)(BigInt(tx)));
	    }
	}
	runeid.RuneId = RuneId;
	
	return runeid;
}

var runestone = {};

var tag = {};

var hasRequiredTag;

function requireTag () {
	if (hasRequiredTag) return tag;
	hasRequiredTag = 1;
	Object.defineProperty(tag, "__esModule", { value: true });
	tag.Tag = void 0;
	const monads_1 = /*@__PURE__*/ requireMonads();
	const integer_1 = /*@__PURE__*/ requireInteger();
	var Tag;
	(function (Tag) {
	    Tag[Tag["BODY"] = 0] = "BODY";
	    Tag[Tag["FLAGS"] = 2] = "FLAGS";
	    Tag[Tag["RUNE"] = 4] = "RUNE";
	    Tag[Tag["PREMINE"] = 6] = "PREMINE";
	    Tag[Tag["CAP"] = 8] = "CAP";
	    Tag[Tag["AMOUNT"] = 10] = "AMOUNT";
	    Tag[Tag["HEIGHT_START"] = 12] = "HEIGHT_START";
	    Tag[Tag["HEIGHT_END"] = 14] = "HEIGHT_END";
	    Tag[Tag["OFFSET_START"] = 16] = "OFFSET_START";
	    Tag[Tag["OFFSET_END"] = 18] = "OFFSET_END";
	    Tag[Tag["MINT"] = 20] = "MINT";
	    Tag[Tag["POINTER"] = 22] = "POINTER";
	    Tag[Tag["CENOTAPH"] = 126] = "CENOTAPH";
	    Tag[Tag["DIVISIBILITY"] = 1] = "DIVISIBILITY";
	    Tag[Tag["SPACERS"] = 3] = "SPACERS";
	    Tag[Tag["SYMBOL"] = 5] = "SYMBOL";
	    Tag[Tag["NOP"] = 127] = "NOP";
	})(Tag || (tag.Tag = Tag = {}));
	(function (Tag) {
	    function take(tag, fields, n, withFn) {
	        const field = fields.get((0, integer_1.u128)(tag));
	        if (field === undefined) {
	            return monads_1.None;
	        }
	        const values = [];
	        for (const i of [...Array(n).keys()]) {
	            if (field[i] === undefined) {
	                return monads_1.None;
	            }
	            values[i] = field[i];
	        }
	        const optionValue = withFn(values);
	        if (optionValue.isNone()) {
	            return monads_1.None;
	        }
	        field.splice(0, n);
	        if (field.length === 0) {
	            fields.delete((0, integer_1.u128)(tag));
	        }
	        return (0, monads_1.Some)(optionValue.unwrap());
	    }
	    Tag.take = take;
	    function encode(tag, values) {
	        return Buffer.concat(values.map((value) => [integer_1.u128.encodeVarInt((0, integer_1.u128)(tag)), integer_1.u128.encodeVarInt(value)]).flat());
	    }
	    Tag.encode = encode;
	    function encodeOptionInt(tag, value) {
	        return value.map((value) => Tag.encode(tag, [(0, integer_1.u128)(value)])).unwrapOr(Buffer.alloc(0));
	    }
	    Tag.encodeOptionInt = encodeOptionInt;
	})(Tag || (tag.Tag = Tag = {}));
	
	return tag;
}

var rune = {};

var network = {};

var hasRequiredNetwork;

function requireNetwork () {
	if (hasRequiredNetwork) return network;
	hasRequiredNetwork = 1;
	Object.defineProperty(network, "__esModule", { value: true });
	network.Network = void 0;
	const constants_1 = /*@__PURE__*/ requireConstants();
	var Network;
	(function (Network) {
	    Network[Network["MAINNET"] = 0] = "MAINNET";
	    Network[Network["SIGNET"] = 1] = "SIGNET";
	    Network[Network["TESTNET"] = 2] = "TESTNET";
	    Network[Network["REGTEST"] = 3] = "REGTEST";
	})(Network || (network.Network = Network = {}));
	(function (Network) {
	    function getFirstRuneHeight(chain) {
	        switch (chain) {
	            case Network.MAINNET:
	                return constants_1.SUBSIDY_HALVING_INTERVAL * 4;
	            case Network.REGTEST:
	                return constants_1.SUBSIDY_HALVING_INTERVAL * 0;
	            case Network.SIGNET:
	                return constants_1.SUBSIDY_HALVING_INTERVAL * 0;
	            case Network.TESTNET:
	                return constants_1.SUBSIDY_HALVING_INTERVAL * 12;
	        }
	    }
	    Network.getFirstRuneHeight = getFirstRuneHeight;
	})(Network || (network.Network = Network = {}));
	
	return network;
}

var hasRequiredRune;

function requireRune () {
	if (hasRequiredRune) return rune;
	hasRequiredRune = 1;
	Object.defineProperty(rune, "__esModule", { value: true });
	rune.Rune = void 0;
	const network_1 = /*@__PURE__*/ requireNetwork();
	const constants_1 = /*@__PURE__*/ requireConstants();
	const integer_1 = /*@__PURE__*/ requireInteger();
	class Rune {
	    constructor(value) {
	        this.value = value;
	    }
	    static getMinimumAtHeight(chain, height) {
	        let offset = integer_1.u128.saturatingAdd(height, (0, integer_1.u128)(1));
	        const INTERVAL = (0, integer_1.u128)(constants_1.SUBSIDY_HALVING_INTERVAL / 12);
	        let startSubsidyInterval = (0, integer_1.u128)(network_1.Network.getFirstRuneHeight(chain));
	        let endSubsidyInterval = integer_1.u128.saturatingAdd(startSubsidyInterval, (0, integer_1.u128)(constants_1.SUBSIDY_HALVING_INTERVAL));
	        if (offset < startSubsidyInterval) {
	            return new Rune(Rune.STEPS[12]);
	        }
	        if (offset >= endSubsidyInterval) {
	            return new Rune((0, integer_1.u128)(0));
	        }
	        let progress = integer_1.u128.saturatingSub(offset, startSubsidyInterval);
	        let length = integer_1.u128.saturatingSub((0, integer_1.u128)(12n), (0, integer_1.u128)(progress / INTERVAL));
	        let lengthNumber = Number(length & (0, integer_1.u128)(integer_1.u32.MAX));
	        let endStepInterval = Rune.STEPS[lengthNumber];
	        let startStepInterval = Rune.STEPS[lengthNumber - 1];
	        let remainder = (0, integer_1.u128)(progress % INTERVAL);
	        return new Rune((0, integer_1.u128)(endStepInterval - ((endStepInterval - startStepInterval) * remainder) / INTERVAL));
	    }
	    get reserved() {
	        return this.value >= constants_1.RESERVED;
	    }
	    get commitment() {
	        const bytes = Buffer.alloc(16);
	        bytes.writeBigUInt64LE(0xffffffffffffffffn & this.value, 0);
	        bytes.writeBigUInt64LE(this.value >> 64n, 8);
	        let end = bytes.length;
	        while (end > 0 && bytes.at(end - 1) === 0) {
	            end--;
	        }
	        return bytes.subarray(0, end);
	    }
	    static getReserved(block, tx) {
	        return new Rune(integer_1.u128.checkedAdd(constants_1.RESERVED, (0, integer_1.u128)((block << 32n) | tx)).unwrap());
	    }
	    toString() {
	        let n = this.value;
	        if (n === integer_1.u128.MAX) {
	            return 'BCGDENLQRQWDSLRUGSNLBTMFIJAV';
	        }
	        n = (0, integer_1.u128)(n + 1n);
	        let symbol = '';
	        while (n > 0) {
	            symbol = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Number((n - 1n) % 26n)] + symbol;
	            n = (0, integer_1.u128)((n - 1n) / 26n);
	        }
	        return symbol;
	    }
	    static fromString(s) {
	        let x = (0, integer_1.u128)(0);
	        for (const i of [...Array(s.length).keys()]) {
	            const c = s[i];
	            if (i > 0) {
	                x = (0, integer_1.u128)(x + 1n);
	            }
	            x = integer_1.u128.checkedMultiply(x, (0, integer_1.u128)(26)).unwrap();
	            if ('A' <= c && c <= 'Z') {
	                x = integer_1.u128.checkedAdd(x, (0, integer_1.u128)(c.charCodeAt(0) - 'A'.charCodeAt(0))).unwrap();
	            }
	            else {
	                throw new Error(`invalid character in rune name: ${c}`);
	            }
	        }
	        return new Rune(x);
	    }
	}
	rune.Rune = Rune;
	Rune.STEPS = [
	    (0, integer_1.u128)(0n),
	    (0, integer_1.u128)(26n),
	    (0, integer_1.u128)(702n),
	    (0, integer_1.u128)(18278n),
	    (0, integer_1.u128)(475254n),
	    (0, integer_1.u128)(12356630n),
	    (0, integer_1.u128)(321272406n),
	    (0, integer_1.u128)(8353082582n),
	    (0, integer_1.u128)(217180147158n),
	    (0, integer_1.u128)(5646683826134n),
	    (0, integer_1.u128)(146813779479510n),
	    (0, integer_1.u128)(3817158266467286n),
	    (0, integer_1.u128)(99246114928149462n),
	    (0, integer_1.u128)(2580398988131886038n),
	    (0, integer_1.u128)(67090373691429037014n),
	    (0, integer_1.u128)(1744349715977154962390n),
	    (0, integer_1.u128)(45353092615406029022166n),
	    (0, integer_1.u128)(1179180408000556754576342n),
	    (0, integer_1.u128)(30658690608014475618984918n),
	    (0, integer_1.u128)(797125955808376366093607894n),
	    (0, integer_1.u128)(20725274851017785518433805270n),
	    (0, integer_1.u128)(538857146126462423479278937046n),
	    (0, integer_1.u128)(14010285799288023010461252363222n),
	    (0, integer_1.u128)(364267430781488598271992561443798n),
	    (0, integer_1.u128)(9470953200318703555071806597538774n),
	    (0, integer_1.u128)(246244783208286292431866971536008150n),
	    (0, integer_1.u128)(6402364363415443603228541259936211926n),
	    (0, integer_1.u128)(166461473448801533683942072758341510102n),
	];
	
	return rune;
}

var flag = {};

var hasRequiredFlag;

function requireFlag () {
	if (hasRequiredFlag) return flag;
	hasRequiredFlag = 1;
	Object.defineProperty(flag, "__esModule", { value: true });
	flag.Flag = void 0;
	const integer_1 = /*@__PURE__*/ requireInteger();
	var Flag;
	(function (Flag) {
	    Flag[Flag["ETCHING"] = 0] = "ETCHING";
	    Flag[Flag["TERMS"] = 1] = "TERMS";
	    Flag[Flag["TURBO"] = 2] = "TURBO";
	    Flag[Flag["CENOTAPH"] = 127] = "CENOTAPH";
	})(Flag || (flag.Flag = Flag = {}));
	(function (Flag) {
	    function mask(flag) {
	        return (0, integer_1.u128)(1n << BigInt(flag));
	    }
	    Flag.mask = mask;
	    function take(flags, flag) {
	        const mask = Flag.mask(flag);
	        const set = (flags & mask) !== 0n;
	        return { set, flags: set ? (0, integer_1.u128)(flags - mask) : flags };
	    }
	    Flag.take = take;
	    function set(flags, flag) {
	        return (0, integer_1.u128)(flags | Flag.mask(flag));
	    }
	    Flag.set = set;
	})(Flag || (flag.Flag = Flag = {}));
	
	return flag;
}

var utils = {};

var hasRequiredUtils;

function requireUtils () {
	if (hasRequiredUtils) return utils;
	hasRequiredUtils = 1;
	Object.defineProperty(utils, "__esModule", { value: true });
	utils.Instruction = void 0;
	var Instruction;
	(function (Instruction) {
	    function isNumber(instruction) {
	        return typeof instruction === 'number';
	    }
	    Instruction.isNumber = isNumber;
	    function isBuffer(instruction) {
	        return typeof instruction !== 'number';
	    }
	    Instruction.isBuffer = isBuffer;
	})(Instruction || (utils.Instruction = Instruction = {}));
	
	return utils;
}

var message = {};

var edict = {};

var hasRequiredEdict;

function requireEdict () {
	if (hasRequiredEdict) return edict;
	hasRequiredEdict = 1;
	Object.defineProperty(edict, "__esModule", { value: true });
	edict.Edict = void 0;
	const monads_1 = /*@__PURE__*/ requireMonads();
	const integer_1 = /*@__PURE__*/ requireInteger();
	var Edict;
	(function (Edict) {
	    function fromIntegers(numOutputs, id, amount, output) {
	        if (id.block === 0n && id.tx > 0n) {
	            return monads_1.None;
	        }
	        const optionOutputU32 = integer_1.u128.tryIntoU32(output);
	        if (optionOutputU32.isNone()) {
	            return monads_1.None;
	        }
	        const outputU32 = optionOutputU32.unwrap();
	        if (outputU32 > numOutputs) {
	            return monads_1.None;
	        }
	        return (0, monads_1.Some)({ id, amount, output: outputU32 });
	    }
	    Edict.fromIntegers = fromIntegers;
	})(Edict || (edict.Edict = Edict = {}));
	
	return edict;
}

var hasRequiredMessage;

function requireMessage () {
	if (hasRequiredMessage) return message;
	hasRequiredMessage = 1;
	Object.defineProperty(message, "__esModule", { value: true });
	message.Message = void 0;
	const edict_1 = /*@__PURE__*/ requireEdict();
	const flaw_1 = /*@__PURE__*/ requireFlaw();
	const integer_1 = /*@__PURE__*/ requireInteger();
	const runeid_1 = /*@__PURE__*/ requireRuneid();
	const tag_1 = /*@__PURE__*/ requireTag();
	class Message {
	    constructor(flaws, edicts, fields) {
	        this.flaws = flaws;
	        this.edicts = edicts;
	        this.fields = fields;
	    }
	    static fromIntegers(numOutputs, payload) {
	        const edicts = [];
	        const fields = new Map();
	        const flaws = [];
	        for (const i of [...Array(Math.ceil(payload.length / 2)).keys()].map((n) => n * 2)) {
	            const tag = payload[i];
	            if ((0, integer_1.u128)(tag_1.Tag.BODY) === tag) {
	                let id = new runeid_1.RuneId((0, integer_1.u64)(0), (0, integer_1.u32)(0));
	                const chunkSize = 4;
	                const body = payload.slice(i + 1);
	                for (let j = 0; j < body.length; j += chunkSize) {
	                    const chunk = body.slice(j, j + chunkSize);
	                    if (chunk.length !== chunkSize) {
	                        flaws.push(flaw_1.Flaw.TRAILING_INTEGERS);
	                        break;
	                    }
	                    const optionNext = id.next(chunk[0], chunk[1]);
	                    if (optionNext.isNone()) {
	                        flaws.push(flaw_1.Flaw.EDICT_RUNE_ID);
	                        break;
	                    }
	                    const next = optionNext.unwrap();
	                    const optionEdict = edict_1.Edict.fromIntegers(numOutputs, next, chunk[2], chunk[3]);
	                    if (optionEdict.isNone()) {
	                        flaws.push(flaw_1.Flaw.EDICT_OUTPUT);
	                        break;
	                    }
	                    const edict = optionEdict.unwrap();
	                    id = next;
	                    edicts.push(edict);
	                }
	                break;
	            }
	            const value = payload[i + 1];
	            if (value === undefined) {
	                flaws.push(flaw_1.Flaw.TRUNCATED_FIELD);
	                break;
	            }
	            const values = fields.get(tag) ?? [];
	            values.push(value);
	            fields.set(tag, values);
	        }
	        return new Message(flaws, edicts, fields);
	    }
	}
	message.Message = Message;
	
	return message;
}

var cenotaph = {};

var hasRequiredCenotaph;

function requireCenotaph () {
	if (hasRequiredCenotaph) return cenotaph;
	hasRequiredCenotaph = 1;
	Object.defineProperty(cenotaph, "__esModule", { value: true });
	cenotaph.Cenotaph = void 0;
	const monads_1 = /*@__PURE__*/ requireMonads();
	class Cenotaph {
	    constructor(flaws, etching = monads_1.None, mint = monads_1.None) {
	        this.flaws = flaws;
	        this.etching = etching;
	        this.mint = mint;
	        this.type = 'cenotaph';
	    }
	}
	cenotaph.Cenotaph = Cenotaph;
	
	return cenotaph;
}

var hasRequiredRunestone;

function requireRunestone () {
	if (hasRequiredRunestone) return runestone;
	hasRequiredRunestone = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.Runestone = exports.isValidPayload = exports.MAX_SPACERS = void 0;
		const constants_1 = /*@__PURE__*/ requireConstants();
		const etching_1 = /*@__PURE__*/ requireEtching();
		const seekbuffer_1 = /*@__PURE__*/ requireSeekbuffer();
		const tag_1 = /*@__PURE__*/ requireTag();
		const integer_1 = /*@__PURE__*/ requireInteger();
		const monads_1 = /*@__PURE__*/ requireMonads();
		const rune_1 = /*@__PURE__*/ requireRune();
		const flag_1 = /*@__PURE__*/ requireFlag();
		const utils_1 = /*@__PURE__*/ requireUtils();
		const runeid_1 = /*@__PURE__*/ requireRuneid();
		const script_1 = /*@__PURE__*/ requireScript();
		const message_1 = /*@__PURE__*/ requireMessage();
		const flaw_1 = /*@__PURE__*/ requireFlaw();
		const cenotaph_1 = /*@__PURE__*/ requireCenotaph();
		exports.MAX_SPACERS = 134217727;
		function isValidPayload(payload) {
		    return Buffer.isBuffer(payload);
		}
		exports.isValidPayload = isValidPayload;
		class Runestone {
		    constructor(mint, pointer, edicts, etching) {
		        this.mint = mint;
		        this.pointer = pointer;
		        this.edicts = edicts;
		        this.etching = etching;
		        this.type = 'runestone';
		    }
		    static decipher(transaction) {
		        const optionPayload = Runestone.payload(transaction);
		        if (optionPayload.isNone()) {
		            return monads_1.None;
		        }
		        const payload = optionPayload.unwrap();
		        if (!isValidPayload(payload)) {
		            return (0, monads_1.Some)(new cenotaph_1.Cenotaph([payload]));
		        }
		        const optionIntegers = Runestone.integers(payload);
		        if (optionIntegers.isNone()) {
		            return (0, monads_1.Some)(new cenotaph_1.Cenotaph([flaw_1.Flaw.VARINT]));
		        }
		        const { flaws, edicts, fields } = message_1.Message.fromIntegers(transaction.vout.length, optionIntegers.unwrap());
		        let flags = tag_1.Tag.take(tag_1.Tag.FLAGS, fields, 1, ([value]) => (0, monads_1.Some)(value)).unwrapOr((0, integer_1.u128)(0));
		        const etchingResult = flag_1.Flag.take(flags, flag_1.Flag.ETCHING);
		        const etchingFlag = etchingResult.set;
		        flags = etchingResult.flags;
		        const etching = etchingFlag
		            ? (() => {
		                const divisibility = tag_1.Tag.take(tag_1.Tag.DIVISIBILITY, fields, 1, ([value]) => integer_1.u128
		                    .tryIntoU8(value)
		                    .andThen((value) => (value <= constants_1.MAX_DIVISIBILITY ? (0, monads_1.Some)(value) : monads_1.None)));
		                const rune = tag_1.Tag.take(tag_1.Tag.RUNE, fields, 1, ([value]) => (0, monads_1.Some)(new rune_1.Rune(value)));
		                const spacers = tag_1.Tag.take(tag_1.Tag.SPACERS, fields, 1, ([value]) => integer_1.u128.tryIntoU32(value).andThen((value) => (value <= exports.MAX_SPACERS ? (0, monads_1.Some)(value) : monads_1.None)));
		                const symbol = tag_1.Tag.take(tag_1.Tag.SYMBOL, fields, 1, ([value]) => integer_1.u128.tryIntoU32(value).andThen((value) => {
		                    try {
		                        return (0, monads_1.Some)(String.fromCodePoint(Number(value)));
		                    }
		                    catch (e) {
		                        return monads_1.None;
		                    }
		                }));
		                const termsResult = flag_1.Flag.take(flags, flag_1.Flag.TERMS);
		                const termsFlag = termsResult.set;
		                flags = termsResult.flags;
		                const terms = termsFlag
		                    ? (() => {
		                        const amount = tag_1.Tag.take(tag_1.Tag.AMOUNT, fields, 1, ([value]) => (0, monads_1.Some)(value));
		                        const cap = tag_1.Tag.take(tag_1.Tag.CAP, fields, 1, ([value]) => (0, monads_1.Some)(value));
		                        const offset = [
		                            tag_1.Tag.take(tag_1.Tag.OFFSET_START, fields, 1, ([value]) => integer_1.u128.tryIntoU64(value)),
		                            tag_1.Tag.take(tag_1.Tag.OFFSET_END, fields, 1, ([value]) => integer_1.u128.tryIntoU64(value)),
		                        ];
		                        const height = [
		                            tag_1.Tag.take(tag_1.Tag.HEIGHT_START, fields, 1, ([value]) => integer_1.u128.tryIntoU64(value)),
		                            tag_1.Tag.take(tag_1.Tag.HEIGHT_END, fields, 1, ([value]) => integer_1.u128.tryIntoU64(value)),
		                        ];
		                        return (0, monads_1.Some)({ amount, cap, offset, height });
		                    })()
		                    : monads_1.None;
		                const premine = tag_1.Tag.take(tag_1.Tag.PREMINE, fields, 1, ([value]) => (0, monads_1.Some)(value));
		                const turboResult = flag_1.Flag.take(flags, flag_1.Flag.TURBO);
		                const turbo = etchingResult.set;
		                flags = turboResult.flags;
		                return (0, monads_1.Some)(new etching_1.Etching(divisibility, rune, spacers, symbol, terms, premine, turbo));
		            })()
		            : monads_1.None;
		        const mint = tag_1.Tag.take(tag_1.Tag.MINT, fields, 2, ([block, tx]) => {
		            const optionBlockU64 = integer_1.u128.tryIntoU64(block);
		            const optionTxU32 = integer_1.u128.tryIntoU32(tx);
		            if (optionBlockU64.isNone() || optionTxU32.isNone()) {
		                return monads_1.None;
		            }
		            return runeid_1.RuneId.new(optionBlockU64.unwrap(), optionTxU32.unwrap());
		        });
		        const pointer = tag_1.Tag.take(tag_1.Tag.POINTER, fields, 1, ([value]) => integer_1.u128
		            .tryIntoU32(value)
		            .andThen((value) => (value < transaction.vout.length ? (0, monads_1.Some)(value) : monads_1.None)));
		        if (etching.map((etching) => etching.supply.isNone()).unwrapOr(false)) {
		            flaws.push(flaw_1.Flaw.SUPPLY_OVERFLOW);
		        }
		        if (flags !== 0n) {
		            flaws.push(flaw_1.Flaw.UNRECOGNIZED_FLAG);
		        }
		        if ([...fields.keys()].find((tag) => tag % 2n === 0n) !== undefined) {
		            flaws.push(flaw_1.Flaw.UNRECOGNIZED_EVEN_TAG);
		        }
		        if (flaws.length !== 0) {
		            return (0, monads_1.Some)(new cenotaph_1.Cenotaph(flaws, etching.andThen((etching) => etching.rune), mint));
		        }
		        return (0, monads_1.Some)(new Runestone(mint, pointer, edicts, etching));
		    }
		    encipher() {
		        const payloads = [];
		        if (this.etching.isSome()) {
		            const etching = this.etching.unwrap();
		            let flags = (0, integer_1.u128)(0);
		            flags = flag_1.Flag.set(flags, flag_1.Flag.ETCHING);
		            if (etching.terms.isSome()) {
		                flags = flag_1.Flag.set(flags, flag_1.Flag.TERMS);
		            }
		            if (etching.turbo) {
		                flags = flag_1.Flag.set(flags, flag_1.Flag.TURBO);
		            }
		            payloads.push(tag_1.Tag.encode(tag_1.Tag.FLAGS, [flags]));
		            payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.RUNE, etching.rune.map((rune) => rune.value)));
		            payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.DIVISIBILITY, etching.divisibility.map(integer_1.u128)));
		            payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.SPACERS, etching.spacers.map(integer_1.u128)));
		            payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.SYMBOL, etching.symbol.map((symbol) => (0, integer_1.u128)(symbol.codePointAt(0)))));
		            payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.PREMINE, etching.premine));
		            if (etching.terms.isSome()) {
		                const terms = etching.terms.unwrap();
		                payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.AMOUNT, terms.amount));
		                payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.CAP, terms.cap));
		                payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.HEIGHT_START, terms.height[0]));
		                payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.HEIGHT_END, terms.height[1]));
		                payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.OFFSET_START, terms.offset[0]));
		                payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.OFFSET_END, terms.offset[1]));
		            }
		        }
		        if (this.mint.isSome()) {
		            const claim = this.mint.unwrap();
		            payloads.push(tag_1.Tag.encode(tag_1.Tag.MINT, [claim.block, claim.tx].map(integer_1.u128)));
		        }
		        payloads.push(tag_1.Tag.encodeOptionInt(tag_1.Tag.POINTER, this.pointer.map(integer_1.u128)));
		        if (this.edicts.length) {
		            payloads.push(integer_1.u128.encodeVarInt((0, integer_1.u128)(tag_1.Tag.BODY)));
		            const edicts = [...this.edicts].sort((x, y) => Number(x.id.block - y.id.block || x.id.tx - y.id.tx));
		            let previous = new runeid_1.RuneId((0, integer_1.u64)(0), (0, integer_1.u32)(0));
		            for (const edict of edicts) {
		                const [block, tx] = previous.delta(edict.id).unwrap();
		                payloads.push(integer_1.u128.encodeVarInt(block));
		                payloads.push(integer_1.u128.encodeVarInt(tx));
		                payloads.push(integer_1.u128.encodeVarInt(edict.amount));
		                payloads.push(integer_1.u128.encodeVarInt((0, integer_1.u128)(edict.output)));
		                previous = edict.id;
		            }
		        }
		        const stack = [];
		        stack.push(constants_1.OP_RETURN);
		        stack.push(constants_1.MAGIC_NUMBER);
		        const payload = Buffer.concat(payloads);
		        for (let i = 0; i < payload.length; i += constants_1.MAX_SCRIPT_ELEMENT_SIZE) {
		            stack.push(payload.subarray(i, i + constants_1.MAX_SCRIPT_ELEMENT_SIZE));
		        }
		        return script_1.script.compile(stack);
		    }
		    static payload(transaction) {
		        // search transaction outputs for payload
		        for (const output of transaction.vout) {
		            const instructions = script_1.script.decompile(Buffer.from(output.scriptPubKey.hex, 'hex'));
		            if (instructions === null) {
		                throw new Error('unable to decompile');
		            }
		            // payload starts with OP_RETURN
		            let nextInstructionResult = instructions.next();
		            if (nextInstructionResult.done || nextInstructionResult.value !== constants_1.OP_RETURN) {
		                continue;
		            }
		            // followed by the protocol identifier
		            nextInstructionResult = instructions.next();
		            if (nextInstructionResult.done ||
		                utils_1.Instruction.isBuffer(nextInstructionResult.value) ||
		                nextInstructionResult.value !== constants_1.MAGIC_NUMBER) {
		                continue;
		            }
		            // construct the payload by concatinating remaining data pushes
		            let payloads = [];
		            do {
		                nextInstructionResult = instructions.next();
		                if (nextInstructionResult.done) {
		                    const decodedSuccessfully = nextInstructionResult.value;
		                    if (!decodedSuccessfully) {
		                        return (0, monads_1.Some)(flaw_1.Flaw.INVALID_SCRIPT);
		                    }
		                    break;
		                }
		                const instruction = nextInstructionResult.value;
		                if (utils_1.Instruction.isBuffer(instruction)) {
		                    payloads.push(instruction);
		                }
		                else {
		                    return (0, monads_1.Some)(flaw_1.Flaw.OPCODE);
		                }
		            } while (true);
		            return (0, monads_1.Some)(Buffer.concat(payloads));
		        }
		        return monads_1.None;
		    }
		    static integers(payload) {
		        const integers = [];
		        const seekBuffer = new seekbuffer_1.SeekBuffer(payload);
		        while (!seekBuffer.isFinished()) {
		            const optionInt = integer_1.u128.decodeVarInt(seekBuffer);
		            if (optionInt.isNone()) {
		                return monads_1.None;
		            }
		            integers.push(optionInt.unwrap());
		        }
		        return (0, monads_1.Some)(integers);
		    }
		}
		exports.Runestone = Runestone;
		
	} (runestone));
	return runestone;
}

var spacedrune = {};

var hasRequiredSpacedrune;

function requireSpacedrune () {
	if (hasRequiredSpacedrune) return spacedrune;
	hasRequiredSpacedrune = 1;
	Object.defineProperty(spacedrune, "__esModule", { value: true });
	spacedrune.SpacedRune = void 0;
	const rune_1 = /*@__PURE__*/ requireRune();
	class SpacedRune {
	    constructor(rune, spacers) {
	        this.rune = rune;
	        this.spacers = spacers;
	    }
	    static fromString(s) {
	        let rune = '';
	        let spacers = 0;
	        for (const c of s) {
	            if ('A' <= c && c <= 'Z') {
	                rune += c;
	            }
	            else if ('.' === c || '•' === c) {
	                if (rune.length === 0) {
	                    throw new Error('leading spacer');
	                }
	                const flag = 1 << (rune.length - 1);
	                if ((spacers & flag) !== 0) {
	                    throw new Error('double spacer');
	                }
	                spacers |= flag;
	            }
	            else {
	                throw new Error('invalid character');
	            }
	        }
	        if (spacers >= 1 << (rune.length - 1)) {
	            throw new Error('trailing spacer');
	        }
	        return new SpacedRune(rune_1.Rune.fromString(rune), spacers);
	    }
	    toString() {
	        const rune = this.rune.toString();
	        let i = 0;
	        let result = '';
	        for (const c of rune) {
	            result += c;
	            if (i < rune.length - 1 && (this.spacers & (1 << i)) !== 0) {
	                result += '•';
	            }
	            i++;
	        }
	        return result;
	    }
	}
	spacedrune.SpacedRune = SpacedRune;
	
	return spacedrune;
}

var indexer = {};

var updater = {};

var types = {};

var hasRequiredTypes;

function requireTypes () {
	if (hasRequiredTypes) return types;
	hasRequiredTypes = 1;
	Object.defineProperty(types, "__esModule", { value: true });
	types.RuneLocation = void 0;
	var RuneLocation;
	(function (RuneLocation) {
	    function toString(runeId) {
	        return `${runeId.block}:${runeId.tx}`;
	    }
	    RuneLocation.toString = toString;
	})(RuneLocation || (types.RuneLocation = RuneLocation = {}));
	
	return types;
}

var hasRequiredUpdater;

function requireUpdater () {
	if (hasRequiredUpdater) return updater;
	hasRequiredUpdater = 1;
	Object.defineProperty(updater, "__esModule", { value: true });
	updater.RuneUpdater = void 0;
	const constants_1 = /*@__PURE__*/ requireConstants();
	const integer_1 = /*@__PURE__*/ requireInteger();
	const monads_1 = /*@__PURE__*/ requireMonads();
	const rune_1 = /*@__PURE__*/ requireRune();
	const runestone_1 = /*@__PURE__*/ requireRunestone();
	const script_1 = /*@__PURE__*/ requireScript();
	const spacedrune_1 = /*@__PURE__*/ requireSpacedrune();
	const types_1 = /*@__PURE__*/ requireTypes();
	function isScriptPubKeyHexOpReturn(scriptPubKeyHex) {
	    return scriptPubKeyHex && Buffer.from(scriptPubKeyHex, 'hex')[0] === constants_1.OP_RETURN;
	}
	class RuneUpdater {
	    constructor(network, block, reorg, _storage, _rpc) {
	        this.reorg = reorg;
	        this._storage = _storage;
	        this._rpc = _rpc;
	        this.etchings = [];
	        this.utxoBalances = [];
	        this.spentBalances = [];
	        this._mintCountsByRuneLocation = new Map();
	        this._burnedBalancesByRuneLocation = new Map();
	        this.block = {
	            height: block.height,
	            hash: block.hash,
	            previousblockhash: block.previousblockhash,
	            time: block.time,
	        };
	        this._minimum = rune_1.Rune.getMinimumAtHeight(network, (0, integer_1.u128)(block.height));
	    }
	    get mintCounts() {
	        return [...this._mintCountsByRuneLocation.values()];
	    }
	    get burnedBalances() {
	        return [...this._burnedBalancesByRuneLocation.values()];
	    }
	    async indexRunes(tx, txIndex) {
	        const optionArtifact = runestone_1.Runestone.decipher(tx);
	        const unallocated = await this.unallocated(tx);
	        const allocated = [...new Array(tx.vout.length)].map(() => new Map());
	        function getUnallocatedRuneBalance(runeId) {
	            const key = types_1.RuneLocation.toString(runeId);
	            const balance = unallocated.get(key) ?? { runeId, amount: 0n };
	            unallocated.set(key, balance);
	            return balance;
	        }
	        function getAllocatedRuneBalance(vout, runeId) {
	            const key = types_1.RuneLocation.toString(runeId);
	            const balance = allocated[vout].get(key) ?? { runeId, amount: 0n };
	            allocated[vout].set(key, balance);
	            return balance;
	        }
	        if (optionArtifact.isSome()) {
	            const artifact = optionArtifact.unwrap();
	            const optionMint = artifact.mint;
	            if (optionMint.isSome()) {
	                const runeId = optionMint.unwrap();
	                const runeLocation = {
	                    block: Number(runeId.block),
	                    tx: Number(runeId.tx),
	                };
	                const optionAmount = await this.mint(runeLocation, tx.txid);
	                if (optionAmount.isSome()) {
	                    const amount = optionAmount.unwrap();
	                    const unallocatedBalance = getUnallocatedRuneBalance(runeLocation);
	                    unallocatedBalance.amount = integer_1.u128.checkedAddThrow((0, integer_1.u128)(unallocatedBalance.amount), (0, integer_1.u128)(amount));
	                }
	            }
	            const optionEtched = await this.etched(txIndex, tx, artifact);
	            if (artifact.type === 'runestone') {
	                const runestone = artifact;
	                if (optionEtched.isSome()) {
	                    const etched = optionEtched.unwrap();
	                    const unallocatedBalance = getUnallocatedRuneBalance(etched.runeId);
	                    unallocatedBalance.amount = integer_1.u128.checkedAddThrow((0, integer_1.u128)(unallocatedBalance.amount), runestone.etching.unwrap().premine.unwrapOr((0, integer_1.u128)(0)));
	                }
	                for (const { id, amount, output } of [...runestone.edicts]) {
	                    // edicts with output values greater than the number of outputs
	                    // should never be produced by the edict parser
	                    if (output > tx.vout.length) {
	                        throw new Error('Runestone edict output should never exceed transaction output size');
	                    }
	                    if (id.block === 0n && id.tx === 0n && optionEtched.isNone()) {
	                        continue;
	                    }
	                    const runeLocation = id.block === 0n && id.tx === 0n
	                        ? optionEtched.unwrap().runeId
	                        : { block: Number(id.block), tx: Number(id.tx) };
	                    const runeLocationString = types_1.RuneLocation.toString(runeLocation);
	                    const maybeBalance = unallocated.get(runeLocationString);
	                    if (maybeBalance === undefined) {
	                        continue;
	                    }
	                    let allocate = (amount, output) => {
	                        if (amount > 0n) {
	                            const currentAllocated = getAllocatedRuneBalance(output, runeLocation);
	                            maybeBalance.amount = integer_1.u128.checkedSubThrow((0, integer_1.u128)(maybeBalance.amount), amount);
	                            currentAllocated.amount = integer_1.u128.checkedAddThrow((0, integer_1.u128)(currentAllocated.amount), amount);
	                        }
	                    };
	                    if (Number(output) === tx.vout.length) {
	                        // find non-OP_RETURN outputs
	                        const destinations = [...tx.vout.entries()]
	                            .filter(([_, vout]) => !isScriptPubKeyHexOpReturn(vout.scriptPubKey.hex))
	                            .map(([index]) => index);
	                        if (destinations.length !== 0) {
	                            if (amount === 0n) {
	                                // if amount is zero, divide balance between eligible outputs
	                                const amount = (0, integer_1.u128)((0, integer_1.u128)(maybeBalance.amount) / (0, integer_1.u128)(destinations.length));
	                                const remainder = (0, integer_1.u128)(maybeBalance.amount) % (0, integer_1.u128)(destinations.length);
	                                for (const [i, output] of destinations.entries()) {
	                                    allocate(i < remainder ? integer_1.u128.checkedAddThrow(amount, (0, integer_1.u128)(1)) : amount, output);
	                                }
	                            }
	                            else {
	                                // if amount is non-zero, distribute amount to eligible outputs
	                                for (const output of destinations) {
	                                    allocate(amount < maybeBalance.amount ? amount : (0, integer_1.u128)(maybeBalance.amount), output);
	                                }
	                            }
	                        }
	                    }
	                    else {
	                        // Get the allocatable amount
	                        allocate(amount !== 0n && amount < (0, integer_1.u128)(maybeBalance.amount)
	                            ? amount
	                            : (0, integer_1.u128)(maybeBalance.amount), Number(output));
	                    }
	                }
	            }
	            if (optionEtched.isSome()) {
	                const { runeId, rune } = optionEtched.unwrap();
	                this.createEtching(tx.txid, artifact, runeId, rune);
	            }
	        }
	        const burned = new Map();
	        function getBurnedRuneBalance(runeId) {
	            const key = types_1.RuneLocation.toString(runeId);
	            const balance = burned.get(key) ?? { runeId, amount: 0n };
	            burned.set(key, balance);
	            return balance;
	        }
	        if (optionArtifact.isSome() && optionArtifact.unwrap().type === 'cenotaph') {
	            for (const balance of unallocated.values()) {
	                const currentBalance = getBurnedRuneBalance(balance.runeId);
	                currentBalance.amount = integer_1.u128.checkedAddThrow((0, integer_1.u128)(currentBalance.amount), (0, integer_1.u128)(balance.amount));
	            }
	        }
	        else {
	            const pointer = optionArtifact
	                .map((artifact) => {
	                if (artifact.type === 'cenotaph') {
	                    throw new Error('unreachable');
	                }
	                return artifact.pointer;
	            })
	                .unwrapOr(monads_1.None);
	            const optionVout = pointer
	                .map((pointer) => Number(pointer))
	                .inspect((pointer) => {
	                if (pointer < 0 || pointer >= allocated.length)
	                    throw new Error('Pointer is invalid');
	            })
	                .orElse(() => {
	                const entry = [...tx.vout.entries()].find(([_, txOut]) => !isScriptPubKeyHexOpReturn(txOut.scriptPubKey.hex));
	                return entry !== undefined ? (0, monads_1.Some)(entry[0]) : monads_1.None;
	            });
	            if (optionVout.isSome()) {
	                const vout = optionVout.unwrap();
	                for (const balance of unallocated.values()) {
	                    if (balance.amount > 0) {
	                        const currentBalance = getAllocatedRuneBalance(vout, balance.runeId);
	                        currentBalance.amount = integer_1.u128.checkedAddThrow((0, integer_1.u128)(currentBalance.amount), (0, integer_1.u128)(balance.amount));
	                    }
	                }
	            }
	            else {
	                for (const [id, balance] of unallocated) {
	                    if (balance.amount > 0) {
	                        const currentBalance = getBurnedRuneBalance(balance.runeId);
	                        burned.set(id, {
	                            runeId: balance.runeId,
	                            amount: integer_1.u128.checkedAddThrow((0, integer_1.u128)(currentBalance.amount), (0, integer_1.u128)(balance.amount)),
	                        });
	                    }
	                }
	            }
	        }
	        // update outpoint balances
	        for (const [vout, balances] of allocated.entries()) {
	            if (balances.size === 0) {
	                continue;
	            }
	            // increment burned balances
	            const output = tx.vout[vout];
	            if (isScriptPubKeyHexOpReturn(output.scriptPubKey.hex)) {
	                for (const [id, balance] of balances) {
	                    const currentBurned = getBurnedRuneBalance(balance.runeId);
	                    currentBurned.amount = integer_1.u128.checkedAddThrow((0, integer_1.u128)(currentBurned.amount), (0, integer_1.u128)(balance.amount));
	                }
	                continue;
	            }
	            const etchingByRuneId = new Map(this.etchings.map((etching) => [types_1.RuneLocation.toString(etching.runeId), etching]));
	            for (const balance of balances.values()) {
	                const runeIdString = types_1.RuneLocation.toString(balance.runeId);
	                const etching = etchingByRuneId.get(runeIdString) ?? (await this._storage.getEtching(runeIdString));
	                if (etching === null) {
	                    throw new Error('Rune should exist at this point');
	                }
	                this.utxoBalances.push({
	                    runeId: balance.runeId,
	                    runeTicker: etching.runeTicker,
	                    amount: balance.amount,
	                    scriptPubKey: Buffer.from(output.scriptPubKey.hex),
	                    txid: tx.txid,
	                    vout,
	                    address: output.scriptPubKey.address,
	                    satValue: output.value,
	                });
	            }
	        }
	        // update entries with burned runes
	        for (const [id, balance] of burned) {
	            this._burnedBalancesByRuneLocation.set(id, balance);
	        }
	        return;
	    }
	    async etched(txIndex, tx, artifact) {
	        let optionRune;
	        if (artifact.type === 'runestone') {
	            const runestone = artifact;
	            if (runestone.etching.isNone()) {
	                return monads_1.None;
	            }
	            optionRune = runestone.etching.unwrap().rune;
	        }
	        else {
	            const cenotaph = artifact;
	            if (cenotaph.etching.isNone()) {
	                return monads_1.None;
	            }
	            optionRune = cenotaph.etching;
	        }
	        let rune;
	        if (optionRune.isSome()) {
	            rune = optionRune.unwrap();
	            if (rune.value < this._minimum.value) {
	                return monads_1.None;
	            }
	            if (rune.reserved) {
	                return monads_1.None;
	            }
	            if (this.etchings.find((etching) => spacedrune_1.SpacedRune.fromString(etching.runeName).rune.toString() === rune.toString())) {
	                return monads_1.None;
	            }
	            const runeLocation = await this._storage.getRuneLocation(rune.toString());
	            if (runeLocation && runeLocation.block < this.block.height) {
	                return monads_1.None;
	            }
	            const txCommitsToRune = await this.txCommitsToRune(tx, rune);
	            if (!txCommitsToRune) {
	                return monads_1.None;
	            }
	        }
	        else {
	            rune = rune_1.Rune.getReserved((0, integer_1.u64)(this.block.height), (0, integer_1.u32)(txIndex));
	        }
	        return (0, monads_1.Some)({
	            runeId: {
	                block: this.block.height,
	                tx: txIndex,
	            },
	            rune,
	        });
	    }
	    async mint(id, txid) {
	        const runeLocation = types_1.RuneLocation.toString(id);
	        const etchingByRuneId = new Map(this.etchings.map((etching) => [types_1.RuneLocation.toString(etching.runeId), etching]));
	        const etching = etchingByRuneId.get(runeLocation) ?? (await this._storage.getEtching(runeLocation));
	        if (etching === null || !etching.valid || !etching.terms) {
	            return monads_1.None;
	        }
	        const terms = etching.terms;
	        const startRelative = terms.offset?.start !== undefined ? etching.runeId.block + Number(terms.offset.start) : null;
	        const startAbsolute = terms.height?.start !== undefined ? Number(terms.height.start) : null;
	        const start = startRelative !== null || startAbsolute !== null
	            ? Math.max(startRelative ?? -Infinity, startAbsolute ?? -Infinity)
	            : null;
	        if (start !== null && this.block.height < start) {
	            return monads_1.None;
	        }
	        const endRelative = terms.offset?.end !== undefined ? etching.runeId.block + Number(terms.offset.end) : null;
	        const endAbsolute = terms.height?.end !== undefined ? Number(terms.height.end) : null;
	        const end = endRelative !== null || endAbsolute !== null
	            ? Math.max(endRelative ?? -Infinity, endAbsolute ?? -Infinity)
	            : null;
	        if (end !== null && this.block.height >= end) {
	            return monads_1.None;
	        }
	        const cap = terms.cap ?? 0n;
	        const currentBlockMints = this._mintCountsByRuneLocation.get(runeLocation) ?? {
	            mint: id,
	            count: 0,
	        };
	        this._mintCountsByRuneLocation.set(runeLocation, currentBlockMints);
	        const totalMints = currentBlockMints.count +
	            (await this._storage.getValidMintCount(runeLocation, this.block.height - 1));
	        if (totalMints >= cap) {
	            return monads_1.None;
	        }
	        const amount = terms.amount ?? 0n;
	        currentBlockMints.count++;
	        return (0, monads_1.Some)(amount);
	    }
	    async unallocated(tx) {
	        const unallocated = new Map();
	        const utxoBalancesByOutputLocation = new Map();
	        for (const utxoBalance of this.utxoBalances) {
	            const location = `${utxoBalance.txid}:${utxoBalance.vout}`;
	            const balances = utxoBalancesByOutputLocation.get(location) ?? [];
	            balances.push(utxoBalance);
	            utxoBalancesByOutputLocation.set(location, balances);
	        }
	        for (const input of tx.vin) {
	            if ('coinbase' in input) {
	                continue;
	            }
	            const utxoBalance = utxoBalancesByOutputLocation.get(`${input.txid}:${input.vout}`) ??
	                (await this._storage.getUtxoBalance(input.txid, input.vout));
	            for (const additionalBalance of utxoBalance) {
	                const runeId = additionalBalance.runeId;
	                const runeLocation = types_1.RuneLocation.toString(runeId);
	                const balance = unallocated.get(runeLocation) ?? { runeId, amount: 0n };
	                unallocated.set(runeLocation, balance);
	                balance.amount = integer_1.u128.checkedAddThrow((0, integer_1.u128)(balance.amount), (0, integer_1.u128)(additionalBalance.amount));
	                this.spentBalances.push({
	                    txid: input.txid,
	                    vout: input.vout,
	                    address: additionalBalance.address,
	                    scriptPubKey: additionalBalance.scriptPubKey,
	                    runeId: additionalBalance.runeId,
	                    runeTicker: additionalBalance.runeTicker,
	                    amount: additionalBalance.amount,
	                    spentTxid: tx.txid,
	                    satValue: additionalBalance.satValue,
	                });
	            }
	        }
	        return unallocated;
	    }
	    async txCommitsToRune(tx, rune) {
	        const commitment = rune.commitment;
	        for (const input of tx.vin) {
	            if ('coinbase' in input) {
	                continue;
	            }
	            const witnessStack = input.txinwitness.map((item) => Buffer.from(item, 'hex'));
	            const lastWitnessElement = witnessStack[witnessStack.length - 1];
	            const offset = witnessStack.length >= 2 && lastWitnessElement[0] === constants_1.TAPROOT_ANNEX_PREFIX ? 3 : 2;
	            if (offset > witnessStack.length) {
	                continue;
	            }
	            const potentiallyTapscript = witnessStack[witnessStack.length - offset];
	            if (potentiallyTapscript === undefined) {
	                continue;
	            }
	            const instructions = script_1.script.decompile(potentiallyTapscript);
	            for (const instruction of instructions) {
	                if (!Buffer.isBuffer(instruction)) {
	                    continue;
	                }
	                if (Buffer.compare(instruction, commitment) !== 0) {
	                    continue;
	                }
	                // rpc client
	                const inputTxResult = await this._rpc.getrawtransaction({
	                    txid: input.txid,
	                    verbose: true,
	                });
	                if (inputTxResult.error !== null) {
	                    throw inputTxResult.error;
	                }
	                const inputTx = inputTxResult.result;
	                const isTaproot = inputTx.vout[input.vout].scriptPubKey.type === constants_1.TAPROOT_SCRIPT_PUBKEY_TYPE;
	                if (!isTaproot) {
	                    continue;
	                }
	                const commitTxHeightResult = await this._rpc.getblock({ blockhash: inputTx.blockhash });
	                if (commitTxHeightResult.error !== null) {
	                    throw commitTxHeightResult.error;
	                }
	                const commitTxHeight = commitTxHeightResult.result.height;
	                const confirmations = integer_1.u128.checkedSubThrow((0, integer_1.u128)(this.block.height), (0, integer_1.u128)(commitTxHeight)) + 1n;
	                if (confirmations >= constants_1.COMMIT_CONFIRMATIONS) {
	                    return true;
	                }
	            }
	        }
	        return false;
	    }
	    createEtching(txid, artifact, runeId, rune) {
	        if (artifact.type === 'runestone') {
	            const { divisibility, terms, premine, spacers, symbol } = artifact.etching.unwrap();
	            this.etchings.push({
	                valid: true,
	                runeTicker: rune.toString(),
	                runeName: new spacedrune_1.SpacedRune(rune, Number(spacers.map(Number).unwrapOr(0))).toString(),
	                runeId,
	                txid,
	                ...(divisibility.isSome() ? { divisibility: divisibility.map(Number).unwrap() } : {}),
	                ...(premine.isSome() ? { premine: premine.unwrap() } : {}),
	                ...(symbol.isSome() ? { symbol: symbol.unwrap() } : {}),
	                ...(terms.isSome()
	                    ? {
	                        terms: (() => {
	                            const unwrappedTerms = terms.unwrap();
	                            return {
	                                ...(unwrappedTerms.amount.isSome()
	                                    ? { amount: unwrappedTerms.amount.unwrap() }
	                                    : {}),
	                                ...(unwrappedTerms.cap.isSome() ? { cap: unwrappedTerms.cap.unwrap() } : {}),
	                                ...(unwrappedTerms.height.filter((option) => option.isSome()).length
	                                    ? {
	                                        height: {
	                                            ...(unwrappedTerms.height[0].isSome()
	                                                ? { start: unwrappedTerms.height[0].unwrap() }
	                                                : {}),
	                                            ...(unwrappedTerms.height[1].isSome()
	                                                ? { end: unwrappedTerms.height[1].unwrap() }
	                                                : {}),
	                                        },
	                                    }
	                                    : {}),
	                                ...(unwrappedTerms.offset.filter((option) => option.isSome()).length
	                                    ? {
	                                        offset: {
	                                            ...(unwrappedTerms.offset[0].isSome()
	                                                ? { start: unwrappedTerms.offset[0].unwrap() }
	                                                : {}),
	                                            ...(unwrappedTerms.offset[1].isSome()
	                                                ? { end: unwrappedTerms.offset[1].unwrap() }
	                                                : {}),
	                                        },
	                                    }
	                                    : {}),
	                            };
	                        })(),
	                    }
	                    : {}),
	            });
	        }
	        else {
	            // save failed entry
	            this.etchings.push({
	                valid: false,
	                runeId,
	                txid,
	                runeTicker: rune.toString(),
	                runeName: rune.toString(),
	            });
	        }
	    }
	}
	updater.RuneUpdater = RuneUpdater;
	
	return updater;
}

var hasRequiredIndexer;

function requireIndexer () {
	if (hasRequiredIndexer) return indexer;
	hasRequiredIndexer = 1;
	(function (exports) {
		var __createBinding = (indexer && indexer.__createBinding) || (Object.create ? (function(o, m, k, k2) {
		    if (k2 === undefined) k2 = k;
		    var desc = Object.getOwnPropertyDescriptor(m, k);
		    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
		      desc = { enumerable: true, get: function() { return m[k]; } };
		    }
		    Object.defineProperty(o, k2, desc);
		}) : (function(o, m, k, k2) {
		    if (k2 === undefined) k2 = k;
		    o[k2] = m[k];
		}));
		var __exportStar = (indexer && indexer.__exportStar) || function(m, exports) {
		    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
		};
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.RunestoneIndexer = exports.RuneUpdater = void 0;
		const network_1 = /*@__PURE__*/ requireNetwork();
		const updater_1 = /*@__PURE__*/ requireUpdater();
		const integer_1 = /*@__PURE__*/ requireInteger();
		__exportStar(/*@__PURE__*/ requireTypes(), exports);
		var updater_2 = /*@__PURE__*/ requireUpdater();
		Object.defineProperty(exports, "RuneUpdater", { enumerable: true, get: function () { return updater_2.RuneUpdater; } });
		class RunestoneIndexer {
		    constructor(options) {
		        this._started = false;
		        this._updateInProgress = false;
		        this._rpc = options.bitcoinRpcClient;
		        this._storage = options.storage;
		        this._network = options.network;
		    }
		    async start() {
		        if (this._started) {
		            return;
		        }
		        await this._storage.connect();
		        this._started = true;
		        if (this._network === network_1.Network.MAINNET) {
		            this._storage.seedEtchings([
		                {
		                    runeTicker: 'UNCOMMONGOODS',
		                    runeName: 'UNCOMMON•GOODS',
		                    runeId: { block: 1, tx: 0 },
		                    txid: '0000000000000000000000000000000000000000000000000000000000000000',
		                    valid: true,
		                    symbol: '⧉',
		                    terms: { amount: 1n, cap: integer_1.u128.MAX, height: { start: 840000n, end: 1050000n } },
		                },
		            ]);
		        }
		    }
		    async stop() {
		        if (!this._started) {
		            return;
		        }
		        await this._storage.disconnect();
		        this._started = false;
		    }
		    async updateRuneUtxoBalances() {
		        if (!this._started) {
		            throw new Error('Runestone indexer is not started');
		        }
		        if (this._updateInProgress) {
		            return;
		        }
		        this._updateInProgress = true;
		        try {
		            await this.updateRuneUtxoBalancesImpl();
		        }
		        finally {
		            this._updateInProgress = false;
		        }
		    }
		    async updateRuneUtxoBalancesImpl() {
		        const currentStorageBlock = await this._storage.getCurrentBlock();
		        if (currentStorageBlock) {
		            // walk down until matching hash is found
		            const reorgBlockhashesToIndex = [];
		            let blockheight = currentStorageBlock.height;
		            let blockhash = (await this._rpc.getblockhash({ height: blockheight })).result;
		            let storageBlockHash = currentStorageBlock.hash;
		            while (storageBlockHash !== blockhash) {
		                if (blockhash) {
		                    reorgBlockhashesToIndex.push(blockhash);
		                }
		                blockheight--;
		                blockhash = (await this._rpc.getblockhash({ height: blockheight })).result;
		                storageBlockHash = await this._storage.getBlockhash(blockheight);
		            }
		            reorgBlockhashesToIndex.reverse();
		            // process blocks that are reorgs
		            for (const blockhash of reorgBlockhashesToIndex) {
		                const blockResult = await this._rpc.getblock({ blockhash, verbosity: 2 });
		                if (blockResult.error !== null) {
		                    throw blockResult.error;
		                }
		                const block = blockResult.result;
		                const runeUpdater = new updater_1.RuneUpdater(this._network, block, true, this._storage, this._rpc);
		                for (const [txIndex, tx] of block.tx.entries()) {
		                    await runeUpdater.indexRunes(tx, txIndex);
		                }
		                await this._storage.saveBlockIndex(runeUpdater);
		            }
		        }
		        // start from first rune height or next block height, whichever is greater
		        let blockheight = Math.max(network_1.Network.getFirstRuneHeight(this._network), currentStorageBlock ? currentStorageBlock.height + 1 : 0);
		        let blockhash = (await this._rpc.getblockhash({ height: blockheight })).result;
		        while (blockhash !== null) {
		            const blockResult = await this._rpc.getblock({ blockhash, verbosity: 2 });
		            if (blockResult.error !== null) {
		                throw blockResult.error;
		            }
		            const block = blockResult.result;
		            const runeUpdater = new updater_1.RuneUpdater(this._network, block, false, this._storage, this._rpc);
		            for (const [txIndex, tx] of block.tx.entries()) {
		                await runeUpdater.indexRunes(tx, txIndex);
		            }
		            await this._storage.saveBlockIndex(runeUpdater);
		            blockheight++;
		            blockhash = (await this._rpc.getblockhash({ height: blockheight })).result;
		        }
		    }
		}
		exports.RunestoneIndexer = RunestoneIndexer;
		
	} (indexer));
	return indexer;
}

var hasRequiredDist;

function requireDist () {
	if (hasRequiredDist) return dist;
	hasRequiredDist = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.tryDecodeRunestone = exports.isRunestone = exports.encodeRunestone = exports.Network = exports.RunestoneIndexer = exports.RuneUpdater = exports.RuneLocation = void 0;
		const constants_1 = /*@__PURE__*/ requireConstants();
		const etching_1 = /*@__PURE__*/ requireEtching();
		const flaw_1 = /*@__PURE__*/ requireFlaw();
		const integer_1 = /*@__PURE__*/ requireInteger();
		const monads_1 = /*@__PURE__*/ requireMonads();
		const runeid_1 = /*@__PURE__*/ requireRuneid();
		const runestone_1 = /*@__PURE__*/ requireRunestone();
		const spacedrune_1 = /*@__PURE__*/ requireSpacedrune();
		var indexer_1 = /*@__PURE__*/ requireIndexer();
		Object.defineProperty(exports, "RuneLocation", { enumerable: true, get: function () { return indexer_1.RuneLocation; } });
		Object.defineProperty(exports, "RuneUpdater", { enumerable: true, get: function () { return indexer_1.RuneUpdater; } });
		Object.defineProperty(exports, "RunestoneIndexer", { enumerable: true, get: function () { return indexer_1.RunestoneIndexer; } });
		var network_1 = /*@__PURE__*/ requireNetwork();
		Object.defineProperty(exports, "Network", { enumerable: true, get: function () { return network_1.Network; } });
		function getFlawString(flaw) {
		    switch (flaw) {
		        case flaw_1.Flaw.EDICT_OUTPUT:
		            return 'edict_output';
		        case flaw_1.Flaw.EDICT_RUNE_ID:
		            return 'edict_rune_id';
		        case flaw_1.Flaw.INVALID_SCRIPT:
		            return 'invalid_script';
		        case flaw_1.Flaw.OPCODE:
		            return 'opcode';
		        case flaw_1.Flaw.SUPPLY_OVERFLOW:
		            return 'supply_overflow';
		        case flaw_1.Flaw.TRAILING_INTEGERS:
		            return 'trailing_integers';
		        case flaw_1.Flaw.TRUNCATED_FIELD:
		            return 'truncated_field';
		        case flaw_1.Flaw.UNRECOGNIZED_EVEN_TAG:
		            return 'unrecognized_even_tag';
		        case flaw_1.Flaw.UNRECOGNIZED_FLAG:
		            return 'unrecognized_flag';
		        case flaw_1.Flaw.VARINT:
		            return 'varint';
		    }
		}
		// Helper functions to ensure numbers fit the desired type correctly
		const u8Strict = (n) => {
		    const bigN = BigInt(n);
		    if (bigN < 0n || bigN > integer_1.u8.MAX) {
		        throw Error('u8 overflow');
		    }
		    return (0, integer_1.u8)(bigN);
		};
		const u32Strict = (n) => {
		    const bigN = BigInt(n);
		    if (bigN < 0n || bigN > integer_1.u32.MAX) {
		        throw Error('u32 overflow');
		    }
		    return (0, integer_1.u32)(bigN);
		};
		const u64Strict = (n) => {
		    const bigN = BigInt(n);
		    if (bigN < 0n || bigN > integer_1.u64.MAX) {
		        throw Error('u64 overflow');
		    }
		    return (0, integer_1.u64)(bigN);
		};
		const u128Strict = (n) => {
		    const bigN = BigInt(n);
		    if (bigN < 0n || bigN > integer_1.u128.MAX) {
		        throw Error('u128 overflow');
		    }
		    return (0, integer_1.u128)(bigN);
		};
		// TODO: Add unit tests
		/**
		 * Low level function to allow for encoding runestones without any indexer and transaction checks.
		 *
		 * @param runestone runestone spec to encode as runestone
		 * @returns encoded runestone bytes
		 * @throws Error if encoding is detected to be considered a cenotaph
		 */
		function encodeRunestone(runestone) {
		    const mint = runestone.mint
		        ? (0, monads_1.Some)(new runeid_1.RuneId(u64Strict(runestone.mint.block), u32Strict(runestone.mint.tx)))
		        : monads_1.None;
		    const pointer = runestone.pointer !== undefined ? (0, monads_1.Some)(runestone.pointer).map(u32Strict) : monads_1.None;
		    const edicts = (runestone.edicts ?? []).map((edict) => ({
		        id: new runeid_1.RuneId(u64Strict(edict.id.block), u32Strict(edict.id.tx)),
		        amount: u128Strict(edict.amount),
		        output: u32Strict(edict.output),
		    }));
		    let etching = monads_1.None;
		    let etchingCommitment = undefined;
		    if (runestone.etching) {
		        const etchingSpec = runestone.etching;
		        const spacedRune = etchingSpec.runeName
		            ? spacedrune_1.SpacedRune.fromString(etchingSpec.runeName)
		            : undefined;
		        const rune = spacedRune?.rune !== undefined ? (0, monads_1.Some)(spacedRune.rune) : monads_1.None;
		        if (etchingSpec.symbol &&
		            !(etchingSpec.symbol.length === 1 ||
		                (etchingSpec.symbol.length === 2 && etchingSpec.symbol.codePointAt(0) >= 0x10000))) {
		            throw Error('Symbol must be one code point');
		        }
		        const divisibility = etchingSpec.divisibility !== undefined ? (0, monads_1.Some)(etchingSpec.divisibility).map(u8Strict) : monads_1.None;
		        const premine = etchingSpec.premine !== undefined ? (0, monads_1.Some)(etchingSpec.premine).map(u128Strict) : monads_1.None;
		        const spacers = spacedRune?.spacers !== undefined && spacedRune.spacers !== 0
		            ? (0, monads_1.Some)(u32Strict(spacedRune.spacers))
		            : monads_1.None;
		        const symbol = etchingSpec.symbol ? (0, monads_1.Some)(etchingSpec.symbol) : monads_1.None;
		        if (divisibility.isSome() && divisibility.unwrap() > constants_1.MAX_DIVISIBILITY) {
		            throw Error(`Divisibility is greater than protocol max ${constants_1.MAX_DIVISIBILITY}`);
		        }
		        let terms = monads_1.None;
		        if (etchingSpec.terms) {
		            const termsSpec = etchingSpec.terms;
		            const amount = termsSpec.amount !== undefined ? (0, monads_1.Some)(termsSpec.amount).map(u128Strict) : monads_1.None;
		            const cap = termsSpec.cap !== undefined ? (0, monads_1.Some)(termsSpec.cap).map(u128Strict) : monads_1.None;
		            const height = termsSpec.height
		                ? [
		                    termsSpec.height.start !== undefined
		                        ? (0, monads_1.Some)(termsSpec.height.start).map(u64Strict)
		                        : monads_1.None,
		                    termsSpec.height.end !== undefined ? (0, monads_1.Some)(termsSpec.height.end).map(u64Strict) : monads_1.None,
		                ]
		                : [monads_1.None, monads_1.None];
		            const offset = termsSpec.offset
		                ? [
		                    termsSpec.offset.start !== undefined
		                        ? (0, monads_1.Some)(termsSpec.offset.start).map(u64Strict)
		                        : monads_1.None,
		                    termsSpec.offset.end !== undefined ? (0, monads_1.Some)(termsSpec.offset.end).map(u64Strict) : monads_1.None,
		                ]
		                : [monads_1.None, monads_1.None];
		            if (amount.isSome() && cap.isSome() && amount.unwrap() * cap.unwrap() > integer_1.u128.MAX) {
		                throw Error('Terms overflow with amount times cap');
		            }
		            terms = (0, monads_1.Some)({ amount, cap, height, offset });
		        }
		        const turbo = etchingSpec.turbo ?? false;
		        etching = (0, monads_1.Some)(new etching_1.Etching(divisibility, rune, spacers, symbol, terms, premine, turbo));
		        etchingCommitment = rune.isSome() ? rune.unwrap().commitment : undefined;
		    }
		    return {
		        encodedRunestone: new runestone_1.Runestone(mint, pointer, edicts, etching).encipher(),
		        etchingCommitment,
		    };
		}
		exports.encodeRunestone = encodeRunestone;
		function isRunestone(artifact) {
		    return !('flaws' in artifact);
		}
		exports.isRunestone = isRunestone;
		function tryDecodeRunestone(tx) {
		    const optionArtifact = runestone_1.Runestone.decipher(tx);
		    if (optionArtifact.isNone()) {
		        return null;
		    }
		    const artifact = optionArtifact.unwrap();
		    if (artifact.type === 'runestone') {
		        const runestone = artifact;
		        const etching = () => runestone.etching.unwrap();
		        const terms = () => etching().terms.unwrap();
		        return {
		            ...(runestone.etching.isSome()
		                ? {
		                    etching: {
		                        ...(etching().divisibility.isSome()
		                            ? { divisibility: etching().divisibility.map(Number).unwrap() }
		                            : {}),
		                        ...(etching().premine.isSome() ? { premine: etching().premine.unwrap() } : {}),
		                        ...(etching().rune.isSome()
		                            ? {
		                                runeName: new spacedrune_1.SpacedRune(etching().rune.unwrap(), etching().spacers.map(Number).unwrapOr(0)).toString(),
		                            }
		                            : {}),
		                        ...(etching().symbol.isSome() ? { symbol: etching().symbol.unwrap() } : {}),
		                        ...(etching().terms.isSome()
		                            ? {
		                                terms: {
		                                    ...(terms().amount.isSome() ? { amount: terms().amount.unwrap() } : {}),
		                                    ...(terms().cap.isSome() ? { cap: terms().cap.unwrap() } : {}),
		                                    ...(terms().height.find((option) => option.isSome())
		                                        ? {
		                                            height: {
		                                                ...(terms().height[0].isSome()
		                                                    ? { start: terms().height[0].unwrap() }
		                                                    : {}),
		                                                ...(terms().height[1].isSome()
		                                                    ? { end: terms().height[1].unwrap() }
		                                                    : {}),
		                                            },
		                                        }
		                                        : {}),
		                                    ...(terms().offset.find((option) => option.isSome())
		                                        ? {
		                                            offset: {
		                                                ...(terms().offset[0].isSome()
		                                                    ? { start: terms().offset[0].unwrap() }
		                                                    : {}),
		                                                ...(terms().offset[1].isSome()
		                                                    ? { end: terms().offset[1].unwrap() }
		                                                    : {}),
		                                            },
		                                        }
		                                        : {}),
		                                },
		                            }
		                            : {}),
		                        turbo: etching().turbo,
		                    },
		                }
		                : {}),
		            ...(runestone.mint.isSome()
		                ? {
		                    mint: {
		                        block: runestone.mint.unwrap().block,
		                        tx: Number(runestone.mint.unwrap().tx),
		                    },
		                }
		                : {}),
		            ...(runestone.pointer.isSome() ? { pointer: Number(runestone.pointer.unwrap()) } : {}),
		            ...(runestone.edicts.length
		                ? {
		                    edicts: runestone.edicts.map((edict) => ({
		                        id: {
		                            block: edict.id.block,
		                            tx: Number(edict.id.tx),
		                        },
		                        amount: edict.amount,
		                        output: Number(edict.output),
		                    })),
		                }
		                : {}),
		        };
		    }
		    else {
		        const cenotaph = artifact;
		        return {
		            flaws: cenotaph.flaws.map(getFlawString),
		            ...(cenotaph.etching.isSome() ? { etching: cenotaph.etching.unwrap().toString() } : {}),
		            ...(cenotaph.mint.isSome()
		                ? { mint: { block: cenotaph.mint.unwrap().block, tx: Number(cenotaph.mint.unwrap().tx) } }
		                : {}),
		        };
		    }
		}
		exports.tryDecodeRunestone = tryDecodeRunestone;
		
	} (dist));
	return dist;
}

var distExports = /*@__PURE__*/ requireDist();

const RUNE_ID_REGEX = /\d+:\d+/;
function transfer_runes(rune_id, amount, output) {
    if (!RUNE_ID_REGEX.test(rune_id)) {
        throw new Error('invalid rune id: ' + rune_id);
    }
    const [block, idx] = rune_id.split(':');
    const runestone = distExports.encodeRunestone({
        edicts: [{
                id: { block: BigInt(block), tx: Number(idx) },
                amount: BigInt(amount),
                output
            }]
    });
    return runestone.encodedRunestone.toString('hex');
}

function taptweak_pubkey(pubkey) {
    const ctx = tap_pubkey(pubkey);
    return ctx.tapkey;
}

var OrdUtil;
(function (OrdUtil) {
    function encode_inscribe_id(id) {
        assert_inscribe_id(id);
        const [txid, vout] = id.split('i');
        const index = Number(vout);
        const buffer = [Buff.hex(txid).reverse()];
        if (index > 0) {
            buffer.push(Buff.num(index, 1));
        }
        return Buff.join(buffer);
    }
    OrdUtil.encode_inscribe_id = encode_inscribe_id;
    function decode_inscribe_id(hex) {
        const stream = Buff.hex(hex).stream;
        let index = 0;
        Assert.ok(stream.size <= 33, 'encoded inscription id is greater than 33 bytes');
        if (stream.size === 33) {
            index = stream.read(1).num;
        }
        const txid = stream.read(32).reverse();
        return `${txid}i${index}`;
    }
    OrdUtil.decode_inscribe_id = decode_inscribe_id;
    function parse_inscribe_id(inscription_id) {
        assert_inscribe_id(inscription_id);
        const items = inscription_id.split('i');
        Assert.is_hash(items[0]);
        Assert.is_number(items[1]);
        return [items[0], items[1]];
    }
    OrdUtil.parse_inscribe_id = parse_inscribe_id;
    function parse_rune_id(rune_id) {
        assert_rune_id(rune_id);
        const items = rune_id.split(':').map(e => Number(e));
        items.forEach(num => Assert.is_number(num));
        return [items[0], items[1]];
    }
    OrdUtil.parse_rune_id = parse_rune_id;
    function parse_outpoint(outpoint) {
        assert_outpoint(outpoint);
        const arr = outpoint.split(':');
        return [arr[0], Number(arr[1])];
    }
    OrdUtil.parse_outpoint = parse_outpoint;
    function parse_satpoint(satpoint) {
        const arr = satpoint.split(':');
        return [arr[0], Number(arr[1]), Number(arr[2])];
    }
    OrdUtil.parse_satpoint = parse_satpoint;
    function assert_inscribe_id(id) {
        if (typeof id === 'undefined') {
            throw new Error('inscription id is undefined');
        }
        const is_valid = /^[a-fA-F0-9]{64}i[0-9]+$/.test(id);
        if (!is_valid)
            throw new Error('invalid inscription id: ' + id);
    }
    OrdUtil.assert_inscribe_id = assert_inscribe_id;
    function assert_rune_id(id) {
        if (typeof id === 'undefined') {
            throw new Error('rune id is undefined');
        }
        const is_valid = /^[0-9]+\:[0-9]+$/.test(id);
        if (!is_valid)
            throw new Error('invalid rune id: ' + id);
    }
    OrdUtil.assert_rune_id = assert_rune_id;
    function assert_outpoint(outpoint) {
        if (typeof outpoint === 'undefined') {
            throw new Error('outpoint is undefined');
        }
        const is_valid = /^[a-fA-F0-9]{64}:[0-9]+$/.test(outpoint);
        if (!is_valid)
            throw new Error('invalid outpoint: ' + outpoint);
    }
    OrdUtil.assert_outpoint = assert_outpoint;
    function assert_satpoint(satpoint) {
        if (typeof satpoint === 'undefined') {
            throw new Error('satpoint id is undefined');
        }
        const is_valid = /^[a-fA-F0-9]{64}:[0-9]+:[0-9]+$/.test(satpoint);
        if (!is_valid)
            throw new Error('invalid sat point: ' + satpoint);
    }
    OrdUtil.assert_satpoint = assert_satpoint;
})(OrdUtil || (OrdUtil = {}));

var index$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    get Assert () { return Assert; },
    get Check () { return Check; },
    get Fetch () { return Fetch; },
    get InscribeUtil () { return InscribeUtil; },
    get OrdUtil () { return OrdUtil; },
    PSBT: PSBT,
    get Resolve () { return Resolve; },
    TX: TX,
    get_map_value: get_map_value,
    get_record_key: get_record_key,
    get_record_type: get_record_type,
    hash160: hash160,
    normalize_obj: normalize_obj,
    now: now,
    parse_error: parse_error,
    parse_schema: parse_schema,
    resolver: resolver,
    round_to_fixed: round_to_fixed,
    safe_exec: safe_exec,
    sleep: sleep,
    taptweak_pubkey: taptweak_pubkey,
    transfer_runes: transfer_runes
});

function parse_liquid_terms(terms) {
    const error = 'liquidation terms failed validation';
    const schema = Schema.proto.liquid_terms;
    return parse_schema(terms, schema, error);
}
function parse_vault_terms$1(terms) {
    const error = 'vault terms failed validation';
    const schema = Schema.proto.vault_terms;
    return parse_schema(terms, schema, error);
}
function parse_vault_open_config(config) {
    const error = 'vault open config failed validation';
    const schema = Schema.vault.config.open_config;
    return parse_schema(config, schema, error);
}
function parse_vault_borrow_config(config) {
    const error = 'vault borrow config failed validation';
    const schema = Schema.vault.config.borrow_config;
    return parse_schema(config, schema, error);
}
function parse_vault_repay_config(config) {
    const error = 'vault repay config failed validation';
    const schema = Schema.vault.config.repay_config;
    return parse_schema(config, schema, error);
}
function parse_vault_deposit_config(config) {
    const error = 'vault deposit config failed validation';
    const schema = Schema.vault.config.deposit_config;
    return parse_schema(config, schema, error);
}
function parse_vault_withdraw_config(config) {
    const error = 'vault withdraw config failed validation';
    const schema = Schema.vault.config.withdraw_config;
    return parse_schema(config, schema, error);
}
function parse_vault_open_request(req) {
    const error = 'vault open request failed validation';
    const schema = Schema.vault.req.open_req;
    return parse_schema(req, schema, error);
}
function parse_vault_borrow_request(req) {
    const error = 'vault borrow request failed validation';
    const schema = Schema.vault.req.borrow_req;
    return parse_schema(req, schema, error);
}
function parse_vault_repay_request(req) {
    const error = 'vault repay request failed validation';
    const schema = Schema.vault.req.repay_req;
    return parse_schema(req, schema, error);
}
function parse_vault_deposit_request(req) {
    const error = 'vault deposit request failed validation';
    const schema = Schema.vault.req.deposit_req;
    return parse_schema(req, schema, error);
}
function parse_vault_withdraw_request(req) {
    const error = 'vault withdraw request failed validation';
    const schema = Schema.vault.req.withdraw_req;
    return parse_schema(req, schema, error);
}

var parse = /*#__PURE__*/Object.freeze({
    __proto__: null,
    parse_liquid_terms: parse_liquid_terms,
    parse_vault_borrow_config: parse_vault_borrow_config,
    parse_vault_borrow_request: parse_vault_borrow_request,
    parse_vault_deposit_config: parse_vault_deposit_config,
    parse_vault_deposit_request: parse_vault_deposit_request,
    parse_vault_open_config: parse_vault_open_config,
    parse_vault_open_request: parse_vault_open_request,
    parse_vault_repay_config: parse_vault_repay_config,
    parse_vault_repay_request: parse_vault_repay_request,
    parse_vault_terms: parse_vault_terms$1,
    parse_vault_withdraw_config: parse_vault_withdraw_config,
    parse_vault_withdraw_request: parse_vault_withdraw_request
});

var verify = /*#__PURE__*/Object.freeze({
    __proto__: null
});

var index = { ...parse, ...verify };

async function esplora_get_tx(esplora_url, txid) {
    Assert.is_hash(txid);
    const url = `${esplora_url}/tx/${txid}`;
    return Fetch.json(url);
}
async function esplora_get_address_data(esplora_url, address) {
    const url = `${esplora_url}/address/${address}`;
    return Fetch.json(url);
}
async function esplora_get_utxos(esplora_url, address, filter) {
    const url = `${esplora_url}/address/${address}/utxo`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    const utxos = (Array.isArray(filter))
        ? res.data.filter(e => filter.includes(e.value))
        : res.data;
    return Resolve.data(utxos);
}
async function esplora_publish_tx(esplora_url, txhex) {
    const url = `${esplora_url}/tx`;
    const opt = { body: txhex, method: 'POST' };
    return Fetch.text(url, opt);
}

var esplora = /*#__PURE__*/Object.freeze({
    __proto__: null,
    esplora_get_address_data: esplora_get_address_data,
    esplora_get_tx: esplora_get_tx,
    esplora_get_utxos: esplora_get_utxos,
    esplora_publish_tx: esplora_publish_tx
});

function parse_outpoint_sat(output) {
    return output.sat_ranges?.at(0)?.at(0) ?? null;
}
function parse_outpoint_utxo(outpoint, res) {
    const { script_pubkey: script, value } = res;
    OrdUtil.assert_outpoint(outpoint);
    const out_pt = outpoint.split(':');
    return { txid: out_pt[0], vout: Number(out_pt[1]), value, script };
}
function parse_inscription_utxo(res) {
    const { address, satpoint, value } = res;
    const sat_pt = satpoint.split(':');
    const script = parse_address_script(address).hex;
    return { txid: sat_pt[0], vout: Number(sat_pt[1]), value, script };
}
function parse_rune_data(output) {
    const { runes } = output;
    return (runes !== null)
        ? new Map(Object.entries(runes))
        : new Map();
}

async function ord_fetch_tx(ord_url, txid) {
    Assert.is_hash(txid);
    const url = `${ord_url}/tx/${txid}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_inscription(ord_url, identifier) {
    OrdUtil.assert_inscribe_id(identifier);
    const url = `${ord_url}/inscription/${identifier}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_content(ord_url, identifier) {
    OrdUtil.assert_inscribe_id(identifier);
    const url = `${ord_url}/content/${identifier}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_outpoint(ord_url, outpoint) {
    OrdUtil.assert_outpoint(outpoint);
    const url = `${ord_url}/output/${outpoint}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_sat(ord_url, sat_id) {
    const url = `${ord_url}/sat/${sat_id}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_rune(ord_url, rune_name) {
    const url = `${ord_url}/rune/${rune_name}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_address(ord_url, address) {
    const url = `${ord_url}/address/${address}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_children(ord_url, identifier) {
    OrdUtil.assert_inscribe_id(identifier);
    const url = `${ord_url}/r/children/${identifier}/inscriptions`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
async function ord_fetch_sat_identifier(ord_url, sat_ptr, index = 0) {
    const url = `${ord_url}/r/sat/${sat_ptr}/at/${index}`;
    const opt = { headers: { Accept: 'application/json' } };
    const res = await Fetch.json(url, opt);
    if (!res.ok)
        return res;
    return Resolve.data(res.data.id);
}

var ord = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ord_fetch_address: ord_fetch_address,
    ord_fetch_children: ord_fetch_children,
    ord_fetch_content: ord_fetch_content,
    ord_fetch_inscription: ord_fetch_inscription,
    ord_fetch_outpoint: ord_fetch_outpoint,
    ord_fetch_rune: ord_fetch_rune,
    ord_fetch_sat: ord_fetch_sat,
    ord_fetch_sat_identifier: ord_fetch_sat_identifier,
    ord_fetch_tx: ord_fetch_tx
});

const SAT_IDX$1 = -1;
const FETCH_CONFIG$1 = {
    index: SAT_IDX$1,
    ival: CONST.FETCH_IVAL
};

var CONFIG = /*#__PURE__*/Object.freeze({
    __proto__: null,
    FETCH_CONFIG: FETCH_CONFIG$1,
    SAT_IDX: SAT_IDX$1
});

const { FETCH_CONFIG, SAT_IDX } = CONFIG;
const RANDOM_IDX = (max) => {
    return Math.floor(Math.random() * 1000) % max;
};
async function fetch_record_id(ord_url, sat_ptr, index = SAT_IDX) {
    const res = await ord_fetch_sat_identifier(ord_url, sat_ptr, index);
    if (!res.ok)
        return res;
    return (res.data !== null)
        ? Resolve.data(res.data)
        : Resolve.fail('sat pointer returned null', 404);
}
async function fetch_record_content(ord_url, identifier, schema) {
    const res = await ord_fetch_content(ord_url, identifier);
    if (!res.ok)
        return res;
    return (schema !== undefined)
        ? Resolve.schema(res.data, schema)
        : Resolve.data(res.data);
}
async function fetch_outpoint_sat(ord_url, outpoint) {
    const res = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res.ok)
        return res;
    const sat = parse_outpoint_sat(res.data);
    return (sat !== null)
        ? Resolve.data(sat)
        : Resolve.fail('sat pointer returned null', 404);
}
async function fetch_satpoint_meta(ord_url, pointer, options) {
    const { index, ival } = { ...FETCH_CONFIG, ...options };
    const res1 = await fetch_record_id(ord_url, pointer, index);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return ord_fetch_inscription(ord_url, res1.data);
}
async function fetch_satpoint_content(ord_url, pointer, options) {
    const { index, ival, schema } = { ...FETCH_CONFIG, ...options };
    const res1 = await fetch_record_id(ord_url, pointer, index);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_record_content(ord_url, res1.data, schema);
}
async function fetch_outpoint_groups(esp_url, address, postage) {
    const res = await esplora_get_utxos(esp_url, address, postage);
    if (!res.ok)
        return res;
    const groups = new Map();
    for (const utxo of res.data) {
        const { txid, value, vout } = utxo;
        if (postage.includes(value)) {
            const group = groups.get(value) ?? [];
            group.push(`${txid}:${vout}`);
            groups.set(value, group);
        }
    }
    return Resolve.data(groups);
}
async function fetch_outpoint_group(esp_url, address, postage) {
    const res = await fetch_outpoint_groups(esp_url, address, [postage]);
    if (!res.ok)
        return res;
    const arr = res.data.get(postage) ?? [];
    return Resolve.data(arr);
}
async function fetch_outpoint_range(esp_url, address, range) {
    const res = await esplora_get_utxos(esp_url, address);
    if (!res.ok)
        return res;
    const entries = new Map();
    for (const utxo of res.data) {
        const { txid, value, vout } = utxo;
        if (range[0] <= value && value <= range[1]) {
            entries.set(value, `${txid}:${vout}`);
        }
    }
    return Resolve.data(entries);
}
async function fetch_rand_outpoint(esp_url, address, postage) {
    const res = await fetch_outpoint_group(esp_url, address, postage);
    if (!res.ok)
        return res;
    const idx = RANDOM_IDX(res.data.length);
    const out = res.data.at(idx);
    Assert.exists(out, 'invalid index for outpoint group: ' + idx);
    return Resolve.data(out);
}
async function fetch_outpoint_id(ord_url, outpoint, options) {
    const conf = { ...FETCH_CONFIG, ...options };
    const res = await fetch_outpoint_sat(ord_url, outpoint);
    if (!res.ok)
        return res;
    await sleep(conf.ival);
    return fetch_record_id(ord_url, res.data);
}
async function fetch_outpoint_meta(ord_url, outpoint, options) {
    const conf = { ...FETCH_CONFIG, ...options };
    const res = await fetch_outpoint_sat(ord_url, outpoint);
    if (!res.ok)
        return res;
    await sleep(conf.ival);
    return fetch_satpoint_meta(ord_url, res.data, conf);
}
async function fetch_outpoint_content(ord_url, outpoint, options) {
    const conf = { ...FETCH_CONFIG, ...options };
    const res = await fetch_outpoint_sat(ord_url, outpoint);
    if (!res.ok)
        return res;
    await sleep(conf.ival);
    return fetch_satpoint_content(ord_url, res.data, conf);
}
async function fetch_rune_utxo(ord_url, outpoint) {
    OrdUtil.assert_outpoint(outpoint);
    const [txid, vout] = OrdUtil.parse_outpoint(outpoint);
    const res = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res.ok) {
        return res;
    }
    else if (res.data.runes === null) {
        return Resolve.fail('no runes found', 404);
    }
    else {
        const records = res.data.inscriptions;
        const runes = new Map(Object.entries(res.data.runes));
        const script = res.data.script_pubkey;
        const value = res.data.value;
        return Resolve.data({ records, runes, script, txid, value, vout });
    }
}

var ordx = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_outpoint_content: fetch_outpoint_content,
    fetch_outpoint_group: fetch_outpoint_group,
    fetch_outpoint_groups: fetch_outpoint_groups,
    fetch_outpoint_id: fetch_outpoint_id,
    fetch_outpoint_meta: fetch_outpoint_meta,
    fetch_outpoint_range: fetch_outpoint_range,
    fetch_outpoint_sat: fetch_outpoint_sat,
    fetch_rand_outpoint: fetch_rand_outpoint,
    fetch_record_content: fetch_record_content,
    fetch_record_id: fetch_record_id,
    fetch_rune_utxo: fetch_rune_utxo,
    fetch_satpoint_content: fetch_satpoint_content,
    fetch_satpoint_meta: fetch_satpoint_meta
});

async function fetch_master_contract(ord_url, identifier) {
    const schema = Schema.oracle.proto.master_contract;
    return fetch_record_content(ord_url, identifier, schema);
}
async function fetch_child_contract(ord_url, pointer, options = {}) {
    const { ival = CONST.FETCH_IVAL, schema } = options;
    const [address, sat] = pointer;
    const res1 = await ord_fetch_sat_identifier(ord_url, sat, -1);
    if (!res1.ok) {
        return res1;
    }
    else if (res1.data === null) {
        return Resolve.fail('sat points to a null inscription id', 404);
    }
    await sleep(ival);
    const res2 = await ord_fetch_inscription(ord_url, res1.data);
    if (!res2.ok) {
        return res2;
    }
    else if (res2.data.address !== address) {
        return Resolve.fail('sat points to an unrecognized address', 403);
    }
    else if (res2.data.sat !== sat) {
        return Resolve.fail('sat does not point to itself', 403);
    }
    await sleep(ival);
    return fetch_record_content(ord_url, res1.data, schema);
}
async function fetch_guard_contract(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.proto.guard_contract;
    return fetch_child_contract(ord_url, pointer, { ival, schema });
}
async function fetch_oracle_contract(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.proto.oracle_contract;
    return fetch_child_contract(ord_url, pointer, { ival, schema });
}
async function fetch_terms_contract(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.proto.terms_contract;
    return fetch_child_contract(ord_url, pointer, { ival, schema });
}

var contract = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_child_contract: fetch_child_contract,
    fetch_guard_contract: fetch_guard_contract,
    fetch_master_contract: fetch_master_contract,
    fetch_oracle_contract: fetch_oracle_contract,
    fetch_terms_contract: fetch_terms_contract
});

async function fetch_account_record(ord_url, identifier) {
    const schema = Schema.oracle.record.acct_record;
    return fetch_record_content(ord_url, identifier, schema);
}
async function fetch_guardian_record(ord_url, identifier) {
    const schema = Schema.oracle.record.host_record;
    return fetch_record_content(ord_url, identifier, schema);
}
async function fetch_exchange_record(ord_url, identifier) {
    const schema = Schema.oracle.record.host_record;
    return fetch_record_content(ord_url, identifier, schema);
}
async function fetch_terms_record(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.record.val_arr;
    return fetch_satpoint_content(ord_url, pointer, { ival, schema });
}

var record = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_account_record: fetch_account_record,
    fetch_exchange_record: fetch_exchange_record,
    fetch_guardian_record: fetch_guardian_record,
    fetch_terms_record: fetch_terms_record
});

async function fetch_account_profile(mint, ord_url, outpoint, ival = CONST.FETCH_IVAL) {
    OrdUtil.assert_outpoint(outpoint);
    const res1 = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res1.ok)
        return res1;
    const runes = parse_rune_data(res1.data);
    const rdata = runes.get(mint.label);
    Assert.exists(rdata, 'rune data returned null');
    const sat = parse_outpoint_sat(res1.data);
    Assert.exists(sat, 'sat pointer returned null');
    await sleep(ival);
    const res2 = await fetch_record_id(ord_url, sat);
    if (!res2.ok)
        return res2;
    const acct_id = res2.data;
    await sleep(ival);
    const res3 = await ord_fetch_inscription(ord_url, acct_id);
    if (!res3.ok)
        return res3;
    const parents = res3.data.parents;
    Assert.ok(parents.includes(mint.mint_id), 'account is not related to mint');
    await sleep(ival);
    const res4 = await fetch_account_record(ord_url, acct_id);
    if (!res4.ok)
        return res4;
    return Resolve.data({
        acct_id,
        balance: rdata.amount,
        issued: res4.data.iss,
        utxo: parse_inscription_utxo(res3.data)
    });
}
async function fetch_mint_profile(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const [address, identifier] = pointer;
    OrdUtil.assert_inscribe_id(identifier);
    const res1 = await ord_fetch_inscription(ord_url, identifier);
    if (!res1.ok) {
        return res1;
    }
    else if (res1.data.rune === null) {
        return Resolve.fail('inscription not linked to a rune');
    }
    else if (res1.data.address !== address) {
        return Resolve.fail('record points to an unrecognized address', 403);
    }
    await sleep(ival);
    const res2 = await ord_fetch_rune(ord_url, res1.data.rune);
    if (!res2.ok)
        return res2;
    return Resolve.data({
        address: res1.data.address,
        burned: res2.data.entry.burned,
        divisor: res2.data.entry.divisibility,
        issued: res2.data.entry.premine,
        label: res1.data.rune,
        mint_id: identifier,
        rune_id: res2.data.id,
        symbol: res2.data.entry.symbol,
        utxo: parse_inscription_utxo(res1.data)
    });
}

var mint = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_account_profile: fetch_account_profile,
    fetch_mint_profile: fetch_mint_profile
});

const { FETCH_IVAL: FETCH_IVAL$2, POSTAGE: POSTAGE$1 } = CONST;
async function fetch_rand_unit_account(mint, esp_url, ord_url, address, ival = FETCH_IVAL$2) {
    const postage = POSTAGE$1.GET_TYPE('unit_account');
    Assert.exists(postage, 'unit account postage type not found');
    const res1 = await fetch_rand_outpoint(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_account_profile(mint, ord_url, res1.data, ival);
}
async function fetch_rand_guardian_host(esp_url, ord_url, address, ival = FETCH_IVAL$2) {
    const postage = POSTAGE$1.GET_TYPE('guard_hosts');
    Assert.exists(postage, 'guard host postage type not found');
    const res1 = await fetch_rand_outpoint(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_outpoint_content(ord_url, res1.data, { ival });
}
async function fetch_rand_exchange_host(esp_url, ord_url, address, ival = FETCH_IVAL$2) {
    const postage = POSTAGE$1.GET_TYPE('oracle_hosts');
    Assert.exists(postage, 'oracle host postage type not found');
    const res1 = await fetch_rand_outpoint(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_outpoint_content(ord_url, res1.data, { ival });
}

var group = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_rand_exchange_host: fetch_rand_exchange_host,
    fetch_rand_guardian_host: fetch_rand_guardian_host,
    fetch_rand_unit_account: fetch_rand_unit_account
});

function get_vsize(bytes) {
    const weight = Buff.bytes(bytes).length;
    const remain = (weight % 4 > 0) ? 1 : 0;
    return Math.floor(weight / 4) + remain;
}
function get_chain_network(network) {
    if (network === 'main')
        return 'main';
    if (network === 'mutiny')
        return 'signet';
    if (network === 'testnet3')
        return 'testnet';
    if (network === 'testnet4')
        return 'testnet';
    if (network === 'regtest')
        return 'regtest';
    if (network === 'signet')
        return 'signet';
    throw new Error('invalid network: ' + network);
}
function create_proto_profile(profile, network = 'signet') {
    return {
        ctx: {
            groups: {
                guard: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0],
                oracle: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0]
            },
            runes: {
                unit: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 'e65d820ebc0e0de5215255fcc17363644b5676d4de47ea6bffe442c392e28894i0']
            },
            terms: {
                repo: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0],
                vault: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0],
            },
            ver: profile.version
        },
        groups: {
            guard: {
                adr: P2TR.create(profile.guard_pk, network),
                pub: profile.guard_pk,
                thd: 0
            },
            oracle: {
                adr: P2TR.create(profile.oracle_pk, network)
            }
        },
        master_id: profile.master_id,
        points: {
            repo: { adr: 'bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', ptr: [[0, 0]] },
            vault: { adr: 'bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', ptr: [[0, 0]] }
        },
        runes: { unit: profile.unit_rune },
        terms: new Map(profile.terms.map(e => [e[0], [e[1]]]))
    };
}

function get_contract_pointers(ctx) {
    const pointers = [];
    for (const key of Object.keys(ctx)) {
        const record = ctx[key];
        if (record !== undefined) {
            pointers.push(...record.ptr);
        }
    }
    return pointers;
}

const { FETCH_IVAL: FETCH_IVAL$1, POINTER, POSTAGE } = CONST;
const MASTER_TYPE = POSTAGE.GET_TYPE('master');
const DEFAULT_CONFIG$1 = {
    cache: {
        groups: {},
        points: {},
        runes: {},
        terms: new Map()
    },
    ival: FETCH_IVAL$1,
    mints: new Map(),
    terms: new Map()
};
async function fetch_master_id(esp_url, ord_url, master_pk, network = 'regtest', ival = FETCH_IVAL$1) {
    Assert.exists(MASTER_TYPE, 'master postage type not found');
    const net = get_chain_network(network);
    const addr = P2TR.create(master_pk, net);
    const res1 = await fetch_outpoint_groups(esp_url, addr, [MASTER_TYPE]);
    if (!res1.ok)
        return res1;
    const outpoint = res1.data.get(MASTER_TYPE)?.at(0);
    Assert.exists(outpoint, 'outpoint not found for master type: ' + MASTER_TYPE);
    await sleep(ival);
    return fetch_outpoint_id(ord_url, outpoint, { ival });
}
async function fetch_master_ctx(ord_url, master_id, options = {}) {
    const conf = { ...DEFAULT_CONFIG$1, ...options };
    let { cache, ival } = conf;
    try {
        if (cache.id === undefined) {
            cache.id = master_id;
        }
        else if (cache.id !== master_id) {
            cache = { ...DEFAULT_CONFIG$1.cache, id: master_id };
        }
        if (cache.ctx === undefined) {
            const res = await fetch_master_contract(ord_url, master_id);
            if (!res.ok)
                return res;
            cache.ctx = res.data;
            await sleep(ival);
        }
        if (cache.ctx === undefined) {
            return Resolve.fail('failed to fetch matcher contract');
        }
        if (cache.groups.guard === undefined) {
            const ptr = cache.ctx.groups.guard;
            const res = await fetch_guard_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.groups.guard = res.data;
            await sleep(ival);
        }
        if (cache.groups.oracle === undefined) {
            const ptr = cache.ctx.groups.oracle;
            const res = await fetch_oracle_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.groups.oracle = res.data;
            await sleep(ival);
        }
        if (cache.points.repo === undefined) {
            const ptr = cache.ctx.terms.repo;
            const res = await fetch_terms_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.points.repo = res.data;
            await sleep(ival);
        }
        if (cache.points.vault === undefined) {
            const ptr = cache.ctx.terms.vault;
            const res = await fetch_terms_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.points.vault = res.data;
            await sleep(ival);
        }
        if (cache.runes.unit === undefined) {
            const id = cache.ctx.runes.unit;
            const res = await fetch_mint_profile(ord_url, id);
            if (!res.ok)
                return res;
            cache.runes.unit = res.data;
            await sleep(ival);
        }
        const pointers = get_contract_pointers(cache.points);
        for (const [type, pointer] of pointers) {
            const key = POINTER.GET_KEY(type);
            if (key === undefined)
                continue;
            if (cache.terms.has(key))
                continue;
            const res = await fetch_terms_record(ord_url, pointer, ival);
            if (!res.ok)
                return res;
            cache.terms.set(key, res.data.slice(1));
            await sleep(ival);
        }
    }
    catch (err) {
        return Resolve.error(err);
    }
    const schema = Schema.oracle.proto.proto_profile;
    const parsed = await schema.spa({ ...cache, master_id });
    return (parsed.success)
        ? Resolve.data(parsed.data)
        : Resolve.error(parsed.error, 622);
}

var proto = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_master_ctx: fetch_master_ctx,
    fetch_master_id: fetch_master_id
});

async function fetch_price_quote(exchange_url, thold_price, quote_stamp) {
    const query = new URLSearchParams({ th: String(thold_price) });
    if (quote_stamp !== undefined) {
        query.append('ts', String(quote_stamp));
    }
    const url = `${exchange_url}/api/quote?` + query.toString();
    const opt = { method: 'GET' };
    return Fetch.json(url, opt);
}

var quote = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_price_quote: fetch_price_quote
});

const { VDATA_MAX_SIZE, VDATA_MIN_SIZE } = CONST;
function get_vault_return_data(vault_ctx, unit_bal) {
    return (unit_bal > 0)
        ? get_vault_locked_data(vault_ctx, unit_bal)
        : get_vault_cleared_data(vault_ctx);
}
function get_vault_cleared_data(vault_ctx) {
    const { vault_action, vault_quote } = vault_ctx;
    const unit_price = vault_quote.quote_price;
    const unit_stamp = vault_quote.quote_stamp;
    return { is_locked: false, unit_balance: 0, unit_price, unit_stamp, vault_action };
}
function get_vault_locked_data(vault_ctx, unit_balance) {
    const { vault_action, vault_quote } = vault_ctx;
    const { thold_hash, thold_price } = vault_quote;
    const unit_price = vault_quote.quote_price;
    const unit_stamp = vault_quote.quote_stamp;
    return { is_locked: true, thold_hash, thold_price, unit_balance, unit_price, unit_stamp, vault_action };
}
function get_liquid_vault_return_data(liquid_ctx, vault_ctx) {
    const { liquid_vaults, return_unit } = liquid_ctx;
    const vault_action = vault_ctx.vault_action;
    const liquid_vault = liquid_vaults.at(0);
    Assert.exists(liquid_vault, 'no liquid vaults found');
    const unit_price = liquid_vault.rdata.unit_price;
    const unit_stamp = liquid_vault.rdata.unit_stamp;
    return (return_unit > 0)
        ? { ...liquid_vault.rdata, unit_balance: return_unit, vault_action }
        : { is_locked: false, unit_balance: 0, unit_price, unit_stamp, vault_action };
}
function create_vault_return(data) {
    const v_byte = Buff.num(1, CONST.VAULT_VERSION);
    const action = Buff.str(data.vault_action, 1);
    const balance = Buff.num(data.unit_balance, 4);
    const quote = Buff.num(data.unit_price, 4);
    const stamp = Buff.num(data.unit_stamp, 4);
    const vreturn = [v_byte, action, balance, quote, stamp];
    if (data.unit_balance > 0) {
        Assert.exists(data.thold_price);
        Assert.exists(data.thold_hash);
        const tprice = Buff.num(data.thold_price, 4);
        const thold = Buff.hex(data.thold_hash, 20);
        vreturn.push(tprice, thold);
    }
    else {
        Assert.ok(data.unit_balance === 0, 'cleared vault data has non-zero balance');
    }
    const payload = Buff.join(vreturn);
    return {
        amount: CONST.BIGINT._0,
        script: TX.encode_script(['OP_RETURN', 'OP_8', payload])
    };
}
function parse_vault_return(script, version = 1) {
    const words = TX.parse_script_asm(script);
    verify_vault_return(words);
    const ret_data = Buff.hex(words[2]).stream;
    const ret_ver = ret_data.read(1).num;
    Assert.ok(ret_ver === version, `vault return data version mismatch: ${ret_ver} !== ${version}`);
    const vault_action = ret_data.read(1).str;
    const unit_balance = ret_data.read(4).num;
    const unit_price = ret_data.read(4).num;
    const unit_stamp = ret_data.read(4).num;
    let return_data = {
        vault_action, unit_balance, unit_price, unit_stamp, is_locked: false
    };
    if (unit_balance > 0) {
        const thold_price = ret_data.read(4).num;
        const thold_hash = ret_data.read(20).hex;
        return_data = { ...return_data, is_locked: true, thold_price, thold_hash };
    }
    Assert.ok(ret_data.size === 0, 'data remaining in buffer');
    return return_data;
}
function verify_vault_return(script_words) {
    Assert.ok(script_words[0] === 'OP_RETURN', 'vault data does not include OP_RETURN');
    Assert.ok(script_words[1] === 'OP_8', 'vault data does not include OP_8');
    Assert.exists(script_words[2]);
    const bytes = Buff.hex(script_words[2]);
    Assert.ok(bytes.length >= VDATA_MIN_SIZE, `vault data size below min: ${bytes.length} < ${VDATA_MIN_SIZE}`);
    Assert.ok(bytes.length <= VDATA_MAX_SIZE, `vault data size above max: ${bytes.length} > ${VDATA_MAX_SIZE}`);
}

const { TXMAP } = CONST;
function parse_vault_prevout(res) {
    const { input, output } = res.transaction;
    const vault_return = output.find(e => e.script_pubkey.startsWith('6a58'));
    Assert.exists(vault_return, 'vault return data not found');
    const rdata = parse_vault_return(vault_return.script_pubkey);
    const vin_idx = get_vault_input_idx(rdata.vault_action);
    const out_idx = get_vault_output_idx(rdata.vault_action);
    const vault_vin = input.at(vin_idx);
    const vault_out = output.at(out_idx);
    Assert.exists(vault_vin, 'vault input not found in tx');
    Assert.exists(vault_out, 'vault output not found in tx');
    const utxo = {
        txid: res.txid,
        vout: out_idx,
        value: vault_out.value,
        script: vault_out.script_pubkey
    };
    return { rdata, utxo };
}
function get_vault_output_idx(action) {
    const label = get_vault_action_label(action);
    return TXMAP[label].vault_tx.vout.vault;
}
function get_vault_input_idx(action) {
    const label = get_vault_action_label(action);
    return (label === 'open')
        ? TXMAP['open'].vault_tx.vin.conn
        : TXMAP[label].vault_tx.vin.vault;
}
function get_vault_action_label(action) {
    switch (action) {
        case 'o':
            return 'open';
        case 'b':
            return 'borrow';
        case 'r':
            return 'repay';
        case 'l':
            return 'liquidate';
        case 'x':
            return 'repo';
        case 'd':
            return 'deposit';
        case 'w':
            return 'withdraw';
        default:
            throw new Error('unrecognozed vault action: ' + action);
    }
}

const DEFAULT_IVAL = CONST.FETCH_IVAL;
async function fetch_vault_token(ord_url, outpoint, ival = DEFAULT_IVAL) {
    OrdUtil.assert_outpoint(outpoint);
    const res1 = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res1.ok)
        return res1;
    const ptr = parse_outpoint_sat(res1.data);
    Assert.exists(ptr, 'sat pointer is null');
    await sleep(ival);
    const res2 = await fetch_record_id(ord_url, ptr);
    if (!res2.ok)
        return res2;
    const tkn_id = res2.data;
    await sleep(ival);
    const schema = Schema.vault.base.token_data;
    const res3 = await fetch_record_content(ord_url, tkn_id, schema);
    if (!res3.ok)
        return res3;
    const revision = res3.data.rev;
    let vid = tkn_id.slice(0, -1) + 1;
    if (revision > 0) {
        await sleep(ival);
        const idx = (-1 * revision) - 1;
        const res = await fetch_record_id(ord_url, ptr, idx);
        if (!res.ok)
            return res;
        vid = res.data.slice(0, -1) + 1;
    }
    const data = res3.data;
    const utxo = parse_outpoint_utxo(outpoint, res1.data);
    return Resolve.data({ data, ptr, utxo, vid });
}
async function fetch_vault_prevout(ord_url, txid) {
    const res = await ord_fetch_tx(ord_url, txid);
    if (!res.ok)
        return res;
    const prevout = parse_vault_prevout(res.data);
    return Resolve.data(prevout);
}
async function fetch_vault_profile(ord_url, token, interval = DEFAULT_IVAL) {
    const res1 = await ord_fetch_inscription(ord_url, token.vid);
    if (!res1.ok)
        return res1;
    const satpoint = OrdUtil.parse_satpoint(res1.data.satpoint);
    const acct_id = res1.data.parents.at(0);
    Assert.exists(acct_id, 'vault record not linked to an account');
    await sleep(interval);
    const schema = Schema.oracle.vault.record;
    const res2 = await fetch_record_content(ord_url, token.vid, schema);
    if (!res2.ok)
        return res2;
    const { gpk, mid, vpk } = res2.data;
    await sleep(interval);
    const res3 = await fetch_vault_prevout(ord_url, satpoint[0]);
    if (!res3.ok)
        return res3;
    return Resolve.data({
        ...res3.data,
        acct_id,
        guard_pk: gpk,
        master_id: mid,
        vault_pk: vpk
    });
}

var vault = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_vault_prevout: fetch_vault_prevout,
    fetch_vault_profile: fetch_vault_profile,
    fetch_vault_token: fetch_vault_token
});

const { FETCH_IVAL } = CONST;
const DEFAULT_CONFIG = () => {
    return {
        cache: new Map(),
        ival: FETCH_IVAL
    };
};
async function fetch_address_bal(ord_url, address) {
    const res = await ord_fetch_address(ord_url, address);
    if (!res.ok)
        return res;
    const runes = res.data.runes_balances.map(e => {
        return [e[0], Number(e[1])];
    });
    const rune_bal = new Map(runes);
    const sats_bal = res.data.sat_balance;
    return Resolve.data({ rune_bal, sats_bal });
}
async function fetch_sats_utxos(esp_url, address) {
    const res = await esplora_get_utxos(esp_url, address);
    if (!res.ok)
        return res;
    const script = TX.parse_address_script(address).hex;
    const utxos = res.data.map(({ txid, value, vout }) => {
        return { script, txid, value, vout };
    });
    return Resolve.data(utxos);
}
async function fetch_rune_utxos(ord_url, address, options = {}) {
    const { cache, ival } = { ...DEFAULT_CONFIG(), ...options };
    const res1 = await ord_fetch_address(ord_url, address);
    if (!res1.ok)
        return res1;
    for (const outpoint of res1.data.outputs) {
        if (cache.has(outpoint))
            continue;
        await sleep(ival);
        const res = await fetch_rune_utxo(ord_url, outpoint);
        if (!res.ok)
            continue;
        cache.set(outpoint, res.data);
    }
    return Resolve.data(cache);
}
async function fetch_vault_tokens(esp_url, ord_url, address, postage, options = {}) {
    const { cache, ival } = { ...DEFAULT_CONFIG(), ...options };
    const res1 = await fetch_outpoint_group(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    for (const outpoint of res1.data) {
        if (cache.has(outpoint))
            continue;
        await sleep(ival);
        const res = await fetch_vault_token(ord_url, outpoint, ival);
        if (!res.ok) {
            continue;
        }
        cache.set(outpoint, res.data);
    }
    return Resolve.data(cache);
}

var wallet = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetch_address_bal: fetch_address_bal,
    fetch_rune_utxos: fetch_rune_utxos,
    fetch_sats_utxos: fetch_sats_utxos,
    fetch_vault_tokens: fetch_vault_tokens
});

var OracleAPI = {
    contract,
    esplora,
    group,
    mint,
    ord,
    ordx,
    proto,
    quote,
    record,
    vault,
    wallet
};

function get_account_input(account) {
    const { acct_id, utxo } = account;
    return { acct_id, acct_utxo: utxo };
}
function get_contract_input(profile) {
    const contract_id = profile.master_id;
    const guard_pubkey = profile.groups.guard.pub;
    const unit_rune_id = profile.runes.unit.rune_id;
    const unit_rune_lbl = profile.runes.unit.label;
    const proto_terms = profile.terms;
    return { guard_pubkey, contract_id: contract_id, proto_terms, unit_rune_id, unit_rune_lbl };
}
function get_vault_input(profile) {
    return {
        vault_balance: profile.rdata.unit_balance,
        vault_pubkey: profile.vault_pk,
        vault_utxo: profile.utxo
    };
}

function create_vault_open_conn_script(vault_ctx) {
    const { acct_id, acct_utxo, guard_pubkey, contract_id, token_data, vault_pubkey } = vault_ctx;
    Assert.size(guard_pubkey, 32);
    Assert.size(vault_pubkey, 32);
    const VTKN_PTR = acct_utxo.value;
    const VTXO_PTR = VTKN_PTR + CONST.DEFAULT_POSTAGE;
    const record_flag = Buff.str('ord');
    const record_type = Buff.str('application/json');
    const parent_id = OrdUtil.encode_inscribe_id(acct_id);
    const token_ptr = Buff.num(VTKN_PTR).reverse();
    const token_str = Buff.json(normalize_obj(token_data));
    const vault_ptr = Buff.num(VTXO_PTR).reverse();
    const vault_str = Buff.json({ gpk: guard_pubkey, mid: contract_id, vpk: vault_pubkey, ver: CONST.VAULT_VERSION });
    const lock_script = [vault_pubkey, 'OP_CHECKSIGVERIFY', guard_pubkey, 'OP_CHECKSIG'];
    const vault_token = ['OP_0', 'OP_IF', record_flag, 'OP_1', record_type, 'OP_2', token_ptr, 'OP_0', token_str, 'OP_ENDIF'];
    const vault_utxo = ['OP_0', 'OP_IF', record_flag, 'OP_1', record_type, 'OP_2', vault_ptr, 'OP_3', parent_id, 'OP_0', vault_str, 'OP_ENDIF'];
    return [TX.encode_script([...lock_script, ...vault_token, ...vault_utxo])];
}
function create_vault_fund_conn_script(guard_pk, vault_pk) {
    Assert.size(vault_pk, 32);
    Assert.size(guard_pk, 32);
    const lock_script = [vault_pk, 'OP_CHECKSIGVERIFY', guard_pk, 'OP_CHECKSIG'];
    return [TX.encode_script(lock_script)];
}
function create_vault_locked_spend_script(guard_pk, thold_hash, vault_pk) {
    Assert.size(guard_pk, 32);
    Assert.size(vault_pk, 32);
    Assert.size(thold_hash, 20);
    const lock_script = [vault_pk, 'OP_CHECKSIGVERIFY', guard_pk, 'OP_CHECKSIG'];
    const thold_script = ['OP_HASH160', thold_hash, 'OP_EQUALVERIFY', guard_pk, 'OP_CHECKSIG'];
    return [TX.encode_script(lock_script), TX.encode_script(thold_script)];
}
function create_vault_cleared_spend_script(guard_pk, vault_pk) {
    Assert.size(guard_pk, 32);
    Assert.size(vault_pk, 32);
    const lock_script = [vault_pk, 'OP_CHECKSIGVERIFY', guard_pk, 'OP_CHECKSIG'];
    return [TX.encode_script(lock_script)];
}

function parse_liquidation_terms(map) {
    return Schema.proto.liquid_terms.parse({
        liquidation_thold: get_map_value(map, 'repo_liquidation_thold'),
        reserve_pubkey: get_map_value(map, 'repo_reserve_pubkey'),
        reserve_sats_min: get_map_value(map, 'repo_reserve_sats_min'),
        liquid_tax_rate: get_map_value(map, 'repo_liquid_tax_rate'),
        subsidy_inc_rate: get_map_value(map, 'repo_subsidy_inc_rate'),
        subsidy_inc_thold: get_map_value(map, 'repo_subsidy_inc_thold')
    });
}
function parse_vault_terms(map) {
    return Schema.proto.vault_terms.parse({
        collateral_min: get_map_value(map, 'vault_collateral_min'),
        internal_key: get_map_value(map, 'vault_internal_key'),
        sats_balance_min: get_map_value(map, 'vault_sats_balance_min'),
        unit_balance_min: get_map_value(map, 'vault_unit_balance_min')
    });
}
function get_coin_size(type) {
    switch (type) {
        case 'p2sh':
            return CONST.TXSIZE.TXIN.P2SH;
        case 'p2w-pkh':
            return CONST.TXSIZE.TXIN.P2WK;
        case 'p2tr':
            return CONST.TXSIZE.TXIN.P2TR;
        default:
            throw new Error('unsupported input type: ' + type);
    }
}
function get_estimated_spend_size(spend_options = {}) {
    const { coin_count = 1, coin_type = 'p2w-pkh', padding = 0 } = spend_options;
    return get_coin_size(coin_type) * coin_count + padding;
}
function get_actual_spend_size(utxos) {
    let size = 0;
    for (const utxo of utxos) {
        const ctx = parse_script_meta(utxo.script);
        size += get_coin_size(ctx.type);
    }
    return size;
}

function get_vault_token_vsize(token) {
    const str = JSON.stringify(token, null, 2);
    const bytes = Buff.str(str);
    return get_vsize(bytes);
}
function calc_issuance_tx_cost(fund_utxos, postage, tx_feerate) {
    const base_tx_size = CONST.TXSIZE.TX.GUARD_ACCOUNT;
    const txin_spend_size = get_actual_spend_size(fund_utxos);
    const total_tx_size = base_tx_size + txin_spend_size;
    return (postage + (total_tx_size * tx_feerate));
}
function calc_liquidate_tx_cost(fund_utxos, tx_feerate, vault_count) {
    const base_tx_size = CONST.TXSIZE.TX.VAULT_LIQUID;
    const repo_vault_size = CONST.TXSIZE.TXIO.LIQUID_VAULT;
    const total_vault_size = repo_vault_size * vault_count;
    const txin_spend_size = get_actual_spend_size(fund_utxos);
    const total_tx_size = base_tx_size + total_vault_size + txin_spend_size;
    return total_tx_size * tx_feerate;
}

const { FLOAT_PREC: FLOAT_PREC$2, COIN_SIZE } = CONST;
function calc_portion(amount, percent = 1.0) {
    Assert.ok(percent >= 0 && percent <= 1, 'percent must be between 0 and 1');
    const float_amt = round_to_fixed(amount * percent, FLOAT_PREC$2);
    return Math.round(float_amt);
}
function convert_sats_to_btc(sats_amount) {
    return (sats_amount / CONST.COIN_SIZE);
}
function convert_btc_to_sats(btc_amount) {
    return (btc_amount * CONST.COIN_SIZE);
}
function convert_sats_to_unit(sats_amount, coin_price) {
    const unit_amt = (sats_amount / COIN_SIZE) * coin_price;
    return Math.round(unit_amt);
}
function convert_unit_to_sats(unit_amount, coin_price) {
    const sats_amt = (unit_amount / coin_price) * COIN_SIZE;
    return Math.round(sats_amt);
}
function calc_collateral_ratio(sats_amount, unit_amount, coin_price) {
    const collateral_value = (sats_amount / COIN_SIZE) * coin_price;
    const collateral_rate = (collateral_value / unit_amount);
    return round_to_fixed(collateral_rate, FLOAT_PREC$2);
}
function calc_collateral_value(coll_ratio, unit_amount, unit_rate) {
    const sats_amt = convert_unit_to_sats(unit_amount, unit_rate);
    return calc_portion(sats_amt, coll_ratio);
}

const FLOAT_PREC$1 = CONST.FLOAT_PREC;
function get_adjusted_unit_price(coin_price, divisor = 0) {
    if (divisor === 0)
        return coin_price;
    const adjusted_price = coin_price * (10 ** divisor);
    return round_to_fixed(adjusted_price, divisor);
}
function calc_subsidy_rate(liquid_terms, subsidy_multi) {
    const { liquid_tax_rate, subsidy_inc_rate } = liquid_terms;
    const subsidy_rate = round_to_fixed(subsidy_inc_rate * subsidy_multi, FLOAT_PREC$1);
    return Math.min(subsidy_rate, liquid_tax_rate);
}
function calc_subsidy_multiplier(liquid_terms, coll_ratio) {
    const { subsidy_inc_thold } = liquid_terms;
    Assert.ok(subsidy_inc_thold > 1, 'subsidy increment threshold must be greater than 100%');
    const max_steps = (subsidy_inc_thold - 1) * 100;
    if (coll_ratio >= subsidy_inc_thold)
        return 0;
    let multi = Math.floor((subsidy_inc_thold - coll_ratio) * 100);
    multi = Math.min(multi, max_steps);
    multi = Math.max(multi, 0);
    return multi;
}
function calc_subsidy_sats(sats_balance, subsidy_rate, taxable_sats) {
    const subsidy_sats = Math.floor(sats_balance * subsidy_rate);
    return Math.min(subsidy_sats, taxable_sats);
}
function calc_reserve_sats(liquid_terms, tax_remaining) {
    const min_sats_amt = liquid_terms.reserve_sats_min;
    return (tax_remaining >= min_sats_amt) ? tax_remaining : 0;
}

function verify_repo_portion(repo_portion) {
    Assert.ok(repo_portion > 0, 'repo portion must be greater than zero');
    Assert.ok(repo_portion <= 1, 'repo portion must be less than or equal to one');
}
function verify_return_balances(repo_portion, return_sats, return_unit) {
    if (repo_portion === 1) {
        Assert.ok(return_sats === CONST.MIN_VAULT_BAL, 'returned sats must be equal to the minimum vault balance');
        Assert.ok(return_unit === 0, 'returned unit must be zero');
    }
    else {
        Assert.ok(return_sats > CONST.MIN_VAULT_BAL, 'returned sats must be greater than the minimum vault balance');
        Assert.ok(return_unit > 0, 'returned unit must be positive');
    }
}
function verify_batch_liquidate(vaults) {
    Assert.ok(vaults.length > 0, 'there are no vaults to liquidate');
    let has_partial_liquidation = false;
    vaults.forEach(vault => {
        Assert.ok(vault.rdata.unit_balance > 0, 'vault unit balance must be greater than zero');
        Assert.ok(vault.utxo.value > CONST.MIN_VAULT_BAL, 'vault sats balance must be greater than minimum vault balance');
        if (vault.repo_portion !== 1) {
            Assert.ok(!has_partial_liquidation, 'you can only partially liquidate one vault at a time');
            has_partial_liquidation = true;
        }
    });
}

function get_liquidation_ctx(liquid_vaults, proto_contract) {
    verify_batch_liquidate(liquid_vaults);
    const vault_count = liquid_vaults.length;
    const liquid_terms = parse_liquidation_terms(proto_contract.terms);
    const reserve_pk = liquid_terms.reserve_pubkey;
    const total_sats = get_liquid_sats_total(liquid_vaults);
    const total_unit = get_liquid_unit_total(liquid_vaults);
    const initial_vault = liquid_vaults.at(0);
    Assert.exists(initial_vault, 'no vaults to liquidate');
    const return_unit = initial_vault.return_unit;
    const return_sats = initial_vault.return_sats;
    Assert.ok(liquid_vaults.slice(1).every(vault => vault.repo_portion === 1), 'remaining vaults must be fully liquidated');
    let reserve_sats = 0, claimed_sats = 0;
    for (let i = 0; i < vault_count; i++) {
        const profile = liquid_vaults.at(i);
        Assert.exists(profile, 'vault is undefined');
        claimed_sats += profile.liquid_quote.reward_sats;
        reserve_sats += profile.liquid_quote.reserve_sats;
    }
    const claimed_unit = total_unit - return_unit;
    return {
        liquid_terms,
        liquid_vaults,
        reserve_pk,
        reserve_sats,
        return_unit,
        return_sats,
        claimed_sats,
        claimed_unit,
        total_sats,
        total_unit,
        vault_count
    };
}
function get_liquid_sats_total(liquid_vaults) {
    return liquid_vaults.reduce((prev, curr) => {
        const value = curr.utxo.value - CONST.MIN_VAULT_BAL;
        Assert.ok(value > 0, 'liquid vault value is less than minimum vault balance');
        return prev + value;
    }, 0);
}
function get_liquid_unit_total(liquid_vaults) {
    return liquid_vaults.reduce((prev, curr) => prev + curr.rdata.unit_balance, 0);
}

const FLOAT_PREC = CONST.FLOAT_PREC;
function get_liquid_profile(proto_profile, liquid_vault, thold_key, coin_price, repo_portion = 1.0) {
    Assert.ok(liquid_vault.rdata.unit_balance > 0, 'vault unit balance must be greater than zero');
    Assert.ok(liquid_vault.utxo.value > CONST.MIN_VAULT_BAL, 'vault sats balance must be greater than minimum vault balance');
    verify_repo_portion(repo_portion);
    const sats_total = liquid_vault.utxo.value;
    const unit_total = liquid_vault.rdata.unit_balance;
    const unit_divisor = proto_profile.runes.unit.divisor;
    const quote_config = { coin_price, repo_portion, sats_total, unit_total, unit_divisor };
    const liquid_quote = get_liquidation_quote(proto_profile.terms, quote_config);
    const return_sats = sats_total - liquid_quote.sats_balance;
    const return_unit = unit_total - liquid_quote.unit_balance;
    verify_return_balances(repo_portion, return_sats, return_unit);
    return {
        ...liquid_vault,
        liquid_quote,
        repo_portion,
        return_sats,
        return_unit,
        thold_key
    };
}
function get_liquidation_quote(proto_terms, liquid_config) {
    const { coin_price, repo_portion = 1.0, unit_divisor = 0 } = liquid_config;
    const sats_available = liquid_config.sats_total - CONST.MIN_VAULT_BAL;
    const sats_balance = calc_portion(sats_available, repo_portion);
    const unit_balance = calc_portion(liquid_config.unit_total, repo_portion);
    const liquid_terms = parse_liquidation_terms(proto_terms);
    const vault_terms = parse_vault_terms(proto_terms);
    const min_collateral = vault_terms.collateral_min;
    const tax_rate = liquid_terms.liquid_tax_rate;
    const adj_price = get_adjusted_unit_price(coin_price, unit_divisor);
    const vault_cr = calc_collateral_ratio(sats_balance, unit_balance, adj_price);
    const taxable_sats = Math.round(sats_balance * tax_rate);
    const subsidy_multi = calc_subsidy_multiplier(liquid_terms, vault_cr);
    const subsidy_rate = calc_subsidy_rate(liquid_terms, subsidy_multi);
    const subsidy_sats = calc_subsidy_sats(sats_balance, subsidy_rate, taxable_sats);
    const tax_remaining = taxable_sats - subsidy_sats;
    const reserve_sats = calc_reserve_sats(liquid_terms, tax_remaining);
    const reward_sats = sats_balance - reserve_sats;
    const reward_cr = calc_collateral_ratio(reward_sats, unit_balance, adj_price);
    const deficit_cr = min_collateral - reward_cr;
    const deficit_sats = Math.ceil((deficit_cr / reward_cr) * reward_sats);
    const liquid_nav = round_to_fixed(reward_cr - 1, FLOAT_PREC);
    const profit_margin = round_to_fixed(liquid_nav / deficit_cr, FLOAT_PREC);
    return {
        coin_price,
        vault_cr,
        deficit_cr,
        deficit_sats,
        liquid_nav,
        profit_margin,
        reserve_sats,
        reward_cr,
        reward_sats,
        sats_balance,
        subsidy_multi,
        subsidy_rate,
        subsidy_sats,
        taxable_sats,
        unit_balance,
        unit_divisor
    };
}

function get_unit_balance(balance_amt, repay_amount) {
    const unit_balance = balance_amt - repay_amount;
    if (unit_balance < 0) {
        throw new Error(`repay amount is greater than unit balance: ${balance_amt} < ${repay_amount}`);
    }
    return unit_balance;
}
function get_unit_change(input_amount, repay_amount) {
    const change_amt = input_amount - repay_amount;
    if (change_amt < 0) {
        throw new Error(`insufficient unit balance from inputs: ${input_amount} < ${repay_amount}`);
    }
    return change_amt;
}
function create_unit_output(unit_address, unit_postage) {
    return PSBT.create.payout(unit_postage, unit_address);
}
function create_unit_rune_data(rune_id, unit_amount, utxo_index) {
    const script = transfer_runes(rune_id, unit_amount, utxo_index);
    return { amount: CONST.BIGINT._0, script };
}

function create_vault_open_conn_vin(vault_ctx, vault_utxo) {
    const input = PSBT.create.input(vault_utxo);
    const scripts = create_vault_open_conn_script(vault_ctx);
    const tapleaf = PSBT.create.tapscript(scripts, 0);
    return {
        ...input,
        tapLeafScript: [tapleaf],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
function create_vault_fund_conn_vin(vault_ctx, conn_utxo) {
    const { guard_pubkey, vault_pubkey } = vault_ctx;
    const input = PSBT.create.input(conn_utxo);
    const scripts = create_vault_fund_conn_script(guard_pubkey, vault_pubkey);
    return {
        ...input,
        tapLeafScript: [PSBT.create.tapscript(scripts, 0)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
function create_vault_cleared_spend_vin(guard_pubkey, vault_pubkey, vault_utxo) {
    const input = PSBT.create.input(vault_utxo);
    const scripts = create_vault_cleared_spend_script(guard_pubkey, vault_pubkey);
    return {
        ...input,
        tapLeafScript: [PSBT.create.tapscript(scripts, 0)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
function create_vault_locked_spend_vin(guard_pubkey, thold_hash, vault_pubkey, vault_utxo) {
    const input = PSBT.create.input(vault_utxo);
    const scripts = create_vault_locked_spend_script(guard_pubkey, thold_hash, vault_pubkey);
    return {
        ...input,
        tapLeafScript: [PSBT.create.tapscript(scripts, 0)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
function create_vault_spend_vin(vault_ctx) {
    const { guard_pubkey, vault_quote, vault_balance, vault_pubkey, vault_utxo } = vault_ctx;
    const thold_hash = vault_quote.thold_hash;
    return (vault_balance > 0)
        ? create_vault_locked_spend_vin(guard_pubkey, thold_hash, vault_pubkey, vault_utxo)
        : create_vault_cleared_spend_vin(guard_pubkey, vault_pubkey, vault_utxo);
}
function create_liquid_spend_vin(vault_ctx, vault_profile) {
    const { rdata, vault_pk, thold_key, utxo } = vault_profile;
    Assert.ok(rdata.is_locked, 'liquid vault is not locked');
    const thold_hash = rdata.thold_hash;
    const scripts = create_vault_locked_spend_script(vault_ctx.guard_pubkey, thold_hash, vault_pk);
    const input = PSBT.create.input(utxo);
    const hlock = PSBT.create.hashlock(thold_hash, thold_key);
    return {
        ...input,
        hash160: [hlock],
        tapLeafScript: [PSBT.create.tapscript(scripts, 1)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}

function create_vault_open_conn_out(vault_ctx, fund_value) {
    const scripts = create_vault_open_conn_script(vault_ctx);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(fund_value), script: TX.encode_p2tr_pubkey(tapkey) };
}
function create_vault_fund_conn_out(vault_ctx, fund_value) {
    const { guard_pubkey, vault_pubkey } = vault_ctx;
    const scripts = create_vault_fund_conn_script(guard_pubkey, vault_pubkey);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(fund_value), script: TX.encode_p2tr_pubkey(tapkey) };
}
function create_vault_locked_spend_out(guard_pubkey, thold_hash, vault_amount, vault_pubkey) {
    const scripts = create_vault_locked_spend_script(guard_pubkey, thold_hash, vault_pubkey);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: TX.encode_p2tr_pubkey(tapkey) };
}
function create_vault_cleared_spend_out(guard_pubkey, vault_amount, vault_pubkey) {
    const scripts = create_vault_cleared_spend_script(guard_pubkey, vault_pubkey);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: TX.encode_p2tr_pubkey(tapkey) };
}
function create_vault_spend_out(vault_ctx, unit_bal, vault_amt) {
    const { guard_pubkey, vault_quote, vault_pubkey } = vault_ctx;
    const thold_hash = vault_quote.thold_hash;
    return (unit_bal > 0)
        ? create_vault_locked_spend_out(guard_pubkey, thold_hash, vault_amt, vault_pubkey)
        : create_vault_cleared_spend_out(guard_pubkey, vault_amt, vault_pubkey);
}
function create_reserve_spend_out(liquid_ctx) {
    const { reserve_sats, reserve_pk } = liquid_ctx;
    Assert.ok(reserve_sats > CONST.DUST_LIMIT, 'reserve amount is below dust limit');
    const script = Buff.hex('5120' + reserve_pk);
    return { amount: BigInt(reserve_sats), script };
}
function create_change_out(vault_ctx, change_amt) {
    const { sats_address } = vault_ctx;
    Assert.ok(change_amt > CONST.DUST_LIMIT, 'change amount is below dust limit');
    const script = TX.parse_address_script(sats_address);
    return { amount: BigInt(change_amt), script };
}

const ACCT_VIN_IDX$2 = CONST.TXMAP.borrow.acct_tx.vin.acct;
const CONN_OUT_IDX$2 = CONST.TXMAP.borrow.acct_tx.vout.conn;
const UNIT_OUT_IDX$2 = CONST.TXMAP.borrow.acct_tx.vout.unit;
const VAULT_VIN_IDX$4 = CONST.TXMAP.borrow.vault_tx.vin.vault;
const CONN_VIN_IDX$2 = CONST.TXMAP.borrow.vault_tx.vin.conn;
function create_vault_borrow_ctx(acct_profile, price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_account_input(acct_profile),
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'b'
    };
}
function create_vault_borrow_psbt1(vault_ctx, sats_utxos) {
    const { acct_utxo, borrow_amount, unit_rune_id, unit_address, unit_postage } = vault_ctx;
    const conn_value = calc_connector_value(vault_ctx, sats_utxos);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(create_vault_fund_conn_out(vault_ctx, conn_value));
    pdata.addOutput(create_unit_output(unit_address, unit_postage));
    pdata.addOutput(create_unit_rune_data(unit_rune_id, borrow_amount, UNIT_OUT_IDX$2));
    pdata.addInput(PSBT.create.input(acct_utxo));
    for (const utxo of sats_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    return PSBT.encode(pdata);
}
function create_vault_borrow_psbt2(vault_ctx, acct_psbt) {
    const acct_pdata = PSBT.parse(acct_psbt);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, CONN_OUT_IDX$2);
    const unit_balance = calc_unit_balance(vault_ctx);
    const vault_amount = calc_vault_amount$1(vault_ctx);
    const change_amt = calc_change_amount$2(vault_ctx, conn_utxo.value);
    const return_data = get_vault_return_data(vault_ctx, unit_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, unit_balance, vault_amount));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    pdata.addInput(create_vault_fund_conn_vin(vault_ctx, conn_utxo));
    return PSBT.encode(pdata);
}
function create_vault_borrow_req(vault_ctx, issue_psbt, vault_psbt) {
    const issue_txhex = PSBT.get.txhex(issue_psbt);
    const issue_txid = TX.get_txid(issue_txhex);
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(issue_psbt, { start_idx: ACCT_VIN_IDX$2 + 1 });
    const connect_input = PSBT.extract.script_vin(vault_psbt, CONN_VIN_IDX$2);
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX$4);
    const schema = Schema.vault.req.borrow_req;
    return schema.parse({ ...vault_ctx, sats_inputs, connect_input, issue_psbt, issue_txhex, issue_txid, vault_input, vault_psbt, vault_txhex, vault_txid });
}
function calc_connector_value(vault_config, sats_utxos) {
    const { unit_postage, tx_feerate } = vault_config;
    const fund_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const issue_cost = calc_issuance_tx_cost(sats_utxos, unit_postage, tx_feerate);
    return fund_value - issue_cost;
}
function calc_unit_balance(vault_ctx) {
    const { borrow_amount, vault_balance } = vault_ctx;
    return vault_balance + borrow_amount;
}
function calc_vault_amount$1(vault_ctx) {
    const { deposit_amount, vault_utxo } = vault_ctx;
    return vault_utxo.value + deposit_amount;
}
function calc_change_amount$2(vault_config, conn_value) {
    const { deposit_amount, tx_feerate } = vault_config;
    const tx_size = CONST.TXSIZE.TX.VAULT_CONN;
    const tx_cost = tx_size * tx_feerate;
    return conn_value - (deposit_amount + tx_cost);
}
function get_vault_borrow_quote(vault_config, fee_options) {
    const { deposit_amount, tx_feerate, unit_postage } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_BORROW + spend_size;
    const total_size = action_size + spend_size;
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + unit_postage + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
function get_vault_borrow_change(vault_config, sats_utxos) {
    const conn_value = calc_connector_value(vault_config, sats_utxos);
    return calc_change_amount$2(vault_config, conn_value);
}
var borrow = {
    create_ctx: create_vault_borrow_ctx,
    create_psbt1: create_vault_borrow_psbt1,
    create_psbt2: create_vault_borrow_psbt2,
    create_req: create_vault_borrow_req,
    get_quote: get_vault_borrow_quote,
    get_change: get_vault_borrow_change
};

const VAULT_VIN_IDX$3 = CONST.TXMAP.deposit.vault_tx.vin.vault;
function create_vault_deposit_ctx(price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'd'
    };
}
function create_vault_deposit_psbt(vault_ctx, sats_utxos) {
    const { deposit_amount, vault_balance, vault_utxo } = vault_ctx;
    const vault_amt = vault_utxo.value + deposit_amount;
    const change_amt = get_vault_deposit_change(vault_ctx, sats_utxos);
    const return_data = get_vault_return_data(vault_ctx, vault_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, vault_balance, vault_amt));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    for (const utxo of sats_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    return PSBT.encode(pdata);
}
function create_vault_deposit_req(vault_ctx, vault_psbt) {
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(vault_psbt, { start_idx: VAULT_VIN_IDX$3 + 1 });
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX$3);
    const schema = Schema.vault.req.deposit_req;
    return schema.parse({ ...vault_ctx, sats_inputs, vault_input, vault_psbt, vault_txhex, vault_txid });
}
function get_vault_deposit_quote(vault_config, fee_options = {}) {
    const { deposit_amount, tx_feerate } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const tx_vsize = CONST.TXSIZE.ACTION.VAULT_DEPOSIT + spend_size;
    const tx_cost = tx_vsize * tx_feerate;
    const total_cost = deposit_amount + tx_cost;
    return { tx_vsize, tx_cost, total_cost };
}
function get_vault_deposit_change(vault_config, vin_utxos) {
    const { tx_feerate } = vault_config;
    const vin_value = vin_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const vin_vsize = get_actual_spend_size(vin_utxos);
    const tx_quote = get_vault_deposit_quote(vault_config);
    const vin_cost = vin_vsize * tx_feerate;
    return vin_value - (vin_cost + tx_quote.total_cost);
}
var deposit = {
    create_ctx: create_vault_deposit_ctx,
    create_psbt: create_vault_deposit_psbt,
    create_req: create_vault_deposit_req,
    get_quote: get_vault_deposit_quote,
    get_change: get_vault_deposit_change
};

const ACCT_VIN_IDX$1 = CONST.TXMAP.open.acct_tx.vin.acct;
const ACCT_OUT_IDX = CONST.TXMAP.open.acct_tx.vout.acct;
const CONN_OUT_IDX$1 = CONST.TXMAP.open.acct_tx.vout.conn;
const UNIT_OUT_IDX$1 = CONST.TXMAP.open.acct_tx.vout.unit;
const CONN_VIN_IDX$1 = CONST.TXMAP.open.vault_tx.vin.conn;
function create_vault_open_ctx(acct_profile, price_quote, proto_profile, req_config) {
    return {
        ...req_config,
        ...get_account_input(acct_profile),
        ...get_contract_input(proto_profile),
        vault_quote: price_quote,
        vault_action: 'o'
    };
}
function create_vault_open_psbt1(vault_ctx, sats_utxos) {
    const { acct_utxo, borrow_amount, unit_address, unit_postage, unit_rune_id } = vault_ctx;
    const conn_value = calc_conn_amount(vault_ctx, sats_utxos);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(create_vault_open_conn_out(vault_ctx, conn_value));
    pdata.addOutput(create_unit_output(unit_address, unit_postage));
    pdata.addOutput(create_unit_rune_data(unit_rune_id, borrow_amount, UNIT_OUT_IDX$1));
    pdata.addInput(PSBT.create.input(acct_utxo));
    for (const utxo of sats_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
function create_vault_open_psbt2(vault_ctx, acct_psbt) {
    const { borrow_amount, deposit_amount, token_address, token_postage } = vault_ctx;
    const acct_pdata = PSBT.parse(acct_psbt);
    const acct_utxo = PSBT.extract.utxo(acct_pdata, ACCT_OUT_IDX);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, CONN_OUT_IDX$1);
    const change_amt = calc_change_amount$1(vault_ctx, conn_utxo.value);
    const return_data = get_vault_return_data(vault_ctx, borrow_amount);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(PSBT.create.payout(token_postage, token_address));
    pdata.addOutput(create_vault_spend_out(vault_ctx, borrow_amount, deposit_amount));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(PSBT.create.input(acct_utxo));
    pdata.addInput(create_vault_open_conn_vin(vault_ctx, conn_utxo));
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
function create_vault_open_req(vault_ctx, issue_psbt, vault_psbt) {
    vault_psbt = PSBT.finalize.script_vin(vault_psbt, CONN_VIN_IDX$1);
    const issue_pdata = PSBT.decode(issue_psbt);
    const issue_txhex = PSBT.get.txhex(issue_psbt);
    const issue_txid = TX.get_txid(issue_txhex);
    const vault_pdata = PSBT.decode(vault_psbt);
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(issue_pdata, { start_idx: ACCT_VIN_IDX$1 + 1 });
    const connect_input = PSBT.extract.script_vin(vault_pdata, CONN_VIN_IDX$1);
    const schema = Schema.vault.req.open_req;
    return schema.parse({ ...vault_ctx, connect_input, sats_inputs, issue_psbt, issue_txhex, issue_txid, vault_psbt, vault_txhex, vault_txid });
}
function calc_conn_amount(vault_config, sats_utxos) {
    const { unit_postage, tx_feerate } = vault_config;
    const fund_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const issue_cost = calc_issuance_tx_cost(sats_utxos, unit_postage, tx_feerate);
    return fund_value - issue_cost;
}
function calc_change_amount$1(vault_config, conn_value) {
    const { deposit_amount, token_postage, token_data, tx_feerate } = vault_config;
    const token_size = get_vault_token_vsize(token_data);
    const tx_size = CONST.TXSIZE.TX.VAULT_OPEN;
    const total_size = token_size + tx_size;
    const tx_cost = total_size * tx_feerate;
    return conn_value - (deposit_amount + token_postage + tx_cost);
}
function get_vault_open_quote(vault_config, fee_options) {
    const { deposit_amount, unit_postage, token_postage, token_data, tx_feerate } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_OPEN;
    const token_size = get_vault_token_vsize(token_data);
    const total_size = action_size + spend_size + token_size;
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + unit_postage + token_postage + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
function get_vault_open_change(vault_config, sats_utxos) {
    const conn_value = calc_conn_amount(vault_config, sats_utxos);
    return calc_change_amount$1(vault_config, conn_value);
}
var open = {
    create_ctx: create_vault_open_ctx,
    create_psbt1: create_vault_open_psbt1,
    create_psbt2: create_vault_open_psbt2,
    create_req: create_vault_open_req,
    get_quote: get_vault_open_quote,
    get_change: get_vault_open_change
};

const RANDOM_SORT = () => Math.random() > 0.5 ? 1 : -1;
function select_sat_utxos(utxos, amount, sorter = RANDOM_SORT) {
    const selected = [];
    let total = 0;
    utxos.sort(sorter);
    for (const utxo of utxos) {
        selected.push(utxo);
        total += utxo.value;
        if (total > amount + CONST.DUST_LIMIT) {
            return selected;
        }
    }
    throw new Error(`insufficient sats: ${total} < ${amount}`);
}
function select_rune_utxos(utxos, rune, amount, sorter = RANDOM_SORT) {
    const selected = [];
    let total = 0;
    utxos.sort(sorter);
    for (const utxo of utxos) {
        const rdata = utxo.runes.get(rune);
        if (rdata === undefined)
            continue;
        if (rdata.amount < 1)
            continue;
        selected.push(utxo);
        total += rdata.amount;
        if (total >= amount) {
            return selected;
        }
    }
    throw new Error(`insufficient funds for "${rune}" rune: ${total} < ${amount}`);
}
function filter_rune_utxos(utxos, rune) {
    let filtered = [];
    for (const utxo of utxos) {
        const rdata = utxo.runes.get(rune);
        if (rdata === undefined)
            continue;
        filtered.push(utxo);
    }
    return filtered;
}
function sum_rune_utxos(utxos, rune) {
    let total = 0;
    for (const utxo of utxos) {
        const rdata = utxo.runes.get(rune);
        if (rdata === undefined)
            continue;
        total += rdata.amount;
    }
    return total;
}

const ACCT_VIN_IDX = CONST.TXMAP.repay.acct_tx.vin.acct;
const CONN_OUT_IDX = CONST.TXMAP.repay.acct_tx.vout.conn;
const UNIT_OUT_IDX = CONST.TXMAP.repay.acct_tx.vout.unit;
const VAULT_VIN_IDX$2 = CONST.TXMAP.repay.vault_tx.vin.vault;
const CONN_VIN_IDX = CONST.TXMAP.repay.vault_tx.vin.conn;
function create_vault_repay_ctx(acct_profile, price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_account_input(acct_profile),
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'r'
    };
}
function create_vault_repay_psbt1(vault_ctx, sats_utxos, unit_utxos) {
    const { acct_utxo, repay_amount, unit_rune_id, unit_rune_lbl, unit_address, unit_postage } = vault_ctx;
    const fund_utxos = [...unit_utxos, ...sats_utxos];
    const conn_value = calc_connector_amt$1(vault_ctx, fund_utxos);
    const unit_value = sum_rune_utxos(unit_utxos, unit_rune_lbl);
    const unit_change = get_unit_change(unit_value, repay_amount);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(create_vault_fund_conn_out(vault_ctx, conn_value));
    if (unit_change !== 0) {
        pdata.addOutput(create_unit_output(unit_address, unit_postage));
        pdata.addOutput(create_unit_rune_data(unit_rune_id, unit_change, UNIT_OUT_IDX));
    }
    pdata.addInput(PSBT.create.input(acct_utxo));
    for (const utxo of fund_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    return PSBT.encode(pdata);
}
function create_vault_repay_psbt2(vault_ctx, acct_psbt) {
    const { repay_amount, vault_balance } = vault_ctx;
    const acct_pdata = PSBT.parse(acct_psbt);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, CONN_OUT_IDX);
    const vault_amount = calc_vault_amount(vault_ctx);
    Assert.ok(repay_amount <= vault_balance, 'over-repayment detected');
    const unit_balance = get_unit_balance(vault_balance, repay_amount);
    const change_amt = calc_change_amount(vault_ctx, conn_utxo.value);
    const return_data = get_vault_return_data(vault_ctx, unit_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, unit_balance, vault_amount));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    pdata.addInput(create_vault_fund_conn_vin(vault_ctx, conn_utxo));
    return PSBT.encode(pdata);
}
function create_vault_repay_req(vault_ctx, repay_psbt, vault_psbt) {
    const repay_pdata = PSBT.decode(repay_psbt);
    const repay_txhex = PSBT.get.txhex(repay_psbt);
    const repay_txid = TX.get_txid(repay_txhex);
    const vault_pdata = PSBT.decode(vault_psbt);
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(repay_pdata, {
        start_idx: ACCT_VIN_IDX + 1, post_exclude: vault_ctx.unit_postage
    });
    const unit_inputs = PSBT.extract.funding_vins(repay_pdata, {
        start_idx: ACCT_VIN_IDX + 1, post_filter: vault_ctx.unit_postage
    });
    const vault_input = PSBT.extract.script_vin(vault_pdata, VAULT_VIN_IDX$2);
    const connect_input = PSBT.extract.script_vin(vault_pdata, CONN_VIN_IDX);
    const schema = Schema.vault.req.repay_req;
    return schema.parse({ ...vault_ctx, connect_input, sats_inputs, unit_inputs, vault_input, repay_psbt, repay_txhex, repay_txid, vault_psbt, vault_txhex, vault_txid });
}
function calc_connector_amt$1(vault_config, sats_utxos) {
    const { unit_postage, tx_feerate } = vault_config;
    const fund_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const issue_cost = calc_issuance_tx_cost(sats_utxos, unit_postage, tx_feerate);
    return fund_value - issue_cost;
}
function calc_vault_amount(vault_ctx) {
    const { deposit_amount, vault_utxo } = vault_ctx;
    return vault_utxo.value + deposit_amount;
}
function calc_change_amount(vault_config, conn_value) {
    const { deposit_amount, tx_feerate } = vault_config;
    const tx_size = CONST.TXSIZE.TX.VAULT_CONN;
    const tx_cost = tx_size * tx_feerate;
    return conn_value - (deposit_amount + tx_cost);
}
function get_vault_repay_quote(vault_config, fee_options) {
    const { deposit_amount, unit_postage, tx_feerate } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_REPAY;
    const total_size = action_size + spend_size;
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + unit_postage + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
function get_vault_repay_change(vault_config, sats_utxos) {
    const conn_value = calc_connector_amt$1(vault_config, sats_utxos);
    return calc_change_amount(vault_config, conn_value);
}
var repay = {
    create_ctx: create_vault_repay_ctx,
    create_psbt1: create_vault_repay_psbt1,
    create_psbt2: create_vault_repay_psbt2,
    create_req: create_vault_repay_req,
    get_quote: get_vault_repay_quote,
    get_change: get_vault_repay_change
};

const VAULT_CON_IDX = CONST.TXMAP.repo.vault_tx.vin.conn;
const VAULT_VIN_IDX$1 = CONST.TXMAP.repo.vault_tx.vin.vault;
const MIN_VAULT_BAL = CONST.MIN_VAULT_BAL;
function create_vault_repo_ctx(price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        repo_action: 'l',
        vault_quote: price_quote,
        vault_action: 'x'
    };
}
function create_vault_repo_psbt1(liquid_ctx, vault_ctx, fund_utxos) {
    const { liquid_vaults, reserve_sats, return_unit, return_sats } = liquid_ctx;
    const vault_action = vault_ctx.repo_action;
    const conn_value = calc_connector_amt(liquid_ctx, vault_ctx, fund_utxos);
    const return_data = get_liquid_vault_return_data(liquid_ctx, vault_ctx);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    const guard_pubkey = vault_ctx.guard_pubkey;
    for (const [index, profile] of liquid_vaults.entries()) {
        const vault_pubkey = profile.vault_pk;
        const thold_hash = profile.rdata.thold_hash;
        if (return_unit > 0 && index === 0) {
            Assert.exists(thold_hash, 'thold_hash is undefined for partially liquidated vault');
            pdata.addOutput(create_vault_locked_spend_out(guard_pubkey, thold_hash, return_sats, vault_pubkey));
        }
        else {
            Assert.ok(profile.return_sats === MIN_VAULT_BAL, 'return sats must be equal to the minimum vault balance for fully liquidated vault');
            pdata.addOutput(create_vault_cleared_spend_out(guard_pubkey, MIN_VAULT_BAL, vault_pubkey));
        }
    }
    pdata.addOutput(create_vault_fund_conn_out(vault_ctx, conn_value));
    if (reserve_sats > 0) {
        pdata.addOutput(create_reserve_spend_out(liquid_ctx));
    }
    pdata.addOutput(create_vault_return({ ...return_data, vault_action }));
    for (const vault of liquid_vaults) {
        pdata.addInput(create_liquid_spend_vin(vault_ctx, vault));
    }
    for (const utxo of fund_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
function create_vault_repo_psbt2(liquid_ctx, vault_ctx, liquid_psbt) {
    const { claimed_unit, vault_count } = liquid_ctx;
    const { vault_balance } = vault_ctx;
    const acct_pdata = PSBT.parse(liquid_psbt);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, vault_count);
    const vault_amount = calc_vault_amt(liquid_ctx, vault_ctx);
    const unit_balance = claimed_unit + vault_balance;
    const change_amt = calc_change_amt(liquid_ctx, vault_ctx, conn_utxo.value);
    const return_data = get_vault_return_data(vault_ctx, unit_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, unit_balance, vault_amount));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    pdata.addInput(create_vault_fund_conn_vin(vault_ctx, conn_utxo));
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
function create_vault_repo_req(liquid_ctx, vault_ctx, liquid_psbt, vault_psbt) {
    const liquid_txhex = PSBT.get.txhex(liquid_psbt);
    const liquid_txid = TX.get_txid(liquid_txhex);
    const repo_amount = liquid_ctx.claimed_unit;
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const liquid_inputs = extract_liquid_inputs(liquid_ctx, liquid_psbt);
    const sats_inputs = extract_funding_inputs(liquid_ctx, liquid_psbt);
    const connect_input = PSBT.extract.script_vin(vault_psbt, VAULT_CON_IDX);
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX$1);
    const schema = Schema.vault.req.repo_req;
    return schema.parse({ ...vault_ctx, connect_input, liquid_inputs, liquid_psbt, liquid_txhex, liquid_txid, repo_amount, sats_inputs, vault_input, vault_psbt, vault_txhex, vault_txid });
}
function calc_connector_amt(liquid_ctx, vault_config, sats_utxos) {
    const { tx_feerate } = vault_config;
    const { claimed_sats, vault_count } = liquid_ctx;
    const funding_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const liquid_tx_cost = calc_liquidate_tx_cost(sats_utxos, tx_feerate, vault_count);
    return funding_value + claimed_sats - liquid_tx_cost;
}
function calc_vault_amt(liquid_ctx, vault_ctx) {
    const { claimed_sats } = liquid_ctx;
    const { deposit_amount, vault_utxo } = vault_ctx;
    return deposit_amount + claimed_sats + vault_utxo.value;
}
function calc_change_amt(liquid_ctx, vault_config, conn_value) {
    const { claimed_sats } = liquid_ctx;
    const { deposit_amount, tx_feerate } = vault_config;
    const base_size = CONST.TXSIZE.TX.VAULT_CONN;
    const tx_cost = base_size * tx_feerate;
    const deposit_total = deposit_amount + claimed_sats;
    return conn_value - (deposit_total + tx_cost);
}
function extract_liquid_inputs(liquid_ctx, liquid_psbt) {
    const { vault_count, liquid_vaults } = liquid_ctx;
    const liquid_inputs = [];
    for (let idx = 0; idx < vault_count; idx++) {
        const vin = PSBT.extract.hlock_vin(liquid_psbt, idx);
        const input = get_liquid_vault_input(liquid_vaults, vin);
        liquid_inputs.push(input);
    }
    return liquid_inputs;
}
function get_liquid_vault_input(vaults, utxo) {
    const utxo_pt = `${utxo.txid}:${utxo.vout}`;
    const vault = vaults.find(v => {
        const vault_pt = `${v.utxo.txid}:${v.utxo.vout}`;
        return utxo_pt === vault_pt;
    });
    Assert.exists(vault, 'vault not found for utxo ' + utxo_pt);
    return {
        repo_portion: vault.repo_portion,
        vault_pubkey: vault.vault_pk,
        ...utxo
    };
}
function extract_funding_inputs(liquid_ctx, liquid_psbt) {
    const opt = { start_idx: liquid_ctx.vault_count };
    return PSBT.extract.funding_vins(liquid_psbt, opt);
}
function get_vault_repo_quote(vault_config, vault_count, fee_options) {
    const { deposit_amount, tx_feerate } = vault_config;
    Assert.ok(tx_feerate > 0, 'tx_feerate must be greater than 0');
    Assert.ok(vault_count > 0, 'vault_count must be greater than 0');
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_LIQUID;
    const vault_size = CONST.TXSIZE.TXIO.LIQUID_VAULT;
    const total_size = action_size + spend_size + (vault_size * vault_count);
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
function get_vault_repo_change(liquid_ctx, vault_config, sats_utxos) {
    const conn_value = calc_connector_amt(liquid_ctx, vault_config, sats_utxos);
    return calc_change_amt(liquid_ctx, vault_config, conn_value);
}
var repo = {
    create_ctx: create_vault_repo_ctx,
    create_psbt1: create_vault_repo_psbt1,
    create_psbt2: create_vault_repo_psbt2,
    create_req: create_vault_repo_req,
    get_tx_quote: get_vault_repo_quote,
    get_change: get_vault_repo_change,
    liquidation: {
        get_ctx: get_liquidation_ctx,
        get_quote: get_liquidation_quote,
        get_profile: get_liquid_profile
    }
};

const VAULT_VIN_IDX = CONST.TXMAP.withdraw.vault_tx.vin.vault;
function create_vault_withdraw_ctx(price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'w'
    };
}
function create_vault_withdraw_psbt(vault_ctx) {
    const { change_amount, vault_balance, vault_utxo } = vault_ctx;
    const tx_quote = get_vault_withdraw_quote(vault_ctx);
    const vault_amount = vault_utxo.value - tx_quote.total_cost;
    const return_data = get_vault_return_data(vault_ctx, vault_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, vault_balance, vault_amount));
    pdata.addOutput(create_change_out(vault_ctx, change_amount));
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    return PSBT.encode(pdata);
}
function create_vault_withdraw_req(vault_ctx, vault_psbt) {
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX);
    const schema = Schema.vault.req.withdraw_req;
    return schema.parse({ ...vault_ctx, vault_input, vault_psbt, vault_txhex, vault_txid });
}
function get_vault_withdraw_quote(vault_config) {
    const { change_amount, tx_feerate } = vault_config;
    const total_size = CONST.TXSIZE.ACTION.VAULT_WITHDRAW;
    const tx_cost = total_size * tx_feerate;
    const total_cost = change_amount + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
var withdraw = {
    create_ctx: create_vault_withdraw_ctx,
    create_psbt: create_vault_withdraw_psbt,
    create_req: create_vault_withdraw_req,
    get_quote: get_vault_withdraw_quote
};

var VaultAPI = { deposit, open, borrow, repay, repo, withdraw };

class EventEmitter {
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

const VERBOSE = process.env['VERBOSE'] === 'true';
class WebSocketClient extends EventEmitter {
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
class SocketSubscription extends EventEmitter {
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

function unit_reserve_api (client) {
    return (request) => {
        const schema = Schema.guard.acct_reserve_config;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.UNIT_ACCT;
        const sub = client.subscribe(topic);
        sub.register(handler$6);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler$6(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.acct_reserve_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}

function unit_req_api (client) {
    return {
        reserve: unit_reserve_api(client),
    };
}

function vault_borrow_api$1 (client) {
    return (request) => {
        const schema = Schema.wallet.req.borrow_req;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.VAULT_BORROW;
        Assert.ok(config.network === client.network, 'network mismatch');
        const sub = client.subscribe(topic);
        sub.register(handler$5);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler$5(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.vault_borrow_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}

function vault_deposit_api$1 (client) {
    return (request) => {
        const schema = Schema.wallet.req.deposit_req;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.VAULT_DEPOSIT;
        Assert.ok(config.network === client.network, 'network mismatch');
        const sub = client.subscribe(topic);
        sub.register(handler$4);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler$4(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.vault_update_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}

function vault_open_api$1 (client) {
    return (request) => {
        const schema = Schema.wallet.req.open_req;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.VAULT_OPEN;
        Assert.ok(config.network === client.network, 'network mismatch');
        const sub = client.subscribe(topic);
        sub.register(handler$3);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler$3(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.vault_open_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}

function vault_repay_api$1 (client) {
    return (request) => {
        const schema = Schema.wallet.req.repay_req;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.VAULT_REPAY;
        Assert.ok(config.network === client.network, 'network mismatch');
        const sub = client.subscribe(topic);
        sub.register(handler$2);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler$2(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.vault_repay_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}

function vault_repo_api$1 (client) {
    return (request) => {
        const schema = Schema.wallet.req.repo_req;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.VAULT_REPO;
        Assert.ok(config.network === client.network, 'network mismatch');
        const sub = client.subscribe(topic);
        sub.register(handler$1);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler$1(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.vault_repo_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}

function vault_withdraw_api$1 (client) {
    return (request) => {
        const schema = Schema.wallet.req.withdraw_req;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.VAULT_WITHDRAW;
        Assert.ok(config.network === client.network, 'network mismatch');
        const sub = client.subscribe(topic);
        sub.register(handler);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.vault_update_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}

function vault_req_api (client) {
    return {
        borrow: vault_borrow_api$1(client),
        deposit: vault_deposit_api$1(client),
        open: vault_open_api$1(client),
        repay: vault_repay_api$1(client),
        repo: vault_repo_api$1(client),
        withdraw: vault_withdraw_api$1(client),
    };
}

class GuardianClient extends WebSocketClient {
    constructor(host_url, network, pubkey) {
        super(host_url);
        this._network = network;
        this._pubkey = pubkey;
    }
    get network() {
        return this._network;
    }
    get pubkey() {
        return this._pubkey;
    }
    get req() {
        return {
            unit: unit_req_api(this),
            vault: vault_req_api(this)
        };
    }
    subscribe(topic, identifier) {
        return new SocketSubscription(this, topic, identifier);
    }
}

function fetch_vault_tokens_api(client) {
    const fetch_vault_tokens = client.conn.fetch.vault_tokens(client);
    return async () => {
        const named = new Map();
        const tokens = await fetch_vault_tokens();
        for (const tkn of tokens.values()) {
            named.set(tkn.data.tag, tkn);
        }
        return named;
    };
}
function fetch_balance_api(client) {
    const fetch_balance = client.conn.fetch.balance(client);
    return async () => {
        const balance = fetch_balance();
        return balance;
    };
}
function fetch_sats_utxos_api(client) {
    const fetch_sat_utxos = client.conn.fetch.sats_utxos(client);
    return async (amount) => {
        let utxos = await fetch_sat_utxos();
        if (typeof amount === 'number') {
            utxos = select_sat_utxos(utxos, amount);
        }
        return utxos;
    };
}
function fetch_rune_utxos_api(client) {
    const fetch_rune_utxos = client.conn.fetch.rune_utxos(client);
    return async (rune, amount) => {
        const map = await fetch_rune_utxos();
        let utxos = [...map.values()];
        utxos = filter_rune_utxos(utxos, rune);
        if (typeof amount === 'number') {
            utxos = select_rune_utxos(utxos, rune, amount);
        }
        return utxos;
    };
}
var fetch_api = (client) => {
    return {
        balance: fetch_balance_api(client),
        sats_utxos: fetch_sats_utxos_api(client),
        rune_utxos: fetch_rune_utxos_api(client),
        vault_tokens: fetch_vault_tokens_api(client)
    };
};

function create_manifest(inputs) {
    const manifest = {};
    for (const [key, value] of inputs) {
        if (manifest[key] === undefined) {
            manifest[key] = [];
        }
        manifest[key].push(...value);
    }
    return manifest;
}

function verify_vault_open_config(config) {
    const schema = Schema.wallet.config.open_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault open config failed schema validation');
    }
}
function verify_vault_borrow_config(config) {
    const schema = Schema.wallet.config.borrow_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault borrow config failed schema validation');
    }
}
function verify_vault_repay_config(config) {
    const schema = Schema.wallet.config.repay_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault repay config failed schema validation');
    }
}
function verify_vault_deposit_config(config) {
    const schema = Schema.wallet.config.deposit_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault deposit config failed schema validation');
    }
}
function verify_vault_withdraw_config(config) {
    const schema = Schema.wallet.config.withdraw_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault withdraw config failed schema validation');
    }
}
function verify_vault_repo_config(config) {
    const schema = Schema.wallet.config.repo_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault repo config failed schema validation');
    }
}

function gen_seckey(secret) {
    let sbig = (secret !== undefined)
        ? Buff.hex(secret).big
        : Buff.random(32).big;
    sbig = mod(sbig, secp256k1.CURVE.n);
    return Buff.big(sbig).hex;
}
function get_pubkey(seckey) {
    const pbytes = schnorr.getPublicKey(seckey);
    return new Buff(pbytes).hex;
}
function sign_ecdsa(seckey, message) {
    const sig = secp256k1.sign(message, seckey);
    return new Buff(sig.toDERRawBytes()).hex;
}
function verify_ecdsa_pubkey(pubkey) {
    try {
        const cpub = Schema.base.cpubkey.parse(pubkey);
        secp256k1.Point.fromHex(cpub);
    }
    catch {
        throw new Error('invalid ecdsa pubkey: ' + pubkey);
    }
}
function verify_ecdsa_sig(message, pubkey, signature) {
    if (!Check.is_hex(signature)) {
        throw new Error('invalid signature encoding: ' + signature);
    }
    else if (signature.length > 146) {
        throw new Error('invalid signature length: ' + signature.length);
    }
    const sig = signature.slice(0, -2);
    if (!secp256k1.verify(sig, message, pubkey, { format: 'der' })) {
        throw new Error(`invalid ecdsa signature:\n\tmessage: ${message}\n\tpubkey: ${pubkey}\n\tsignature: ${sig}`);
    }
}
function sign_bip340(seckey, message) {
    const sig = schnorr.sign(message, seckey);
    return new Buff(sig).hex;
}
function verify_bip340_pubkey(pubkey) {
    try {
        const pub = Schema.base.xpubkey.parse(pubkey);
        secp256k1.ProjectivePoint.fromHex('02' + pub);
    }
    catch {
        throw new Error('invalid bip340 pubkey: ' + pubkey);
    }
}
function verify_bip340_sig(message, pubkey, signature) {
    if (!Check.is_hex(signature)) {
        throw new Error('invalid signature encoding: ' + signature);
    }
    else if (signature.length > 130) {
        throw new Error('invalid signature length: ' + signature.length);
    }
    const sig = signature.slice(0, 128);
    if (!schnorr.verify(sig, message, pubkey)) {
        throw new Error(`invalid bip340 signature:\n\tmessage: ${message}\n\tpubkey: ${pubkey}\n\tsignature: ${sig}`);
    }
}

function verify_account_profile(profile) {
    const schema = Schema.oracle.mint.acct_profile;
    const result = schema.safeParse(profile);
    if (!result.success) {
        console.error(result.error);
        throw new Error('account profile failed schema validation');
    }
}
function verify_price_quote(quote) {
    const schema = Schema.oracle.quote.price_quote;
    const result = schema.safeParse(quote);
    if (!result.success) {
        console.error(result.error);
        throw new Error('price quote failed schema validation');
    }
}
function verify_proto_contract(contract) {
    const schema = Schema.oracle.proto.proto_profile;
    const result = schema.safeParse(contract);
    if (!result.success) {
        console.error(result.error);
        throw new Error('proto contract failed schema validation');
    }
}
function verify_vault_profile(profile) {
    const schema = Schema.oracle.vault.profile;
    const result = schema.safeParse(profile);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault profile failed schema validation');
    }
}
function verify_signed_utxo(utxo) {
    Assert.exists(utxo.sighash, 'sighash is missing');
    const { type, key } = TX.parse_script_meta(utxo.script);
    let pubkey, signature = utxo.witness.at(0);
    Assert.exists(signature, 'signature is missing');
    if (type === 'p2sh' || type === 'p2w-pkh') {
        pubkey = utxo.witness.at(1);
        Assert.exists(pubkey, 'pubkey is missing');
        verify_ecdsa_pubkey(pubkey);
        verify_ecdsa_sig(utxo.sighash, pubkey, signature);
    }
    else if (type === 'p2tr') {
        pubkey = key.hex;
        verify_bip340_pubkey(pubkey);
        verify_bip340_sig(utxo.sighash, pubkey, signature);
    }
    else {
        throw new Error('unsupported funding input type: ' + type);
    }
}

function vault_open_ctx_api(client) {
    return (acct_profile, price_quote, vault_config) => {
        verify_account_profile(acct_profile);
        verify_price_quote(price_quote);
        verify_vault_open_config(vault_config);
        const { borrow_amount, deposit_amount, tx_feerate, vault_label } = vault_config;
        const token_data = {
            rev: 0,
            tag: vault_label,
            ver: 1
        };
        const config = {
            borrow_amount,
            deposit_amount,
            sats_address: client.acct.sats.address,
            unit_address: client.acct.runes.address,
            unit_postage: client.config.postage.unit,
            token_address: client.acct.vault.address,
            token_postage: client.config.postage.vault,
            token_data,
            tx_feerate,
            vault_pubkey: client.acct.vault.pubkey
        };
        return VaultAPI.open.create_ctx(acct_profile, price_quote, client.ctx, config);
    };
}
function vault_open_req_api(client) {
    const vin_conn_idx = CONST.TXMAP.open.vault_tx.vin.conn;
    const vin_fund_idx = CONST.TXMAP.open.acct_tx.vin.acct + 1;
    return async (ctx, utxos, batch = false) => {
        const { contract_id, network } = client;
        const utxo_inputs = utxos.map((_, idx) => vin_fund_idx + idx);
        const utxo_manifest = create_manifest([
            [client.acct.sats.address, utxo_inputs]
        ]);
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_conn_idx]]
        ]);
        let psbt1, psbt2;
        if (batch) {
            psbt1 = VaultAPI.open.create_psbt1(ctx, utxos);
            psbt2 = VaultAPI.open.create_psbt2(ctx, psbt1);
            const batch_request = [[psbt1, utxo_manifest], [psbt2, vault_manifest]];
            const signed_psbts = await client.sign.batch(batch_request);
            psbt1 = signed_psbts[0];
            psbt2 = signed_psbts[1];
        }
        else {
            psbt1 = VaultAPI.open.create_psbt1(ctx, utxos);
            psbt1 = await client.sign.psbt(psbt1, utxo_manifest);
            psbt2 = VaultAPI.open.create_psbt2(ctx, psbt1);
            psbt2 = await client.sign.psbt(psbt2, vault_manifest);
        }
        const req = VaultAPI.open.create_req(ctx, psbt1, psbt2);
        req.sats_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
function vault_open_api (client) {
    return {
        ctx: vault_open_ctx_api(client),
        quote: VaultAPI.open.get_quote,
        req: vault_open_req_api(client)
    };
}

function vault_borrow_ctx_api(client) {
    return (acct_profile, price_quote, vault_profile, vault_config) => {
        verify_account_profile(acct_profile);
        verify_price_quote(price_quote);
        verify_vault_borrow_config(vault_config);
        const { borrow_amount, deposit_amount, tx_feerate } = vault_config;
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            borrow_amount,
            deposit_amount,
            tx_feerate,
            sats_address: client.acct.sats.address,
            unit_address: client.acct.runes.address,
            unit_postage: client.config.postage.unit,
        };
        return VaultAPI.borrow.create_ctx(acct_profile, price_quote, client.ctx, vault_profile, config);
    };
}
function vault_borrow_req_api(client) {
    const vin_conn_idx = CONST.TXMAP.borrow.vault_tx.vin.conn;
    const vin_vault_idx = CONST.TXMAP.borrow.vault_tx.vin.vault;
    const vin_fund_idx = CONST.TXMAP.borrow.acct_tx.vin.acct + 1;
    return async (ctx, utxos, batch = false) => {
        const { contract_id, network } = client;
        const utxo_inputs = utxos.map((_, idx) => vin_fund_idx + idx);
        const utxo_manifest = create_manifest([
            [client.acct.sats.address, utxo_inputs]
        ]);
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_vault_idx, vin_conn_idx]]
        ]);
        let psbt1, psbt2;
        if (batch) {
            psbt1 = VaultAPI.borrow.create_psbt1(ctx, utxos);
            psbt2 = VaultAPI.borrow.create_psbt2(ctx, psbt1);
            const batch_request = [[psbt1, utxo_manifest], [psbt2, vault_manifest]];
            const signed_psbts = await client.sign.batch(batch_request);
            psbt1 = signed_psbts[0];
            psbt2 = signed_psbts[1];
        }
        else {
            psbt1 = VaultAPI.borrow.create_psbt1(ctx, utxos);
            psbt1 = await client.sign.psbt(psbt1, utxo_manifest);
            psbt2 = VaultAPI.borrow.create_psbt2(ctx, psbt1);
            psbt2 = await client.sign.psbt(psbt2, vault_manifest);
        }
        const req = VaultAPI.borrow.create_req(ctx, psbt1, psbt2);
        req.sats_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
function vault_borrow_api (client) {
    return {
        ctx: vault_borrow_ctx_api(client),
        quote: VaultAPI.borrow.get_quote,
        req: vault_borrow_req_api(client)
    };
}

function vault_repay_ctx_api(client) {
    return (acct_profile, price_quote, vault_profile, vault_config) => {
        verify_account_profile(acct_profile);
        verify_price_quote(price_quote);
        verify_vault_profile(vault_profile);
        verify_vault_repay_config(vault_config);
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            ...vault_config,
            sats_address: client.acct.sats.address,
            unit_address: client.acct.runes.address,
            unit_postage: client.config.postage.unit,
        };
        return VaultAPI.repay.create_ctx(acct_profile, price_quote, client.ctx, vault_profile, config);
    };
}
function vault_repay_req_api(client) {
    const vin_vault_idx = CONST.TXMAP.repay.vault_tx.vin.vault;
    const vin_conn_idx = CONST.TXMAP.repay.vault_tx.vin.conn;
    return async (ctx, sats_utxos, unit_utxos, batch = false) => {
        const { contract_id, network } = client;
        const unit_fund_idx = CONST.TXMAP.repay.acct_tx.vin.acct + 1;
        const unit_inputs = unit_utxos.map((_, idx) => unit_fund_idx + idx);
        const sats_fund_idx = unit_fund_idx + unit_utxos.length;
        const sats_inputs = sats_utxos.map((_, idx) => sats_fund_idx + idx);
        const utxo_manifest = create_manifest([
            [client.acct.runes.address, unit_inputs],
            [client.acct.sats.address, sats_inputs]
        ]);
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_vault_idx, vin_conn_idx]]
        ]);
        let psbt1, psbt2;
        if (batch) {
            psbt1 = VaultAPI.repay.create_psbt1(ctx, sats_utxos, unit_utxos);
            psbt2 = VaultAPI.repay.create_psbt2(ctx, psbt1);
            const batch_request = [[psbt1, utxo_manifest], [psbt2, vault_manifest]];
            const signed_psbts = await client.sign.batch(batch_request);
            psbt1 = signed_psbts[0];
            psbt2 = signed_psbts[1];
        }
        else {
            psbt1 = VaultAPI.repay.create_psbt1(ctx, sats_utxos, unit_utxos);
            psbt1 = await client.sign.psbt(psbt1, utxo_manifest);
            psbt2 = VaultAPI.repay.create_psbt2(ctx, psbt1);
            psbt2 = await client.sign.psbt(psbt2, vault_manifest);
        }
        const req = VaultAPI.repay.create_req(ctx, psbt1, psbt2);
        req.sats_inputs.forEach(verify_signed_utxo);
        req.unit_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
function vault_repay_api (client) {
    return {
        ctx: vault_repay_ctx_api(client),
        quote: VaultAPI.repay.get_quote,
        req: vault_repay_req_api(client)
    };
}

function vault_repo_ctx_api(client) {
    return (price_quote, vault_profile, vault_config) => {
        verify_price_quote(price_quote);
        verify_vault_profile(vault_profile);
        verify_vault_repo_config(vault_config);
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            ...vault_config,
            sats_address: client.acct.sats.address
        };
        return VaultAPI.repo.create_ctx(price_quote, client.ctx, vault_profile, config);
    };
}
function vault_repo_req_api(client) {
    const vin_vault_idx = CONST.TXMAP.repo.vault_tx.vin.vault;
    const vin_conn_idx = CONST.TXMAP.repo.vault_tx.vin.conn;
    return async (liquid_ctx, vault_ctx, utxos, batch = false) => {
        const { contract_id, network } = client;
        const vin_fund_idx = liquid_ctx.liquid_vaults.length;
        const utxo_inputs = utxos.map((_, idx) => vin_fund_idx + idx);
        const utxo_manifest = create_manifest([
            [client.acct.sats.address, utxo_inputs]
        ]);
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_vault_idx, vin_conn_idx]]
        ]);
        let psbt1, psbt2;
        if (batch) {
            psbt1 = VaultAPI.repo.create_psbt1(liquid_ctx, vault_ctx, utxos);
            psbt2 = VaultAPI.repo.create_psbt2(liquid_ctx, vault_ctx, psbt1);
            const batch_request = [[psbt1, utxo_manifest], [psbt2, vault_manifest]];
            const signed_psbts = await client.sign.batch(batch_request);
            psbt1 = signed_psbts[0];
            psbt2 = signed_psbts[1];
        }
        else {
            psbt1 = VaultAPI.repo.create_psbt1(liquid_ctx, vault_ctx, utxos);
            psbt1 = await client.sign.psbt(psbt1, utxo_manifest);
            psbt2 = VaultAPI.repo.create_psbt2(liquid_ctx, vault_ctx, psbt1);
            psbt2 = await client.sign.psbt(psbt2, vault_manifest);
        }
        const req = VaultAPI.repo.create_req(liquid_ctx, vault_ctx, psbt1, psbt2);
        req.sats_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
function vault_repo_api (client) {
    return {
        ctx: vault_repo_ctx_api(client),
        liquidation: VaultAPI.repo.liquidation,
        quote: VaultAPI.repo.get_tx_quote,
        req: vault_repo_req_api(client)
    };
}

function vault_deposit_ctx_api(client) {
    return (price_quote, vault_profile, vault_config) => {
        verify_price_quote(price_quote);
        verify_vault_profile(vault_profile);
        verify_vault_deposit_config(vault_config);
        const { deposit_amount, tx_feerate } = vault_config;
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            deposit_amount,
            sats_address: client.acct.sats.address,
            tx_feerate
        };
        return VaultAPI.deposit.create_ctx(price_quote, client.ctx, vault_profile, config);
    };
}
function vault_deposit_req_api(client) {
    const vin_vault_idx = CONST.TXMAP.deposit.vault_tx.vin.vault;
    const vin_fund_idx = vin_vault_idx + 1;
    return async (ctx, utxos) => {
        const { contract_id, network } = client;
        const utxo_inputs = utxos.map((_, idx) => vin_fund_idx + idx);
        const psbt_manifest = create_manifest([
            [client.acct.sats.address, utxo_inputs],
            [client.acct.vault.address, [vin_vault_idx]]
        ]);
        let psbt;
        psbt = VaultAPI.deposit.create_psbt(ctx, utxos);
        psbt = await client.sign.psbt(psbt, psbt_manifest);
        const req = VaultAPI.deposit.create_req(ctx, psbt);
        req.sats_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
function vault_deposit_api (client) {
    return {
        ctx: vault_deposit_ctx_api(client),
        quote: VaultAPI.deposit.get_quote,
        req: vault_deposit_req_api(client)
    };
}

function vault_withdraw_ctx_api(client) {
    return (price_quote, vault_profile, vault_config) => {
        verify_price_quote(price_quote);
        verify_vault_profile(vault_profile);
        verify_vault_withdraw_config(vault_config);
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            change_amount: vault_config.change_amount,
            sats_address: client.acct.sats.address,
            tx_feerate: vault_config.tx_feerate
        };
        return VaultAPI.withdraw.create_ctx(price_quote, client.ctx, vault_profile, config);
    };
}
function vault_withdraw_req_api(client) {
    const vin_vault_idx = CONST.TXMAP.withdraw.vault_tx.vin.vault;
    return async (ctx) => {
        const { contract_id, network } = client;
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_vault_idx]]
        ]);
        let psbt;
        psbt = VaultAPI.withdraw.create_psbt(ctx);
        psbt = await client.sign.psbt(psbt, vault_manifest);
        const req = VaultAPI.withdraw.create_req(ctx, psbt);
        return { ...req, contract_id, network };
    };
}
function vault_withdraw_api (client) {
    return {
        ctx: vault_withdraw_ctx_api(client),
        quote: VaultAPI.withdraw.get_quote,
        req: vault_withdraw_req_api(client)
    };
}

var vault_api = (client) => {
    return {
        open: vault_open_api(client),
        borrow: vault_borrow_api(client),
        repay: vault_repay_api(client),
        repo: vault_repo_api(client),
        deposit: vault_deposit_api(client),
        withdraw: vault_withdraw_api(client)
    };
};

class VaultWallet {
    constructor(accounts, proto_ctx, connector, config) {
        this._acct = accounts;
        this._conf = config;
        this._conn = connector;
        this._mctx = proto_ctx;
    }
    get acct() {
        return this._acct;
    }
    get config() {
        return this._conf;
    }
    get contract_id() {
        return this._mctx.master_id;
    }
    get network() {
        return this.config.network;
    }
    get conn() {
        return this._conn;
    }
    get ctx() {
        return this._mctx;
    }
    get fetch() {
        return fetch_api(this);
    }
    get sign() {
        return {
            batch: (this.conn.sign.batch !== undefined)
                ? this.conn.sign.batch(this)
                : batch_default(this),
            psbt: this.conn.sign.psbt(this),
            utxos: this.conn.sign.utxos(this)
        };
    }
    get vault() {
        return vault_api(this);
    }
}
function batch_default(client) {
    return async (psbts) => {
        const signed = [];
        for (const [psbt, manifest] of psbts) {
            const signed_psbt = await client.sign.psbt(psbt, manifest);
            signed.push(signed_psbt);
        }
        return signed;
    };
}

exports.CONST = CONST;
exports.EventEmitter = EventEmitter;
exports.GuardianSocket = GuardianClient;
exports.OracleAPI = OracleAPI;
exports.Schema = Schema;
exports.SocketSubscription = SocketSubscription;
exports.Util = index$1;
exports.Validate = index;
exports.VaultAPI = VaultAPI;
exports.VaultWallet = VaultWallet;
exports.WebSocketClient = WebSocketClient;
exports.calc_collateral_ratio = calc_collateral_ratio;
exports.calc_collateral_value = calc_collateral_value;
exports.calc_portion = calc_portion;
exports.convert_btc_to_sats = convert_btc_to_sats;
exports.convert_sats_to_btc = convert_sats_to_btc;
exports.convert_sats_to_unit = convert_sats_to_unit;
exports.convert_unit_to_sats = convert_unit_to_sats;
exports.create_proto_profile = create_proto_profile;
exports.filter_rune_utxos = filter_rune_utxos;
exports.gen_seckey = gen_seckey;
exports.get_chain_network = get_chain_network;
exports.get_pubkey = get_pubkey;
exports.get_vsize = get_vsize;
exports.select_rune_utxos = select_rune_utxos;
exports.select_sat_utxos = select_sat_utxos;
exports.sign_bip340 = sign_bip340;
exports.sign_ecdsa = sign_ecdsa;
exports.sum_rune_utxos = sum_rune_utxos;
exports.verify_account_profile = verify_account_profile;
exports.verify_bip340_pubkey = verify_bip340_pubkey;
exports.verify_bip340_sig = verify_bip340_sig;
exports.verify_ecdsa_pubkey = verify_ecdsa_pubkey;
exports.verify_ecdsa_sig = verify_ecdsa_sig;
exports.verify_price_quote = verify_price_quote;
exports.verify_proto_contract = verify_proto_contract;
exports.verify_signed_utxo = verify_signed_utxo;
exports.verify_vault_profile = verify_vault_profile;
//# sourceMappingURL=main.cjs.map
