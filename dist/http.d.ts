/**
 * HTTP verb types supported by the API
 */
export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/**
 * Generic JSON response type with type parameter
 */
export interface Json<T = unknown> extends Record<string, T> {
}
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
export declare class HttpClient {
    private readonly apiEndpoint;
    private readonly defaultHeaders;
    constructor(config: HttpClientConfig);
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
    fetch<T = Json<any>>(method: HttpVerb, path: string, body?: unknown, query?: Record<string, string | number | boolean>, headers?: Record<string, string>, signal?: AbortSignal): Promise<T>;
}
/**
 * Create a new HTTP client instance
 */
export declare function createHttpClient(config: HttpClientConfig): HttpClient;
