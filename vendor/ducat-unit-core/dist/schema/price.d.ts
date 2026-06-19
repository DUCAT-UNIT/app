import { z } from 'zod';
export declare const observation: z.ZodObject<{
    base_price: z.ZodNumber;
    base_stamp: z.ZodNumber;
    chain_network: z.ZodEnum<{
        main: "main";
        testnet3: "testnet3";
        testnet4: "testnet4";
        mutiny: "mutiny";
        regtest: "regtest";
        signet: "signet";
        "alpha-mainnet": "alpha-mainnet";
    }>;
    oracle_pubkey: z.ZodString;
}, z.core.$strip>;
export declare const quote: z.ZodObject<{
    rate_min: z.ZodFloat32;
    rate_max: z.ZodFloat32;
    rate_thold: z.ZodFloat32;
    step_size: z.ZodFloat32;
    base_price: z.ZodNumber;
    base_stamp: z.ZodNumber;
    chain_network: z.ZodEnum<{
        main: "main";
        testnet3: "testnet3";
        testnet4: "testnet4";
        mutiny: "mutiny";
        regtest: "regtest";
        signet: "signet";
        "alpha-mainnet": "alpha-mainnet";
    }>;
    oracle_pubkey: z.ZodString;
}, z.core.$strip>;
export declare const contract: z.ZodObject<{
    commit_hash: z.ZodString;
    contract_id: z.ZodString;
    oracle_sig: z.ZodString;
    thold_key: z.ZodNullable<z.ZodString>;
    thold_hash: z.ZodString;
    thold_price: z.ZodNumber;
    base_price: z.ZodNumber;
    base_stamp: z.ZodNumber;
    chain_network: z.ZodEnum<{
        main: "main";
        testnet3: "testnet3";
        testnet4: "testnet4";
        mutiny: "mutiny";
        regtest: "regtest";
        signet: "signet";
        "alpha-mainnet": "alpha-mainnet";
    }>;
    oracle_pubkey: z.ZodString;
}, z.core.$strip>;
export declare const commit: z.ZodObject<{
    base_price: z.ZodNumber;
    oracle_pubkey: z.ZodString;
    oracle_sig: z.ZodString;
    thold_hash: z.ZodString;
    thold_price: z.ZodNumber;
}, z.core.$strip>;
