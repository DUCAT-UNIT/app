import { HDNodeWallet, JsonRpcProvider } from 'ethers';
import { EVM_CONFIG, EVM_DERIVATION_PATH, SEPOLIA_CHAIN_ID } from '../constants/evm';
import { withMnemonic } from './secureStorageService';
import { logger } from '../utils/logger';

export interface DerivedSepoliaAccount {
  address: string;
  chainId: number;
  derivationPath: string;
  accountIndex: number;
}

function getSepoliaProvider(): JsonRpcProvider {
  if (!EVM_CONFIG.rpcUrl) {
    throw new Error('EXPO_PUBLIC_SEPOLIA_RPC_URL is not configured');
  }

  return new JsonRpcProvider(EVM_CONFIG.rpcUrl, SEPOLIA_CHAIN_ID);
}

export { getSepoliaProvider };

export async function deriveSepoliaAccount(accountIndex: number): Promise<DerivedSepoliaAccount> {
  return withMnemonic(async (mnemonic) => {
    const derivationPath = EVM_DERIVATION_PATH(accountIndex);
    const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
    return {
      address: wallet.address,
      chainId: SEPOLIA_CHAIN_ID,
      derivationPath,
      accountIndex,
    };
  });
}

export async function withSepoliaSigner<T>(
  accountIndex: number,
  callback: (wallet: HDNodeWallet, provider: JsonRpcProvider) => Promise<T>,
): Promise<T> {
  return withMnemonic(async (mnemonic) => {
    const derivationPath = EVM_DERIVATION_PATH(accountIndex);
    const provider = getSepoliaProvider();
    const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath).connect(provider);
    logger.debug('[SepoliaSigner] Using signer', {
      accountIndex,
      address: wallet.address,
      derivationPath,
    });
    return callback(wallet, provider);
  });
}
