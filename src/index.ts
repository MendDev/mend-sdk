// mend-sdk.ts
// Lightweight Type‑Safe Mend SDK (fetch‑based)
// ---------------------------------------------------------------------------
// • Written in **TypeScript** so consumers get full IntelliSense.
// • Uses the native `fetch()` API (+AbortController) instead of axios.
// • Emits purposeful errors with `code` fields so callers can branch.
// • **No runtime React dep** – a React‑specific layer can live in
//   `@mend/sdk/react` later if you wish.
// ---------------------------------------------------------------------------

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
  
  export interface MendError extends Error {
    /** Programmatic error category */
    code: string;
    /** HTTP status if applicable */
    status?: number;
  }
  
  /* ------------------------------------------------------------------------------------------------
   * Internal Types
   * ----------------------------------------------------------------------------------------------*/
  
  interface Json
    extends Record<string, unknown> {}
  
  type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  
  /* ------------------------------------------------------------------------------------------------
   * Main SDK Class
   * ----------------------------------------------------------------------------------------------*/
  
  export class MendSdk {
    private readonly apiEndpoint: string;
    private readonly email: string;
    private readonly password: string;
    private readonly orgId?: number;
    private readonly mfaCode?: string | number;
    private readonly tokenTTL: number;
    private readonly defaultHeaders: Record<string, string>;

    private activeOrgId: number | null = null;
    private availableOrgs: Json[] | null = null;
  
    private jwt: string | null = null;
    private jwtExpiresAt = 0; // epoch ms
  
    constructor (opts: MendSdkOptions) {
      if (!opts?.apiEndpoint || !opts?.email || !opts?.password) {
        throw Object.assign(new Error('apiEndpoint, email and password are required'), { code: 'SDK_CONFIG' });
      }

      this.apiEndpoint    = opts.apiEndpoint.replace(/\/$/, '');
      this.email          = opts.email;
      this.password       = opts.password;
      this.orgId          = opts.orgId;
      this.mfaCode        = opts.mfaCode;
      this.tokenTTL       = opts.tokenTTL ?? 55;
      this.defaultHeaders = opts.defaultHeaders ?? {};
    }
  
    /* ------------------------------------------------------------------------------------------ */
    /* Authentication                                                                            */
    /* ------------------------------------------------------------------------------------------ */
  
    private async authenticate (): Promise<void> {
      const res = await this.fetch<Json>('POST', '/session', {
        email   : this.email,
        password: this.password
      }, {}, /* skipAuth = */ true);

      const token = (res as any).token as string | undefined;
      if (token) {
        await this.completeLogin(res);
        return;
      }

      if (this.mfaCode !== undefined) {
        await this.submitMfaCode(this.mfaCode);
        return;
      }

      throw Object.assign(new Error('JWT not returned by /session'), { code: 'AUTH_MISSING_TOKEN' });
    }

    private async completeLogin (res: Json): Promise<void> {
      const token = (res as any).token as string | undefined;
      if (!token) {
        throw Object.assign(new Error('JWT not returned by /session'), { code: 'AUTH_MISSING_TOKEN' });
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
          this.availableOrgs = Array.isArray(orgs?.payload) ? (orgs as any).payload : (orgs as any)?.payload?.orgs;
        }
        if (Array.isArray(this.availableOrgs) && this.availableOrgs.length === 1) {
          const first = this.availableOrgs[0];
          const id = (first as any).id ?? (first as any).orgId;
          if (id) await this.switchOrg(id);
        }
      }
    }
  
    private async ensureAuth (): Promise<void> {
      if (!this.jwt || Date.now() >= this.jwtExpiresAt) {
        await this.authenticate();
      }
    }
  
    /* ------------------------------------------------------------------------------------------ */
    /* Low‑level request helper                                                                   */
    /* ------------------------------------------------------------------------------------------ */
  
    private async fetch<T = Json>(
      method: HttpVerb,
      path: string,
      body?: unknown,
      query: Record<string, string | number | boolean> = {},
      skipAuth = false,
      signal?: AbortSignal
    ): Promise<T> {
      if (!skipAuth) await this.ensureAuth();
  
      /* Query‑string ------------------------------------------------------------------------- */
      const qs = Object.keys(query).length
        ? '?' + new URLSearchParams(query as Record<string,string>).toString()
        : '';
  
      const url = this.apiEndpoint + path + qs;
  
      /* Headers --------------------------------------------------------------------------------*/
      const headers: Record<string, string> = {
        'Content-Type' : 'application/json',
        'Accept'       : 'application/json',
        ...this.defaultHeaders
      };
      if (!skipAuth && this.jwt) headers['X-Access-Token'] = this.jwt;
  
      /* Fetch call ----------------------------------------------------------------------------*/
      const resp = await fetch(url, {
        method,
        headers,
        body   : body ? JSON.stringify(body) : undefined,
        signal
      });
  
      /* Error handling ------------------------------------------------------------------------*/
      if (!resp.ok) {
        const err: MendError = Object.assign(new Error(`HTTP ${resp.status} – ${resp.statusText}`), {
          code  : 'HTTP_ERROR',
          status: resp.status
        });
        throw err;
      }
  
      /* Some endpoints return empty body (204).  Attempt JSON parse only when content exists. */
      const text = await resp.text();
      return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
    }
  
    /* ------------------------------------------------------------------------------------------ */
    /* Public generic request that callers may use directly                                      */
    /* ------------------------------------------------------------------------------------------ */
  
    /**
     * Perform an authenticated request (abort‑able).
     * @example
     * ```ts
     * const ctrl = new AbortController();
     * sdk.request('GET', '/org/2', undefined, {}, ctrl.signal);
     * // ctrl.abort();
     * ```
     */
    public async request<T = Json>(
      method : HttpVerb,
      path   : string,
      body   ?: unknown,
      query  ?: Record<string,string|number|boolean>,
      signal ?: AbortSignal
    ): Promise<T> {
      return this.fetch<T>(method, path, body, query, false, signal);
    }
  
    /* ------------------------------------------------------------------------------------------ */
    /* Sample convenience wrappers – extend as required                                          */
    /* ------------------------------------------------------------------------------------------ */
  
    public getOrg (orgId: number, signal?: AbortSignal) {
      return this.request<Json>('GET', `/org/${orgId}`, undefined, undefined, signal);
    }
  
    public getUser (userId: number, signal?: AbortSignal) {
      return this.request<Json>('GET', `/user/${userId}`, undefined, undefined, signal);
    }
  
    public listPatients (search: string, page = 1, limit = 25, signal?: AbortSignal) {
      return this.request<Json>('GET', '/patient', undefined, { search, page, limit }, signal);
    }
  
    public getAppointment (appointmentId: number, signal?: AbortSignal) {
      return this.request<Json>('GET', `/appointment/${appointmentId}`, undefined, undefined, signal);
    }
  
    public createAppointment (payload: Json, signal?: AbortSignal) {
      return this.request<Json>('POST', '/appointment', payload, undefined, signal);
    }

    public listOrgs (signal?: AbortSignal) {
      return this.request<Json>('GET', '/org', undefined, undefined, signal);
    }

    /**
     * Provide a 6‑digit MFA code after calling {@link authenticate}.
     */
    public async submitMfaCode (code: string | number, signal?: AbortSignal): Promise<void> {
      const res = await this.fetch<Json>('PUT', '/session/mfa', { mfaCode: code }, {}, true, signal);
      await this.completeLogin(res);
    }

    public async switchOrg (orgId: number, signal?: AbortSignal): Promise<void> {
      await this.request<Json>('PUT', `/session/org/${orgId}`, {}, undefined, signal);
      this.activeOrgId = orgId;
    }

    public async getProperties (signal?: AbortSignal) {
      return this.request<Json>('GET', '/property', undefined, undefined, signal);
    }

    public async getProperty (key: string, signal?: AbortSignal) {
      const props = await this.getProperties(signal);
      return (props as any)?.payload?.properties?.[key];
    }
  }
  
  /* ------------------------------------------------------------------------------------------------
   * Default export for CJS interop
   * ----------------------------------------------------------------------------------------------*/
  export default MendSdk;
  