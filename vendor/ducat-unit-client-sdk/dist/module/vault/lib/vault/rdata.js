import { Assert } from '@vbyte/util';
import { select_base_price_commit, DEFAULT_RETURN_DATA } from '@ducat-unit/core/lib';
export function create_vault_return_data(vault_ctx) {
    const { guard_members, price_commits, price_stamp, unit_balance } = vault_ctx;
    if (unit_balance === 0) {
        return { ...DEFAULT_RETURN_DATA(), guard_members };
    }
    else {
        Assert.ok(unit_balance > 0, 'unit balance is not greater than zero');
        Assert.exists(price_stamp, 'price stamp is missing from vault context');
        const base_commit = select_base_price_commit(price_commits);
        Assert.exists(base_commit, 'base commit is missing from price commits');
        const unit_price = base_commit.base_price;
        const thold_price = base_commit.thold_price;
        return { guard_members, price_commits, unit_balance, unit_price, thold_price, price_stamp };
    }
}
