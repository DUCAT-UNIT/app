declare const _default: {
    ACCOUNT_POSTAGE: number;
    BIGINT: {
        _0: bigint;
    };
    COIN_SIZE: number;
    FETCH_IVAL: number;
    FLOAT_PREC: number;
    BLOCK_DURATION: number;
    DEFAULT_POSTAGE: number;
    DUST_LIMIT: number;
    MIN_VAULT_BAL: number;
    TOPICS: {
        UNIT_ACCT: "/unit/reserve";
        VAULT_OPEN: "/vault/open";
        VAULT_BORROW: "/vault/borrow";
        VAULT_REPAY: "/vault/repay";
        VAULT_REPO: "/vault/repo";
        VAULT_DEPOSIT: "/vault/deposit";
        VAULT_WITHDRAW: "/vault/withdraw";
    };
    TXMAP: {
        open: {
            acct_tx: {
                vin: {
                    acct: number;
                };
                vout: {
                    acct: number;
                    conn: number;
                    unit: number;
                    stone: number;
                };
            };
            vault_tx: {
                vin: {
                    acct: number;
                    conn: number;
                };
                vout: {
                    acct: number;
                    token: number;
                    vault: number;
                    change: number;
                    vdata: number;
                };
            };
        };
        borrow: {
            acct_tx: {
                vin: {
                    acct: number;
                };
                vout: {
                    acct: number;
                    conn: number;
                    unit: number;
                    stone: number;
                };
            };
            vault_tx: {
                vin: {
                    vault: number;
                    conn: number;
                };
                vout: {
                    vault: number;
                    change: number;
                    vdata: number;
                };
            };
        };
        repay: {
            acct_tx: {
                vin: {
                    acct: number;
                };
                vout: {
                    acct: number;
                    conn: number;
                    unit: number;
                    stone: number;
                };
            };
            vault_tx: {
                vin: {
                    vault: number;
                    conn: number;
                };
                vout: {
                    vault: number;
                    change: number;
                    vdata: number;
                };
            };
        };
        deposit: {
            vault_tx: {
                vin: {
                    vault: number;
                };
                vout: {
                    vault: number;
                    change: number;
                    vdata: number;
                };
            };
        };
        withdraw: {
            vault_tx: {
                vin: {
                    vault: number;
                };
                vout: {
                    vault: number;
                    change: number;
                    vdata: number;
                };
            };
        };
        repo: {
            vault_tx: {
                vin: {
                    vault: number;
                    conn: number;
                };
                vout: {
                    vault: number;
                    change: number;
                    vdata: number;
                };
            };
        };
        liquidate: {
            vault_tx: {
                vin: {
                    vault: number;
                };
                vout: {
                    vault: number;
                    conn: number;
                    vdata: number;
                };
            };
        };
    };
    UNIT_RUNE_LBL: string;
    UNSPENDABLE_KEY: string;
    VAULT_VERSION: number;
    VDATA_MAX_SIZE: number;
    VDATA_MIN_SIZE: number;
    TXSIZE: {
        ACTION: {
            VAULT_OPEN: number;
            VAULT_BORROW: number;
            VAULT_REPAY: number;
            VAULT_LIQUID: number;
            VAULT_DEPOSIT: number;
            VAULT_WITHDRAW: number;
        };
        BASE: {
            TX: number;
            TXIN: number;
            TXOUT: number;
        };
        RETURN: {
            RUNE: number;
            VDATA: number;
        };
        WITNESS: {
            P2SH: number;
            P2WPKH: number;
            P2TR: number;
            VAULT_VTKN: number;
            VAULT_SIGN: number;
            VAULT_REPO: number;
        };
        TX: {
            GUARD_ACCOUNT: number;
            VAULT_OPEN: number;
            VAULT_CONN: number;
            VAULT_UPDATE: number;
            VAULT_LIQUID: number;
        };
        TXIN: {
            P2SH: number;
            P2WK: number;
            P2TR: number;
        };
        TXOUT: {
            P2SH: number;
            P2WK: number;
            P2TR: number;
            RUNE_CHANGE: number;
            SATS_CHANGE: number;
            VAULT_CONN: number;
        };
        TXIO: {
            GUARD_ACCOUNT: number;
            LIQUID_VAULT: number;
            VAULT_VTKN: number;
            VAULT_SPND: number;
            VAULT_CONN: number;
        };
    };
    POINTER: typeof import("./config/postmap.js").POINTER;
    POSTAGE: typeof import("./config/postmap.js").POSTAGE;
};
export default _default;
