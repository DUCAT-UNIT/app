import { fetchWithTimeout } from './api';

interface NativeXMLHttpRequest {
  readyState: number;
  status: number;
  statusText: string;
  responseText: string;
  timeout: number;
  onreadystatechange: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  open(method: string, url: string, async: boolean): void;
  send(body?: string): void;
  setRequestHeader?(header: string, value: string): void;
}

interface NativeJsonOptions {
  timeout: number;
  headers?: Record<string, string>;
}

interface NativeJsonRequestOptions extends NativeJsonOptions {
  method: 'GET' | 'POST';
  body?: unknown;
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function getNativeXMLHttpRequest(): (new () => NativeXMLHttpRequest) | undefined {
  return (globalThis as unknown as { XMLHttpRequest?: new () => NativeXMLHttpRequest })
    .XMLHttpRequest;
}

async function jsonWithNativeTimeout<T>(
  url: string,
  options: NativeJsonRequestOptions
): Promise<T> {
  const XMLHttpRequestCtor = getNativeXMLHttpRequest();
  const headers = options.headers ?? {};
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);

  if (!XMLHttpRequestCtor) {
    const response = await fetchWithTimeout(
      url,
      {
        method: options.method,
        headers,
        body,
      },
      options.timeout
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequestCtor();
    let settled = false;

    const settle = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      callback();
    };

    request.onreadystatechange = () => {
      if (request.readyState !== 4) return;

      settle(() => {
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(`HTTP ${request.status}: ${request.statusText}`));
          return;
        }

        try {
          resolve(JSON.parse(request.responseText) as T);
        } catch {
          reject(new Error('Failed to parse JSON response'));
        }
      });
    };

    request.onerror = () => {
      settle(() => reject(new Error('Network error')));
    };

    request.ontimeout = () => {
      settle(() => reject(createAbortError(`Request timed out after ${options.timeout}ms`)));
    };

    request.timeout = options.timeout;
    request.open(options.method, url, true);
    for (const [header, value] of Object.entries(headers)) {
      request.setRequestHeader?.(header, value);
    }
    request.send(body);
  });
}

export async function getJsonWithNativeTimeout<T>(
  url: string,
  options: NativeJsonOptions
): Promise<T> {
  return jsonWithNativeTimeout<T>(url, { ...options, method: 'GET' });
}

export async function postJsonWithNativeTimeout<T>(
  url: string,
  body: unknown,
  options: NativeJsonOptions
): Promise<T> {
  return jsonWithNativeTimeout<T>(url, {
    ...options,
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
