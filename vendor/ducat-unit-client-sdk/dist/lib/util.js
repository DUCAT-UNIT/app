import { Buff } from '@cmdcode/buff';
import { P2TR } from '@scrow/tapscript/address';
export function get_vsize(bytes) {
    const weight = Buff.bytes(bytes).length;
    const remain = (weight % 4 > 0) ? 1 : 0;
    return Math.floor(weight / 4) + remain;
}
export function get_chain_network(network) {
    if (network === 'main')
        return 'main';
    if (network === 'mutiny')
        return 'signet';
    if (network === 'testnet3')
        return 'testnet';
    if (network === 'testnet4')
        return 'testnet';
    if (network === 'regtest')
        return 'regtest';
    if (network === 'signet')
        return 'signet';
    throw new Error('invalid network: ' + network);
}
export function create_proto_profile(profile, network = 'signet') {
    return {
        ctx: {
            groups: {
                guard: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0],
                oracle: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0]
            },
            runes: {
                unit: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 'e65d820ebc0e0de5215255fcc17363644b5676d4de47ea6bffe442c392e28894i0']
            },
            terms: {
                repo: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0],
                vault: ['bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', 0],
            },
            ver: profile.version
        },
        groups: {
            guard: {
                adr: P2TR.create(profile.guard_pk, network),
                pub: profile.guard_pk,
                thd: 0
            },
            oracle: {
                adr: P2TR.create(profile.oracle_pk, network)
            }
        },
        master_id: profile.master_id,
        points: {
            repo: { adr: 'bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', ptr: [[0, 0]] },
            vault: { adr: 'bcrt1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjsch6c8d', ptr: [[0, 0]] }
        },
        runes: { unit: profile.unit_rune },
        terms: new Map(profile.terms.map(e => [e[0], [e[1]]]))
    };
}
