"use strict";
// mend-sdk.ts
// Lightweight Type‑Safe Mend SDK (fetch‑based)
// ---------------------------------------------------------------------------
// • Written in **TypeScript** so consumers get full IntelliSense.
// • Uses the native `fetch()` API (+AbortController) instead of axios.
// • Emits purposeful errors with `code` fields so callers can branch.
// • **No runtime React dep** – a React‑specific layer can live in
//   `@mend/sdk/react` later if you wish.
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.MendSdk = void 0;
/* ------------------------------------------------------------------------------------------------
 * Main SDK Class
 * ----------------------------------------------------------------------------------------------*/
class MendSdk {
    constructor(opts) {
        var _a, _b;
        this.jwt = null;
        this.jwtExpiresAt = 0; // epoch ms
        if (!(opts === null || opts === void 0 ? void 0 : opts.apiEndpoint) || !(opts === null || opts === void 0 ? void 0 : opts.adminEmail) || !(opts === null || opts === void 0 ? void 0 : opts.adminPassword)) {
            throw Object.assign(new Error('apiEndpoint, adminEmail, and adminPassword are required'), { code: 'SDK_CONFIG' });
        }
        this.apiEndpoint = opts.apiEndpoint.replace(/\/$/, '');
        this.adminEmail = opts.adminEmail;
        this.adminPassword = opts.adminPassword;
        this.tokenTTL = (_a = opts.tokenTTL) !== null && _a !== void 0 ? _a : 55;
        this.defaultHeaders = (_b = opts.defaultHeaders) !== null && _b !== void 0 ? _b : {};
    }
    /* ------------------------------------------------------------------------------------------ */
    /* Authentication                                                                            */
    /* ------------------------------------------------------------------------------------------ */
    async authenticate() {
        const res = await this.fetch('POST', '/session', {
            email: this.adminEmail,
            password: this.adminPassword
        }, {}, /* skipAuth = */ true);
        const token = res.token;
        if (!token) {
            throw Object.assign(new Error('JWT not returned by /session'), { code: 'AUTH_MISSING_TOKEN' });
        }
        this.jwt = token;
        this.jwtExpiresAt = Date.now() + this.tokenTTL * 60000;
    }
    async ensureAuth() {
        if (!this.jwt || Date.now() >= this.jwtExpiresAt) {
            await this.authenticate();
        }
    }
    /* ------------------------------------------------------------------------------------------ */
    /* Low‑level request helper                                                                   */
    /* ------------------------------------------------------------------------------------------ */
    async fetch(method, path, body, query = {}, skipAuth = false, signal) {
        if (!skipAuth)
            await this.ensureAuth();
        /* Query‑string ------------------------------------------------------------------------- */
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : '';
        const url = this.apiEndpoint + path + qs;
        /* Headers --------------------------------------------------------------------------------*/
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.defaultHeaders
        };
        if (!skipAuth && this.jwt)
            headers['X-Access-Token'] = this.jwt;
        /* Fetch call ----------------------------------------------------------------------------*/
        const resp = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal
        });
        /* Error handling ------------------------------------------------------------------------*/
        if (!resp.ok) {
            const err = Object.assign(new Error(`HTTP ${resp.status} – ${resp.statusText}`), {
                code: 'HTTP_ERROR',
                status: resp.status
            });
            throw err;
        }
        /* Some endpoints return empty body (204).  Attempt JSON parse only when content exists. */
        const text = await resp.text();
        return text ? JSON.parse(text) : undefined;
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
    async request(method, path, body, query, signal) {
        return this.fetch(method, path, body, query, false, signal);
    }
    /* ------------------------------------------------------------------------------------------ */
    /* Sample convenience wrappers – extend as required                                          */
    /* ------------------------------------------------------------------------------------------ */
    getOrg(orgId, signal) {
        return this.request('GET', `/org/${orgId}`, undefined, undefined, signal);
    }
    getUser(userId, signal) {
        return this.request('GET', `/user/${userId}`, undefined, undefined, signal);
    }
    listPatients(search, page = 1, limit = 25, signal) {
        return this.request('GET', '/patient', undefined, { search, page, limit }, signal);
    }
    getAppointment(appointmentId, signal) {
        return this.request('GET', `/appointment/${appointmentId}`, undefined, undefined, signal);
    }
    createAppointment(payload, signal) {
        return this.request('POST', '/appointment', payload, undefined, signal);
    }
}
exports.MendSdk = MendSdk;
/* ------------------------------------------------------------------------------------------------
 * Default export for CJS interop
 * ----------------------------------------------------------------------------------------------*/
exports.default = MendSdk;
