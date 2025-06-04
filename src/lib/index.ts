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
import { HttpClient, HttpVerb, Json, createHttpClient } from './http';
import { Mutex } from './mutex';

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
}

// Re-export MendError for consumers
export { MendError, ERROR_CODES } from './errors';
export { Json } from './http';

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
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Authentication                                                                            */
  /* ------------------------------------------------------------------------------------------ */

  private async authenticate(): Promise<void> {
    let res: Json<any>;
    try {
      res = await this.httpClient.fetch<Json<any>>(
        'POST',
        '/session',
        {
          email: this.email,
          password: this.password,
        },
        {},
        {},
      );
    } catch (err) {
      if (err instanceof MendError) {
        const msg = JSON.stringify(err.details ?? '').toLowerCase();
        if (err.status === 401 && msg.includes('mfa')) {
          throw new MendError(
            'MFA required',
            ERROR_CODES.AUTH_MFA_REQUIRED,
            err.status,
            err.details,
          );
        }
      }
      throw err;
    }

    const token = (res as any).token as string | undefined;
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

  private async completeLogin(res: Json<any>): Promise<void> {
    const token = (res as any).token as string | undefined;
    if (!token) {
      throw new MendError('JWT not returned by /session', ERROR_CODES.AUTH_MISSING_TOKEN);
    }

    this.jwt = token;
    this.jwtExpiresAt = Date.now() + this.tokenTTL * 60_000;

    const payload = (res as any)?.payload;
    if (Array.isArray(payload?.orgs)) {
      this.availableOrgs = payload.orgs;
    }

    if (this.orgId !== undefined) {
      await this.switchOrg(this.orgId);
    } else {
      if (!this.availableOrgs) {
        const orgs = await this.listOrgs();
        this.availableOrgs = Array.isArray(orgs?.payload)
          ? (orgs as any).payload
          : (orgs as any)?.payload?.orgs;
      }
      if (Array.isArray(this.availableOrgs) && this.availableOrgs.length === 1) {
        const first = this.availableOrgs[0];
        const id = (first as any).id ?? (first as any).orgId;
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
    query?: Record<string, string | number | boolean>,
    signal?: AbortSignal,
  ): Promise<T> {
    await this.ensureAuth();
    
    // Initialize empty headers object as Record<string, string>
    const authHeaders: Record<string, string> = {};
    
    // Only add the token if it exists
    if (this.jwt) {
      authHeaders['X-Access-Token'] = this.jwt;
    }
    
    return this.httpClient.fetch<T>(
      method,
      path,
      body,
      query || {},
      authHeaders,
      signal
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
    query: Record<string, string | number | boolean> = {},
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

  public async listOrgs<T = Json<any>>(signal?: AbortSignal): Promise<T> {
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
    
    let res: Json<any>;
    try {
      res = await this.httpClient.fetch<Json<any>>(
        'PUT',
        '/session/mfa',
        { mfaCode: code },
        {},
        authHeaders,
        signal
      );
    } catch (err) {
      if (err instanceof MendError) {
        throw new MendError(
          'Invalid MFA code',
          ERROR_CODES.AUTH_INVALID_MFA,
          err.status,
          err.details,
        );
      }
      throw err;
    }

    await this.completeLogin(res);
  }

  public async switchOrg(orgId: number, signal?: AbortSignal): Promise<void> {
    try {
      await this.request<Json<any>>('PUT', `/session/org/${orgId}`, {}, undefined, signal);
      this.activeOrgId = orgId;
    } catch (err) {
      if (err instanceof MendError && err.status === 404) {
        throw new MendError('Organization not found', ERROR_CODES.ORG_NOT_FOUND, err.status, err.details);
      }
      throw err;
    }
  }

  public async getProperties<T = Json<any>>(signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', '/property', undefined, undefined, signal);
  }

  public async getProperty<T = Json<any>>(key: string, signal?: AbortSignal): Promise<T> {
    const props = await this.getProperties<T>(signal);
    return (props as any)?.payload?.properties?.[key];
  }
}

/* ------------------------------------------------------------------------------------------------
 * Default export for CJS interop
 * ----------------------------------------------------------------------------------------------*/
export default MendSdk;
