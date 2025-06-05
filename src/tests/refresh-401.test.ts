import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from '../lib/index';

let authCalls = 0;

const server = setupServer(
  http.post('https://api.example.com/session', () => {
    authCalls += 1;
    return HttpResponse.json({ token: `t${authCalls}`, payload: { orgs: [{ id: 1 }] } });
  }),
  http.put('https://api.example.com/session/org/:orgId', () => HttpResponse.json({ payload: { org_id: 1 } })),
  http.get('https://api.example.com/protected', ({ request }) => {
    const tok = request.headers.get('X-Access-Token');
    if (tok === 't1') return new HttpResponse('no', { status: 401 });
    return HttpResponse.json({ ok: true });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { authCalls = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe('401 refresh retry', () => {
  it('re-authenticates once on 401', async () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'e',
      password: 'p',
      orgId: 1,
    });

    const res = await sdk.request('GET', '/protected');
    expect((res as any).ok).toBe(true);
    expect(authCalls).toBe(2);
  });
});
