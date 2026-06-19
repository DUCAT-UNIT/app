import type { GuardianSigner } from '../class/cosigner.js';
export declare function sign_inputs_api(guardian: GuardianSigner): {
    cosign: (psbt: string, index: number) => string;
    liquidate: (psbt: string, index: number) => string;
    spend: (psbt: string, index: number) => string;
};
export declare function sign_liquid_input_api(guard: GuardianSigner): (psbt: string, index: number) => string;
export declare function cosign_vault_input_api(guard: GuardianSigner): (psbt: string, index: number) => string;
