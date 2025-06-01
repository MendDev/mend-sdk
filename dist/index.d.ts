import { HttpVerb, Json } from './http';
export interface MendSdkOptions {
    /** Base REST endpoint, e.g. "https://api.mend.com/v2" (no trailing slash) */
    apiEndpoint: string;
    /** Admin/service account credentials */
    email: string;
    password: string;
    /** Optional organization ID to automatically switch to after login */
    orgId?: number;
    /** Optional MFA code for accounts that require it */
    mfaCode?: string | number;
    /** Minutes before JWT refresh (default 55) */
    tokenTTL?: number;
    /** Optional default headers passed to **every** request (apart from auth headers). */
    defaultHeaders?: Record<string, string>;
}
export { MendError, ERROR_CODES } from './errors';
export { Json } from './http';
export declare class MendSdk {
    private readonly httpClient;
    private readonly email;
    private readonly password;
    private readonly orgId?;
    private readonly mfaCode?;
    private readonly tokenTTL;
    private readonly authMutex;
    private activeOrgId;
    private availableOrgs;
    private jwt;
    private jwtExpiresAt;
    constructor(opts: MendSdkOptions);
    private authenticate;
    private completeLogin;
    private ensureAuth;
    /**
     * Make a request to the API with authentication handling
     *
     * ```ts
     * const response = await sdk.request('GET', '/user/me');
     * const ctrl = new AbortController();
     * const response2 = await sdk.request('GET', '/patients', null, {}, ctrl.signal);
     * // ctrl.abort();
     * ```
     */
    request<T = Json<any>>(method: HttpVerb, path: string, body?: unknown, query?: Record<string, string | number | boolean>, signal?: AbortSignal): Promise<T>;
    getOrg<T = Json<any>>(orgId: number, signal?: AbortSignal): Promise<T>;
    getUser<T = Json<any>>(userId: number, signal?: AbortSignal): Promise<T>;
    searchPatients<T = Json<any>>(query?: Record<string, string | number | boolean>, signal?: AbortSignal): Promise<T>;
    getPatient<T = Json<any>>(id: number, signal?: AbortSignal): Promise<T>;
    getPatientAssessmentScores<T = Json<any>>(id: number, signal?: AbortSignal): Promise<T>;
    createPatient<T = Json<any>>(payload: Json<any>, force?: boolean, signal?: AbortSignal): Promise<T>;
    updatePatient<T = Json<any>>(id: number, payload: Json<any>, force?: boolean, signal?: AbortSignal): Promise<T>;
    deletePatient<T = Json<any>>(id: number, signal?: AbortSignal): Promise<T>;
    getAppointment<T = Json<any>>(appointmentId: number, signal?: AbortSignal): Promise<T>;
    createAppointment<T = Json<any>>(payload: Json<any>, signal?: AbortSignal): Promise<T>;
    listOrgs<T = Json<any>>(signal?: AbortSignal): Promise<T>;
    /**
     * Submit MFA code to complete authentication (when 2FA is enabled on the account)
     */
    submitMfaCode(code: string | number, signal?: AbortSignal): Promise<void>;
    switchOrg(orgId: number, signal?: AbortSignal): Promise<void>;
    getProperties<T = Json<any>>(signal?: AbortSignal): Promise<T>;
    getProperty<T = Json<any>>(key: string, signal?: AbortSignal): Promise<T>;
}
export default MendSdk;
