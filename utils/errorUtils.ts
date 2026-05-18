export function getErrorMessage(error: unknown, fallback = 'Operation failed'): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const directMessage = [
      record.message,
      record.error,
      record.reason,
      record.detail,
      record.details,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    if (directMessage) {
      return directMessage;
    }

    if (record.cause) {
      const causeMessage = getErrorMessage(record.cause, '');
      if (causeMessage) {
        return causeMessage;
      }
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') {
        return serialized.length > 500 ? `${serialized.slice(0, 500)}...[truncated]` : serialized;
      }
    } catch {
      // Fall through to fallback.
    }
  }

  return fallback;
}
