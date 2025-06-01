/**
 * Custom error class for Mend SDK
 */
export declare class MendError extends Error {
    /** Programmatic error category */
    code: string;
    /** HTTP status if applicable */
    status?: number;
    constructor(message: string, code: string, status?: number);
}
export declare const ERROR_CODES: {
    readonly SDK_CONFIG: "SDK_CONFIG";
    readonly AUTH_MISSING_TOKEN: "AUTH_MISSING_TOKEN";
    readonly AUTH_MFA_REQUIRED: "AUTH_MFA_REQUIRED";
    readonly AUTH_INVALID_MFA: "AUTH_INVALID_MFA";
    readonly ORG_NOT_FOUND: "ORG_NOT_FOUND";
    readonly HTTP_ERROR: "HTTP_ERROR";
};
export type ErrorCode = keyof typeof ERROR_CODES;
