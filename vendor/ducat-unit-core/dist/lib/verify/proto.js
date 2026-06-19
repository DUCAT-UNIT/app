import { Assert } from '@vbyte/util';
import { assert_schema } from '../../validate/schema.js';
import * as SCHEMA from '../../schema/index.js';
import { get_proto_contract_id } from '../../lib/proto/contract.js';
export function verify_proto_profile(proto) {
    assert_schema(proto, SCHEMA.proto.profile, 'verify_proto_profile: schema validation failed');
    const expected_id = get_proto_contract_id(proto);
    Assert.ok(proto.contract_id === expected_id, `verify_proto_profile: contract_id mismatch — supplied ${proto.contract_id}, expected ${expected_id}`);
}
