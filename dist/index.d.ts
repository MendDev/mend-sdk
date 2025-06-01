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
export interface MendError extends Error {
  /** Programmatic error category */
  code: string;
  /** HTTP status if applicable */
  status?: number;
}
interface Json extends Record<string, unknown> {}
type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export declare class MendSdk {
  private readonly apiEndpoint;
  private readonly email;
  private readonly password;
  private readonly orgId?;
  private readonly mfaCode?;
  private readonly tokenTTL;
  private readonly defaultHeaders;
  private activeOrgId;
  private availableOrgs;
  private jwt;
  private jwtExpiresAt;
  constructor(opts: MendSdkOptions);
  private authenticate;
  private completeLogin;
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
  request<T = Json>(
    method: HttpVerb,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean>,
    signal?: AbortSignal,
  ): Promise<T>;
  getOrg(orgId: number, signal?: AbortSignal): Promise<Json>;
  getUser(userId: number, signal?: AbortSignal): Promise<Json>;
  searchPatients(
    query?: Record<string, string | number | boolean>,
    signal?: AbortSignal,
  ): Promise<Json>;
  getPatient(id: number, signal?: AbortSignal): Promise<Json>;
  getPatientAssessmentScores(id: number, signal?: AbortSignal): Promise<Json>;
  createPatient(payload: Json, force?: boolean, signal?: AbortSignal): Promise<Json>;
  updatePatient(id: number, payload: Json, force?: boolean, signal?: AbortSignal): Promise<Json>;
  deletePatient(id: number, signal?: AbortSignal): Promise<Json>;
  getAppointment(appointmentId: number, signal?: AbortSignal): Promise<Json>;
  createAppointment(payload: Json, signal?: AbortSignal): Promise<Json>;
  listOrgs(signal?: AbortSignal): Promise<Json>;
  /**
   * Provide a 6‑digit MFA code after calling {@link authenticate}.
   */
  submitMfaCode(code: string | number, signal?: AbortSignal): Promise<void>;
  switchOrg(orgId: number, signal?: AbortSignal): Promise<void>;
  getProperties(signal?: AbortSignal): Promise<Json>;
  getProperty(key: string, signal?: AbortSignal): Promise<any>;
}
export default MendSdk;
