import { Assert } from '@vbyte/util';
import { verify_price_contract_signature } from '../../lib/price/contract.js';
import { verify_oracle_authorized } from '../../lib/price/validate.js';
export function verify_price_contract(contract, proto) {
    verify_price_contract_signature(contract);
    verify_oracle_authorized(contract.oracle_pubkey, proto);
    Assert.ok(contract.thold_price > 0, `verify_price_contract: thold_price must be > 0 (got ${contract.thold_price})`);
    Assert.ok(contract.thold_price < contract.base_price, `verify_price_contract: thold_price (${contract.thold_price}) must be < base_price (${contract.base_price})`);
}
export function verify_active_price_contract(contract, proto) {
    verify_price_contract(contract, proto);
    Assert.ok(contract.thold_key === null, 'verify_active_price_contract: thold_key must be null (contract must not be triggered)');
}
