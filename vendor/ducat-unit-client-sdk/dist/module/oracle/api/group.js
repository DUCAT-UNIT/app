import { fetch_account_profile } from './mint.js';
import { sleep } from '../../../util/helpers.js';
import { fetch_outpoint_content, fetch_rand_outpoint } from './ordx.js';
import CONST from '../../../const.js';
import { Assert } from '../../../util/index.js';
const { FETCH_IVAL, POSTAGE } = CONST;
export async function fetch_rand_unit_account(mint, esp_url, ord_url, address, ival = FETCH_IVAL) {
    const postage = POSTAGE.GET_TYPE('unit_account');
    Assert.exists(postage, 'unit account postage type not found');
    const res1 = await fetch_rand_outpoint(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_account_profile(mint, ord_url, res1.data, ival);
}
export async function fetch_rand_guardian_host(esp_url, ord_url, address, ival = FETCH_IVAL) {
    const postage = POSTAGE.GET_TYPE('guard_hosts');
    Assert.exists(postage, 'guard host postage type not found');
    const res1 = await fetch_rand_outpoint(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_outpoint_content(ord_url, res1.data, { ival });
}
export async function fetch_rand_exchange_host(esp_url, ord_url, address, ival = FETCH_IVAL) {
    const postage = POSTAGE.GET_TYPE('oracle_hosts');
    Assert.exists(postage, 'oracle host postage type not found');
    const res1 = await fetch_rand_outpoint(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_outpoint_content(ord_url, res1.data, { ival });
}
