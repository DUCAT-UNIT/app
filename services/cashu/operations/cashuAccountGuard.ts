import { getCurrentCashuAccount } from '../cashuProofManager';

export const captureCashuOperationAccount = (): string | null =>
  typeof getCurrentCashuAccount === 'function' ? getCurrentCashuAccount() : null;

export const requireCashuOperationAccount = (operation: string): string => {
  const account = captureCashuOperationAccount();
  if (!account) {
    throw new Error(`Cashu account is not initialized for ${operation}; retry after wallet unlock`);
  }
  return account;
};

export const assertCashuOperationAccountUnchanged = (
  expectedAccount: string | null,
  operation: string
): void => {
  if (!expectedAccount) {
    return;
  }

  const currentAccount = captureCashuOperationAccount();
  if (currentAccount !== expectedAccount) {
    throw new Error(`Cashu account changed during ${operation}; retry from the active account`);
  }
};
