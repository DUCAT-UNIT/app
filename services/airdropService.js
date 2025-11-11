/**
 * Airdrop Service
 * Handles requesting testnet coins from the faucet for new users
 */

import { API } from '../utils/constants';

const DUMMY_CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX';

/**
 * Request airdrop for a new wallet
 * @param {string} segwitAddress - User's SegWit address (tb1q...)
 * @returns {Promise<{txId: string}>} Transaction ID of the airdrop
 */
export const requestAirdrop = async (segwitAddress) => {
  try {
    const response = await fetch(API.FAUCET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: segwitAddress,
        captchaToken: DUMMY_CAPTCHA,
        network: 'mutinynet',
      }),
    });

    if (!response.ok) {
      throw new Error(`Airdrop request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !data.data.tx_id) {
      throw new Error('Invalid airdrop response');
    }

    return {
      txId: data.data.tx_id,
      timeout: data.data.timeout,
    };
  } catch (error) {
    throw error;
  }
};
