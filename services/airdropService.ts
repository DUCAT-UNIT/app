/**
 * Airdrop Service
 * Handles requesting faucet coins on supported test networks
 */

import { postJSON } from '../utils/apiClient';
import { API, NETWORK_DISPLAY_NAME, NETWORK_CONFIG } from '../utils/constants';

// Public Mutinynet faucet sentinel. This is not an application secret.
const TESTNET_FAUCET_CAPTCHA_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

export interface AirdropResponse {
  txId: string;
  timeout?: number;
}

interface AirdropApiResponse {
  data: {
    tx_id: string;
    timeout?: number;
  };
}

/**
 * Request airdrop for a new wallet
 * @param segwitAddress - User's SegWit address on the active network
 * @returns Transaction ID of the airdrop
 */
export const requestAirdrop = async (segwitAddress: string): Promise<AirdropResponse> => {
  if (!API.FAUCET || !NETWORK_CONFIG.api.faucetNetwork) {
    throw new Error(`Airdrop is unavailable on ${NETWORK_DISPLAY_NAME}`);
  }

  const data = await postJSON<AirdropApiResponse>(
    API.FAUCET,
    {
      address: segwitAddress,
      captchaToken: TESTNET_FAUCET_CAPTCHA_TOKEN,
      network: NETWORK_CONFIG.api.faucetNetwork,
    },
    {
      description: 'Request airdrop',
      headers: {
        'User-Agent': 'DucatProtocolWallet',
      },
    }
  );

  if (!data.data || !data.data.tx_id) {
    throw new Error('Invalid airdrop response');
  }

  return {
    txId: data.data.tx_id,
    timeout: data.data.timeout,
  };
};
