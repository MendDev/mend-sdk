// mend-sdk.ts
// Lightweight Type‑Safe Mend SDK (fetch‑based)
// ---------------------------------------------------------------------------
// • Written in **TypeScript** so consumers get full IntelliSense.
// • Uses the native `fetch()` API (+AbortController) instead of axios.
// • Emits purposeful errors with `code` fields so callers can branch.
// • **No runtime React dep** – a React‑specific layer can live in
//   `@mend/sdk/react` later if you wish.
// ---------------------------------------------------------------------------
import { MendError, ERROR_CODES } from './errors';
import { HttpClient, HttpVerb, Json, QueryParams, createHttpClient } from './http';
import { Mutex } from './mutex';
import { Org, User, Patient, AuthResponse, PropertiesResponse, ListOrgsResponse } from './types';

/* ------------------------------------------------------------------------------------------------
 * Public Types
 * ----------------------------------------------------------------------------------------------*/

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
  /** Milliseconds before a request times out (default 30000) */
  requestTimeout?: number;
  /** Number of times to retry a failed request (default 0) */
  retryAttempts?: number;
}

// Re-export MendError for consumers
export { MendError, ERROR_CODES } from './errors';
export { Json, QueryParams } from './http';
export type { Org, User, Patient, AuthResponse, PropertiesResponse, ListOrgsResponse } from './types';

/* ------------------------------------------------------------------------------------------------
 * Main SDK Class
 * ----------------------------------------------------------------------------------------------*/

export class MendSdk {
  private readonly httpClient: HttpClient;
  private readonly email: string;
  private readonly password: string;
  private readonly orgId?: number;
  private readonly mfaCode?: string | number;
  private readonly tokenTTL: number;
  private readonly requestTimeout: number;
  private readonly retryAttempts: number;
  private readonly authMutex = new Mutex();

  private activeOrgId: number | null = null;
  private availableOrgs: Json<any>[] | null = null;

  private jwt: string | null = null;
  private jwtExpiresAt = 0; // epoch ms

  constructor(opts: MendSdkOptions) {
    if (!opts?.apiEndpoint || !opts?.email || !opts?.password) {
      throw new MendError('apiEndpoint, email and password are required', ERROR_CODES.SDK_CONFIG);
    }

    this.httpClient = createHttpClient({
      apiEndpoint: opts.apiEndpoint,
      defaultHeaders: opts.defaultHeaders,
    });
    
    this.email = opts.email;
    this.password = opts.password;
    this.orgId = opts.orgId;
    this.mfaCode = opts.mfaCode;
    this.tokenTTL = opts.tokenTTL ?? 55;
    this.requestTimeout = opts.requestTimeout ?? 30_000;
    this.retryAttempts = opts.retryAttempts ?? 0;
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Authentication                                                                            */
  /* ------------------------------------------------------------------------------------------ */

  private async authenticate(): Promise<void> {
    const res = await this.httpClient.fetch<AuthResponse>(
      'POST',
      '/session',
      {
        email: this.email,
        password: this.password,
      },
      {},
      {},
    );

    const token = res.token;
    if (token) {
      await this.completeLogin(res);
      return;
    }

    if (this.mfaCode !== undefined) {
      await this.submitMfaCode(this.mfaCode);
      return;
    }

    throw new MendError('JWT not returned by /session', ERROR_CODES.AUTH_MISSING_TOKEN);
  }

  private async completeLogin(res: AuthResponse): Promise<void> {
    const token = res.token;
    if (!token) {
      throw new MendError('JWT not returned by /session', ERROR_CODES.AUTH_MISSING_TOKEN);
    }

    this.jwt = token;
    this.jwtExpiresAt = Date.now() + this.tokenTTL * 60_000;

    const payload = res.payload;
    if (Array.isArray(payload?.orgs)) {
      this.availableOrgs = payload.orgs;
    }

    if (this.orgId !== undefined) {
      await this.switchOrg(this.orgId);
    } else {
      if (!this.availableOrgs) {
        const orgs = await this.listOrgs<ListOrgsResponse>();
        this.availableOrgs = orgs.payload.orgs;
      }
      if (Array.isArray(this.availableOrgs) && this.availableOrgs.length === 1) {
        const first = this.availableOrgs[0] as Org;
        const id = first.id ?? first.orgId;
        if (id) await this.switchOrg(id);
      }
    }
  }

  private async ensureAuth(): Promise<void> {
    // Use mutex to prevent multiple concurrent authentication attempts
  // Fast-path: token still valid → no locking required
  if (this.jwt && Date.now() < this.jwtExpiresAt) return;

   await this.authMutex.lock(async () => {
    // Double-check in case another waiter already refreshed the token
    if (!this.jwt || Date.now() >= this.jwtExpiresAt) {
      await this.authenticate();
    }
   });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry<T>(
    method: HttpVerb,
    path: string,
    body: unknown,
    query: Record<string, string | number | boolean>,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      const ctrl = new AbortController();
      const timer = this.requestTimeout
        ? setTimeout(() => ctrl.abort(), this.requestTimeout)
        : null;

      const onAbort = () => ctrl.abort();
      if (signal) {
        if (signal.aborted) ctrl.abort();
        else signal.addEventListener('abort', onAbort);
      }

      try {
        return await this.httpClient.fetch<T>(
          method,
          path,
          body,
          query,
          headers,
          ctrl.signal,
        );
      } catch (err) {
        if (attempt >= this.retryAttempts) throw err;
        await this.delay(2 ** attempt * 100);
        attempt += 1;
      } finally {
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
    }
  }

  /* ------------------------------------------------------------------------------------------ */
  /* API Request Methods                                                                       */
  /* ------------------------------------------------------------------------------------------ */

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
  public async request<T = Json<any>>(
    method: HttpVerb,
    path: string,
    body?: unknown,
    query?: QueryParams,
    signal?: AbortSignal,
  ): Promise<T> {
    await this.ensureAuth();
    
    // Initialize empty headers object as Record<string, string>
    const authHeaders: Record<string, string> = {};
    
    // Only add the token if it exists
    if (this.jwt) {
      authHeaders['X-Access-Token'] = this.jwt;
    }

    return this.fetchWithRetry<T>(
      method,
      path,
      body,
      query || {},
      authHeaders,
      signal,
    );
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Sample convenience wrappers – extend as required                                          */
  /* ------------------------------------------------------------------------------------------ */

  public async getOrg<T = Json<any>>(orgId: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/org/${orgId}`, undefined, undefined, signal);
  }

  public async getUser<T = Json<any>>(userId: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/user/${userId}`, undefined, undefined, signal);
  }

  public async searchPatients<T = Json<any>>(
    query: QueryParams = {},
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('GET', '/patient', undefined, query, signal);
  }

  public async getPatient<T = Json<any>>(id: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/patient/${id}`, undefined, undefined, signal);
  }

  public async getPatientAssessmentScores<T = Json<any>>(id: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/patient/${id}/assessment-scores`, undefined, undefined, signal);
  }

  public async createPatient<T = Json<any>>(payload: Json<any>, force = false, signal?: AbortSignal): Promise<T> {
    const path = force ? '/patient/force' : '/patient';
    return this.request<T>('POST', path, payload, undefined, signal);
  }

  public async updatePatient<T = Json<any>>(id: number, payload: Json<any>, force = false, signal?: AbortSignal): Promise<T> {
    const path = force ? `/patient/${id}/force` : `/patient/${id}`;
    return this.request<T>('PUT', path, payload, undefined, signal);
  }

  public async deletePatient<T = Json<any>>(id: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('DELETE', `/patient/${id}`, undefined, undefined, signal);
  }

  public async getAppointment<T = Json<any>>(appointmentId: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/appointment/${appointmentId}`, undefined, undefined, signal);
  }

  public async createAppointment<T = Json<any>>(payload: Json<any>, signal?: AbortSignal): Promise<T> {
    return this.request<T>('POST', '/appointment', payload, undefined, signal);
  }

  public async listOrgs<T = ListOrgsResponse>(signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', '/org', undefined, undefined, signal);
  }

  /**
   * Submit MFA code to complete authentication (when 2FA is enabled on the account)
   */
  public async submitMfaCode(code: string | number, signal?: AbortSignal): Promise<void> {
    // This is a special case - we need to bypass the normal auth flow
    // Initialize empty headers object as Record<string, string>
    const authHeaders: Record<string, string> = {};
    
    // Only add the token if it exists
    if (this.jwt) {
      authHeaders['X-Access-Token'] = this.jwt;
    }
    
    const res = await this.httpClient.fetch<Json<any>>(
      'PUT',
      '/session/mfa',
      { mfaCode: code },
      {},
      authHeaders,
      signal
    );
    
    await this.completeLogin(res);
  }

  public async switchOrg(orgId: number, signal?: AbortSignal): Promise<void> {
    await this.request<Json<any>>('PUT', `/session/org/${orgId}`, {}, undefined, signal);
    this.activeOrgId = orgId;
  }

  public async getProperties<T = PropertiesResponse>(signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', '/property', undefined, undefined, signal);
  }

  public async getProperty<T = unknown>(key: string, signal?: AbortSignal): Promise<T> {
    const props = await this.getProperties<PropertiesResponse>(signal);
    return props.payload.properties[key] as T;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Default export for CJS interop
 * ----------------------------------------------------------------------------------------------*/
export default MendSdk;
