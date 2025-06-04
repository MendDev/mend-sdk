/**
 * Custom error class for Mend SDK
 */
export class MendError extends Error {
  /** Programmatic error category */
  code: string;
  /** HTTP status if applicable */
  status?: number;
  /** Parsed error body returned by the server */
  details?: unknown;

  constructor(message: string, code: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'MendError';
    this.code = code;
    this.status = status;
    this.details = details;
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, MendError.prototype);
  }
}

// Common error codes
export const ERROR_CODES = {
  /** Missing or invalid SDK configuration */
  SDK_CONFIG: 'SDK_CONFIG',
  /** API did not return a JWT token */
  AUTH_MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  /** Login requires multi‑factor authentication */
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  /** Provided MFA code was rejected */
  AUTH_INVALID_MFA: 'AUTH_INVALID_MFA',
  /** Requested organization does not exist */
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  /** Generic HTTP failure */
  HTTP_ERROR: 'HTTP_ERROR',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
