import { z } from 'zod';
export declare const contract: z.ZodObject<{
    assets: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>>;
    boot: z.ZodNumber;
    domain: z.ZodString;
    network: z.ZodEnum<{
        main: "main";
        testnet3: "testnet3";
        testnet4: "testnet4";
        mutiny: "mutiny";
        regtest: "regtest";
        signet: "signet";
        "alpha-mainnet": "alpha-mainnet";
    }>;
    signers: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodString], null>>;
    terms: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
}, z.core.$strip>;
export declare const data: z.ZodObject<{
    anchor_id: z.ZodString;
    anchor_height: z.ZodNumber;
    anchor_index: z.ZodNumber;
    anchor_txid: z.ZodString;
    boot_height: z.ZodNumber;
    chain_network: z.ZodEnum<{
        main: "main";
        testnet3: "testnet3";
        testnet4: "testnet4";
        mutiny: "mutiny";
        regtest: "regtest";
        signet: "signet";
        "alpha-mainnet": "alpha-mainnet";
    }>;
    domain_hash: z.ZodString;
}, z.core.$strip>;
export declare const profile: z.ZodObject<{
    anchor_id: z.ZodString;
    anchor_height: z.ZodNumber;
    anchor_index: z.ZodNumber;
    anchor_txid: z.ZodString;
    boot_height: z.ZodNumber;
    chain_network: z.ZodEnum<{
        main: "main";
        testnet3: "testnet3";
        testnet4: "testnet4";
        mutiny: "mutiny";
        regtest: "regtest";
        signet: "signet";
        "alpha-mainnet": "alpha-mainnet";
    }>;
    domain_hash: z.ZodString;
    anchor_assets: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>>;
    anchor_signers: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodString], null>>;
    anchor_terms: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
}, z.core.$strip>;
