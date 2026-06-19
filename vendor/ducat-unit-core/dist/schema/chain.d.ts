import { z } from 'zod';
export declare const address: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
export declare const block_id: z.ZodString;
export declare const outpoint: z.ZodString;
export declare const scribe_id: z.ZodString;
export declare const network: z.ZodEnum<{
    main: "main";
    testnet3: "testnet3";
    testnet4: "testnet4";
    mutiny: "mutiny";
    regtest: "regtest";
    signet: "signet";
    "alpha-mainnet": "alpha-mainnet";
}>;
