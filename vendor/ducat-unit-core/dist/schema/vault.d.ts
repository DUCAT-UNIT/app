import { z } from 'zod';
export declare const action: z.ZodEnum<{
    open: "open";
    close: "close";
    borrow: "borrow";
    repay: "repay";
    repo: "repo";
    withdraw: "withdraw";
    deposit: "deposit";
    trim: "trim";
    liquidate: "liquidate";
}>;
export declare const commit: z.ZodObject<{
    lbl: z.ZodString;
}, z.core.$strip>;
export declare const config: z.ZodObject<{
    label: z.ZodString;
}, z.core.$strip>;
export declare const rdata: z.ZodObject<{
    guard_members: z.ZodArray<z.ZodString>;
    price_commits: z.ZodArray<z.ZodObject<{
        base_price: z.ZodNumber;
        oracle_pubkey: z.ZodString;
        oracle_sig: z.ZodString;
        thold_hash: z.ZodString;
        thold_price: z.ZodNumber;
    }, z.core.$strip>>;
    price_stamp: z.ZodNullable<z.ZodNumber>;
    unit_balance: z.ZodNumber;
    unit_price: z.ZodNullable<z.ZodNumber>;
    thold_price: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export declare const sdata: z.ZodObject<{
    vault_action: z.ZodEnum<{
        open: "open";
        close: "close";
        borrow: "borrow";
        repay: "repay";
        repo: "repo";
        withdraw: "withdraw";
        deposit: "deposit";
        trim: "trim";
        liquidate: "liquidate";
    }>;
    vault_version: z.ZodNumber;
}, z.core.$strip>;
export declare const profile: z.ZodObject<{
    coin_id: z.ZodNullable<z.ZodString>;
    client_pubkey: z.ZodString;
    contract_id: z.ZodString;
    guard_pubkey: z.ZodString;
    root_txid: z.ZodString;
    vault_balance: z.ZodNumber;
    vault_config: z.ZodNullable<z.ZodObject<{
        label: z.ZodString;
    }, z.core.$strip>>;
    vault_ratio: z.ZodNullable<z.ZodFloat32>;
    vault_script: z.ZodNullable<z.ZodString>;
    vault_value: z.ZodNullable<z.ZodInt>;
    vault_action: z.ZodEnum<{
        open: "open";
        close: "close";
        borrow: "borrow";
        repay: "repay";
        repo: "repo";
        withdraw: "withdraw";
        deposit: "deposit";
        trim: "trim";
        liquidate: "liquidate";
    }>;
    vault_version: z.ZodNumber;
    guard_members: z.ZodArray<z.ZodString>;
    price_commits: z.ZodArray<z.ZodObject<{
        base_price: z.ZodNumber;
        oracle_pubkey: z.ZodString;
        oracle_sig: z.ZodString;
        thold_hash: z.ZodString;
        thold_price: z.ZodNumber;
    }, z.core.$strip>>;
    price_stamp: z.ZodNullable<z.ZodNumber>;
    unit_balance: z.ZodNumber;
    unit_price: z.ZodNullable<z.ZodNumber>;
    thold_price: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export declare const history_profile: z.ZodObject<{
    block_height: z.ZodNumber;
    block_stamp: z.ZodNumber;
    coin_id: z.ZodNullable<z.ZodString>;
    client_pubkey: z.ZodString;
    contract_id: z.ZodString;
    guard_pubkey: z.ZodString;
    root_txid: z.ZodString;
    vault_balance: z.ZodNumber;
    vault_config: z.ZodNullable<z.ZodObject<{
        label: z.ZodString;
    }, z.core.$strip>>;
    vault_ratio: z.ZodNullable<z.ZodFloat32>;
    vault_script: z.ZodNullable<z.ZodString>;
    vault_value: z.ZodNullable<z.ZodInt>;
    vault_action: z.ZodEnum<{
        open: "open";
        close: "close";
        borrow: "borrow";
        repay: "repay";
        repo: "repo";
        withdraw: "withdraw";
        deposit: "deposit";
        trim: "trim";
        liquidate: "liquidate";
    }>;
    vault_version: z.ZodNumber;
    guard_members: z.ZodArray<z.ZodString>;
    price_commits: z.ZodArray<z.ZodObject<{
        base_price: z.ZodNumber;
        oracle_pubkey: z.ZodString;
        oracle_sig: z.ZodString;
        thold_hash: z.ZodString;
        thold_price: z.ZodNumber;
    }, z.core.$strip>>;
    price_stamp: z.ZodNullable<z.ZodNumber>;
    unit_balance: z.ZodNumber;
    unit_price: z.ZodNullable<z.ZodNumber>;
    thold_price: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export declare const cosign_witness: z.ZodTuple<[z.ZodString, z.ZodString, z.ZodString, z.ZodString], null>;
export declare const liquid_witness: z.ZodTuple<[z.ZodString, z.ZodString, z.ZodString, z.ZodString], null>;
