import { z } from 'zod';
declare const _default: {
    acct_reserve_config: z.ZodObject<{
        unit_amount: z.ZodNumber;
        vault_action: z.ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
        vault_pubkey: string;
        unit_amount: number;
    }, {
        vault_action: "open" | "borrow" | "repay" | "deposit" | "withdraw" | "repo" | "liquidate";
        vault_pubkey: string;
        unit_amount: number;
    }>;
    acct_reserve_req: z.ZodObject<{
        unit_amount: z.ZodNumber;
        vault_action: z.ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    } & {
        network: z.ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
    }, "strip", z.ZodTypeAny, {
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
    acct_reserve_res: z.ZodObject<{
        mint_account: z.ZodObject<{
            acct_id: z.ZodString;
            balance: z.ZodNumber;
            issued: z.ZodNumber;
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
        vault_action: z.ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
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
    vault_open_res: z.ZodObject<{
        vault_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    } & {
        issue_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        vault_pubkey: string;
        vault_txid: string;
        issue_txid: string;
    }, {
        vault_pubkey: string;
        vault_txid: string;
        issue_txid: string;
    }>;
    vault_borrow_res: z.ZodObject<{
        vault_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    } & {
        issue_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        vault_pubkey: string;
        vault_txid: string;
        issue_txid: string;
    }, {
        vault_pubkey: string;
        vault_txid: string;
        issue_txid: string;
    }>;
    vault_repay_res: z.ZodObject<{
        vault_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    } & {
        repay_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        vault_pubkey: string;
        vault_txid: string;
        repay_txid: string;
    }, {
        vault_pubkey: string;
        vault_txid: string;
        repay_txid: string;
    }>;
    vault_repo_res: z.ZodObject<{
        vault_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    } & {
        liquid_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        vault_pubkey: string;
        vault_txid: string;
        liquid_txid: string;
    }, {
        vault_pubkey: string;
        vault_txid: string;
        liquid_txid: string;
    }>;
    vault_update_res: z.ZodObject<{
        vault_txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        vault_pubkey: string;
        vault_txid: string;
    }, {
        vault_pubkey: string;
        vault_txid: string;
    }>;
};
export default _default;
