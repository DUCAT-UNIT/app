import { P2TR } from '@scrow/tapscript/address';
import { get_chain_network } from '../../../lib/util.js';
import { get_contract_pointers } from '../lib/proto.js';
import { fetch_mint_profile } from './mint.js';
import { Assert, Resolve, sleep } from '../../../util/index.js';
import { fetch_guard_contract, fetch_master_contract, fetch_oracle_contract, fetch_terms_contract } from './contract.js';
import { fetch_outpoint_groups, fetch_outpoint_id } from './ordx.js';
import { fetch_terms_record } from './record.js';
import CONST from '../../../const.js';
import Schema from '../../../schema/index.js';
const { FETCH_IVAL, POINTER, POSTAGE } = CONST;
const MASTER_TYPE = POSTAGE.GET_TYPE('master');
const DEFAULT_CONFIG = {
    cache: {
        groups: {},
        points: {},
        runes: {},
        terms: new Map()
    },
    ival: FETCH_IVAL,
    mints: new Map(),
    terms: new Map()
};
export async function fetch_master_id(esp_url, ord_url, master_pk, network = 'regtest', ival = FETCH_IVAL) {
    Assert.exists(MASTER_TYPE, 'master postage type not found');
    const net = get_chain_network(network);
    const addr = P2TR.create(master_pk, net);
    const res1 = await fetch_outpoint_groups(esp_url, addr, [MASTER_TYPE]);
    if (!res1.ok)
        return res1;
    const outpoint = res1.data.get(MASTER_TYPE)?.at(0);
    Assert.exists(outpoint, 'outpoint not found for master type: ' + MASTER_TYPE);
    await sleep(ival);
    return fetch_outpoint_id(ord_url, outpoint, { ival });
}
export async function fetch_master_ctx(ord_url, master_id, options = {}) {
    const conf = { ...DEFAULT_CONFIG, ...options };
    let { cache, ival } = conf;
    try {
        if (cache.id === undefined) {
            cache.id = master_id;
        }
        else if (cache.id !== master_id) {
            cache = { ...DEFAULT_CONFIG.cache, id: master_id };
        }
        if (cache.ctx === undefined) {
            const res = await fetch_master_contract(ord_url, master_id);
            if (!res.ok)
                return res;
            cache.ctx = res.data;
            await sleep(ival);
        }
        if (cache.ctx === undefined) {
            return Resolve.fail('failed to fetch matcher contract');
        }
        if (cache.groups.guard === undefined) {
            const ptr = cache.ctx.groups.guard;
            const res = await fetch_guard_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.groups.guard = res.data;
            await sleep(ival);
        }
        if (cache.groups.oracle === undefined) {
            const ptr = cache.ctx.groups.oracle;
            const res = await fetch_oracle_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.groups.oracle = res.data;
            await sleep(ival);
        }
        if (cache.points.repo === undefined) {
            const ptr = cache.ctx.terms.repo;
            const res = await fetch_terms_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.points.repo = res.data;
            await sleep(ival);
        }
        if (cache.points.vault === undefined) {
            const ptr = cache.ctx.terms.vault;
            const res = await fetch_terms_contract(ord_url, ptr, ival);
            if (!res.ok)
                return res;
            cache.points.vault = res.data;
            await sleep(ival);
        }
        if (cache.runes.unit === undefined) {
            const id = cache.ctx.runes.unit;
            const res = await fetch_mint_profile(ord_url, id);
            if (!res.ok)
                return res;
            cache.runes.unit = res.data;
            await sleep(ival);
        }
        const pointers = get_contract_pointers(cache.points);
        for (const [type, pointer] of pointers) {
            const key = POINTER.GET_KEY(type);
            if (key === undefined)
                continue;
            if (cache.terms.has(key))
                continue;
            const res = await fetch_terms_record(ord_url, pointer, ival);
            if (!res.ok)
                return res;
            cache.terms.set(key, res.data.slice(1));
            await sleep(ival);
        }
    }
    catch (err) {
        return Resolve.error(err);
    }
    const schema = Schema.oracle.proto.proto_profile;
    const parsed = await schema.spa({ ...cache, master_id });
    return (parsed.success)
        ? Resolve.data(parsed.data)
        : Resolve.error(parsed.error, 622);
}
