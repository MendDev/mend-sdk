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
import {
  Org,
  User,
  Patient,
  AuthResponse,
  PropertiesResponse,
  ListOrgsResponse,
  CreatePatientPayload,
  AppointmentPayload,
} from './types';

// Why 55 minutes? Because JWTs expire after 1 hour, and we want to give
// some buffer time and avoid edge cases.
export const DEFAULT_TOKEN_TTL_MINUTES = 55;
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_RETRY_ATTEMPTS = 0;
export const DEFAULT_RETRY_BACKOFF_MS = 100;

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
  /** Minutes before JWT refresh (default {@link DEFAULT_TOKEN_TTL_MINUTES}) */
  tokenTTL?: number;
  /** Optional default headers passed to **every** request (apart from auth headers). */
  defaultHeaders?: Record<string, string>;
  /** Milliseconds before a request times out (default {@link DEFAULT_REQUEST_TIMEOUT_MS}) */
  requestTimeout?: number;
  /** Number of times to retry a failed request (default {@link DEFAULT_RETRY_ATTEMPTS}) */
  retryAttempts?: number;
  /** Base delay in ms for exponential backoff (default {@link DEFAULT_RETRY_BACKOFF_MS}) */
  retryBackoff?: number;
}

// Re-export MendError for consumers
export { MendError, ERROR_CODES } from './errors';
export type { ErrorContext } from './errors';
export { Json, QueryParams } from './http';
export type {
  Org,
  User,
  Patient,
  AuthResponse,
  PropertiesResponse,
  ListOrgsResponse,
  CreatePatientPayload,
  AppointmentPayload,
} from './types';

/* ------------------------------------------------------------------------------------------------
 * Main SDK Class
 * ----------------------------------------------------------------------------------------------*/

export class MendSdk {
  private readonly httpClient: HttpClient;
  private readonly email: string;
  private readonly password: string;
  private readonly orgId?: number;
  private mfaCode?: string | number;
  private readonly tokenTTL: number;
  private readonly requestTimeout: number;
  private readonly retryAttempts: number;
  private readonly retryBackoff: number;
  private readonly authMutex = new Mutex();

  private activeOrgId: number | null = null;
  private availableOrgs: Json<unknown>[] | null = null;

  private jwt: string | null = null;
  private jwtExpiresAt = 0; // epoch ms

  constructor(opts: MendSdkOptions) {
    if (!opts?.apiEndpoint || !opts?.email || !opts?.password) {
      throw new MendError('apiEndpoint, email and password are required', ERROR_CODES.SDK_CONFIG);
    }

    if (!/^https:\/\//i.test(opts.apiEndpoint)) {
      throw new MendError('apiEndpoint must use HTTPS', ERROR_CODES.SDK_CONFIG);
    }

    this.httpClient = createHttpClient({
      apiEndpoint: opts.apiEndpoint,
      defaultHeaders: opts.defaultHeaders,
    });

    this.email = opts.email;
    this.password = opts.password;
    this.orgId = opts.orgId;
    this.mfaCode = opts.mfaCode;
    this.tokenTTL = opts.tokenTTL ?? DEFAULT_TOKEN_TTL_MINUTES;
    this.requestTimeout = opts.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.retryAttempts = opts.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.retryBackoff = opts.retryBackoff ?? DEFAULT_RETRY_BACKOFF_MS;
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
      await this.submitMfaCode(this.mfaCode, undefined);
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
      // When no organization is pre-selected, callers can choose which org to
      // use. Avoid automatic switching to prevent unexpected network requests
      // during initialization.
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.jwt) headers['X-Access-Token'] = this.jwt;
    return headers;
  }

  private async fetchWithRetry<T>(
    method: HttpVerb,
    path: string,
    body: unknown,
    query: QueryParams,
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
        return await this.httpClient.fetch<T>(method, path, body, query, headers, ctrl.signal);
      } catch (err) {
        if (attempt >= this.retryAttempts) throw err;
        await this.delay(this.retryBackoff * 2 ** attempt);
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
   * Make an authenticated request to the API.
   *
   * The method automatically refreshes the JWT if the first attempt
   * returns a `401` response and retries the request once. Endpoints that
   * return an empty body (e.g. HTTP 204) resolve to `undefined`.
   *
   * ```ts
   * const response = await sdk.request('GET', '/user/me');
   * const ctrl = new AbortController();
   * const response2 = await sdk.request('GET', '/patients', null, {}, ctrl.signal);
   * // ctrl.abort();
   * ```
   *
   * @param method - HTTP method to perform
   * @param path - API path beginning with '/'
   * @param body - Optional JSON serialisable payload
   * @param query - Query string parameters
   * @param signal - Optional abort controller signal
   * @returns Parsed JSON response from the server
   * @throws {@link MendError} wrapping network or server failures
   */
  public async request<T = Json<unknown>>(
    method: HttpVerb,
    path: string,
    body?: unknown,
    query?: QueryParams,
    signal?: AbortSignal,
  ): Promise<T> {
    await this.ensureAuth();

    const doRequest = async () =>
      this.fetchWithRetry<T>(method, path, body, query || {}, this.buildAuthHeaders(), signal);

    try {
      return await doRequest();
    } catch (err) {
      if (err instanceof MendError && err.status === 401) {
        this.jwt = null;
        this.jwtExpiresAt = 0;
        await this.ensureAuth();
        return doRequest();
      }
      throw err;
    }
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Sample convenience wrappers – extend as required                                          */
  /* ------------------------------------------------------------------------------------------ */

  /**
   * Fetch details for a single organization.
   *
   * @param orgId - Organization ID
   * @param signal - Optional abort signal
   */
  public async getOrg<T = Json<unknown>>(orgId: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/org/${orgId}`, undefined, undefined, signal);
  }

  /**
   * Retrieve a user's details by ID.
   *
   * @param userId - User ID
   * @param signal - Optional abort signal
   */
  public async getUser<T = Json<unknown>>(userId: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/user/${userId}`, undefined, undefined, signal);
  }

  /**
   * List all users.
   *
   * @param query - Optional query / paging parameters
   * @param signal - Optional abort signal
   */
  public async listUsers<T = Json<unknown>>(
    query: QueryParams = {},
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('GET', '/user', undefined, query, signal);
  }

  /**
   * List users filtered by role.
   *
   * @param role - Role name (e.g. 'Patient', 'Admin')
   * @param query - Optional query / paging parameters
   * @param signal - Optional abort signal
   */
  public async listUsersByRole<T = Json<unknown>>(
    role: string,
    query: QueryParams = {},
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('GET', `/user/${encodeURIComponent(role)}`, undefined, query, signal);
  }

  /**
   * Create a new user.
   *
   * @param payload - User data to send in the request body. This should
   *   include fields accepted by the `/user` API such as
   *   `firstName`, `lastName`, `email`, etc.
   * @param signal - Optional abort signal
   */
  public async createUser<T = Json<unknown>>(
    payload: Json<unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('POST', '/user', payload, undefined, signal);
  }

  /**
   * Update an existing user.
   *
   * @param id - User ID
   * @param payload - Fields to update
   * @param signal - Optional abort signal
   */
  public async updateUser<T = Json<unknown>>(
    id: number,
    payload: Json<unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('PUT', `/user/${id}`, payload, undefined, signal);
  }

  /**
   * Update a user's timezone.
   *
   * @param id - User ID
   * @param timeZone - IANA / PHP compatible timezone string (e.g. 'America/New_York')
   * @param force - Pass `true` to override an existing timezone
   * @param signal - Optional abort signal
   */
  public async updateUserTimezone<T = Json<unknown>>(
    id: number,
    timeZone: string,
    force = false,
    signal?: AbortSignal,
  ): Promise<T> {
    const body: Json<unknown> = force ? { timeZone, forceTimezoneUpdate: true } : { timeZone };
    return this.request<T>('PUT', `/user/${id}`, body, undefined, signal);
  }

  /**
   * Search patients using any supported query parameters.
   *
   * @param query - Search filters and paging options
   * @param signal - Optional abort signal
   */
  public async searchPatients<T = Json<unknown>>(
    query: QueryParams = {},
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('GET', '/patient', undefined, query, signal);
  }

  /**
   * Get a patient record by ID.
   *
   * @param id - Patient ID
   * @param signal - Optional abort signal
   *
   * Throws a {@link MendError} with `HTTP_ERROR` code when the
   * patient cannot be found (404).
   */
  public async getPatient<T = Json<unknown>>(id: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', `/patient/${id}`, undefined, undefined, signal);
  }

  /**
   * Fetch assessment scores for a patient.
   *
   * @param id - Patient ID
   * @param signal - Optional abort signal
   */
  public async getPatientAssessmentScores<T = Json<unknown>>(
    id: number,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('GET', `/patient/${id}/assessment-scores`, undefined, undefined, signal);
  }

  /**
   * Create a new patient record.
   *
   * @param payload - Patient data to send in the request body. This should
   *   include fields accepted by the `/patient` API such as
   *   `firstName`, `lastName`, `email`, etc.
   * @param force - Bypass age or validation checks
   * @param signal - Optional abort signal
   */
  public async createPatient<T = Json<unknown>>(
    payload: CreatePatientPayload,
    force = false,
    signal?: AbortSignal,
  ): Promise<T> {
    const body = force ? { ...payload, force: 1 } : payload;
    return this.request<T>('POST', '/patient', body, undefined, signal);
  }

  /**
   * Update an existing patient record.
   *
   * @param id - Patient ID
   * @param payload - Fields to update. Provide only the keys to modify
   *   (e.g. `mobile`, `email`).
   * @param force - Ignore update limits
   * @param signal - Optional abort signal
   */
  public async updatePatient<T = Json<unknown>>(
    id: number,
    payload: Json<unknown>,
    force = false,
    signal?: AbortSignal,
  ): Promise<T> {
    const path = force ? `/patient/${id}/force` : `/patient/${id}`;
    return this.request<T>('PUT', path, payload, undefined, signal);
  }

  /**
   * Delete a patient record.
   *
   * @param id - Patient ID
   * @param signal - Optional abort signal
   *
   * Throws a {@link MendError} if the patient does not exist.
   */
  public async deletePatient<T = Json<unknown>>(id: number, signal?: AbortSignal): Promise<T> {
    return this.request<T>('DELETE', `/patient/${id}`, undefined, undefined, signal);
  }

  /**
   * Retrieve an appointment by ID.
   *
   * @param appointmentId - Appointment ID
   * @param signal - Optional abort signal
   */
  public async getAppointment<T = Json<unknown>>(
    appointmentId: number,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>('GET', `/appointment/${appointmentId}`, undefined, undefined, signal);
  }

  /**
   * Create an appointment (POST /appointment).
   * The SDK injects { optimized: 1 } automatically.
   *
   * @param payload - Appointment details (see `AppointmentPayload`)
   * @param signal - Optional abort signal
   */
  public async createAppointment<T = Json<unknown>>(
    payload: AppointmentPayload,
    signal?: AbortSignal,
  ): Promise<T> {
    /* Validate required fields ----------------------------------------------------*/
    const missing: string[] = [];
    if (!payload.patientId) missing.push('patientId');
    if (!payload.providerId) missing.push('providerId');
    if (!payload.appointmentTypeId) missing.push('appointmentTypeId');
    if (!payload.startDate) missing.push('startDate');
    if (!payload.endDate) missing.push('endDate');

    if (missing.length) {
      throw new MendError(`Missing required fields: ${missing.join(', ')}`, ERROR_CODES.SDK_CONFIG);
    }

    /* Auto-inject approved flag when caller omitted it ---------------------------*/
    let approvedVal = payload.approved;
    if (approvedVal === undefined) {
      try {
        const autoApprove = await this.getProperty<number>('scheduling.patients.autoApprove');
        approvedVal = autoApprove === 1 ? 1 : 0;
      } catch {
        // Swallow – property may not exist; default remains undefined
      }
    }

    const body: AppointmentPayload = {
      optimized: 1,
      ...payload,
      ...(approvedVal !== undefined ? { approved: approvedVal } : {}),
    } as AppointmentPayload;

    return this.request<T>('POST', '/appointment', body, undefined, signal);
  }

  /**
   * List available appointment slots for a provider / type.
   * Thin wrapper around the API – more advanced logic lives in higher layers.
   */
  public async listAvailableSlots<T = Json<unknown>>(
    providerId: number,
    appointmentTypeId: number,
    startDate: string,
    limit = 10,
    signal?: AbortSignal,
  ): Promise<T> {
    const query: QueryParams = {
      providerId,
      appointmentTypeId,
      startDate,
      limit,
    };
    return this.request<T>('GET', '/appointment/available-slots', undefined, query, signal);
  }

  /**
   * Retrieve appointment-type details.
   */
  public async getAppointmentType<T = Json<unknown>>(
    appointmentTypeId: number,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>(
      'GET',
      `/appointment-type/${appointmentTypeId}`,
      undefined,
      undefined,
      signal,
    );
  }

  /**
   * List organizations available to the account.
   *
   * @param signal - Optional abort signal
   */
  public async listOrgs<T = ListOrgsResponse>(signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', '/org', undefined, undefined, signal);
  }

  /**
   * Submit MFA code to complete authentication (when 2FA is enabled on the account)
   */
  public async submitMfaCode(code: string | number, signal?: AbortSignal): Promise<void> {
    // This bypasses ensureAuth, but still needs the current token if available
    const authHeaders = this.buildAuthHeaders();

    const res = await this.httpClient.fetch<AuthResponse>(
      'PUT',
      '/session/mfa',
      { mfaCode: code },
      {},
      authHeaders,
      signal,
    );

    await this.completeLogin(res);
    this.mfaCode = undefined;
  }

  /**
   * Switch the active organization.
   *
   * @param orgId - Organization ID to switch to
   * @param signal - Optional abort signal
   */
  public async switchOrg(orgId: number, signal?: AbortSignal): Promise<void> {
    await this.request<Json<unknown>>('PUT', `/session/org/${orgId}`, {}, undefined, signal);
    this.activeOrgId = orgId;
  }

  /**
   * Retrieve all application properties.
   *
   * @param signal - Optional abort signal
   */
  public async getProperties<T = PropertiesResponse>(signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', '/property', undefined, undefined, signal);
  }

  /**
   * Convenience wrapper around `getProperties()` returning only the value.
   *
   * @param key - Property key to retrieve
   * @param signal - Optional abort signal
   * @returns The value stored for the given key
   */
  public async getProperty<T = unknown>(key: string, signal?: AbortSignal): Promise<T> {
    const props = await this.getProperties<PropertiesResponse>(signal);
    return props.payload.properties[key] as T;
  }

  /**
   * Clear authentication state and JWTs
   */
  public logout(): void {
    this.jwt = null;
    this.jwtExpiresAt = 0;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Default export for CJS interop
 * ----------------------------------------------------------------------------------------------*/
export default MendSdk;
