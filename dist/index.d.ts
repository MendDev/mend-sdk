export interface MendSdkOptions {
    /** Base REST endpoint, e.g. "https://api.mend.com/v2" (no trailing slash) */
    apiEndpoint: string;
    /** Admin/service account credentials */
    adminEmail: string;
    adminPassword: string;
    /** Minutes before JWT refresh (default 55) */
    tokenTTL?: number;
    /** Optional default headers passed to **every** request (apart from auth headers). */
    defaultHeaders?: Record<string, string>;
}
export interface MendError extends Error {
    /** Programmatic error category */
    code: string;
    /** HTTP status if applicable */
    status?: number;
}
interface Json extends Record<string, unknown> {
}
type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export declare class MendSdk {
    private readonly apiEndpoint;
    private readonly adminEmail;
    private readonly adminPassword;
    private readonly tokenTTL;
    private readonly defaultHeaders;
    private jwt;
    private jwtExpiresAt;
    constructor(opts: MendSdkOptions);
    private authenticate;
    private ensureAuth;
    private fetch;
    /**
     * Perform an authenticated request (abort‑able).
     * @example
     * ```ts
     * const ctrl = new AbortController();
     * sdk.request('GET', '/org/2', undefined, {}, ctrl.signal);
     * // ctrl.abort();
     * ```
     */
    request<T = Json>(method: HttpVerb, path: string, body?: unknown, query?: Record<string, string | number | boolean>, signal?: AbortSignal): Promise<T>;
    getOrg(orgId: number, signal?: AbortSignal): Promise<Json>;
    getUser(userId: number, signal?: AbortSignal): Promise<Json>;
    listPatients(search: string, page?: number, limit?: number, signal?: AbortSignal): Promise<Json>;
    getAppointment(appointmentId: number, signal?: AbortSignal): Promise<Json>;
    createAppointment(payload: Json, signal?: AbortSignal): Promise<Json>;
}
export default MendSdk;
