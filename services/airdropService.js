/**
 * Airdrop Service
 * Handles requesting testnet coins from the faucet for new users
 */

import { postJSON } from '../utils/apiClient';
import { API } from '../utils/constants';

const DUMMY_CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX';

/**
 * Request airdrop for a new wallet
 * @param {string} segwitAddress - User's SegWit address (tb1q...)
 * @returns {Promise<{txId: string}>} Transaction ID of the airdrop
 */
export const requestAirdrop = async (segwitAddress) => {
  const data = await postJSON(
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
