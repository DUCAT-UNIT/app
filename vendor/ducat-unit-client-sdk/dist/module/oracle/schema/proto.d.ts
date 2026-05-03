import { z } from 'zod';
declare const _default: {
    group_map: z.ZodMap<z.ZodString, z.ZodArray<z.ZodString, "many">>;
    guard_contract: z.ZodObject<{
        adr: z.ZodString;
    } & {
        pub: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        thd: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        adr: string;
        pub: string;
        thd: number;
    }, {
        adr: string;
        pub: string;
        thd: number;
    }>;
    oracle_contract: z.ZodObject<{
        adr: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        adr: string;
    }, {
        adr: string;
    }>;
    master_contract: z.ZodObject<{
        groups: z.ZodObject<{
            guard: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
            oracle: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
        }, "strip", z.ZodTypeAny, {
            guard: [string, number];
            oracle: [string, number];
        }, {
            guard: [string, number];
            oracle: [string, number];
        }>;
        runes: z.ZodObject<{
            unit: z.ZodTuple<[z.ZodString, z.ZodString], null>;
        }, "strip", z.ZodTypeAny, {
            unit: [string, string];
        }, {
            unit: [string, string];
        }>;
        terms: z.ZodObject<{
            repo: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
            vault: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
        }, "strip", z.ZodTypeAny, {
            repo: [string, number];
            vault: [string, number];
        }, {
            repo: [string, number];
            vault: [string, number];
        }>;
        ver: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
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
    proto_profile: z.ZodObject<{
        ctx: z.ZodObject<{
            groups: z.ZodObject<{
                guard: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
                oracle: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
            }, "strip", z.ZodTypeAny, {
                guard: [string, number];
                oracle: [string, number];
            }, {
                guard: [string, number];
                oracle: [string, number];
            }>;
            runes: z.ZodObject<{
                unit: z.ZodTuple<[z.ZodString, z.ZodString], null>;
            }, "strip", z.ZodTypeAny, {
                unit: [string, string];
            }, {
                unit: [string, string];
            }>;
            terms: z.ZodObject<{
                repo: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
                vault: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
            }, "strip", z.ZodTypeAny, {
                repo: [string, number];
                vault: [string, number];
            }, {
                repo: [string, number];
                vault: [string, number];
            }>;
            ver: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
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
        groups: z.ZodObject<{
            guard: z.ZodObject<{
                adr: z.ZodString;
            } & {
                pub: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
                thd: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                adr: string;
                pub: string;
                thd: number;
            }, {
                adr: string;
                pub: string;
                thd: number;
            }>;
            oracle: z.ZodObject<{
                adr: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                adr: string;
            }, {
                adr: string;
            }>;
        }, "strip", z.ZodTypeAny, {
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
        master_id: z.ZodString;
        points: z.ZodObject<{
            repo: z.ZodObject<{
                adr: z.ZodString;
            } & {
                ptr: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, "many">;
            }, "strip", z.ZodTypeAny, {
                adr: string;
                ptr: [number, number][];
            }, {
                adr: string;
                ptr: [number, number][];
            }>;
            vault: z.ZodObject<{
                adr: z.ZodString;
            } & {
                ptr: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, "many">;
            }, "strip", z.ZodTypeAny, {
                adr: string;
                ptr: [number, number][];
            }, {
                adr: string;
                ptr: [number, number][];
            }>;
        }, "strip", z.ZodTypeAny, {
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
        runes: z.ZodObject<{
            unit: z.ZodObject<{
                address: z.ZodString;
                divisor: z.ZodNumber;
                issued: z.ZodNumber;
                label: z.ZodString;
                mint_id: z.ZodString;
                rune_id: z.ZodString;
                symbol: z.ZodString;
                utxo: z.ZodObject<{
                    txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
                    vout: z.ZodNumber;
                    value: z.ZodNumber;
                    script: z.ZodEffects<z.ZodString, string, string>;
                }, "strip", z.ZodTypeAny, {
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
            }, "strip", z.ZodTypeAny, {
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
        }, "strip", z.ZodTypeAny, {
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
        terms: z.ZodMap<z.ZodString, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, "many">>;
    }, "strip", z.ZodTypeAny, {
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
    term_map: z.ZodMap<z.ZodString, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, "many">>;
    terms_contract: z.ZodObject<{
        adr: z.ZodString;
    } & {
        ptr: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, "many">;
    }, "strip", z.ZodTypeAny, {
        adr: string;
        ptr: [number, number][];
    }, {
        adr: string;
        ptr: [number, number][];
    }>;
};
export default _default;
