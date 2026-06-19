export function to_chain_network(network) {
    switch (network) {
        case 'mainnet':
            return 'main';
        case 'testnet':
            return 'testnet3';
        case 'mutinynet':
            return 'mutiny';
        case 'main':
        case 'testnet3':
        case 'testnet4':
        case 'signet':
        case 'mutiny':
        case 'regtest':
        case 'alpha-mainnet':
            return network;
        default:
            throw new Error(`unsupported chain network: ${network}`);
    }
}
export function to_address_network(network) {
    switch (network) {
        case 'main': return 'main';
        case 'alpha-mainnet': return 'main';
        case 'regtest': return 'regtest';
        case 'testnet3':
        case 'testnet4':
        case 'signet':
        case 'mutiny': return 'testnet';
        default: {
            const _exhaustive = network;
            throw new Error(`unsupported chain network: ${_exhaustive}`);
        }
    }
}
export function normalize_address_network(network) {
    return to_address_network(to_chain_network(network));
}
