import { z } from 'zod';
declare const _default: {
    acct_input: z.ZodObject<{
        acct_id: z.ZodString;
        acct_utxo: z.ZodObject<{
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
    liquid_input: z.ZodObject<{
        txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vout: z.ZodNumber;
        value: z.ZodNumber;
        script: z.ZodEffects<z.ZodString, string, string>;
    } & {
        sighash: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
        witness: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    } & {
        repo_portion: z.ZodNumber;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
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
    proto_input: z.ZodObject<{
        contract_id: z.ZodString;
        guard_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        unit_rune_id: z.ZodString;
        unit_rune_lbl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
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
    vault_input: z.ZodObject<{
        vault_balance: z.ZodNumber;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vault_utxo: z.ZodObject<{
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
export default _default;
