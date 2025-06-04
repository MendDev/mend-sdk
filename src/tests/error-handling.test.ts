import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk, { ERROR_CODES, MendError } from '../lib/index';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SDK error mapping', () => {
  it('maps MFA required responses', async () => {
    server.use(
      http.post('https://api.example.com/session', () =>
        HttpResponse.json({ message: 'MFA required' }, { status: 401 }),
      ),
    );

    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'user@example.com',
      password: 'secret',
      orgId: 1,
    });

    await expect(sdk.getUser(1)).rejects.toMatchObject({ code: ERROR_CODES.AUTH_MFA_REQUIRED });
  });

  it('maps invalid MFA code responses', async () => {
    server.use(
      http.put('https://api.example.com/session/mfa', () =>
        HttpResponse.json({ message: 'bad code' }, { status: 401 }),
      ),
    );

    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'user@example.com',
      password: 'secret',
      orgId: 1,
    });
    (sdk as any).jwt = 'token';

    await expect(sdk.submitMfaCode('000')).rejects.toMatchObject({ code: ERROR_CODES.AUTH_INVALID_MFA });
  });

  it('maps org not found responses', async () => {
    server.use(
      http.post('https://api.example.com/session', () =>
        HttpResponse.json({ token: 't', payload: { orgs: [{ id: 1 }] } }),
      ),
      http.put('https://api.example.com/session/org/99', () =>
        HttpResponse.json({ message: 'nope' }, { status: 404 }),
      ),
    );

    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'user@example.com',
      password: 'secret',
      orgId: 1,
    });

    await expect(sdk.switchOrg(99)).rejects.toMatchObject({ code: ERROR_CODES.ORG_NOT_FOUND });
  });
});
