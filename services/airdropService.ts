/**
 * Airdrop Service
 * Handles requesting testnet coins from the faucet for new users
 */

import { postJSON } from '../utils/apiClient';
import { API } from '../utils/constants';

const DUMMY_CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX';

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
 * @param segwitAddress - User's SegWit address (tb1q...)
 * @returns Transaction ID of the airdrop
 */
export const requestAirdrop = async (segwitAddress: string): Promise<AirdropResponse> => {
  const data = await postJSON<AirdropApiResponse>(
    API.FAUCET,
    {
      address: segwitAddress,
      captchaToken: DUMMY_CAPTCHA,
      network: 'mutinynet',
    },
    { description: 'Request airdrop' }
  );

  if (!data.data || !data.data.tx_id) {
    throw new Error('Invalid airdrop response');
  }

  return {
    txId: data.data.tx_id,
    timeout: data.data.timeout,
  };
};
