import { ProtoWallet } from '../../../module/wallet/class/wallet.js';
import type { SignPSBTManifest } from '../../../types/index.js';
export declare function get_psbt_manifest_api(client: ProtoWallet): (psbt: string) => Promise<SignPSBTManifest>;
