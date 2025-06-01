/**
 * Custom error class for Mend SDK
 */
export class MendError extends Error {
  /** Programmatic error category */
  code: string;
  /** HTTP status if applicable */
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'MendError';
    this.code = code;
    this.status = status;
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, MendError.prototype);
  }
}

// Common error codes
export const ERROR_CODES = {
  SDK_CONFIG: 'SDK_CONFIG',
  AUTH_MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  AUTH_INVALID_MFA: 'AUTH_INVALID_MFA',
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  HTTP_ERROR: 'HTTP_ERROR',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
