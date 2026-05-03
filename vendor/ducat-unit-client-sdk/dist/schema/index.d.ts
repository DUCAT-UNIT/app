declare const _default: {
    base: {
        any: import("zod").ZodAny;
        base58: import("zod").ZodString;
        base64: import("zod").ZodString;
        base64url: import("zod").ZodString;
        bech32: import("zod").ZodString;
        big: import("zod").ZodBigInt;
        bool: import("zod").ZodBoolean;
        date: import("zod").ZodDate;
        hash20: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        hash32: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        hash64: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        hex: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        json: import("zod").ZodType<string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null, import("zod").ZodTypeDef, string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null>;
        literal: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodNull]>;
        num: import("zod").ZodNumber;
        pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        cpubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        xpubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        sats: import("zod").ZodBigInt;
        str: import("zod").ZodString;
        stamp: import("zod").ZodNumber;
        uint: import("zod").ZodNumber;
    };
    guard: {
        acct_reserve_config: import("zod").ZodObject<{
            unit_amount: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
            vault_pubkey: string;
            unit_amount: number;
        }, {
            vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
            vault_pubkey: string;
            unit_amount: number;
        }>;
        acct_reserve_req: import("zod").ZodObject<{
            unit_amount: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        } & {
            network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
            vault_pubkey: string;
            unit_amount: number;
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
        }, {
            vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
            vault_pubkey: string;
            unit_amount: number;
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
        }>;
        acct_reserve_res: import("zod").ZodObject<{
            mint_account: import("zod").ZodObject<{
                acct_id: import("zod").ZodString;
                balance: import("zod").ZodNumber;
                issued: import("zod").ZodNumber;
                utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                balance: number;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }, {
                acct_id: string;
                balance: number;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }>;
            vault_action: import("zod").ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
            vault_pubkey: string;
            mint_account: {
                acct_id: string;
                balance: number;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            };
        }, {
            vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
            vault_pubkey: string;
            mint_account: {
                acct_id: string;
                balance: number;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            };
        }>;
        vault_open_res: import("zod").ZodObject<{
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        } & {
            issue_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_pubkey: string;
            vault_txid: string;
            issue_txid: string;
        }, {
            vault_pubkey: string;
            vault_txid: string;
            issue_txid: string;
        }>;
        vault_borrow_res: import("zod").ZodObject<{
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        } & {
            issue_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_pubkey: string;
            vault_txid: string;
            issue_txid: string;
        }, {
            vault_pubkey: string;
            vault_txid: string;
            issue_txid: string;
        }>;
        vault_repay_res: import("zod").ZodObject<{
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        } & {
            repay_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_pubkey: string;
            vault_txid: string;
            repay_txid: string;
        }, {
            vault_pubkey: string;
            vault_txid: string;
            repay_txid: string;
        }>;
        vault_repo_res: import("zod").ZodObject<{
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        } & {
            liquid_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_pubkey: string;
            vault_txid: string;
            liquid_txid: string;
        }, {
            vault_pubkey: string;
            vault_txid: string;
            liquid_txid: string;
        }>;
        vault_update_res: import("zod").ZodObject<{
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_pubkey: string;
            vault_txid: string;
        }, {
            vault_pubkey: string;
            vault_txid: string;
        }>;
    };
    oracle: {
        contract: {
            adr_ptr: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
            group_contract: import("zod").ZodObject<{
                adr: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                adr: string;
            }, {
                adr: string;
            }>;
            point_contract: import("zod").ZodObject<{
                adr: import("zod").ZodString;
            } & {
                ptr: import("zod").ZodArray<import("zod").ZodTuple<[import("zod").ZodNumber, import("zod").ZodNumber], null>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                adr: string;
                ptr: [number, number][];
            }, {
                adr: string;
                ptr: [number, number][];
            }>;
            quorum_contract: import("zod").ZodObject<{
                adr: import("zod").ZodString;
            } & {
                pub: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thd: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                adr: string;
                pub: string;
                thd: number;
            }, {
                adr: string;
                pub: string;
                thd: number;
            }>;
            rec_ptr: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodString], null>;
            val_ptr: import("zod").ZodTuple<[import("zod").ZodNumber, import("zod").ZodNumber], null>;
        };
        mint: {
            acct_profile: import("zod").ZodObject<{
                acct_id: import("zod").ZodString;
                balance: import("zod").ZodNumber;
                issued: import("zod").ZodNumber;
                utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                balance: number;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }, {
                acct_id: string;
                balance: number;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }>;
            mint_profile: import("zod").ZodObject<{
                address: import("zod").ZodString;
                divisor: import("zod").ZodNumber;
                issued: import("zod").ZodNumber;
                label: import("zod").ZodString;
                mint_id: import("zod").ZodString;
                rune_id: import("zod").ZodString;
                symbol: import("zod").ZodString;
                utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                symbol: string;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                address: string;
                divisor: number;
                label: string;
                mint_id: string;
                rune_id: string;
            }, {
                symbol: string;
                issued: number;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                address: string;
                divisor: number;
                label: string;
                mint_id: string;
                rune_id: string;
            }>;
        };
        proto: {
            group_map: import("zod").ZodMap<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString, "many">>;
            guard_contract: import("zod").ZodObject<{
                adr: import("zod").ZodString;
            } & {
                pub: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thd: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                adr: string;
                pub: string;
                thd: number;
            }, {
                adr: string;
                pub: string;
                thd: number;
            }>;
            oracle_contract: import("zod").ZodObject<{
                adr: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                adr: string;
            }, {
                adr: string;
            }>;
            master_contract: import("zod").ZodObject<{
                groups: import("zod").ZodObject<{
                    guard: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                    oracle: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                }, "strip", import("zod").ZodTypeAny, {
                    guard: [string, number];
                    oracle: [string, number];
                }, {
                    guard: [string, number];
                    oracle: [string, number];
                }>;
                runes: import("zod").ZodObject<{
                    unit: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodString], null>;
                }, "strip", import("zod").ZodTypeAny, {
                    unit: [string, string];
                }, {
                    unit: [string, string];
                }>;
                terms: import("zod").ZodObject<{
                    repo: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                    vault: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                }, "strip", import("zod").ZodTypeAny, {
                    repo: [string, number];
                    vault: [string, number];
                }, {
                    repo: [string, number];
                    vault: [string, number];
                }>;
                ver: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                ver: number;
                groups: {
                    guard: [string, number];
                    oracle: [string, number];
                };
                runes: {
                    unit: [string, string];
                };
                terms: {
                    repo: [string, number];
                    vault: [string, number];
                };
            }, {
                ver: number;
                groups: {
                    guard: [string, number];
                    oracle: [string, number];
                };
                runes: {
                    unit: [string, string];
                };
                terms: {
                    repo: [string, number];
                    vault: [string, number];
                };
            }>;
            proto_profile: import("zod").ZodObject<{
                ctx: import("zod").ZodObject<{
                    groups: import("zod").ZodObject<{
                        guard: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                        oracle: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                    }, "strip", import("zod").ZodTypeAny, {
                        guard: [string, number];
                        oracle: [string, number];
                    }, {
                        guard: [string, number];
                        oracle: [string, number];
                    }>;
                    runes: import("zod").ZodObject<{
                        unit: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodString], null>;
                    }, "strip", import("zod").ZodTypeAny, {
                        unit: [string, string];
                    }, {
                        unit: [string, string];
                    }>;
                    terms: import("zod").ZodObject<{
                        repo: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                        vault: import("zod").ZodTuple<[import("zod").ZodString, import("zod").ZodNumber], null>;
                    }, "strip", import("zod").ZodTypeAny, {
                        repo: [string, number];
                        vault: [string, number];
                    }, {
                        repo: [string, number];
                        vault: [string, number];
                    }>;
                    ver: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    ver: number;
                    groups: {
                        guard: [string, number];
                        oracle: [string, number];
                    };
                    runes: {
                        unit: [string, string];
                    };
                    terms: {
                        repo: [string, number];
                        vault: [string, number];
                    };
                }, {
                    ver: number;
                    groups: {
                        guard: [string, number];
                        oracle: [string, number];
                    };
                    runes: {
                        unit: [string, string];
                    };
                    terms: {
                        repo: [string, number];
                        vault: [string, number];
                    };
                }>;
                groups: import("zod").ZodObject<{
                    guard: import("zod").ZodObject<{
                        adr: import("zod").ZodString;
                    } & {
                        pub: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                        thd: import("zod").ZodNumber;
                    }, "strip", import("zod").ZodTypeAny, {
                        adr: string;
                        pub: string;
                        thd: number;
                    }, {
                        adr: string;
                        pub: string;
                        thd: number;
                    }>;
                    oracle: import("zod").ZodObject<{
                        adr: import("zod").ZodString;
                    }, "strip", import("zod").ZodTypeAny, {
                        adr: string;
                    }, {
                        adr: string;
                    }>;
                }, "strip", import("zod").ZodTypeAny, {
                    guard: {
                        adr: string;
                        pub: string;
                        thd: number;
                    };
                    oracle: {
                        adr: string;
                    };
                }, {
                    guard: {
                        adr: string;
                        pub: string;
                        thd: number;
                    };
                    oracle: {
                        adr: string;
                    };
                }>;
                master_id: import("zod").ZodString;
                points: import("zod").ZodObject<{
                    repo: import("zod").ZodObject<{
                        adr: import("zod").ZodString;
                    } & {
                        ptr: import("zod").ZodArray<import("zod").ZodTuple<[import("zod").ZodNumber, import("zod").ZodNumber], null>, "many">;
                    }, "strip", import("zod").ZodTypeAny, {
                        adr: string;
                        ptr: [number, number][];
                    }, {
                        adr: string;
                        ptr: [number, number][];
                    }>;
                    vault: import("zod").ZodObject<{
                        adr: import("zod").ZodString;
                    } & {
                        ptr: import("zod").ZodArray<import("zod").ZodTuple<[import("zod").ZodNumber, import("zod").ZodNumber], null>, "many">;
                    }, "strip", import("zod").ZodTypeAny, {
                        adr: string;
                        ptr: [number, number][];
                    }, {
                        adr: string;
                        ptr: [number, number][];
                    }>;
                }, "strip", import("zod").ZodTypeAny, {
                    repo: {
                        adr: string;
                        ptr: [number, number][];
                    };
                    vault: {
                        adr: string;
                        ptr: [number, number][];
                    };
                }, {
                    repo: {
                        adr: string;
                        ptr: [number, number][];
                    };
                    vault: {
                        adr: string;
                        ptr: [number, number][];
                    };
                }>;
                runes: import("zod").ZodObject<{
                    unit: import("zod").ZodObject<{
                        address: import("zod").ZodString;
                        divisor: import("zod").ZodNumber;
                        issued: import("zod").ZodNumber;
                        label: import("zod").ZodString;
                        mint_id: import("zod").ZodString;
                        rune_id: import("zod").ZodString;
                        symbol: import("zod").ZodString;
                        utxo: import("zod").ZodObject<{
                            txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                            vout: import("zod").ZodNumber;
                            value: import("zod").ZodNumber;
                            script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                        }, "strip", import("zod").ZodTypeAny, {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        }, {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        }>;
                    }, "strip", import("zod").ZodTypeAny, {
                        symbol: string;
                        issued: number;
                        utxo: {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        };
                        address: string;
                        divisor: number;
                        label: string;
                        mint_id: string;
                        rune_id: string;
                    }, {
                        symbol: string;
                        issued: number;
                        utxo: {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        };
                        address: string;
                        divisor: number;
                        label: string;
                        mint_id: string;
                        rune_id: string;
                    }>;
                }, "strip", import("zod").ZodTypeAny, {
                    unit: {
                        symbol: string;
                        issued: number;
                        utxo: {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        };
                        address: string;
                        divisor: number;
                        label: string;
                        mint_id: string;
                        rune_id: string;
                    };
                }, {
                    unit: {
                        symbol: string;
                        issued: number;
                        utxo: {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        };
                        address: string;
                        divisor: number;
                        label: string;
                        mint_id: string;
                        rune_id: string;
                    };
                }>;
                terms: import("zod").ZodMap<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodNull]>, "many">>;
            }, "strip", import("zod").ZodTypeAny, {
                groups: {
                    guard: {
                        adr: string;
                        pub: string;
                        thd: number;
                    };
                    oracle: {
                        adr: string;
                    };
                };
                runes: {
                    unit: {
                        symbol: string;
                        issued: number;
                        utxo: {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        };
                        address: string;
                        divisor: number;
                        label: string;
                        mint_id: string;
                        rune_id: string;
                    };
                };
                terms: Map<string, (string | number | boolean | null)[]>;
                ctx: {
                    ver: number;
                    groups: {
                        guard: [string, number];
                        oracle: [string, number];
                    };
                    runes: {
                        unit: [string, string];
                    };
                    terms: {
                        repo: [string, number];
                        vault: [string, number];
                    };
                };
                master_id: string;
                points: {
                    repo: {
                        adr: string;
                        ptr: [number, number][];
                    };
                    vault: {
                        adr: string;
                        ptr: [number, number][];
                    };
                };
            }, {
                groups: {
                    guard: {
                        adr: string;
                        pub: string;
                        thd: number;
                    };
                    oracle: {
                        adr: string;
                    };
                };
                runes: {
                    unit: {
                        symbol: string;
                        issued: number;
                        utxo: {
                            value: number;
                            txid: string;
                            vout: number;
                            script: string;
                        };
                        address: string;
                        divisor: number;
                        label: string;
                        mint_id: string;
                        rune_id: string;
                    };
                };
                terms: Map<string, (string | number | boolean | null)[]>;
                ctx: {
                    ver: number;
                    groups: {
                        guard: [string, number];
                        oracle: [string, number];
                    };
                    runes: {
                        unit: [string, string];
                    };
                    terms: {
                        repo: [string, number];
                        vault: [string, number];
                    };
                };
                master_id: string;
                points: {
                    repo: {
                        adr: string;
                        ptr: [number, number][];
                    };
                    vault: {
                        adr: string;
                        ptr: [number, number][];
                    };
                };
            }>;
            term_map: import("zod").ZodMap<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodNull]>, "many">>;
            terms_contract: import("zod").ZodObject<{
                adr: import("zod").ZodString;
            } & {
                ptr: import("zod").ZodArray<import("zod").ZodTuple<[import("zod").ZodNumber, import("zod").ZodNumber], null>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                adr: string;
                ptr: [number, number][];
            }, {
                adr: string;
                ptr: [number, number][];
            }>;
        };
        quote: {
            active_quote: import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>;
            expired_quote: import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>;
            price_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>, import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>]>;
        };
        record: {
            acct_record: import("zod").ZodObject<{
                iss: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                iss: number;
            }, {
                iss: number;
            }>;
            host_record: import("zod").ZodObject<{
                pub: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                url: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                pub: string;
                url: string;
            }, {
                pub: string;
                url: string;
            }>;
            token_record: import("zod").ZodObject<{
                dat: import("zod").ZodAny;
                ref: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                ref: string;
                dat?: any;
            }, {
                ref: string;
                dat?: any;
            }>;
            val_arr: import("zod").ZodTuple<[import("zod").ZodNumber], import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodNull]>>;
        };
        vault: {
            prevout: import("zod").ZodObject<{
                rdata: import("zod").ZodDiscriminatedUnion<"is_locked", [import("zod").ZodObject<{
                    unit_balance: import("zod").ZodNumber;
                    unit_price: import("zod").ZodNumber;
                    unit_stamp: import("zod").ZodNumber;
                    vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                } & {
                    is_locked: import("zod").ZodLiteral<true>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                }, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                }>, import("zod").ZodObject<{
                    unit_balance: import("zod").ZodNumber;
                    unit_price: import("zod").ZodNumber;
                    unit_stamp: import("zod").ZodNumber;
                    vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                } & {
                    is_locked: import("zod").ZodLiteral<false>;
                }, "strip", import("zod").ZodTypeAny, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                }, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                }>]>;
                utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                rdata: {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                } | {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                };
            }, {
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                rdata: {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                } | {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                };
            }>;
            profile: import("zod").ZodObject<{
                rdata: import("zod").ZodDiscriminatedUnion<"is_locked", [import("zod").ZodObject<{
                    unit_balance: import("zod").ZodNumber;
                    unit_price: import("zod").ZodNumber;
                    unit_stamp: import("zod").ZodNumber;
                    vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                } & {
                    is_locked: import("zod").ZodLiteral<true>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                }, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                }>, import("zod").ZodObject<{
                    unit_balance: import("zod").ZodNumber;
                    unit_price: import("zod").ZodNumber;
                    unit_stamp: import("zod").ZodNumber;
                    vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                } & {
                    is_locked: import("zod").ZodLiteral<false>;
                }, "strip", import("zod").ZodTypeAny, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                }, {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                }>]>;
                utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            } & {
                acct_id: import("zod").ZodString;
                guard_pk: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                master_id: import("zod").ZodString;
                vault_pk: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                master_id: string;
                rdata: {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                } | {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                };
                guard_pk: string;
                vault_pk: string;
            }, {
                acct_id: string;
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                master_id: string;
                rdata: {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: true;
                    thold_hash: string;
                    thold_price: number;
                } | {
                    unit_balance: number;
                    unit_price: number;
                    unit_stamp: number;
                    vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                    is_locked: false;
                };
                guard_pk: string;
                vault_pk: string;
            }>;
            record: import("zod").ZodObject<{
                gpk: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                mid: import("zod").ZodString;
                vpk: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                ver: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                ver: number;
                gpk: string;
                mid: string;
                vpk: string;
            }, {
                ver: number;
                gpk: string;
                mid: string;
                vpk: string;
            }>;
            token: import("zod").ZodObject<{
                data: import("zod").ZodObject<{
                    rev: import("zod").ZodNumber;
                    tag: import("zod").ZodString;
                    ver: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    rev: number;
                    tag: string;
                    ver: number;
                }, {
                    rev: number;
                    tag: string;
                    ver: number;
                }>;
                ptr: import("zod").ZodNumber;
                utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                vid: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                ptr: number;
                data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                vid: string;
            }, {
                utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                ptr: number;
                data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                vid: string;
            }>;
        };
    };
    ord: {
        inscribe_id: import("zod").ZodString;
        outpoint: import("zod").ZodString;
        rune_id: import("zod").ZodString;
        satpoint: import("zod").ZodString;
    };
    proto: {
        liquid_terms: import("zod").ZodObject<{
            liquidation_thold: import("zod").ZodNumber;
            reserve_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            reserve_sats_min: import("zod").ZodNumber;
            liquid_tax_rate: import("zod").ZodNumber;
            subsidy_inc_rate: import("zod").ZodNumber;
            subsidy_inc_thold: import("zod").ZodNumber;
        }, "strip", import("zod").ZodTypeAny, {
            liquidation_thold: number;
            reserve_pubkey: string;
            reserve_sats_min: number;
            liquid_tax_rate: number;
            subsidy_inc_rate: number;
            subsidy_inc_thold: number;
        }, {
            liquidation_thold: number;
            reserve_pubkey: string;
            reserve_sats_min: number;
            liquid_tax_rate: number;
            subsidy_inc_rate: number;
            subsidy_inc_thold: number;
        }>;
        vault_terms: import("zod").ZodObject<{
            collateral_min: import("zod").ZodNumber;
            internal_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            sats_balance_min: import("zod").ZodNumber;
            unit_balance_min: import("zod").ZodNumber;
        }, "strip", import("zod").ZodTypeAny, {
            collateral_min: number;
            internal_key: string;
            sats_balance_min: number;
            unit_balance_min: number;
        }, {
            collateral_min: number;
            internal_key: string;
            sats_balance_min: number;
            unit_balance_min: number;
        }>;
        vault_action: import("zod").ZodUnion<[import("zod").ZodLiteral<"open">, import("zod").ZodLiteral<"borrow">, import("zod").ZodLiteral<"repay">, import("zod").ZodLiteral<"deposit">, import("zod").ZodLiteral<"withdraw">, import("zod").ZodLiteral<"repo">, import("zod").ZodLiteral<"liquidate">]>;
        vault_flag: import("zod").ZodUnion<[import("zod").ZodLiteral<"o">, import("zod").ZodLiteral<"b">, import("zod").ZodLiteral<"r">, import("zod").ZodLiteral<"d">, import("zod").ZodLiteral<"w">, import("zod").ZodLiteral<"x">, import("zod").ZodLiteral<"l">]>;
    };
    tx: {
        btc_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
        network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        tx: {
            version: import("zod").ZodNumber;
            vin: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                prevout: import("zod").ZodObject<{
                    value: import("zod").ZodNumber;
                    scriptPubKey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    scriptPubKey: string;
                }, {
                    value: number;
                    scriptPubKey: string;
                }>;
                script_sig: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">>;
                sequence: import("zod").ZodOptional<import("zod").ZodNumber>;
                witness: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">>;
            }, "strip", import("zod").ZodTypeAny, {
                txid: string;
                vout: number;
                prevout: {
                    value: number;
                    scriptPubKey: string;
                };
                script_sig?: string[] | undefined;
                sequence?: number | undefined;
                witness?: string[] | undefined;
            }, {
                txid: string;
                vout: number;
                prevout: {
                    value: number;
                    scriptPubKey: string;
                };
                script_sig?: string[] | undefined;
                sequence?: number | undefined;
                witness?: string[] | undefined;
            }>, "many">;
            vout: import("zod").ZodArray<import("zod").ZodObject<{
                value: import("zod").ZodNumber;
                scriptPubKey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                scriptPubKey: string;
            }, {
                value: number;
                scriptPubKey: string;
            }>, "many">;
            locktime: import("zod").ZodNumber;
        };
        txin: import("zod").ZodObject<{
            txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vout: import("zod").ZodNumber;
            prevout: import("zod").ZodObject<{
                value: import("zod").ZodNumber;
                scriptPubKey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                scriptPubKey: string;
            }, {
                value: number;
                scriptPubKey: string;
            }>;
            script_sig: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">>;
            sequence: import("zod").ZodOptional<import("zod").ZodNumber>;
            witness: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">>;
        }, "strip", import("zod").ZodTypeAny, {
            txid: string;
            vout: number;
            prevout: {
                value: number;
                scriptPubKey: string;
            };
            script_sig?: string[] | undefined;
            sequence?: number | undefined;
            witness?: string[] | undefined;
        }, {
            txid: string;
            vout: number;
            prevout: {
                value: number;
                scriptPubKey: string;
            };
            script_sig?: string[] | undefined;
            sequence?: number | undefined;
            witness?: string[] | undefined;
        }>;
        txout: import("zod").ZodObject<{
            value: import("zod").ZodNumber;
            scriptPubKey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            value: number;
            scriptPubKey: string;
        }, {
            value: number;
            scriptPubKey: string;
        }>;
        utxo: import("zod").ZodObject<{
            txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vout: import("zod").ZodNumber;
            value: import("zod").ZodNumber;
            script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        }, "strip", import("zod").ZodTypeAny, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }>;
        signed_utxo: import("zod").ZodObject<{
            txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vout: import("zod").ZodNumber;
            value: import("zod").ZodNumber;
            script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        } & {
            sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
            witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
        }, "strip", import("zod").ZodTypeAny, {
            value: number;
            txid: string;
            vout: number;
            witness: string[];
            script: string;
            sighash?: string | undefined;
        }, {
            value: number;
            txid: string;
            vout: number;
            witness: string[];
            script: string;
            sighash?: string | undefined;
        }>;
    };
    vault: {
        base: {
            actions: import("zod").ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
            flags: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            open_witness: import("zod").ZodTuple<[import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>, import("zod").ZodEffects<import("zod").ZodString, string, string>, import("zod").ZodEffects<import("zod").ZodString, string, string>], null>;
            return_data: import("zod").ZodDiscriminatedUnion<"is_locked", [import("zod").ZodObject<{
                unit_balance: import("zod").ZodNumber;
                unit_price: import("zod").ZodNumber;
                unit_stamp: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            } & {
                is_locked: import("zod").ZodLiteral<true>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                unit_balance: number;
                unit_price: number;
                unit_stamp: number;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                is_locked: true;
                thold_hash: string;
                thold_price: number;
            }, {
                unit_balance: number;
                unit_price: number;
                unit_stamp: number;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                is_locked: true;
                thold_hash: string;
                thold_price: number;
            }>, import("zod").ZodObject<{
                unit_balance: import("zod").ZodNumber;
                unit_price: import("zod").ZodNumber;
                unit_stamp: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            } & {
                is_locked: import("zod").ZodLiteral<false>;
            }, "strip", import("zod").ZodTypeAny, {
                unit_balance: number;
                unit_price: number;
                unit_stamp: number;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                is_locked: false;
            }, {
                unit_balance: number;
                unit_price: number;
                unit_stamp: number;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                is_locked: false;
            }>]>;
            token_data: import("zod").ZodObject<{
                rev: import("zod").ZodNumber;
                tag: import("zod").ZodString;
                ver: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                rev: number;
                tag: string;
                ver: number;
            }, {
                rev: number;
                tag: string;
                ver: number;
            }>;
            update_witness: import("zod").ZodTuple<[import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>, import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>, import("zod").ZodEffects<import("zod").ZodString, string, string>, import("zod").ZodEffects<import("zod").ZodString, string, string>], null>;
        };
        config: {
            borrow_config: import("zod").ZodObject<{
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
            } & {
                borrow_amount: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
            }, {
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
            }>;
            deposit_config: import("zod").ZodObject<{
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
            } & {
                deposit_amount: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
            }, {
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
            }>;
            open_config: import("zod").ZodObject<{
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
            } & {
                borrow_amount: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                token_address: import("zod").ZodString;
                token_data: import("zod").ZodObject<{
                    rev: import("zod").ZodNumber;
                    tag: import("zod").ZodString;
                    ver: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    rev: number;
                    tag: string;
                    ver: number;
                }, {
                    rev: number;
                    tag: string;
                    ver: number;
                }>;
                token_postage: import("zod").ZodNumber;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
            }, {
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
            }>;
            repay_config: import("zod").ZodObject<{
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
            } & {
                deposit_amount: import("zod").ZodNumber;
                repay_amount: import("zod").ZodNumber;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                repay_amount: number;
            }, {
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                repay_amount: number;
            }>;
            repo_config: import("zod").ZodObject<{
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
            } & {
                deposit_amount: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
            }, {
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
            }>;
            withdraw_config: import("zod").ZodObject<{
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
            } & {
                change_amount: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                sats_address: string;
                tx_feerate: number;
                change_amount: number;
            }, {
                sats_address: string;
                tx_feerate: number;
                change_amount: number;
            }>;
        };
        ctx: {
            open_ctx: import("zod").ZodObject<{
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_quote: import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>;
            } & {
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                borrow_amount: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                token_address: import("zod").ZodString;
                token_data: import("zod").ZodObject<{
                    rev: import("zod").ZodNumber;
                    tag: import("zod").ZodString;
                    ver: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    rev: number;
                    tag: string;
                    ver: number;
                }, {
                    rev: number;
                    tag: string;
                    ver: number;
                }>;
                token_postage: import("zod").ZodNumber;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            } & {
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            } & {
                contract_id: import("zod").ZodString;
                guard_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                unit_rune_id: import("zod").ZodString;
                unit_rune_lbl: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }>;
            borrow_ctx: import("zod").ZodObject<{
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_quote: import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>;
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                borrow_amount: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                contract_id: import("zod").ZodString;
                guard_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                unit_rune_id: import("zod").ZodString;
                unit_rune_lbl: import("zod").ZodString;
            } & {
                vault_balance: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }>;
            repay_ctx: import("zod").ZodObject<{
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_quote: import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>;
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                repay_amount: import("zod").ZodNumber;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                contract_id: import("zod").ZodString;
                guard_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                unit_rune_id: import("zod").ZodString;
                unit_rune_lbl: import("zod").ZodString;
            } & {
                vault_balance: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                repay_amount: number;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                repay_amount: number;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }>;
            repo_ctx: import("zod").ZodObject<{
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_quote: import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>;
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                contract_id: import("zod").ZodString;
                guard_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                unit_rune_id: import("zod").ZodString;
                unit_rune_lbl: import("zod").ZodString;
            } & {
                vault_balance: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }>;
            deposit_ctx: import("zod").ZodObject<{
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_quote: import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>;
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                contract_id: import("zod").ZodString;
                guard_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                unit_rune_id: import("zod").ZodString;
                unit_rune_lbl: import("zod").ZodString;
            } & {
                vault_balance: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }>;
            withdraw_ctx: import("zod").ZodObject<{
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_quote: import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>;
                sats_address: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                change_amount: import("zod").ZodNumber;
                contract_id: import("zod").ZodString;
                guard_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                unit_rune_id: import("zod").ZodString;
                unit_rune_lbl: import("zod").ZodString;
            } & {
                vault_balance: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                vault_pubkey: string;
                change_amount: number;
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                vault_pubkey: string;
                change_amount: number;
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                };
            }>;
        };
        input: {
            acct_input: import("zod").ZodObject<{
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }, {
                acct_id: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }>;
            liquid_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            } & {
                repo_portion: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                vault_pubkey: string;
                repo_portion: number;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                vault_pubkey: string;
                repo_portion: number;
                sighash?: string | undefined;
            }>;
            proto_input: import("zod").ZodObject<{
                contract_id: import("zod").ZodString;
                guard_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                unit_rune_id: import("zod").ZodString;
                unit_rune_lbl: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
            }, {
                contract_id: string;
                guard_pubkey: string;
                unit_rune_id: string;
                unit_rune_lbl: string;
            }>;
            vault_input: import("zod").ZodObject<{
                vault_balance: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_pubkey: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }, {
                vault_pubkey: string;
                vault_balance: number;
                vault_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
            }>;
        };
        req: {
            borrow_req: import("zod").ZodObject<{
                contract_id: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
            } & {
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                borrow_amount: import("zod").ZodNumber;
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                deposit_amount: import("zod").ZodNumber;
                issue_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                issue_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                issue_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }>;
            deposit_req: import("zod").ZodObject<{
                contract_id: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
            } & {
                deposit_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }>;
            open_req: import("zod").ZodObject<{
                contract_id: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
            } & {
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                borrow_amount: import("zod").ZodNumber;
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                deposit_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                token_address: import("zod").ZodString;
                token_data: import("zod").ZodObject<{
                    rev: import("zod").ZodNumber;
                    tag: import("zod").ZodString;
                    ver: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    rev: number;
                    tag: string;
                    ver: number;
                }, {
                    rev: number;
                    tag: string;
                    ver: number;
                }>;
                token_postage: import("zod").ZodNumber;
                issue_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                issue_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                issue_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }>;
            repay_req: import("zod").ZodObject<{
                contract_id: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
            } & {
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                repay_amount: import("zod").ZodNumber;
                repay_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                repay_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                repay_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                repay_amount: number;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                repay_txid: string;
                unit_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                repay_psbt?: string | undefined;
                repay_txhex?: string | undefined;
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                repay_amount: number;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                repay_txid: string;
                unit_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                repay_psbt?: string | undefined;
                repay_txhex?: string | undefined;
            }>;
            repo_req: import("zod").ZodObject<{
                contract_id: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
            } & {
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                deposit_amount: import("zod").ZodNumber;
                liquid_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                liquid_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                liquid_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                liquid_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                } & {
                    repo_portion: import("zod").ZodNumber;
                    vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }>, "many">;
                repo_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                liquid_txid: string;
                liquid_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }[];
                repo_amount: number;
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                liquid_psbt?: string | undefined;
                liquid_txhex?: string | undefined;
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                liquid_txid: string;
                liquid_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }[];
                repo_amount: number;
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                liquid_psbt?: string | undefined;
                liquid_txhex?: string | undefined;
            }>;
            withdraw_req: import("zod").ZodObject<{
                contract_id: import("zod").ZodString;
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
            } & {
                change_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                vault_pubkey: string;
                change_amount: number;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                vault_pubkey: string;
                change_amount: number;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }>;
        };
    };
    wallet: {
        config: {
            open_config: import("zod").ZodObject<{
                borrow_amount: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                tx_feerate: import("zod").ZodNumber;
                vault_label: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                vault_label: string;
            }, {
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                vault_label: string;
            }>;
            borrow_config: import("zod").ZodObject<{
                borrow_amount: import("zod").ZodNumber;
                deposit_amount: import("zod").ZodNumber;
                tx_feerate: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
            }, {
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
            }>;
            repay_config: import("zod").ZodObject<{
                deposit_amount: import("zod").ZodNumber;
                repay_amount: import("zod").ZodNumber;
                tx_feerate: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                tx_feerate: number;
                deposit_amount: number;
                repay_amount: number;
            }, {
                tx_feerate: number;
                deposit_amount: number;
                repay_amount: number;
            }>;
            repo_config: import("zod").ZodObject<{
                deposit_amount: import("zod").ZodNumber;
                tx_feerate: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                tx_feerate: number;
                deposit_amount: number;
            }, {
                tx_feerate: number;
                deposit_amount: number;
            }>;
            deposit_config: import("zod").ZodObject<{
                deposit_amount: import("zod").ZodNumber;
                tx_feerate: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                tx_feerate: number;
                deposit_amount: number;
            }, {
                tx_feerate: number;
                deposit_amount: number;
            }>;
            withdraw_config: import("zod").ZodObject<{
                change_amount: import("zod").ZodNumber;
                tx_feerate: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                tx_feerate: number;
                change_amount: number;
            }, {
                tx_feerate: number;
                change_amount: number;
            }>;
        };
        req: {
            open_req: import("zod").ZodObject<{
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                borrow_amount: import("zod").ZodNumber;
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                deposit_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                token_address: import("zod").ZodString;
                token_data: import("zod").ZodObject<{
                    rev: import("zod").ZodNumber;
                    tag: import("zod").ZodString;
                    ver: import("zod").ZodNumber;
                }, "strip", import("zod").ZodTypeAny, {
                    rev: number;
                    tag: string;
                    ver: number;
                }, {
                    rev: number;
                    tag: string;
                    ver: number;
                }>;
                token_postage: import("zod").ZodNumber;
                issue_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                issue_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                issue_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                contract_id: import("zod").ZodString;
                network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                token_address: string;
                token_data: {
                    rev: number;
                    tag: string;
                    ver: number;
                };
                token_postage: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }>;
            borrow_req: import("zod").ZodObject<{
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                borrow_amount: import("zod").ZodNumber;
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                deposit_amount: import("zod").ZodNumber;
                issue_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                issue_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                issue_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            } & {
                contract_id: import("zod").ZodString;
                network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                borrow_amount: number;
                deposit_amount: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                issue_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                issue_psbt?: string | undefined;
                issue_txhex?: string | undefined;
            }>;
            repay_req: import("zod").ZodObject<{
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
                acct_id: import("zod").ZodString;
                acct_utxo: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                }>;
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                repay_amount: import("zod").ZodNumber;
                repay_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                repay_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                repay_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                unit_address: import("zod").ZodString;
                unit_postage: import("zod").ZodNumber;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            } & {
                contract_id: import("zod").ZodString;
                network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
            }, "strip", import("zod").ZodTypeAny, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                repay_amount: number;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                repay_txid: string;
                unit_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                repay_psbt?: string | undefined;
                repay_txhex?: string | undefined;
            }, {
                acct_id: string;
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                unit_address: string;
                unit_postage: number;
                vault_pubkey: string;
                repay_amount: number;
                acct_utxo: {
                    value: number;
                    txid: string;
                    vout: number;
                    script: string;
                };
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                repay_txid: string;
                unit_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                repay_psbt?: string | undefined;
                repay_txhex?: string | undefined;
            }>;
            repo_req: import("zod").ZodObject<{
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
                connect_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
                deposit_amount: import("zod").ZodNumber;
                liquid_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                liquid_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                liquid_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                liquid_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                } & {
                    repo_portion: import("zod").ZodNumber;
                    vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }>, "many">;
                repo_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            } & {
                contract_id: import("zod").ZodString;
                network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                liquid_txid: string;
                liquid_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }[];
                repo_amount: number;
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                liquid_psbt?: string | undefined;
                liquid_txhex?: string | undefined;
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                connect_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                liquid_txid: string;
                liquid_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    vault_pubkey: string;
                    repo_portion: number;
                    sighash?: string | undefined;
                }[];
                repo_amount: number;
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
                liquid_psbt?: string | undefined;
                liquid_txhex?: string | undefined;
            }>;
            deposit_req: import("zod").ZodObject<{
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
                deposit_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>, "many">;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            } & {
                contract_id: import("zod").ZodString;
                network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                deposit_amount: number;
                vault_pubkey: string;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                sats_inputs: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }[];
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }>;
            withdraw_req: import("zod").ZodObject<{
                tx_feerate: import("zod").ZodNumber;
                vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
                vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
                vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
                vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<false>;
                    event_origin: import("zod").ZodNull;
                    event_price: import("zod").ZodNull;
                    event_stamp: import("zod").ZodNull;
                    thold_key: import("zod").ZodNull;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                }>, import("zod").ZodObject<{
                    event_type: import("zod").ZodString;
                    latest_origin: import("zod").ZodString;
                    latest_price: import("zod").ZodNumber;
                    latest_stamp: import("zod").ZodNumber;
                    quote_origin: import("zod").ZodString;
                    quote_price: import("zod").ZodNumber;
                    quote_stamp: import("zod").ZodNumber;
                    req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    srv_network: import("zod").ZodString;
                    srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                    thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    thold_price: import("zod").ZodNumber;
                } & {
                    is_expired: import("zod").ZodLiteral<true>;
                    event_origin: import("zod").ZodString;
                    event_price: import("zod").ZodNumber;
                    event_stamp: import("zod").ZodNumber;
                    thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                }, "strip", import("zod").ZodTypeAny, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }, {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                }>]>;
                change_amount: import("zod").ZodNumber;
                sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
                vault_input: import("zod").ZodObject<{
                    txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                    vout: import("zod").ZodNumber;
                    value: import("zod").ZodNumber;
                    script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                } & {
                    sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                    witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
                }, "strip", import("zod").ZodTypeAny, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }, {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                }>;
            } & {
                contract_id: import("zod").ZodString;
                network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
            }, "strip", import("zod").ZodTypeAny, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                vault_pubkey: string;
                change_amount: number;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }, {
                vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
                sats_address: string;
                tx_feerate: number;
                vault_pubkey: string;
                change_amount: number;
                contract_id: string;
                vault_quote: {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: null;
                    event_price: null;
                    event_stamp: null;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: null;
                    is_expired: false;
                } | {
                    thold_hash: string;
                    thold_price: number;
                    event_origin: string;
                    event_price: number;
                    event_stamp: number;
                    event_type: string;
                    latest_origin: string;
                    latest_price: number;
                    latest_stamp: number;
                    quote_origin: string;
                    quote_price: number;
                    quote_stamp: number;
                    req_id: string;
                    req_sig: string;
                    srv_network: string;
                    srv_pubkey: string;
                    thold_key: string;
                    is_expired: true;
                };
                vault_txid: string;
                vault_input: {
                    value: number;
                    txid: string;
                    vout: number;
                    witness: string[];
                    script: string;
                    sighash?: string | undefined;
                };
                network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
                vault_psbt?: string | undefined;
                vault_txhex?: string | undefined;
            }>;
        };
    };
    ws: {
        data: import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodType<string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null, import("zod").ZodTypeDef, string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null>>, import("zod").ZodArray<import("zod").ZodType<string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null, import("zod").ZodTypeDef, string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null>, "many">, import("zod").ZodString]>;
        envelope: import("zod").ZodTuple<[import("zod").ZodUnion<[import("zod").ZodLiteral<"req">, import("zod").ZodLiteral<"res">, import("zod").ZodLiteral<"info">, import("zod").ZodLiteral<"rej">]>, import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>, import("zod").ZodString, import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodType<string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null, import("zod").ZodTypeDef, string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null>>, import("zod").ZodArray<import("zod").ZodType<string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null, import("zod").ZodTypeDef, string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | (string | number | boolean | any | any | null)[] | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | (string | number | boolean | any | any | null)[] | null;
        } | (string | number | boolean | {
            [key: string]: string | number | boolean | any | any | null;
        } | any | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null)[] | null>, "many">, import("zod").ZodString]>], null>;
        identifier: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
        topic: import("zod").ZodString;
        type: import("zod").ZodUnion<[import("zod").ZodLiteral<"req">, import("zod").ZodLiteral<"res">, import("zod").ZodLiteral<"info">, import("zod").ZodLiteral<"rej">]>;
    };
};
export default _default;
