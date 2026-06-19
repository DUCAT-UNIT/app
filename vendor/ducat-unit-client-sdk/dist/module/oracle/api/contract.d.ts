import { PriceOracleClient } from '../class/client.js';
import type { PriceContract } from '@ducat-unit/core';
export declare function fetch_price_contracts_api(client: PriceOracleClient): (commit_hashes: string[]) => Promise<PriceContract[]>;
