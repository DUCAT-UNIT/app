import { Assert } from '../../../../util/index.js';
import CONST from '../../../../const.js';
export function verify_repo_portion(repo_portion) {
    Assert.ok(repo_portion > 0, 'repo portion must be greater than zero');
    Assert.ok(repo_portion <= 1, 'repo portion must be less than or equal to one');
}
export function verify_liquid_threshold(liquid_terms, collateral_ratio) {
    const { liquidation_thold } = liquid_terms;
    Assert.ok(collateral_ratio <= liquidation_thold, 'collateral ratio must be at or below the liquidation threshold');
    Assert.ok(collateral_ratio >= 1, 'collateral ratio must be greater than or equal to 1');
}
export function verify_return_balances(repo_portion, return_sats, return_unit) {
    if (repo_portion === 1) {
        Assert.ok(return_sats === CONST.MIN_VAULT_BAL, 'returned sats must be equal to the minimum vault balance');
        Assert.ok(return_unit === 0, 'returned unit must be zero');
    }
    else {
        Assert.ok(return_sats > CONST.MIN_VAULT_BAL, 'returned sats must be greater than the minimum vault balance');
        Assert.ok(return_unit > 0, 'returned unit must be positive');
    }
}
export function verify_batch_liquidate(vaults) {
    Assert.ok(vaults.length > 0, 'there are no vaults to liquidate');
    let has_partial_liquidation = false;
    vaults.forEach(vault => {
        Assert.ok(vault.rdata.unit_balance > 0, 'vault unit balance must be greater than zero');
        Assert.ok(vault.utxo.value > CONST.MIN_VAULT_BAL, 'vault sats balance must be greater than minimum vault balance');
        if (vault.repo_portion !== 1) {
            Assert.ok(!has_partial_liquidation, 'you can only partially liquidate one vault at a time');
            has_partial_liquidation = true;
        }
    });
}
