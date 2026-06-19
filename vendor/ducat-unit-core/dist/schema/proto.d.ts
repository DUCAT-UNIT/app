import { z } from 'zod';
export declare const signer_record: z.ZodObject<{
    group: z.ZodNumber;
    idx: z.ZodNumber;
    pubkey: z.ZodString;
}, z.core.$strip>;
export declare const term_record: z.ZodObject<{
    group: z.ZodNumber;
    key: z.ZodNumber;
    value: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
}, z.core.$strip>;
export declare const data: z.ZodObject<{
    contract_height: z.ZodNumber;
    contract_index: z.ZodNumber;
    contract_txid: z.ZodString;
    chain_height: z.ZodNumber;
    contract_id: z.ZodString;
    proto_assets: z.ZodArray<z.ZodObject<{
        div: z.ZodNumber;
        id: z.ZodString;
        label: z.ZodString;
        symbol: z.ZodString;
        supply: z.ZodString;
    }, z.core.$strip>>;
    proto_members: z.ZodArray<z.ZodObject<{
        group: z.ZodNumber;
        idx: z.ZodNumber;
        pubkey: z.ZodString;
    }, z.core.$strip>>;
    proto_terms: z.ZodArray<z.ZodObject<{
        group: z.ZodNumber;
        key: z.ZodNumber;
        value: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
    }, z.core.$strip>>;
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
    contract_height: z.ZodNumber;
    contract_index: z.ZodNumber;
    contract_txid: z.ZodString;
    chain_height: z.ZodNumber;
    contract_id: z.ZodString;
    proto_assets: z.ZodArray<z.ZodObject<{
        div: z.ZodNumber;
        id: z.ZodString;
        label: z.ZodString;
        symbol: z.ZodString;
        supply: z.ZodString;
    }, z.core.$strip>>;
    proto_members: z.ZodArray<z.ZodObject<{
        group: z.ZodNumber;
        idx: z.ZodNumber;
        pubkey: z.ZodString;
    }, z.core.$strip>>;
    proto_terms: z.ZodArray<z.ZodObject<{
        group: z.ZodNumber;
        key: z.ZodNumber;
        value: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
