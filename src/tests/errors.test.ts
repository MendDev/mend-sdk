import { describe, it, expect } from 'vitest';
import { MendError, ERROR_CODES } from '../lib/errors';

describe('MendError', () => {
  it('should create an error with the correct properties', () => {
    const error = new MendError('Test error message', ERROR_CODES.SDK_CONFIG);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MendError);
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe(ERROR_CODES.SDK_CONFIG);
    expect(error.status).toBeUndefined();
  });

  it('should include HTTP status when provided', () => {
    const error = new MendError('HTTP error', ERROR_CODES.HTTP_ERROR, 404);

    expect(error.message).toBe('HTTP error');
    expect(error.code).toBe(ERROR_CODES.HTTP_ERROR);
    expect(error.status).toBe(404);
  });

  it('should attach details', () => {
    const detail = { message: 'Bad' };
    const error = new MendError('err', ERROR_CODES.HTTP_ERROR, 400, detail);

    expect(error.details).toEqual(detail);
  });

  it('should store context information', () => {
    const ctx = { url: 'http://x', method: 'GET', headers: { a: 'b' }, responseBody: 'oops' };
    const error = new MendError('err', ERROR_CODES.HTTP_ERROR, undefined, undefined, ctx);

    expect(error.context).toEqual(ctx);
  });

  it('should work correctly with instanceof checks', () => {
    const error = new MendError('Test error', ERROR_CODES.AUTH_MISSING_TOKEN);

    // This ensures that the prototype chain is properly set up
    expect(error instanceof MendError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
