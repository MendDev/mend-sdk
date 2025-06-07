import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from '../lib/index';
import { MendError } from '../lib/errors';

const server = setupServer(
  http.put('https://api.example.com/phone/lookup', async ({ request }) => {
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
  http.put('https://api.example.com/user/exists', async ({ request }) => {
    const body = (await request.json()) as Record<string, any>;
    const exists = body['email-or-phone'] === 'exists@example.com' ? 1 : 0;
    return HttpResponse.json({ payload: { user: { exists } } });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Phone lookup & user exists helpers', () => {
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.example.com',
    email: 'svc@example.com',
    password: 'secret',
  });

  it('should lookup phone numbers', async () => {
    const res = await sdk.lookupPhoneNumbers({ numbers: ['14075550100', 14075550200] });
    expect(res.payload.numbers).toHaveLength(2);
    expect(res.payload.numbers[0].isMobile).toBe(1);
  });

  it('should validate input for lookup', async () => {
    // @ts-expect-error
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
    // @ts-expect-error
    await expect(sdk.checkUserExists({ orgId: 1 } as any)).rejects.toBeInstanceOf(MendError);
  });
});
