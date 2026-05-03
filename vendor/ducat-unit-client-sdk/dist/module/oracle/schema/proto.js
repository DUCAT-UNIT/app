import { z } from 'zod';
import base from '../../../schema/base.js';
import cont from './contract.js';
import ord from '../../../schema/ord.js';
import mint from './mint.js';
const { literal, num, str } = base;
const group_map = z.map(str, ord.outpoint.array());
const term_map = z.map(str, literal.array());
const guard_contract = cont.quorum_contract;
const oracle_contract = cont.group_contract;
const terms_contract = cont.point_contract;
const master_contract = z.object({
    groups: z.object({
        guard: cont.adr_ptr,
        oracle: cont.adr_ptr
    }),
    runes: z.object({
        unit: cont.rec_ptr
    }),
    terms: z.object({
        repo: cont.adr_ptr,
        vault: cont.adr_ptr
    }),
    ver: num
});
const proto_profile = z.object({
    ctx: master_contract,
    groups: z.object({
        guard: guard_contract,
        oracle: oracle_contract
    }),
    master_id: ord.inscribe_id,
    points: z.object({
        repo: terms_contract,
        vault: terms_contract
    }),
    runes: z.object({
        unit: mint.mint_profile,
    }),
    terms: term_map
});
export default {
    group_map,
    guard_contract,
    oracle_contract,
    master_contract,
    proto_profile,
    term_map,
    terms_contract
};
