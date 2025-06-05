import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from '../lib/index';
import { MendError, ERROR_CODES } from '../lib/errors';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('MendSdk constructor validation', () => {
  it('throws when apiEndpoint is missing', () => {
    expect(() => new MendSdk({ email: 'a', password: 'b' } as any)).toThrow(MendError);
  });

  it('throws when email is missing', () => {
    expect(() => new MendSdk({ apiEndpoint: 'x', password: 'b' } as any)).toThrow(MendError);
  });

  it('throws when password is missing', () => {
    expect(() => new MendSdk({ apiEndpoint: 'x', email: 'a' } as any)).toThrow(MendError);
  });
});

describe('MFA authentication flow', () => {
  it('submits MFA code when /session returns no token', async () => {
    server.use(
      http.post('https://api.example.com/session', () => HttpResponse.json({})),
      http.put('https://api.example.com/session/mfa', async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json({ token: 'mfa-token', payload: { orgs: [{ id: 123 }] }, received: body });
      }),
      http.put('https://api.example.com/session/org/:orgId', () => HttpResponse.json({ payload: { org_id: 123 } })),
      http.get('https://api.example.com/user/1', () => HttpResponse.json({ payload: { id: 1 } }))
    );

    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'secret',
      mfaCode: '123456',
      orgId: 123,
    });

    const spy = vi.spyOn(sdk as any, 'submitMfaCode');
    const result = await sdk.getUser(1);

    expect(result).toBeDefined();
    expect(spy).toHaveBeenCalledWith('123456', undefined);
    expect((sdk as any).mfaCode).toBeUndefined();
  });
});

describe('Concurrent authentication', () => {
  it('only authenticates once for parallel requests', async () => {
    let authCalls = 0;
    server.use(
      http.post('https://api.example.com/session', async () => {
        authCalls += 1;
        await new Promise(res => setTimeout(res, 50));
        return HttpResponse.json({ token: 'fake-jwt', payload: { orgs: [{ id: 123 }] } });
      }),
      http.put('https://api.example.com/session/org/:orgId', () => HttpResponse.json({ payload: { org_id: 123 } })),
      http.get('https://api.example.com/user/:id', ({ params }) => {
        return HttpResponse.json({ payload: { id: Number(params.id) } });
      })
    );

    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'secret',
      orgId: 123,
    });

    vi.useFakeTimers();
    const p1 = sdk.getUser(1);
    const p2 = sdk.getUser(2);
    await vi.advanceTimersByTimeAsync(60);
    const results = await Promise.all([p1, p2]);
    vi.useRealTimers();

    expect(results.length).toBe(2);
    expect(authCalls).toBe(1);
  });
});

describe('Security features', () => {
  it('throws on http endpoint in production', () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(() => new MendSdk({ apiEndpoint: 'http://api.example.com', email: 'a', password: 'b' })).toThrow(MendError);
    process.env.NODE_ENV = env;
  });

  it('allows http endpoint outside production with warning', () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sdk = new MendSdk({ apiEndpoint: 'http://api.example.com', email: 'a', password: 'b' });
    expect(sdk).toBeInstanceOf(MendSdk);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    process.env.NODE_ENV = env;
  });

  it('clears jwt on logout', async () => {
    server.use(
      http.post('https://api.example.com/session', () => HttpResponse.json({ token: 'tok', payload: { orgs: [{ id: 1 }] } })),
      http.put('https://api.example.com/session/org/:orgId', () => HttpResponse.json({ payload: { org_id: 1 } })),
      http.get('https://api.example.com/user/1', () => HttpResponse.json({ payload: { id: 1 } }))
    );

    const sdk = new MendSdk({ apiEndpoint: 'https://api.example.com', email: 'a', password: 'b', orgId: 1 });
    await sdk.getUser(1); // triggers login
    expect((sdk as any).jwt).toBe('tok');
    sdk.logout();
    expect((sdk as any).jwt).toBeNull();
    expect((sdk as any).jwtExpiresAt).toBe(0);
  });
});
