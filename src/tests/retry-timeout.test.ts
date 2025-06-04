import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from '../lib/index';

let flakyCalls = 0;

const server = setupServer(
  http.post('https://api.example.com/session', () => {
    return HttpResponse.json({ token: 't', payload: { orgs: [{ id: 1 }] } });
  }),
  http.get('https://api.example.com/slow', async () => {
    await delay(200);
    return HttpResponse.json({ ok: true });
  }),
  http.get('https://api.example.com/flaky', () => {
    flakyCalls++;
    if (flakyCalls === 1) {
      return new HttpResponse('err', { status: 500 });
    }
    return HttpResponse.json({ ok: true });
  }),
);

beforeAll(() => server.listen());
afterEach(() => { flakyCalls = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe('timeout and retry', () => {
  it('times out requests', async () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'e',
      password: 'p',
      requestTimeout: 50,
    });

    await expect(sdk.request('GET', '/slow')).rejects.toHaveProperty('name', 'AbortError');
  });

  it('retries failed requests', async () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'e',
      password: 'p',
      retryAttempts: 1,
    });

    const res = await sdk.request('GET', '/flaky');
    expect((res as any).ok).toBe(true);
    expect(flakyCalls).toBe(2);
  });
});
