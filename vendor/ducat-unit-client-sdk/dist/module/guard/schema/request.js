import { z } from 'zod';
import { asset, base } from '@ducat-unit/core/schema';
export const reserve_acct = z.object({
    asset_id: asset.asset_id,
    asset_amount: base.uint,
});
