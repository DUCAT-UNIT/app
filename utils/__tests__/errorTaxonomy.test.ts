import {
  AppError,
  AppRequestError,
  classifyError,
  classifyHttpStatus,
  getUserFacingErrorMessage,
} from '../errorTaxonomy';

describe('errorTaxonomy', () => {
  it('classifies HTTP statuses', () => {
    expect(classifyHttpStatus(408)).toBe('api_timeout');
    expect(classifyHttpStatus(429)).toBe('api_rate_limited');
    expect(classifyHttpStatus(500)).toBe('api_server');
    expect(classifyHttpStatus(400)).toBe('api_client');
  });

  it('classifies common wallet and EVM errors', () => {
    expect(classifyError(new Error('insufficient funds for gas')).category).toBe('insufficient_funds');
    expect(classifyError(new Error('nonce has already been used')).category).toBe('nonce_conflict');
    expect(classifyError(new Error('execution reverted')).category).toBe('transaction_reverted');
    expect(classifyError(new Error('Blockscout not found')).category).toBe('indexer_lag');
    expect(classifyError(new Error('biometric auth cancelled')).category).toBe('wallet_auth_failed');
    expect(classifyError(new Error('network request failed')).category).toBe('network_unavailable');
  });

  it('preserves typed app request errors', () => {
    const error = new AppRequestError({
      category: 'api_server',
      message: 'HTTP 500',
      statusCode: 500,
      endpoint: '/x',
      method: 'GET',
    });

    expect(classifyError(error)).toBe(error);
    expect(error.retryable).toBe(true);
  });

  it('returns user-facing messages from typed errors', () => {
    expect(getUserFacingErrorMessage(new AppError({
      category: 'nonce_conflict',
      message: 'nonce conflict',
    }))).toBe('The Sepolia nonce changed. Refresh wallet state and retry.');
  });
});
