import { z } from 'zod';
declare const _default: {
    btc_address: z.ZodUnion<[z.ZodString, z.ZodString]>;
    network: z.ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
    tx: {
        version: z.ZodNumber;
        vin: z.ZodArray<z.ZodObject<{
            txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            vout: z.ZodNumber;
            prevout: z.ZodObject<{
                value: z.ZodNumber;
                scriptPubKey: z.ZodEffects<z.ZodString, string, string>;
            }, "strip", z.ZodTypeAny, {
                value: number;
                scriptPubKey: string;
            }, {
                value: number;
                scriptPubKey: string;
            }>;
            script_sig: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
            sequence: z.ZodOptional<z.ZodNumber>;
            witness: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
        }, "strip", z.ZodTypeAny, {
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
        vout: z.ZodArray<z.ZodObject<{
            value: z.ZodNumber;
            scriptPubKey: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            value: number;
            scriptPubKey: string;
        }, {
            value: number;
            scriptPubKey: string;
        }>, "many">;
        locktime: z.ZodNumber;
    };
    txin: z.ZodObject<{
        txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vout: z.ZodNumber;
        prevout: z.ZodObject<{
            value: z.ZodNumber;
            scriptPubKey: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            value: number;
            scriptPubKey: string;
        }, {
            value: number;
            scriptPubKey: string;
        }>;
        script_sig: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
        sequence: z.ZodOptional<z.ZodNumber>;
        witness: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
    }, "strip", z.ZodTypeAny, {
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
    txout: z.ZodObject<{
        value: z.ZodNumber;
        scriptPubKey: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        scriptPubKey: string;
    }, {
        value: number;
        scriptPubKey: string;
    }>;
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
    signed_utxo: z.ZodObject<{
        txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vout: z.ZodNumber;
        value: z.ZodNumber;
        script: z.ZodEffects<z.ZodString, string, string>;
    } & {
        sighash: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
        witness: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    }, "strip", z.ZodTypeAny, {
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
export default _default;
