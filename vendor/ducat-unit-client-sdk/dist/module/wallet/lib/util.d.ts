import type { SignPSBTManifest } from '../../../types/index.js';
export declare function is_asset_input(code: number | null): boolean;
export declare function is_vault_input(code: number | null): boolean;
export declare function create_manifest(inputs: [string, number[]][]): SignPSBTManifest;
export declare function update_manifest(manifest: SignPSBTManifest, address: string, index: number): void;
