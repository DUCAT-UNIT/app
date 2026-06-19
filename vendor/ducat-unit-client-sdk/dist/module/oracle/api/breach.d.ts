import { PriceOracleClient } from '../class/client.js';
import type { BreachedPriceContract } from '@ducat-unit/core';
export declare function fetch_breached_contracts_api(client: PriceOracleClient): (contract_ids: string[]) => Promise<BreachedPriceContract[]>;
