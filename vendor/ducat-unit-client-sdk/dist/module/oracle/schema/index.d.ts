declare const _default: {
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
export default _default;
