import { z } from 'zod';
import * as Base from './base.js';
import * as Chain from './chain.js';
import * as Coin from './coin.js';
export const asset_id = Chain.block_id;
export const account = z.object({
    asset_id: asset_id,
    asset_balance: Base.ulong,
    asset_reserve: Base.ulong,
    coin_id: Coin.coin_id,
    coin_script: Base.hex,
    coin_value: Base.ulong
});
export const profile = z.object({
    div: Base.uint,
    id: asset_id,
    label: Base.str,
    symbol: Base.str,
    supply: Base.str
});
