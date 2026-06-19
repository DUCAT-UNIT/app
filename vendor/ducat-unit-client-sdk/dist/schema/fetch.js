import { z } from 'zod';
import { asset, vault, witness } from '@ducat-unit/core/schema';
export const coin_data = z.object({
    assets: asset.account.array(),
    commits: witness.record.array(),
    vault: vault.profile.nullable()
});
export const tx_data = z.object({
    coins: asset.account.array(),
    commits: witness.record.array(),
    vaults: vault.profile.array()
});
export const asset_stats = z.object({
    issued_count: z.number(),
    issued_total: z.number(),
    reserve_count: z.number(),
    reserve_total: z.number()
});
export const liquid_stats = z.object({
    avg_base_price: z.number(),
    avg_thold_price: z.number(),
    avg_vault_ratio: z.number(),
    sum_base_price: z.number(),
    sum_thold_price: z.number(),
    sum_vault_ratio: z.number(),
    total_count: z.number(),
    total_unit_debt: z.number(),
    total_sats_value: z.number()
});
export const liquid_stats_page = z.object({
    data: liquid_stats,
    has_more: z.boolean(),
    next_cursor: z.string().nullable()
});
export const proto_history_record = z.object({
    spend_height: z.number()
}).passthrough();
