import { SUBSIDY_HALVING_INTERVAL } from './constants.js';
export var Network;
(function (Network) {
    Network[Network["MAINNET"] = 0] = "MAINNET";
    Network[Network["SIGNET"] = 1] = "SIGNET";
    Network[Network["TESTNET"] = 2] = "TESTNET";
    Network[Network["REGTEST"] = 3] = "REGTEST";
})(Network || (Network = {}));
(function (Network) {
    function getFirstRuneHeight(chain) {
        switch (chain) {
            case Network.MAINNET:
                return SUBSIDY_HALVING_INTERVAL * 4;
            case Network.REGTEST:
                return SUBSIDY_HALVING_INTERVAL * 0;
            case Network.SIGNET:
                return SUBSIDY_HALVING_INTERVAL * 0;
            case Network.TESTNET:
                return SUBSIDY_HALVING_INTERVAL * 12;
        }
    }
    Network.getFirstRuneHeight = getFirstRuneHeight;
})(Network || (Network = {}));
