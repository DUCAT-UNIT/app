import { z } from 'zod';
import * as Base from './base.js';
import * as Price from './price.js';
import * as Vault from './vault.js';
export const quote = z.object({
    claimed_sats: Base.ulong,
    claimed_unit: Base.uint,
    deficit_ratio: Base.float,
    deficit_sats: Base.ulong,
    reserve_rate: Base.float,
    reserve_sats: Base.ulong,
    reward_ratio: Base.float,
    reward_sats: Base.ulong,
    subsidy_multi: Base.float,
    subsidy_rate: Base.float,
});
export const breached_contract = Price.contract.extend({
    thold_key: Base.hex32
});
export const vault = z.object({
    ...Vault.profile.shape,
    ...quote.shape,
    liquid_key: Base.hex32,
    liquid_price: Base.uint,
});
