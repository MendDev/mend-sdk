/**
 * Custom error class for Mend SDK
 */
export class MendError extends Error {
  /** Programmatic error category */
  code: ErrorCode;
  /** HTTP status if applicable */
  status?: number;
  /** Parsed error body returned by the API */
  details?: unknown;
  /** Additional metadata about the request/response */
  context?: ErrorContext;

  constructor(
    message: string,
    code: ErrorCode,
    status?: number,
    details?: unknown,
    context?: ErrorContext,
  ) {
    super(message);
    this.name = 'MendError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.context = context;

    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, MendError.prototype);
  }
}

/**
 * Matrix of error codes emitted by the SDK
 */
export const ERROR_CODES = {
  /** missing or invalid SDK configuration */
  SDK_CONFIG: 'SDK_CONFIG',
  /** login succeeded but no JWT was returned */
  AUTH_MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  /** MFA code is required to finish authentication */
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  /** provided MFA code was invalid */
  AUTH_INVALID_MFA: 'AUTH_INVALID_MFA',
  /** selected organization does not exist */
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  /** generic HTTP or server error */
  HTTP_ERROR: 'HTTP_ERROR',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Additional context about a failed request */
export interface ErrorContext {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  responseBody?: unknown;
}
