export type AppErrorCategory =
  | 'network_unavailable'
  | 'api_timeout'
  | 'api_rate_limited'
  | 'api_server'
  | 'api_client'
  | 'insufficient_funds'
  | 'nonce_conflict'
  | 'indexer_lag'
  | 'checkpoint_pending'
  | 'transaction_reverted'
  | 'wallet_auth_failed'
  | 'unknown';

export interface AppErrorOptions {
  category: AppErrorCategory;
  message: string;
  userMessage?: string;
  retryable?: boolean;
  statusCode?: number;
  cause?: unknown;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  category: AppErrorCategory;
  userMessage: string;
  retryable: boolean;
  statusCode?: number;
  context?: Record<string, unknown>;
  override cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.category = options.category;
    this.userMessage = options.userMessage ?? defaultUserMessage(options.category);
    this.retryable = options.retryable ?? defaultRetryable(options.category);
    this.statusCode = options.statusCode;
    this.context = options.context;
    this.cause = options.cause;
  }
}

export class AppRequestError extends AppError {
  endpoint?: string;
  method?: string;

  constructor(options: AppErrorOptions & { endpoint?: string; method?: string }) {
    super(options);
    this.name = 'AppRequestError';
    this.endpoint = options.endpoint;
    this.method = options.method;
  }
}

export class CircuitBreakerOpenError extends AppRequestError {
  constructor(endpoint: string, method: string, retryAfterMs: number) {
    super({
      category: 'api_timeout',
      message: `Request circuit is open for ${endpoint}`,
      userMessage: 'This service is temporarily unavailable. The app will retry shortly.',
      retryable: true,
      endpoint,
      method,
      context: { retryAfterMs },
    });
    this.name = 'CircuitBreakerOpenError';
  }
}

function defaultRetryable(category: AppErrorCategory): boolean {
  return category === 'network_unavailable'
    || category === 'api_timeout'
    || category === 'api_rate_limited'
    || category === 'api_server'
    || category === 'indexer_lag'
    || category === 'checkpoint_pending'
    || category === 'nonce_conflict';
}

function defaultUserMessage(category: AppErrorCategory): string {
  switch (category) {
    case 'network_unavailable':
      return 'Network connection failed. Check your connection and try again.';
    case 'api_timeout':
      return 'The request took too long. Try again in a moment.';
    case 'api_rate_limited':
      return 'The service is rate limiting requests. Try again shortly.';
    case 'api_server':
      return 'The service is temporarily unavailable.';
    case 'api_client':
      return 'The request could not be completed.';
    case 'insufficient_funds':
      return 'Insufficient funds for this operation.';
    case 'nonce_conflict':
      return 'The Sepolia nonce changed. Refresh wallet state and retry.';
    case 'indexer_lag':
      return 'The transaction was submitted, but history has not caught up yet.';
    case 'checkpoint_pending':
      return 'A matching transaction is still pending.';
    case 'transaction_reverted':
      return 'The transaction failed on-chain.';
    case 'wallet_auth_failed':
      return 'Wallet authentication failed.';
    default:
      return 'Something went wrong. Try again.';
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function classifyHttpStatus(status: number): AppErrorCategory {
  if (status === 408 || status === 504) return 'api_timeout';
  if (status === 429) return 'api_rate_limited';
  if (status >= 500) return 'api_server';
  return 'api_client';
}

export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = messageOf(error);

  if (/insufficient funds|insufficient balance|not enough/i.test(message)) {
    return new AppError({ category: 'insufficient_funds', message, cause: error });
  }

  if (/nonce|replacement transaction underpriced|already known/i.test(message)) {
    return new AppError({ category: 'nonce_conflict', message, cause: error });
  }

  if (/reverted|execution reverted|receipt status.*0/i.test(message)) {
    return new AppError({ category: 'transaction_reverted', message, retryable: false, cause: error });
  }

  if (/not found|404|indexer|blockscout/i.test(message)) {
    return new AppError({ category: 'indexer_lag', message, cause: error });
  }

  if (/auth|biometric|passkey|cancelled|canceled/i.test(message)) {
    return new AppError({ category: 'wallet_auth_failed', message, retryable: false, cause: error });
  }

  if (/timeout|timed out|abort/i.test(message)) {
    return new AppError({ category: 'api_timeout', message, cause: error });
  }

  if (/network request failed|fetch failed|network error|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return new AppError({ category: 'network_unavailable', message, cause: error });
  }

  return new AppError({ category: 'unknown', message, retryable: false, cause: error });
}

export function getUserFacingErrorMessage(error: unknown): string {
  return classifyError(error).userMessage;
}
