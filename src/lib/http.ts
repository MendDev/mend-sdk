import { MendError, ERROR_CODES } from './errors';

/**
 * HTTP verb types supported by the API
 */
export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Generic JSON response type with type parameter
 */
export interface Json<T = unknown> extends Record<string, T> {}

export type QueryValue = string | number | boolean | Array<string | number | boolean>;
export type QueryParams = Record<string, QueryValue>;

/**
 * Configuration for the HTTP client
 */
export interface HttpClientConfig {
  apiEndpoint: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * Low-level HTTP client for making API requests
 */
export class HttpClient {
  private readonly apiEndpoint: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: HttpClientConfig) {
    this.apiEndpoint = config.apiEndpoint.replace(/\/$/, '');
    this.defaultHeaders = config.defaultHeaders ?? {};
  }

  private serializeQuery(query: QueryParams): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v));
      } else {
        params.append(key, String(value));
      }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  /**
   * Make an HTTP request to the API
   * 
   * @param method HTTP method to use
   * @param path API path (will be appended to apiEndpoint)
   * @param body Optional request body
   * @param query Optional query parameters
   * @param headers Optional additional headers
   * @param signal Optional AbortSignal for cancellation
   * @returns Promise resolving to the response data
   */
  public async fetch<T = Json<any>>(
    method: HttpVerb,
    path: string,
    body?: unknown,
    query: QueryParams = {},
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    /* Query‑string ------------------------------------------------------------------------- */
    const qs = Object.keys(query).length ? this.serializeQuery(query) : '';

    const url = this.apiEndpoint + path + qs;

    /* Headers --------------------------------------------------------------------------------*/
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...headers,
    };

    /* Fetch call ----------------------------------------------------------------------------*/
    const context = { url, method, headers: requestHeaders };
    let resp: Response;
    try {
      resp = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (err) {
      throw new MendError(
        (err as Error).message,
        ERROR_CODES.HTTP_ERROR,
        undefined,
        undefined,
        context,
      );
    }

    /* Error handling --------------------------------------------------------------*/
    if (!resp.ok) {
      const text = await resp.text();
      let details: unknown;
      let message = `HTTP ${resp.status} – ${resp.statusText}`;
      if (text) {
        try {
          details = JSON.parse(text);
          const obj = details as Record<string, any>;
          message = obj.message || obj.error || message;
        } catch {
          details = text;
          message = text;
        }
      }

      const serverCode = (details as any)?.code as ErrorCode | undefined;
      let code: ErrorCode = ERROR_CODES.HTTP_ERROR;
      if (serverCode && (serverCode in ERROR_CODES)) {
        code = serverCode;
      }

      throw new MendError(
        message,
        code,
        resp.status,
        details,
        { ...context, responseBody: details },
      );
    }

    /* Some endpoints return empty body (204). Attempt JSON parse only when content exists. */
    const text = await resp.text();
    return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
  }
}

/**
 * Create a new HTTP client instance
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}
