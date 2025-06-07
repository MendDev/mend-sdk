import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupMswServer, createTestSdk } from './utils/test-utils';
import { MendError } from '../lib/errors';

// Handlers specific to phone lookup and user exists
const server = setupMswServer([
  http.put('*/phone/lookup', async ({ request }) => {
    const body = (await request.json()) as { numbers: (string | number)[] };
    const results = body.numbers.map((n, idx) => ({
      id: idx + 1,
      orgId: 1,
      phoneNumber: String(n),
      isMobile: idx % 2 ? 0 : 1,
      validated: 1,
      suppress: 0,
    }));
    return HttpResponse.json({ payload: { numbers: results } });
  }),
  http.put('*/user/exists', async ({ request }) => {
    const body = (await request.json()) as Record<string, any>;
    const exists = body['email-or-phone'] === 'exists@example.com' ? 1 : 0;
    return HttpResponse.json({ payload: { user: { exists } } });
  }),
]);

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Phone lookup & user exists helpers', () => {
  const sdk = createTestSdk();

  it('should lookup phone numbers', async () => {
    const res = await sdk.lookupPhoneNumbers({ numbers: ['14075550100', 14075550200] });
    expect(res.payload.numbers).toHaveLength(2);
    expect(res.payload.numbers[0].isMobile).toBe(1);
  });

  it('should validate input for lookup', async () => {
    await expect(sdk.lookupPhoneNumbers({ numbers: [] })).rejects.toBeInstanceOf(MendError);
  });

  it('should detect existing user', async () => {
    const res = await sdk.checkUserExists({ 'email-or-phone': 'exists@example.com', orgId: 1 });
    expect(res.payload.user.exists).toBe(1);
  });

  it('should detect non-existing user', async () => {
    const res = await sdk.checkUserExists({ 'email-or-phone': 'new@example.com', orgId: 1 });
    expect(res.payload.user.exists).toBe(0);
  });

  it('should validate input for exists', async () => {
    await expect(sdk.checkUserExists({ orgId: 1 } as any)).rejects.toBeInstanceOf(MendError);
  });
});
